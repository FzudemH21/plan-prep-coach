/**
 * The coaches of the logged-in coach's organization, for assigning athletes to coaches
 * (Athlete.coachIds) and the "My athletes / All" filter.
 *
 * Assignment is only a label for "who looks after this athlete" — every coach of the organization
 * still sees and works with every athlete (access comes from the rights grid). The filter and the
 * assignment controls only show when the organization has more than one coach.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Athlete } from '@/types/athlete';

export interface OrgCoach {
  userId: string;
  /** Name from the coach profile, else the e-mail */
  label: string;
  initials: string;
}

interface MemberRow { user_id: string; email: string | null; name: string | null }

function initialsOf(label: string): string {
  const base = label.includes('@') ? label.split('@')[0] : label;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

// One lookup per login (the member list rarely changes; a reload picks up new members)
const cache = new Map<string, Promise<OrgCoach[]>>();

function loadCoaches(userId: string): Promise<OrgCoach[]> {
  let p = cache.get(userId);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.rpc('get_org_members');
      if (error) { cache.delete(userId); return []; }
      return ((data ?? []) as MemberRow[]).map((r) => {
        const label = r.name?.trim() || r.email || 'Coach';
        return { userId: r.user_id, label, initials: initialsOf(label) };
      });
    })();
    cache.set(userId, p);
  }
  return p;
}

export function useOrgCoaches(): { coaches: OrgCoach[]; myId: string | null; enabled: boolean } {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState<OrgCoach[]>([]);
  useEffect(() => {
    if (!user) { setCoaches([]); return; }
    let cancelled = false;
    void loadCoaches(user.id).then((c) => { if (!cancelled) setCoaches(c); });
    return () => { cancelled = true; };
  }, [user]);
  return { coaches, myId: user?.id ?? null, enabled: coaches.length > 1 };
}

export type CoachFilter = 'mine' | 'all';

const filterKey = (userId: string) => `athlete-coach-filter:${userId}`;

/** "My athletes / All", remembered per coach in this browser (falls back to All) */
export function useCoachFilter(): [CoachFilter, (f: CoachFilter) => void] {
  const { user } = useAuth();
  const [filter, setFilterState] = useState<CoachFilter>('all');
  useEffect(() => {
    if (!user) return;
    try {
      setFilterState(localStorage.getItem(filterKey(user.id)) === 'mine' ? 'mine' : 'all');
    } catch { /* storage blocked — keep All */ }
  }, [user]);
  const setFilter = useCallback((f: CoachFilter) => {
    setFilterState(f);
    if (!user) return;
    try { localStorage.setItem(filterKey(user.id), f); } catch { /* not remembered */ }
  }, [user]);
  return [filter, setFilter];
}

export function isAssignedTo(athlete: Athlete, userId: string | null): boolean {
  return !!userId && (athlete.coachIds ?? []).includes(userId);
}

/** The athlete's coach ids with one coach added or removed */
export function toggledCoachIds(athlete: Athlete, coachId: string): string[] {
  const current = athlete.coachIds ?? [];
  return current.includes(coachId) ? current.filter((id) => id !== coachId) : [...current, coachId];
}
