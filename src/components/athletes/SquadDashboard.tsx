/**
 * SquadDashboard
 *
 * Displays all non-archived athletes (filtered by group) with real-time
 * monitoring data pulled from the athlete app.
 *
 * Two sub-views, toggled with the List/Card buttons:
 *   List — compact table, great for large squads
 *   Card — detailed cards with wellness-coloured header strip
 *
 * Sort order: most-concerning athletes first (poor wellness + flags → poor →
 * moderate + flags → moderate → good → no check-in → not connected).
 */

import { useMemo, useState } from 'react';
import {
  LayoutGrid,
  List,
  Thermometer,
  Zap,
  Users,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useSquadOverview,
  type AthleteSquadSummary,
  type WellnessStatus,
} from '@/hooks/useSquadOverview';
import type { Athlete, AthleteGroup } from '@/types/athlete';
import { getAthleteDisplayName } from '@/types/athlete';
import type { AthleteConnection } from '@/hooks/useAthleteConnections';

// ── Wellness config ───────────────────────────────────────────────────────────

interface WellnessConfig {
  label: string;
  dotClass: string;
  borderClass: string;
  textClass: string;
  bgClass: string;
  avatarBorderClass: string;
  avatarTextClass: string;
}

const WELLNESS: Record<WellnessStatus, WellnessConfig> = {
  good: {
    label:           'Good',
    dotClass:        'bg-emerald-500',
    borderClass:     'border-l-emerald-400',
    textClass:       'text-emerald-700',
    bgClass:         'bg-emerald-50',
    avatarBorderClass: 'border-emerald-300',
    avatarTextClass:   'text-emerald-800',
  },
  moderate: {
    label:           'Moderate',
    dotClass:        'bg-amber-400',
    borderClass:     'border-l-amber-400',
    textClass:       'text-amber-700',
    bgClass:         'bg-amber-50',
    avatarBorderClass: 'border-amber-300',
    avatarTextClass:   'text-amber-800',
  },
  poor: {
    label:           'Poor',
    dotClass:        'bg-red-500',
    borderClass:     'border-l-red-400',
    textClass:       'text-red-700',
    bgClass:         'bg-red-50',
    avatarBorderClass: 'border-red-300',
    avatarTextClass:   'text-red-800',
  },
  unknown: {
    label:           'No data',
    dotClass:        'bg-slate-300',
    borderClass:     'border-l-border',
    textClass:       'text-muted-foreground',
    bgClass:         'bg-muted/30',
    avatarBorderClass: 'border-border',
    avatarTextClass:   'text-muted-foreground',
  },
};

// ── Sort priority ─────────────────────────────────────────────────────────────

// Lower number = shown first (more concerning)
const STATUS_PRIORITY: Record<WellnessStatus, number> = {
  poor: 0, moderate: 2, good: 4, unknown: 6,
};

