import { useCallback, useRef } from 'react';
import { useSupabaseStore } from './useSupabaseStore';

export interface CalendarEvent {
  id: string;
  date: string; // ISO date string 'YYYY-MM-DD'
  type: 'test' | 'event';
  title: string;
  notes?: string;
  parameterId?: string;
  targetValue?: string;
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
  const [store, setStore] = useSupabaseStore<CalendarEventsStore>({
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
      (current()[athleteId] || []).filter(e => e.date === date),
    [current],
  );

  const getEventsForAthlete = useCallback(
    (athleteId: string): CalendarEvent[] => current()[athleteId] || [],
    [current],
  );

  const addEvent = useCallback(
    async (athleteId: string, event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
      const newEvent: CalendarEvent = {
        ...event,
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
        id: `ce-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      }));
      await write(cur => ({ ...cur, [athleteId]: [...(cur[athleteId] || []), ...newEvents] }));
      return newEvents;
    },
    [write],
  );

  const deleteEvent = useCallback(
    async (athleteId: string, eventId: string): Promise<void> => {
      await write(cur => ({ ...cur, [athleteId]: (cur[athleteId] || []).filter(e => e.id !== eventId) }));
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

  return { getEventsForDate, getEventsForAthlete, addEvent, addEvents, deleteEvent, updateEvent, deleteEventsForAthlete };
}
