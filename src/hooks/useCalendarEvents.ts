import { useCallback, useRef } from 'react';
import { useSupabaseStore } from './useSupabaseStore';
import { toParameterId } from '@/utils/parameterRef';

export interface CalendarEvent {
  id: string;
  date: string; // ISO date string 'YYYY-MM-DD'
  type: 'test' | 'event';
  title: string;
  notes?: string;
  parameterId?: string;
  targetValue?: string;
  /** Set when the test/event came with an assigned program — removed when that assignment is deleted */
  assignmentId?: string;
  /** Last day of an event over several days (inclusive, 'YYYY-MM-DD'); absent = one day */
  endDate?: string;
  /** A period the athlete entered in an anamnesis — kept in step with the answer */
  source?: AnamnesisEventSource;
  /** An anamnesis event the coach removed: kept as a marker so the sync doesn't add it again;
   *  hidden everywhere */
  dismissed?: boolean;
}

export interface AnamnesisEventSource {
  kind: 'anamnesis';
  recordId: string;
  fieldId: string;
  periodId: string;
}

/** Last day of the event (= its date for a one-day event) */
export function eventEndDate(e: Pick<CalendarEvent, 'date' | 'endDate'>): string {
  return e.endDate && e.endDate > e.date ? e.endDate : e.date;
}

export function isMultiDayEvent(e: Pick<CalendarEvent, 'date' | 'endDate'>): boolean {
  return eventEndDate(e) !== e.date;
}

/** Whether the event is on that day (multi-day events: every day from start to end) */
export function eventCoversDate(e: Pick<CalendarEvent, 'date' | 'endDate'>, date: string): boolean {
  return date >= e.date && date <= eventEndDate(e);
}

/** Every day of the event, 'YYYY-MM-DD' (capped at a year) */
export function eventDateList(e: Pick<CalendarEvent, 'date' | 'endDate'>): string[] {
  const end = eventEndDate(e);
  const out: string[] = [];
  const d = new Date(`${e.date}T12:00:00`);
  for (let i = 0; i < 366; i++) {
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (s > end) break;
    out.push(s);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Consecutive days → runs: ['2026-08-01','2026-08-02','2026-08-05'] → [[08-01, 08-02], [08-05, 08-05]] */
export function groupConsecutiveDates(dates: string[]): Array<[string, string]> {
  const sorted = [...new Set(dates.map(d => d.slice(0, 10)))].sort();
  const runs: Array<[string, string]> = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last) {
      const next = new Date(`${last[1]}T12:00:00`);
      next.setDate(next.getDate() + 1);
      const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      if (nextStr === d) { last[1] = d; continue; }
    }
    runs.push([d, d]);
  }
  return runs;
}

/** What an anamnesis sync changed — for the athlete app's schedule (old versions to take out, new ones to put in) */
export interface EventSyncChanges {
  upsert: CalendarEvent[];
  remove: CalendarEvent[];
}

type CalendarEventsStore = Record<string, CalendarEvent[]>;

/**
 * Newest events store across every mounted instance. Components keep callbacks with an older
 * render's store (e.g. the assign handler); writing "{...store, …}" from such a snapshot silently
 * dropped events added in the meantime — tests of a just-assigned program went missing. Reads and
 * writes go through this instead.
 */
let latestStore: CalendarEventsStore | null = null;

