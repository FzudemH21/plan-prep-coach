/**
 * SquadDashboard
 *
 * Live monitoring view for all non-archived athletes.
 * - Card view: portrait "player card" — centred avatar, name, wellness, stats
 * - List view: compact table
 *
 * Group selection is lifted to AthleteDatabase so the sidebar and the
 * dashboard stay in sync.
 */

import { useMemo } from 'react';
import { LayoutGrid, List, Thermometer, Zap, Users, Loader2 } from 'lucide-react';
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
  borderClass: string;    // card border
  textClass: string;
  bgClass: string;
  avatarBorderClass: string;
  avatarTextClass: string;
}

const WELLNESS: Record<WellnessStatus, WellnessConfig> = {
  good: {
    label: 'Good', dotClass: 'bg-emerald-500',
    borderClass: 'border-emerald-200', textClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50', avatarBorderClass: 'border-emerald-300', avatarTextClass: 'text-emerald-800',
  },
  moderate: {
    label: 'Moderate', dotClass: 'bg-amber-400',
    borderClass: 'border-amber-200', textClass: 'text-amber-700',
    bgClass: 'bg-amber-50', avatarBorderClass: 'border-amber-300', avatarTextClass: 'text-amber-800',
  },
  poor: {
    label: 'Poor', dotClass: 'bg-red-500',
    borderClass: 'border-red-200', textClass: 'text-red-700',
    bgClass: 'bg-red-50', avatarBorderClass: 'border-red-300', avatarTextClass: 'text-red-800',
  },
  unknown: {
    label: 'No data', dotClass: 'bg-slate-300',
    borderClass: 'border-border', textClass: 'text-muted-foreground',
    bgClass: 'bg-muted/30', avatarBorderClass: 'border-border', avatarTextClass: 'text-muted-foreground',
  },
};

const STATUS_PRIORITY: Record<WellnessStatus, number> = {
  poor: 0, moderate: 2, good: 4, unknown: 6,
};

