import { useLocalStorage } from './useLocalStorage';

export interface CalendarEvent {
  id: string;
  date: string; // ISO date string 'YYYY-MM-DD'
  type: 'test' | 'event';
  title: string;
  notes?: string;
  parameterId?: string;  // Links to ParameterV2.id in Parameter Database
  targetValue?: string;  // Goal value for the test (stored); baseline is loaded live from athlete profile
}

type CalendarEventsStore = Record<string, CalendarEvent[]>;

export function useCalendarEvents() {
  const [store, setStore] = useLocalStorage<CalendarEventsStore>('calendarEvents', {});

  const getEventsForDate = (athleteId: string, date: string): CalendarEvent[] =>
    (store[athleteId] || []).filter(e => e.date === date);

  const getEventsForAthlete = (athleteId: string): CalendarEvent[] =>
    store[athleteId] || [];

  const addEvent = (athleteId: string, event: Omit<CalendarEvent, 'id'>): CalendarEvent => {
    const newEvent: CalendarEvent = {
      ...event,
      id: `ce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setStore(prev => ({
      ...prev,
      [athleteId]: [...(prev[athleteId] || []), newEvent],
    }));
    return newEvent;
  };

  const deleteEvent = (athleteId: string, eventId: string): void => {
    setStore(prev => ({
      ...prev,
      [athleteId]: (prev[athleteId] || []).filter(e => e.id !== eventId),
    }));
  };

  const updateEvent = (
    athleteId: string,
    eventId: string,
    updates: Partial<Omit<CalendarEvent, 'id' | 'date'>>
  ): void => {
    setStore(prev => ({
      ...prev,
      [athleteId]: (prev[athleteId] || []).map(e =>
        e.id === eventId ? { ...e, ...updates } : e
      ),
    }));
  };

  return { getEventsForDate, getEventsForAthlete, addEvent, deleteEvent, updateEvent };
}
