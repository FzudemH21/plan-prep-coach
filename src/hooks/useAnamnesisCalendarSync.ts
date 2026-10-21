/**
 * useAnamnesisCalendarSync — periods the athlete enters in an anamnesis calendar question
 * (competitions, holidays, travel, camps …) land in their calendar as events, one event per period
 * (over several days where the period has them), and from there in the athlete app.
 *
 * Runs while the athlete's profile is open and whenever an anamnesis of the athlete changes
 * (`notifyAnamnesisChanged`). Only submitted or coach-made records count — a form link the athlete
 * is still filling in stays out until it is submitted. The events stay linked to their period: a
 * changed answer changes the event, a removed period or a deleted record removes it; an event the
 * coach removed in the calendar is not added again. Periods already over are not added.
 *
 * Also puts the athlete's upcoming events into the athlete app once they have connected (events
 * entered before the connection otherwise reached the app only with a program sync).
 */
import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { eventEndDate, useCalendarEvents, type AnamnesisEventSource, type CalendarEvent } from '@/hooks/useCalendarEvents';
import { patchScheduleEvents } from '@/utils/athleteScheduleSync';
import { contextFor, fieldState, parseDateRanges } from '@/utils/anamnesisAnswers';
import type { AnamnesisTemplateSnapshot } from '@/types/anamnesis';

const CHANGED_EVENT = 'ppc:anamnesis-changed';

/** Tell the sync that an anamnesis of this athlete was created, changed or deleted */
export function notifyAnamnesisChanged(athleteLocalId: string): void {
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: athleteLocalId }));
}

interface RecordRow {
  id: string;
  form_status: 'sent' | 'submitted' | null;
  template_snapshot: AnamnesisTemplateSnapshot | null;
  field_values: Record<string, string> | null;
}

/** Title of the event: the name the athlete typed, else its type, else a neutral word */
function periodTitle(label: string, kind?: string): string {
  return label.trim() || kind?.trim() || 'Event (anamnesis)';
}

export function useAnamnesisCalendarSync(athleteLocalId: string, sex: string | null | undefined, connectionId: string | null) {
  const { user } = useAuth();
  const { syncAnamnesisEvents, getEventsForAthlete, isLoaded } = useCalendarEvents();
  const [tick, setTick] = useState(0);
  const pushedFor = useRef<string | null>(null);
  const getEventsRef = useRef(getEventsForAthlete);
  getEventsRef.current = getEventsForAthlete;
  // Through a ref: the function changes with every store write, which shouldn't re-run the sync
  const syncRef = useRef(syncAnamnesisEvents);
  syncRef.current = syncAnamnesisEvents;

  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e as CustomEvent<string>).detail === athleteLocalId) setTick(t => t + 1);
    };
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHANGED_EVENT, onChange);
  }, [athleteLocalId]);

  useEffect(() => {
    if (!user || !athleteLocalId || !isLoaded) return;
    let cancelled = false;
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('athlete_anamneses')
        .select('id, form_status, template_snapshot, field_values')
        .eq('coach_user_id', user.id)
        .eq('athlete_local_id', athleteLocalId);
      // Without the records nothing is changed — an empty answer here would remove every event
      if (error || cancelled) return;

      const desired: Array<Omit<CalendarEvent, 'id' | 'source'> & { source: AnamnesisEventSource }> = [];
      const untouched = new Set<string>();
      for (const row of (data ?? []) as RecordRow[]) {
        if (row.form_status === 'sent') { untouched.add(row.id); continue; }
        const sections = row.template_snapshot?.sections ?? [];
        const values = row.field_values ?? {};
        const ctx = contextFor(sections, values, sex);
        for (const section of sections) {
          for (const field of section.fields) {
            if (field.fieldType !== 'dateRanges') continue;
            // Answers of questions hidden by their condition don't count
            if (fieldState(section, field, ctx) === 'notMet') continue;
            for (const p of parseDateRanges(values[field.id])) {
              const [from, to] = p.from <= p.to ? [p.from, p.to] : [p.to, p.from];
              desired.push({
                type: 'event',
                title: periodTitle(p.label, p.kind),
                date: from,
                ...(to > from ? { endDate: to } : {}),
                source: { kind: 'anamnesis', recordId: row.id, fieldId: field.id, periodId: p.id },
              });
            }
          }
        }
      }

      const changes = await syncRef.current(athleteLocalId, desired, untouched, today);
      if (cancelled || !connectionId) return;

      // Into the athlete app: what the sync changed; and once per connection every upcoming event
      // the app doesn't have yet (entered before the athlete connected)
      const firstPush = pushedFor.current !== `${athleteLocalId}|${connectionId}`;
      pushedFor.current = `${athleteLocalId}|${connectionId}`;
      try {
        if (changes.upsert.length > 0 || changes.remove.length > 0) await patchScheduleEvents(connectionId, changes);
        if (firstPush) {
          const upcoming = getEventsRef.current(athleteLocalId).filter(e => eventEndDate(e) >= today);
          await patchScheduleEvents(connectionId, { upsert: upcoming }, { onlyMissing: true });
        }
      } catch (e) {
        console.error('[anamnesis → calendar] app schedule update failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user, athleteLocalId, sex, connectionId, isLoaded, tick]);
}
