/**
 * PlanReviewDialog.tsx
 *
 * Post-plan outcome annotation dialog for completed athlete calendar assignments.
 * Coaches fill this in after a program ends to capture what worked and what didn't.
 *
 * Active fields:  Overall rating · Goal achievement · Load tolerance · Notes
 * Placeholder sections (greyed-out, future):
 *   - Adherence       — auto-filled from athlete app workout logs
 *   - Planned vs. Real — requires athlete app session completion data
 *   - AI Coaching Dialog — AI-assisted reflection on outcome data
 */

import { useState } from 'react';
import { Star, Lock, MessageSquare, Activity, BarChart3, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AthleteCalendarAssignment } from '@/types/athlete';

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalAchievement = AthleteCalendarAssignment['outcomeGoalAchievement'];
type LoadTolerance = AthleteCalendarAssignment['outcomeLoadTolerance'];

interface PlanReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: AthleteCalendarAssignment;
  onSave: (updates: Pick<
    AthleteCalendarAssignment,
    'outcomeRating' | 'outcomeGoalAchievement' | 'outcomeLoadTolerance' | 'outcomeNotes'
  >) => void;
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value ?? 0;

  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="p-0.5 transition-transform hover:scale-110"
          onMouseEnter={() => setHovered(n)}
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} out of 5`}
        >
          <Star
            className={cn(
              'h-7 w-7 transition-colors',
              n <= display
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground/40',
            )}
          />
        </button>
      ))}
      {value !== null && (
        <button
          type="button"
          className="ml-2 text-xs text-muted-foreground underline underline-offset-2 self-center"
          onClick={() => onChange(0)}
        >
          clear
        </button>
      )}
    </div>
  );
}

// ─── Placeholder Section ──────────────────────────────────────────────────────

function FuturePlaceholderSection({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 p-4 opacity-60 select-none">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-muted p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground border-muted-foreground/40">
              <Lock className="h-2.5 w-2.5 mr-1" />
              {badge}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground/70">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function PlanReviewDialog({
  open,
  onOpenChange,
  assignment,
  onSave,
}: PlanReviewDialogProps) {
  const [rating, setRating] = useState<number | null>(assignment.outcomeRating ?? null);
  const [goalAchievement, setGoalAchievement] = useState<GoalAchievement>(
    assignment.outcomeGoalAchievement ?? null,
  );
  const [loadTolerance, setLoadTolerance] = useState<LoadTolerance>(
    assignment.outcomeLoadTolerance ?? null,
  );
  const [notes, setNotes] = useState<string>(assignment.outcomeNotes ?? '');

  const handleSave = () => {
    onSave({
      outcomeRating: rating,
      outcomeGoalAchievement: goalAchievement,
      outcomeLoadTolerance: loadTolerance,
      outcomeNotes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  const hasData =
    rating !== null ||
    goalAchievement !== null ||
    loadTolerance !== null ||
    notes.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Plan Review — {assignment.programName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Reflect on how this plan went. Your notes feed into future AI suggestions.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* ── Overall Rating ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Overall Rating</Label>
            <StarRating
              value={rating}
              onChange={(v) => setRating(v === 0 ? null : v)}
            />
          </div>

          {/* ── Goal Achievement ───────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="goal-achievement" className="text-sm font-medium">
              Goal Achievement
            </Label>
            <Select
              value={goalAchievement ?? ''}
              onValueChange={(v) =>
                setGoalAchievement((v || null) as GoalAchievement)
              }
            >
              <SelectTrigger id="goal-achievement" className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_achieved">❌ Not achieved</SelectItem>
                <SelectItem value="partial">🟡 Partially achieved</SelectItem>
                <SelectItem value="achieved">✅ Achieved</SelectItem>
                <SelectItem value="exceeded">🚀 Exceeded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Load Tolerance ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="load-tolerance" className="text-sm font-medium">
              Load Tolerance
            </Label>
            <Select
              value={loadTolerance ?? ''}
              onValueChange={(v) =>
                setLoadTolerance((v || null) as LoadTolerance)
              }
            >
              <SelectTrigger id="load-tolerance" className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="too_easy">💤 Too easy</SelectItem>
                <SelectItem value="about_right">✅ About right</SelectItem>
                <SelectItem value="too_hard">🔥 Too hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Coach Notes ────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="outcome-notes" className="text-sm font-medium">
              Coach Notes
            </Label>
            <Textarea
              id="outcome-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked? What didn't? Any observations about this athlete's response to this program…"
              className="min-h-[100px] resize-none text-sm"
            />
          </div>

          {/* ── Future placeholders ─────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <ChevronDown className="h-3 w-3" />
              Coming in future releases
            </div>

            <FuturePlaceholderSection
              icon={Activity}
              title="Adherence"
              description="Session completion rate, missed days, and workout adherence — auto-filled once the athlete is logging sessions in the athlete app."
              badge="Athlete App"
            />

            <FuturePlaceholderSection
              icon={BarChart3}
              title="Planned vs. Real"
              description="Side-by-side comparison of planned volume, intensity, and load vs. what was actually performed. Requires athlete app session data."
              badge="Athlete App"
            />

            <FuturePlaceholderSection
              icon={MessageSquare}
              title="AI Coaching Dialog"
              description="Ask the AI to reflect on this plan's outcome, identify patterns, and suggest adjustments for the next cycle — powered by your outcome data and coaching history."
              badge="Coming Soon"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasData}>
            Save Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
