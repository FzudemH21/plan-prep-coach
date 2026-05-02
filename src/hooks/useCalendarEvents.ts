import { useCallback } from 'react';
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

export function useCalendarEvents() {
  const [store, setStore] = useSupabaseStore<CalendarEventsStore>({
    tableName: 'calendar_events',
    legacyKey: 'calendarEvents',
    defaultValue: {},
  });

  const getEventsForDate = useCallback(
    (athleteId: string, date: string): CalendarEvent[] =>
      (store[athleteId] || []).filter(e => e.date === date),
    [store],
  );

  const getEventsForAthlete = useCallback(
    (athleteId: string): CalendarEvent[] => store[athleteId] || [],
    [store],
  );

  const addEvent = useCallback(
    async (athleteId: string, event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
      const newEvent: CalendarEvent = {
        ...event,
        id: `ce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      await setStore({ ...store, [athleteId]: [...(store[athleteId] || []), newEvent] });
      return newEvent;
    },
    [store, setStore],
  );

  const deleteEvent = useCallback(
    async (athleteId: string, eventId: string): Promise<void> => {
      await setStore({
        ...store,
        [athleteId]: (store[athleteId] || []).filter(e => e.id !== eventId),
      });
    },
    [store, setStore],
  );

  const updateEvent = useCallback(
    async (
      athleteId: string,
      eventId: string,
      updates: Partial<Omit<CalendarEvent, 'id' | 'date'>>,
    ): Promise<void> => {
      await setStore({
        ...store,
        [athleteId]: (store[athleteId] || []).map(e =>
          e.id === eventId ? { ...e, ...updates } : e
        ),
      });
    },
    [store, setStore],
  );

  const deleteEventsForAthlete = useCallback(
    async (athleteId: string): Promise<void> => {
      const updated = { ...store };
      delete updated[athleteId];
      await setStore(updated);
    },
    [store, setStore],
  );

  return { getEventsForDate, getEventsForAthlete, addEvent, deleteEvent, updateEvent, deleteEventsForAthlete };
}