export function useCalendarEvents() {
  const [store, setStore, isLoading] = useSupabaseStore<CalendarEventsStore>({
    tableName: 'calendar_events',
    legacyKey: 'calendarEvents',
    defaultValue: {},
  });

  // A newly loaded / received store (Supabase load, another instance's write) becomes the latest
  const seenStoreRef = useRef<CalendarEventsStore | null>(null);
  if (seenStoreRef.current !== store) {
    seenStoreRef.current = store;
    latestStore = store;
  }
  const current = useCallback((): CalendarEventsStore => latestStore ?? store, [store]);

  /** Apply a change to the newest store and save it */
  const write = useCallback(async (update: (current: CalendarEventsStore) => CalendarEventsStore) => {
    const next = update(latestStore ?? store);
    latestStore = next;
    await setStore(next);
  }, [store, setStore]);

  const getEventsForDate = useCallback(
    (athleteId: string, date: string): CalendarEvent[] =>
      (current()[athleteId] || []).filter(e => !e.dismissed && eventCoversDate(e, date)),
    [current],
  );

  const getEventsForAthlete = useCallback(
    (athleteId: string): CalendarEvent[] => (current()[athleteId] || []).filter(e => !e.dismissed),
    [current],
  );

  const addEvent = useCallback(
    async (athleteId: string, event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
      const newEvent: CalendarEvent = {
        ...event,
        parameterId: toParameterId(event.parameterId),
        id: `ce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      await write(cur => ({ ...cur, [athleteId]: [...(cur[athleteId] || []), newEvent] }));
      return newEvent;
    },
    [write],
  );

  // Batch-add multiple events in a single store write
  const addEvents = useCallback(
    async (athleteId: string, events: Array<Omit<CalendarEvent, 'id'>>): Promise<CalendarEvent[]> => {
      if (events.length === 0) return [];
      const newEvents: CalendarEvent[] = events.map((event, i) => ({
        ...event,
        parameterId: toParameterId(event.parameterId),
        id: `ce-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      }));
      await write(cur => ({ ...cur, [athleteId]: [...(cur[athleteId] || []), ...newEvents] }));
      return newEvents;
    },
    [write],
  );

  const deleteEvent = useCallback(
    async (athleteId: string, eventId: string): Promise<void> => {
      // An event from an anamnesis stays as a hidden marker — otherwise the next sync adds it again
      await write(cur => ({
        ...cur,
        [athleteId]: (cur[athleteId] || []).flatMap(e => (e.id !== eventId ? [e] : e.source ? [{ ...e, dismissed: true }] : [])),
      }));
    },
    [write],
  );

  /**
   * Keeps the athlete's anamnesis events in step with the periods in their answers (one store
   * write). `desired` = every period of the records the sync manages (also past ones, so their
   * events aren't removed); new periods that are already over are not added. Events of records
   * in `untouchedRecordIds` (a form still being filled in) stay as they are; events of records
   * that no longer exist are removed. Removed-by-the-coach markers stay while the period exists.
   */
  const syncAnamnesisEvents = useCallback(
    async (
      athleteId: string,
      desired: Array<Omit<CalendarEvent, 'id' | 'source'> & { source: AnamnesisEventSource }>,
      untouchedRecordIds: Set<string>,
      today: string,
    ): Promise<EventSyncChanges> => {
      const key = (s: AnamnesisEventSource) => `${s.recordId}|${s.fieldId}|${s.periodId}`;
      const changes: EventSyncChanges = { upsert: [], remove: [] };
      await write(cur => {
        const list = cur[athleteId] || [];
        const wanted = new Map(desired.map(d => [key(d.source), d]));
        const seen = new Set<string>();
        let changed = false;
        const next: CalendarEvent[] = [];
        for (const e of list) {
          if (!e.source || untouchedRecordIds.has(e.source.recordId)) { next.push(e); continue; }
          const k = key(e.source);
          const want = wanted.get(k);
          if (!want || seen.has(k)) {
            // Period gone (answer changed, record deleted) or a duplicate
            changed = true;
            if (!e.dismissed) changes.remove.push(e);
            continue;
          }
          seen.add(k);
          if (e.dismissed) { next.push(e); continue; }
          const same = e.title === want.title && e.date === want.date && (e.endDate ?? '') === (want.endDate ?? '')
            && (e.notes ?? '') === (want.notes ?? '');
          if (same) { next.push(e); continue; }
          const updated: CalendarEvent = { ...e, title: want.title, date: want.date, endDate: want.endDate, notes: want.notes };
          changed = true;
          changes.remove.push(e);
          changes.upsert.push(updated);
          next.push(updated);
        }
        desired.forEach((d, i) => {
          const k = key(d.source);
          if (seen.has(k) || eventEndDate(d) < today) return;
          seen.add(k);
          const added: CalendarEvent = { ...d, id: `ce-${Date.now()}-a${i}-${Math.random().toString(36).slice(2, 9)}` };
          changed = true;
          changes.upsert.push(added);
          next.push(added);
        });
        return changed ? { ...cur, [athleteId]: next } : cur;
      });
      return changes;
    },
    [write],
  );

  /** Remove every event of the athlete matching the predicate (one store write) */
  const deleteEventsWhere = useCallback(
    async (athleteId: string, predicate: (e: CalendarEvent) => boolean): Promise<number> => {
      let removed = 0;
      await write(cur => {
        const list = cur[athleteId] || [];
        const kept = list.filter(e => !predicate(e));
        removed = list.length - kept.length;
        return removed > 0 ? { ...cur, [athleteId]: kept } : cur;
      });
      return removed;
    },
    [write],
  );

  const updateEvent = useCallback(
    async (
      athleteId: string,
      eventId: string,
      updates: Partial<Omit<CalendarEvent, 'id' | 'date'>>,
    ): Promise<void> => {
      await write(cur => ({
        ...cur,
        [athleteId]: (cur[athleteId] || []).map(e => (e.id === eventId ? { ...e, ...updates } : e)),
      }));
    },
    [write],
  );

  const deleteEventsForAthlete = useCallback(
    async (athleteId: string): Promise<void> => {
      await write(cur => {
        const updated = { ...cur };
        delete updated[athleteId];
        return updated;
      });
    },
    [write],
  );

  /** Old "bio:{id}" test links → the biometric parameter's id (body metrics moved to the parameter database) */
  const normalizeParameterRefs = useCallback(async (): Promise<number> => {
    let changed = 0;
    await write(cur => {
      const next: CalendarEventsStore = {};
      for (const [athleteId, events] of Object.entries(cur)) {
        next[athleteId] = events.map(e => {
          if (!e.parameterId?.startsWith('bio:')) return e;
          changed++;
          return { ...e, parameterId: toParameterId(e.parameterId) };
        });
      }
      return next;
    });
    return changed;
  }, [write]);

  /** Test links rewritten (`remap` returns the new reference, null = unchanged); returns the changed events per athlete */
  const remapParameterRefs = useCallback(async (remap: (ref: string) => string | null): Promise<Record<string, CalendarEvent[]>> => {
    const changed: Record<string, CalendarEvent[]> = {};
    await write(cur => {
      const next: CalendarEventsStore = {};
      for (const [athleteId, events] of Object.entries(cur)) {
        next[athleteId] = events.map(e => {
          const ref = e.parameterId ? remap(e.parameterId) : null;
          if (ref === null) return e;
          const moved = { ...e, parameterId: ref };
          (changed[athleteId] ??= []).push(moved);
          return moved;
        });
      }
      return next;
    });
    return changed;
  }, [write]);

  return {
    getEventsForDate, getEventsForAthlete, addEvent, addEvents, deleteEvent, deleteEventsWhere, updateEvent, deleteEventsForAthlete,
    syncAnamnesisEvents,
    normalizeParameterRefs, remapParameterRefs, isLoaded: !isLoading,
  };
}
