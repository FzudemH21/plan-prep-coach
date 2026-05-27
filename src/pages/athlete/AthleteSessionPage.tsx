import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Dumbbell, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAthleteApp, AthleteScheduleEntry, ExerciseSummary } from '@/hooks/useAthleteApp';
import { useToast } from '@/hooks/use-toast';

// ── Intensity helpers ────────────────────────────────────────────────────────

const INTENSITY_CONFIG: Record<string, { label: string; color: string }> = {
  '0': { label: '0 – Rest', color: 'bg-slate-100 text-slate-600' },
  '1': { label: '1 – Very Easy', color: 'bg-green-100 text-green-700' },
  '2': { label: '2 – Easy', color: 'bg-green-200 text-green-800' },
  '3': { label: '3 – Moderate', color: 'bg-yellow-100 text-yellow-700' },
  '4': { label: '4 – Somewhat Hard', color: 'bg-yellow-200 text-yellow-800' },
  '5': { label: '5 – Hard', color: 'bg-orange-200 text-orange-800' },
  '6': { label: '6 – Hard+', color: 'bg-orange-300 text-orange-900' },
  '7': { label: '7 – Very Hard', color: 'bg-red-200 text-red-800' },
  '8': { label: '8 – Very Hard+', color: 'bg-red-300 text-red-900' },
  '9': { label: '9 – Extremely Hard', color: 'bg-red-400 text-red-950' },
  '10': { label: '10 – Maximal', color: 'bg-red-600 text-white' },
  off: { label: 'Off', color: 'bg-slate-100 text-slate-600' },
  deload: { label: 'Deload', color: 'bg-blue-100 text-blue-700' },
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700' },
  'easy-moderate': { label: 'Easy-Moderate', color: 'bg-green-200 text-green-800' },
  moderate: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
  'moderate-hard': { label: 'Moderate-Hard', color: 'bg-orange-200 text-orange-800' },
  hard: { label: 'Hard', color: 'bg-red-200 text-red-800' },
  'extremely-hard': { label: 'Extremely Hard', color: 'bg-red-500 text-white' },
};

function IntensityBadge({ intensity }: { intensity: string | null }) {
  if (!intensity) return null;
  const config = INTENSITY_CONFIG[intensity] ?? { label: intensity, color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', config.color)}>
      {config.label}
    </span>
  );
}

// ── Borg CR10 button colors ──────────────────────────────────────────────────

function borgColor(value: number): string {
  if (value === 0) return 'border-slate-300 text-slate-500 data-[selected=true]:bg-slate-500 data-[selected=true]:text-white data-[selected=true]:border-slate-500';
  if (value <= 3) return 'border-green-400 text-green-700 data-[selected=true]:bg-green-500 data-[selected=true]:text-white data-[selected=true]:border-green-500';
  if (value <= 6) return 'border-yellow-400 text-yellow-700 data-[selected=true]:bg-yellow-500 data-[selected=true]:text-white data-[selected=true]:border-yellow-500';
  if (value <= 8) return 'border-orange-400 text-orange-700 data-[selected=true]:bg-orange-500 data-[selected=true]:text-white data-[selected=true]:border-orange-500';
  return 'border-red-400 text-red-700 data-[selected=true]:bg-red-500 data-[selected=true]:text-white data-[selected=true]:border-red-500';
}

// ── Date formatter ───────────────────────────────────────────────────────────

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise }: { exercise: ExerciseSummary }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          {exercise.isCircuit ? (
            <RefreshCw className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{exercise.name}</p>
          {exercise.notes && (
            <p className="text-xs text-muted-foreground truncate">{exercise.notes}</p>
          )}
        </div>
        {exercise.isCircuit && (
          <Badge variant="secondary" className="text-xs shrink-0">Circuit</Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ── Completion sheet ─────────────────────────────────────────────────────────

interface CompletionSheetProps {
  open: boolean;
  onClose: () => void;
  connectionId: string;
  date: string;
  sessionId: string;
  sessionName: string;
  onSaved: () => void;
}

function CompletionSheet({
  open,
  onClose,
  connectionId,
  date,
  sessionId,
  sessionName,
  onSaved,
}: CompletionSheetProps) {
  const [borgRating, setBorgRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from('athlete_session_logs').insert({
      athlete_connection_id: connectionId,
      date,
      session_id: sessionId,
      session_name: sessionName,
      completed_at: new Date().toISOString(),
      borg_rating: borgRating,
      comment: comment.trim() || null,
      sets_logged: [],
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Error saving session', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Session logged!' });
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe-area-inset-bottom">
        <SheetHeader className="mb-4">
          <SheetTitle>How was the session?</SheetTitle>
        </SheetHeader>

        {/* Borg CR10 rating */}
        <div className="mb-5">
          <p className="text-sm font-medium mb-3">Effort (Borg CR10)</p>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 11 }, (_, v) => (
              <button
                key={v}
                data-selected={borgRating === v}
                onClick={() => setBorgRating(borgRating === v ? null : v)}
                className={cn(
                  'w-9 h-9 rounded-lg border-2 text-sm font-semibold transition-colors',
                  borgColor(v)
                )}
              >
                {v}
              </button>
            ))}
          </div>
          {borgRating !== null && (
            <p className="text-xs text-muted-foreground mt-2">
              {INTENSITY_CONFIG[String(borgRating)]?.label ?? ''}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="mb-6">
          <p className="text-sm font-medium mb-2">Notes (optional)</p>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Any notes about this session…"
            className="resize-none h-24"
          />
        </div>

        <Button
          className="w-full"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

interface LocationState {
  entry: AthleteScheduleEntry;
  sessionIdx: number;
}

export default function AthleteSessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { connection } = useAthleteApp();
  const [sheetOpen, setSheetOpen] = useState(false);

  const state = location.state as LocationState | null;

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-sm text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const { entry, sessionIdx } = state;
  const session = entry.sessions[sessionIdx];

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-sm text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const exercises = session.exercises ?? [];

  function handleBack() {
    navigate(-1);
  }

  function handleSaved() {
    setSheetOpen(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center font-semibold text-base truncate pr-8">
          {session.name}
        </h1>
      </div>

      {/* Subheader */}
      <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          {[entry.programName, entry.mesocycleName, formatSessionDate(entry.date)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {/* Intensity badge */}
      {entry.intensity && (
        <div className="px-4 pt-4 pb-2 shrink-0">
          <IntensityBadge intensity={entry.intensity} />
        </div>
      )}

      {/* Exercise list */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-2 py-3">
          {exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Dumbbell className="h-8 w-8 opacity-30" />
              <p className="text-sm">No exercises assigned yet.</p>
            </div>
          ) : (
            exercises.map(ex => (
              <ExerciseCard key={ex.id} exercise={ex} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Bottom action bar */}
      <div className="px-4 py-4 border-t bg-background shrink-0">
        <Button
          className="w-full"
          size="lg"
          onClick={() => setSheetOpen(true)}
        >
          Complete Session
        </Button>
      </div>

      {/* Completion sheet */}
      {connection && (
        <CompletionSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          connectionId={connection.id}
          date={entry.date}
          sessionId={session.id}
          sessionName={session.name}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
