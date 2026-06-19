/**
 * useCoachActivityFeed
 *
 * Fetches the last 7 days of activity across all connected athletes:
 *   - Session completions (athlete_session_logs.completed_at)
 *   - Daily check-in submissions (athlete_daily_checkins.created_at)
 *
 * "Unread" state is tracked per-item via a localStorage set of read IDs.
 * Items are unread by default; clicking one or pressing "Mark all as read"
 * adds their IDs to the set.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AthleteConnection } from '@/hooks/useAthleteConnections';

const READ_IDS_KEY = 'ppc-coach-activity-read-ids';
const FEED_WINDOW_DAYS = 7;

export type FeedItemType = 'session_complete' | 'checkin';
export type FeedFlag = 'illness' | 'low_wellness' | 'pain';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  connectionId: string;
  athleteName: string;
  athleteLocalId: string;
  /** ISO timestamp used for sorting */
  timestamp: string;
  description: string;
  flag?: FeedFlag;
  /** yyyy-MM-dd — only set for session_complete items, used for direct navigation */
  date?: string;
  /** session_id from athlete_session_logs — only set for session_complete items */
  sessionId?: string;
}

function loadReadIds(): Set<string> {
  try {
    const stored = localStorage.getItem(READ_IDS_KEY);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function saveReadIds(ids: Set<string>): void {
  localStorage.setItem(READ_IDS_KEY, JSON.stringify([...ids]));
}

function wellnessComposite(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null);
  return valid.length === 5 ? valid.reduce((a, b) => a + b, 0) / 5 : null;
}

export function useCoachActivityFeed(connections: AthleteConnection[]) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);

  const connectedIds = connections
    .filter((c) => c.connectedAt)
    .map((c) => c.id);

  const connMap = new Map(connections.map((c) => [c.id, c]));

  const load = useCallback(async () => {
    if (connectedIds.length === 0) {
      setItems([]);
      return;
    }
    setLoading(true);

    const windowStart = new Date(
      Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const [sessionsRes, checkinsRes] = await Promise.all([
      supabase
        .from('athlete_session_logs')
        .select(
          'id, athlete_connection_id, session_id, session_name, date, completed_at, borg_rating, duration_seconds'
        )
        .in('athlete_connection_id', connectedIds)
        .not('completed_at', 'is', null)
        .gte('completed_at', windowStart)
        .order('completed_at', { ascending: false }),

      supabase
        .from('athlete_daily_checkins')
        .select(
          'id, athlete_connection_id, date, created_at, has_illness, illness_nrs, has_pain, wellness_fatigue, wellness_sleep, wellness_soreness, wellness_stress, wellness_mood'
        )
        .in('athlete_connection_id', connectedIds)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: false }),
    ]);

    const feed: FeedItem[] = [];

    for (const row of sessionsRes.data ?? []) {
      const conn = connMap.get(row.athlete_connection_id as string);
      if (!conn) continue;

      const rpe = row.borg_rating != null ? ` · RPE ${row.borg_rating}` : '';
      const dur =
        row.duration_seconds != null
          ? ` · ${Math.round((row.duration_seconds as number) / 60)} min`
          : '';

      feed.push({
        id: `sess-${row.id as string}`,
        type: 'session_complete',
        connectionId: conn.id,
        athleteName: conn.athleteName,
        athleteLocalId: conn.athleteLocalId,
        timestamp: row.completed_at as string,
        description: `Completed "${row.session_name as string}"${dur}${rpe}`,
        date: row.date as string,
        sessionId: row.session_id as string,
      });
    }

    for (const row of checkinsRes.data ?? []) {
      const conn = connMap.get(row.athlete_connection_id as string);
      if (!conn) continue;

      let flag: FeedFlag | undefined;
      if (row.has_illness) {
        flag = 'illness';
      } else {
        const composite = wellnessComposite([
          row.wellness_fatigue as number | null,
          row.wellness_sleep as number | null,
          row.wellness_soreness as number | null,
          row.wellness_stress as number | null,
          row.wellness_mood as number | null,
        ]);
        if (composite !== null && composite < 2.5) {
          flag = 'low_wellness';
        } else if (row.has_pain) {
          flag = 'pain';
        }
      }

      const flagLabel = flag === 'illness'
        ? ' — illness reported'
        : flag === 'low_wellness'
        ? ' — low wellness'
        : flag === 'pain'
        ? ' — pain reported'
        : '';

      feed.push({
        id: `ci-${row.id as string}`,
        type: 'checkin',
        connectionId: conn.id,
        athleteName: conn.athleteName,
        athleteLocalId: conn.athleteLocalId,
        timestamp: row.created_at as string,
        description: `Submitted daily check-in${flagLabel}`,
        flag,
      });
    }

    feed.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setItems(feed);
    setLoading(false);
  }, [connectedIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const markItemRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  /** Mark every currently visible item as read (used by "Mark all as read" + onClose). */
  const markSeen = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      items.forEach(item => next.add(item.id));
      saveReadIds(next);
      return next;
    });
  }, [items]);

  const unseenCount = items.filter(item => !readIds.has(item.id)).length;

  return { items, loading, unseenCount, markSeen, markItemRead, readIds };
}