function sortScore(s: AthleteSquadSummary | null): number {
  if (!s) return 8;
  return (s.hasPainFlag || s.hasIllnessFlag)
    ? STATUS_PRIORITY[s.wellnessStatus] - 1
    : STATUS_PRIORITY[s.wellnessStatus];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Micro-components ──────────────────────────────────────────────────────────

function WellnessDot({ status }: { status: WellnessStatus }) {
  return <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', WELLNESS[status].dotClass)} />;
}

function FlagIcons({ summary }: { summary: AthleteSquadSummary }) {
  if (!summary.hasPainFlag && !summary.hasIllnessFlag) return null;
  return (
    <div className="flex items-center justify-center gap-1">
      {summary.hasPainFlag    && <Zap         className="h-3.5 w-3.5 text-orange-500" title="Pain reported" />}
      {summary.hasIllnessFlag && <Thermometer className="h-3.5 w-3.5 text-purple-500" title="Illness reported" />}
    </div>
  );
}

/**
 * Inline z-score badge.
 * positiveIsGood=true  (wellness): z≥1 green, z≤-1 red
 * positiveIsGood=false (load AU):  z≥1.5 amber (spike), z≤-1.5 sky (dip), else muted
 */
function ZBadge({ z, positiveIsGood = false }: { z: number; positiveIsGood?: boolean }) {
  const sign = z >= 0 ? '+' : '';
  const label = `z${sign}${z.toFixed(1)}`;
  const colorClass = positiveIsGood
    ? z >= 1   ? 'text-emerald-600'
    : z <= -1  ? 'text-red-500'
    : 'text-muted-foreground'
    : z >= 1.5  ? 'text-amber-600'
    : z <= -1.5 ? 'text-sky-600'
    : 'text-muted-foreground';
  return (
    <span className={cn('text-[10px] font-mono tabular-nums', colorClass)} title="Z-score (28-day reference)">
      {label}
    </span>
  );
}

// ── Card view — portrait "player card" ────────────────────────────────────────

interface CardProps { name: string; summary: AthleteSquadSummary | null; onClick: () => void; }

function AthleteCard({ name, summary, onClick }: CardProps) {
  const status = summary?.wellnessStatus ?? 'unknown';
  const cfg    = WELLNESS[status];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border-2 bg-card p-4',
        'flex flex-col items-center text-center gap-2',
        'hover:shadow-md transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        cfg.borderClass,
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center',
        'text-xl font-bold border-2 shrink-0',
        cfg.bgClass, cfg.avatarBorderClass, cfg.avatarTextClass,
      )}>
        {getInitials(name)}
      </div>

      {/* Name + wellness */}
      <div className="w-full space-y-0.5">
        <p className="font-semibold text-sm leading-tight truncate">{name}</p>
        {summary ? (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <WellnessDot status={status} />
            <span className={cn('text-xs font-medium', cfg.textClass)}>{cfg.label}</span>
            {summary.wellnessComposite !== null && (
              <span className="text-xs text-muted-foreground">{summary.wellnessComposite}/5</span>
            )}
            {summary.wellnessZScore !== null && <ZBadge z={summary.wellnessZScore} positiveIsGood />}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Not connected</p>
        )}
      </div>

      {/* Flags */}
      {summary && <FlagIcons summary={summary} />}

      {/* Stats */}
      {summary && (
        <div className="w-full border-t border-border/50 pt-2 mt-auto grid grid-cols-2 gap-x-2 text-xs">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Week AU</p>
            <p className="font-medium tabular-nums">
              {summary.weekAU > 0 ? summary.weekAU : '—'}
            </p>
            {summary.avgWeeklyAU > 0 && (
              <p className="text-[10px] text-muted-foreground tabular-nums">avg {summary.avgWeeklyAU}</p>
            )}
            {summary.weekAUZScore !== null && <ZBadge z={summary.weekAUZScore} />}
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Sessions</p>
            {summary.weekPlannedSessions > 0 ? (
              <>
                <p className="font-medium tabular-nums">
                  {summary.weekCompletedSessions}/{summary.weekPlannedSessions}
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {Math.round((summary.weekCompletedSessions / summary.weekPlannedSessions) * 100)}%
                </p>
              </>
            ) : (
              <p className="font-medium text-muted-foreground">—</p>
            )}
          </div>
        </div>
      )}

      {!summary && (
        <p className="text-xs text-muted-foreground mt-auto">No app data yet</p>
      )}
    </button>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

interface RowProps { name: string; summary: AthleteSquadSummary | null; onClick: () => void; }

