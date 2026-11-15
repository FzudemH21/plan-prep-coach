/**
 * Which athletes are the logged-in coach's own in an organization with several coaches — the
 * athletes assigned to them (Athlete.coachIds), plus athletes nobody is assigned to yet (so nothing
 * gets lost while assigning). Used for:
 *  - notifications (bell) and chat badges: only for these athletes
 *  - the athlete chat: only these athletes' coaches write; the others read without marking read
 *
 * In an organization with one coach (or before anything is known) every athlete counts as own.
 */
import { useCallback, useMemo } from 'react';
import { useRecordStore } from '@/lib/recordStore';
import { athleteStore } from '@/hooks/useAthletes';
import { useOrgCoaches, type OrgCoach } from '@/hooks/useOrgCoaches';
import type { Athlete } from '@/types/athlete';

export interface MyAthletes {
  /** The organization has several coaches — the rules apply */
  enabled: boolean;
  /** athleteLocalId (Athlete.id) of an athlete this coach looks after, or one nobody is assigned to */
  isMine: (athleteLocalId: string | null | undefined) => boolean;
  /** The coaches assigned to an athlete (for "Only … write here") */
  coachesOf: (athleteLocalId: string | null | undefined) => OrgCoach[];
}

export function useMyAthletes(): MyAthletes {
  const { coaches, myId, enabled } = useOrgCoaches();
  const [data] = useRecordStore(athleteStore);
  const byId = useMemo(
    () => new Map(((data?.athletes ?? []) as Athlete[]).map((a) => [a.id, a])),
    [data],
  );

  const isMine = useCallback((athleteLocalId: string | null | undefined) => {
    if (!enabled || !athleteLocalId) return true;
    const ids = byId.get(athleteLocalId)?.coachIds ?? [];
    return ids.length === 0 || (!!myId && ids.includes(myId));
  }, [enabled, byId, myId]);

  const coachesOf = useCallback((athleteLocalId: string | null | undefined) => {
    const ids = (athleteLocalId && byId.get(athleteLocalId)?.coachIds) || [];
    return coaches.filter((c) => ids.includes(c.userId));
  }, [byId, coaches]);

  return { enabled, isMine, coachesOf };
}