function sortScore(summary: AthleteSquadSummary | null): number {
  if (!summary) return 8; // not connected → last
  const base = STATUS_PRIORITY[summary.wellnessStatus];
  return (summary.hasPainFlag || summary.hasIllnessFlag) ? base - 1 : base;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Reusable mini-components ─────────────────────────────────────────────────

function WellnessDot({ status }: { status: WellnessStatus }) {
  return (
    <span className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', WELLNESS[status].dotClass)} />
  );
}

function FlagIcons({ summary }: { summary: AthleteSquadSummary }) {
  if (!summary.hasPainFlag && !summary.hasIllnessFlag) return null;
  return (
    <div className="flex items-center gap-1">
      {summary.hasPainFlag && (
        <Zap className="h-3.5 w-3.5 text-orange-500 shrink-0" title="Pain reported" />
      )}
      {summary.hasIllnessFlag && (
        <Thermometer className="h-3.5 w-3.5 text-purple-500 shrink-0" title="Illness reported" />
      )}
    </div>
  );
}

function AUCell({ weekAU, avgWeeklyAU }: { weekAU: number; avgWeeklyAU: number }) {
  if (weekAU === 0 && avgWeeklyAU === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const hasHistory = avgWeeklyAU > 0;
  const delta = hasHistory
    ? Math.round(((weekAU - avgWeeklyAU) / avgWeeklyAU) * 100)
    : null;
  const elevated = delta !== null && delta > 15;
  return (
    <span>
      <span className="font-medium">{weekAU}</span>
      {hasHistory && (
        <span className={cn('ml-1 text-xs', elevated ? 'text-amber-600' : 'text-muted-foreground')}>
          avg {avgWeeklyAU}
        </span>
      )}
    </span>
  );
}

function ComplianceCell({ completed, planned }: { completed: number; planned: number }) {
  if (planned === 0) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round((completed / planned) * 100);
  return (
    <span className={pct < 60 ? 'text-amber-600' : ''}>
      {completed}/{planned}
      <span className="ml-1 text-xs text-muted-foreground">({pct}%)</span>
    </span>
  );
}

// ── Card view ─────────────────────────────────────────────────────────────────

interface AthleteCardProps {
  name: string;
  summary: AthleteSquadSummary | null;
  onClick: () => void;
}

function AthleteCard({ name, summary, onClick }: AthleteCardProps) {
  const status = summary?.wellnessStatus ?? 'unknown';
  const cfg = WELLNESS[status];

  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left w-full rounded-lg border border-l-4 bg-card',
        'hover:shadow-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'flex flex-col aspect-[4/3] overflow-hidden',
        cfg.borderClass,
      )}
    >
      {/* Coloured header strip */}
      <div className={cn('px-4 pt-4 pb-3', cfg.bgClass)}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center',
            'text-sm font-bold shrink-0 border-2',
            cfg.bgClass,
            cfg.avatarBorderClass,
            cfg.avatarTextClass,
          )}>
            {getInitials(name)}
          </div>

          {/* Name + wellness line */}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="font-semibold text-sm leading-tight truncate">{name}</p>
            {summary ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <WellnessDot status={status} />
                <span className={cn('text-xs font-medium', cfg.textClass)}>{cfg.label}</span>
                {summary.wellnessComposite !== null && (
                  <span className="text-xs text-muted-foreground">
                    {summary.wellnessComposite}/5
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Not connected</p>
            )}
          </div>

          {/* Flags */}
          {summary && (
            <div className="shrink-0">
              <FlagIcons summary={summary} />
            </div>
          )}
        </div>
      </div>

      {/* Stats body */}
      {summary ? (
        <div className="px-4 py-3 flex-1 flex flex-col justify-between text-sm">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Week AU</span>
              <AUCell weekAU={summary.weekAU} avgWeeklyAU={summary.avgWeeklyAU} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Sessions</span>
              <ComplianceCell
                completed={summary.weekCompletedSessions}
                planned={summary.weekPlannedSessions}
              />
            </div>
          </div>
          {summary.wellnessDate && (
            <p className="text-[10px] text-muted-foreground/60 pt-2 border-t border-border/40 mt-2">
              Last check-in: {summary.wellnessDate}
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 flex-1">
          <p className="text-xs text-muted-foreground">No app data yet</p>
        </div>
      )}
    </button>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

interface AthleteListRowProps {
  name: string;
  summary: AthleteSquadSummary | null;
  onClick: () => void;
}

function AthleteListRow({ name, summary, onClick }: AthleteListRowProps) {
  const status = summary?.wellnessStatus ?? 'unknown';
  const cfg = WELLNESS[status];

  return (
    <tr
      className="hover:bg-muted/40 cursor-pointer transition-colors border-b border-border/40 last:border-0"
      onClick={onClick}
    >
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <WellnessDot status={status} />
          <span className="text-sm font-medium">{name}</span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-sm">
        {summary ? (
          <span className={cfg.textClass}>
            {summary.wellnessComposite !== null
              ? `${summary.wellnessComposite}/5`
              : cfg.label}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Not connected</span>
        )}
      </td>
      <td className="py-2.5 px-3">
        {summary ? <FlagIcons summary={summary} /> : null}
      </td>
      <td className="py-2.5 px-3 text-sm">
        {summary ? (
          <AUCell weekAU={summary.weekAU} avgWeeklyAU={summary.avgWeeklyAU} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-sm">
        {summary ? (
          <ComplianceCell
            completed={summary.weekCompletedSessions}
            planned={summary.weekPlannedSessions}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SquadDashboardProps {
  athletes: Athlete[];
  groups: AthleteGroup[];
  connections: AthleteConnection[];
  viewMode: 'list' | 'card';
  onViewModeChange: (mode: 'list' | 'card') => void;
  onSelectAthlete: (id: string) => void;
}

export function SquadDashboard({
  athletes,
  groups,
  connections,
  viewMode,
  onViewModeChange,
  onSelectAthlete,
}: SquadDashboardProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Filter to selected group (or all)
  const filteredAthletes = useMemo(
    () =>
      selectedGroupId
        ? athletes.filter(a => a.groupIds.includes(selectedGroupId))
        : athletes,
    [athletes, selectedGroupId],
  );

  // Fast connection lookup by local athlete id
  const connByAthleteId = useMemo(
    () => new Map(connections.map(c => [c.athleteLocalId, c])),
    [connections],
  );

  // Stable list of connections to pass to the overview hook
  const connectedConns = useMemo(
    () =>
      filteredAthletes.flatMap(a => {
        const c = connByAthleteId.get(a.id);
        return c
          ? [{ id: c.id, athleteLocalId: c.athleteLocalId, athleteName: c.athleteName }]
          : [];
      }),
    [filteredAthletes, connByAthleteId],
  );

  const { summaries, loading } = useSquadOverview(connectedConns);

  const summaryByConnId = useMemo(
    () => new Map(summaries.map(s => [s.connectionId, s])),
    [summaries],
  );

  // Build display items sorted by alert priority
  const displayItems = useMemo(() => {
    const items = filteredAthletes.map(a => {
      const conn    = connByAthleteId.get(a.id);
      const summary = conn ? (summaryByConnId.get(conn.id) ?? null) : null;
      return { athlete: a, summary };
    });
    return items.sort((a, b) => {
      const da = sortScore(a.summary);
      const db = sortScore(b.summary);
      if (da !== db) return da - db;
      return getAthleteDisplayName(a.athlete).localeCompare(
        getAthleteDisplayName(b.athlete),
      );
    });
  }, [filteredAthletes, connByAthleteId, summaryByConnId]);

  const connectedCount = displayItems.filter(i => i.summary !== null).length;
  const flaggedCount   = displayItems.filter(
    i => i.summary && (i.summary.hasPainFlag || i.summary.hasIllnessFlag),
  ).length;

  // Group filter chip list: "All athletes" + each named group
  const groupChips = useMemo(
    () => [
      { id: null as string | null, name: 'All athletes' },
      ...groups.map(g => ({ id: g.id as string | null, name: g.name })),
    ],
    [groups],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Squad Overview</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </span>
            ) : (
              <>
                <span>{connectedCount}/{displayItems.length} connected</span>
                {flaggedCount > 0 && (
                  <span className="text-orange-600 font-medium">
                    · {flaggedCount} flagged
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* View-mode toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            title="List view"
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            title="Card view"
            onClick={() => onViewModeChange('card')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Group filter chips ── */}
      {groups.length > 0 && (
        <div className="flex gap-1.5 flex-wrap pb-3 shrink-0">
          {groupChips.map(({ id, name }) => (
            <button
              key={id ?? 'all'}
              onClick={() => setSelectedGroupId(id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                selectedGroupId === id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/60 border-transparent hover:bg-muted text-muted-foreground',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <ScrollArea className="flex-1">
        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">No athletes in this group.</p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 pr-3 pb-3">
            {displayItems.map(({ athlete, summary }) => (
              <AthleteCard
                key={athlete.id}
                name={getAthleteDisplayName(athlete)}
                summary={summary}
                onClick={() => onSelectAthlete(athlete.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden mr-3 mb-3">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  {['Athlete', 'Wellness', 'Flags', 'Week AU (avg)', 'Compliance'].map(h => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-muted-foreground py-2 px-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayItems.map(({ athlete, summary }) => (
                  <AthleteListRow
                    key={athlete.id}
                    name={getAthleteDisplayName(athlete)}
                    summary={summary}
                    onClick={() => onSelectAthlete(athlete.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