function AthleteListRow({ name, summary, onClick }: RowProps) {
  const status = summary?.wellnessStatus ?? 'unknown';
  const cfg    = WELLNESS[status];

  return (
    <tr className="hover:bg-muted/40 cursor-pointer transition-colors border-b border-border/40 last:border-0" onClick={onClick}>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <WellnessDot status={status} />
          <span className="text-sm font-medium">{name}</span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-sm">
        {summary
          ? (
            <div className="flex items-center gap-1.5">
              <span className={cfg.textClass}>
                {summary.wellnessComposite !== null ? `${summary.wellnessComposite}/5` : cfg.label}
              </span>
              {summary.wellnessZScore !== null && <ZBadge z={summary.wellnessZScore} positiveIsGood />}
            </div>
          )
          : <span className="text-muted-foreground text-xs">Not connected</span>}
      </td>
      <td className="py-2.5 px-3">
        {summary && <FlagIcons summary={summary} />}
      </td>
      <td className="py-2.5 px-3 text-sm tabular-nums">
        {summary
          ? (summary.weekAU > 0
            ? (
              <div className="flex items-center gap-1.5">
                <span>{summary.weekAU}</span>
                {summary.avgWeeklyAU > 0 && (
                  <span className="text-xs text-muted-foreground">avg {summary.avgWeeklyAU}</span>
                )}
                {summary.weekAUZScore !== null && <ZBadge z={summary.weekAUZScore} />}
              </div>
            )
            : <span className="text-muted-foreground">—</span>)
          : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="py-2.5 px-3 text-sm tabular-nums">
        {summary && summary.weekPlannedSessions > 0
          ? <>{summary.weekCompletedSessions}/{summary.weekPlannedSessions}<span className="ml-1 text-xs text-muted-foreground">({Math.round((summary.weekCompletedSessions / summary.weekPlannedSessions) * 100)}%)</span></>
          : <span className="text-muted-foreground">—</span>}
      </td>
    </tr>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SquadDashboardProps {
  athletes: Athlete[];
  groups: AthleteGroup[];
  connections: AthleteConnection[];
  viewMode: 'list' | 'card';
  onViewModeChange: (mode: 'list' | 'card') => void;
  onSelectAthlete: (id: string) => void;
  /** Lifted from AthleteDatabase so sidebar + dashboard stay in sync. */
  selectedGroupId: string | null;
  onGroupChange: (id: string | null) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function SquadDashboard({
  athletes, groups, connections,
  viewMode, onViewModeChange,
  onSelectAthlete,
  selectedGroupId, onGroupChange,
}: SquadDashboardProps) {

  const filteredAthletes = useMemo(
    () => selectedGroupId ? athletes.filter(a => a.groupIds.includes(selectedGroupId)) : athletes,
    [athletes, selectedGroupId],
  );

  const connByAthleteId = useMemo(
    () => new Map(connections.map(c => [c.athleteLocalId, c])),
    [connections],
  );

  const connectedConns = useMemo(
    () => filteredAthletes.flatMap(a => {
      const c = connByAthleteId.get(a.id);
      return c ? [{ id: c.id, athleteLocalId: c.athleteLocalId, athleteName: c.athleteName }] : [];
    }),
    [filteredAthletes, connByAthleteId],
  );

  const { summaries, loading } = useSquadOverview(connectedConns);

  const summaryByConnId = useMemo(
    () => new Map(summaries.map(s => [s.connectionId, s])),
    [summaries],
  );

  const displayItems = useMemo(() => {
    const items = filteredAthletes.map(a => {
      const conn    = connByAthleteId.get(a.id);
      const summary = conn ? (summaryByConnId.get(conn.id) ?? null) : null;
      return { athlete: a, summary };
    });
    return items.sort((a, b) => {
      const d = sortScore(a.summary) - sortScore(b.summary);
      return d !== 0 ? d : getAthleteDisplayName(a.athlete).localeCompare(getAthleteDisplayName(b.athlete));
    });
  }, [filteredAthletes, connByAthleteId, summaryByConnId]);

  const connectedCount = displayItems.filter(i => i.summary !== null).length;
  const flaggedCount   = displayItems.filter(i => i.summary && (i.summary.hasPainFlag || i.summary.hasIllnessFlag)).length;

  const activeGroupName = useMemo(
    () => selectedGroupId ? (groups.find(g => g.id === selectedGroupId)?.name ?? 'Squad') : 'All Athletes',
    [groups, selectedGroupId],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">{activeGroupName}</h2>

          {/* Status line */}
          <span className="text-xs text-muted-foreground">
            {loading
              ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Loading…</span>
              : <>{connectedCount}/{displayItems.length} connected{flaggedCount > 0 && <span className="text-orange-600 font-medium ml-1">· {flaggedCount} flagged</span>}</>
            }
          </span>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7 w-7 p-0" title="List view" onClick={() => onViewModeChange('list')}>
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="sm" className="h-7 w-7 p-0" title="Card view" onClick={() => onViewModeChange('card')}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">No athletes in this group.</p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pr-3 pb-3">
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
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground py-2 px-3">{h}</th>
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
