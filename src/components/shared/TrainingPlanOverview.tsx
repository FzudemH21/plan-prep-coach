import React, { useState } from 'react';
import { PlanNotesField, PlanNotesView } from '@/components/shared/PlanNotesField';
import type { PlanNotesVersion } from '@/utils/planStrategy';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The plan's strategy at the top of the mesocycle and microcycle pages — like "Plan strategy" in
 * the macrocycle, but slim: one line (athlete · dates · mesocycles) that opens to the goals and the
 * strategy document. Closed by default, so the page's own work is at the top; open / closed is
 * remembered in this browser.
 */
interface TrainingPlanOverviewProps {
  athleteName?: string;
  planName?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  totalWeeks?: number;
  totalDays?: number;
  totalMesocycles?: number;
  primaryGoal?: string;
  primaryGoals?: string[];
  subGoals?: Array<{ id: string; description: string }>;
  defaultCollapsed?: boolean;
  notes?: string;
  onNotesChange?: (notes: string) => void;
  /** Strategy document: earlier versions, restore, "Write up from conversation" */
  notesHistory?: PlanNotesVersion[];
  onNotesRestore?: (version: PlanNotesVersion) => void;
  onNotesWriteUp?: () => void;
}

const OPEN_KEY = 'fold:planOverview:open';

function readOpen(fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(OPEN_KEY);
    return v === null ? fallback : v === '1';
  } catch { return fallback; }
}

export function TrainingPlanOverview({
  athleteName,
  planName,
  startDate,
  endDate,
  totalWeeks,
  totalMesocycles,
  primaryGoal,
  primaryGoals,
  subGoals = [],
  defaultCollapsed = true,
  notes,
  onNotesChange,
  notesHistory,
  onNotesRestore,
  onNotesWriteUp,
}: TrainingPlanOverviewProps) {
  // Merge legacy single-goal prop with the goals array, deduplicate
  const allPrimaryGoals = React.useMemo(() => {
    const base = primaryGoals && primaryGoals.length > 0 ? primaryGoals : primaryGoal ? [primaryGoal] : [];
    const seen = new Set<string>();
    return base.filter(g => {
      const t = g?.trim();
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  }, [primaryGoal, primaryGoals]);
  const [isOpen, setIsOpenState] = useState(() => readOpen(!defaultCollapsed));
  const setIsOpen = (open: boolean) => {
    setIsOpenState(open);
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* only a convenience */ }
  };

  const short = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'd MMM yyyy');
  };
  const subGoalCount = new Set(subGoals.map(sg => sg.description?.trim()).filter(Boolean)).size;

  // One line: athlete · dates (weeks) · mesocycles
  const summary = [
    athleteName,
    startDate && endDate ? `${short(startDate)} – ${short(endDate)}${totalWeeks ? ` (${totalWeeks} wk)` : ''}` : '',
    totalMesocycles ? `${totalMesocycles} mesocycle${totalMesocycles === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <Card className="mb-4">
      <button
        type="button"
        data-nav
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors rounded-lg"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold shrink-0">Plan strategy</span>
        {summary && <span className="min-w-0 truncate text-xs text-muted-foreground">· {summary}</span>}
        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {(allPrimaryGoals.length > 0 || planName) && (
            <p className="text-xs text-muted-foreground">
              {planName && <span className="text-foreground font-medium">{planName}</span>}
              {planName && allPrimaryGoals.length > 0 && ' · '}
              {allPrimaryGoals.length > 0 && <>{allPrimaryGoals.length === 1 ? 'Goal' : 'Goals'}: <span className="text-foreground">{allPrimaryGoals.join(' · ')}</span></>}
              {subGoalCount > 0 && ` · ${subGoalCount} sub-goal${subGoalCount === 1 ? '' : 's'}`}
            </p>
          )}
          {onNotesChange ? (
            <PlanNotesField value={notes || ''} onChange={onNotesChange} minHeight={120} maxViewHeight={320}
              history={notesHistory} onRestore={onNotesRestore} onWriteUp={onNotesWriteUp}
              pdf={{ planName: planName || 'Training plan', athleteName }} />
          ) : notes ? (
            <PlanNotesView text={notes} />
          ) : null}
        </div>
      )}
    </Card>
  );
}
