import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Minus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { AthleteScheduleEntry, ExerciseSummary, SessionSummary } from '@/hooks/useAthleteApp';
import { IntensityBadge, INTENSITY_CONFIG } from '@/components/athlete-app/IntensityBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';

// ── Helpers (mirrors AthleteSessionPage logic) ────────────────────────────────

function getSetCount(ex: ExerciseSummary): number {
  if (ex.isCircuit) return Math.max(1, Number(ex.circuitRounds ?? 3));
  return ex.plannedSets && ex.plannedSets > 0 ? ex.plannedSets : 3;
}

function getParamColumns(ex: ExerciseSummary): string[] {
  let candidates: string[];
  if (ex.visibleParams && ex.visibleParams.length > 0) {
    candidates = ex.visibleParams;
  } else if (ex.plannedParams) {
    const bases = new Set<string>();
    for (const key of Object.keys(ex.plannedParams)) {
      const m = key.match(/^(.+)_set\d+$/);
      if (m) bases.add(m[1]);
    }
    candidates = bases.size > 0 ? Array.from(bases) : ['Reps'];
  } else {
    return ['Reps'];
  }
  const REST_RE = /rest|pause|recovery/i;
  candidates = candidates.filter(p => p !== ex.restParamName && !REST_RE.test(p));
  if (ex.plannedParams) {
    const withValues = candidates.filter(param => {
      for (const [key, val] of Object.entries(ex.plannedParams!)) {
        if (val === undefined || val === null || val === '') continue;
        const m = key.match(/^(.+)_set\d+$/);
        if (m && m[1] === param) return true;
        if (key === param) return true;
      }
      return false;
    });
    if (withValues.length > 0) return withValues;
    if (candidates.length > 0) return candidates;
  }
  return candidates.length > 0 ? candidates : ['Reps'];
}

function getPlannedValue(ex: ExerciseSummary, paramName: string, setIdx: number): string {
  if (!ex.plannedParams) return '';
  const perSetVal = ex.plannedParams[`${paramName}_set${setIdx + 1}`];
  if (perSetVal !== undefined && perSetVal !== null && perSetVal !== '') return String(perSetVal);
  const plainVal = ex.plannedParams[paramName];
  if (plainVal !== undefined && plainVal !== null && plainVal !== '') return String(plainVal);
  return '';
}

function groupIntoSections(exercises: ExerciseSummary[]) {
  if (exercises.length === 0) return [];
  const map = new Map<string, { id: string; name: string; order: number; exercises: ExerciseSummary[] }>();
  for (const ex of exercises) {
    const sid = ex.sectionId ?? '__none__';
    if (!map.has(sid)) {
      map.set(sid, {
        id: sid,
        name: ex.sectionName ?? 'Workout',
        order: ex.sectionOrder ?? 0,
        exercises: [],
      });
    }
    map.get(sid)!.exercises.push(ex);
  }
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map(s => ({ ...s, exercises: [...s.exercises].sort((a, b) => a.order - b.order) }));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocationState {
  entry: AthleteScheduleEntry;
  sessionIdx: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoachMobileSessionEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const state = location.state as LocationState | null;

  const [entry, setEntry] = useState<AthleteScheduleEntry | null>(state?.entry ?? null);
  const sessionIdx = state?.sessionIdx ?? 0;
  const [saving, setSaving] = useState(false);
  const [intensityPickerOpen, setIntensityPickerOpen] = useState(false);

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (!entry || !state) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Session not found. Go back and try again.
      </div>
    );
  }

  const session: SessionSummary = entry.sessions[sessionIdx];
  const sections = groupIntoSections(session?.exercises ?? []);

  // ── Edit helpers ────────────────────────────────────────────────────────────

  function updateExercise(exId: string, updater: (ex: ExerciseSummary) => ExerciseSummary) {
    setEntry(prev => {
      if (!prev) return prev;
      const sessions = prev.sessions.map((s, i) =>
        i !== sessionIdx ? s : {
          ...s,
          exercises: s.exercises.map(ex => ex.id === exId ? updater(ex) : ex),
        }
      );
      return { ...prev, sessions };
    });
  }

  function setParamValue(exId: string, paramName: string, setIdx: number, value: string) {
    updateExercise(exId, ex => {
      const params = { ...(ex.plannedParams ?? {}) };
      // Write per-set key (primary format)
      params[`${paramName}_set${setIdx + 1}`] = value;
      // Also keep the plain key in sync (used for uniform-sets display)
      if (setIdx === 0) params[paramName] = value;
      return { ...ex, plannedParams: params };
    });
  }

  function changeSetCount(exId: string, delta: number) {
    const ex = session.exercises.find(e => e.id === exId);
    if (!ex) return;
    const current = getSetCount(ex);
    const next = Math.max(1, current + delta);
    updateExercise(exId, e => ({ ...e, plannedSets: next }));
  }

  function setDayIntensity(intensity: string | null) {
    setEntry(prev => prev ? { ...prev, intensity } : prev);
    setIntensityPickerOpen(false);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!entry) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('athlete_schedule')
        .update({ sessions: entry.sessions, intensity: entry.intensity })
        .eq('id', entry.id);
      if (error) throw error;
      toast({ title: 'Saved ✓', description: 'Session updated.' });
      navigate(-1);
    } catch {
      toast({ title: 'Error', description: 'Could not save. Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const intensityLevels = Object.entries(INTENSITY_CONFIG)
    .filter(([k]) => /^\d+$/.test(k))
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent -ml-1 shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{entry.date}</p>
          <p className="text-sm font-semibold truncate">{session?.name || 'Session'}</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Day intensity row */}
      <button
        onClick={() => setIntensityPickerOpen(true)}
        className="flex items-center justify-between px-4 py-3 border-b shrink-0 w-full text-left active:bg-accent/40"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Day Intensity
        </p>
        {entry.intensity
          ? <IntensityBadge intensity={entry.intensity} />
          : <span className="text-xs text-muted-foreground italic">Tap to set…</span>}
      </button>

      {/* Exercise list */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5 pb-10">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No exercises in this session.</p>
          ) : sections.map(section => (
            <div key={section.id} className="space-y-3">
              {/* Section label (only when multiple sections) */}
              {sections.length > 1 && (
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {section.name}
                </p>
              )}

              {section.exercises.map(ex => {
                const params = getParamColumns(ex);
                const sets = getSetCount(ex);

                return (
                  <div key={ex.id} className="rounded-xl border bg-card overflow-hidden">
                    {/* Exercise name + sets control */}
                    <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-b gap-3">
                      <p className="text-sm font-semibold truncate flex-1 min-w-0">{ex.name}</p>
                      {/* Sets ± control */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">Sets</span>
                        <button
                          onClick={() => changeSetCount(ex.id, -1)}
                          className="w-6 h-6 rounded-full border bg-background flex items-center justify-center active:bg-accent"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-bold w-5 text-center">{sets}</span>
                        <button
                          onClick={() => changeSetCount(ex.id, +1)}
                          className="w-6 h-6 rounded-full border bg-background flex items-center justify-center active:bg-accent"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Params table */}
                    {params.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/10">
                              <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground w-8">Set</th>
                              {params.map(p => (
                                <th key={p} className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">{p}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: sets }, (_, i) => (
                              <tr key={i} className={cn('border-b last:border-0', i % 2 === 1 && 'bg-muted/10')}>
                                <td className="px-3 py-2 text-xs font-medium text-muted-foreground">{i + 1}</td>
                                {params.map(p => (
                                  <td key={p} className="px-2 py-1.5">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={getPlannedValue(ex, p, i)}
                                      onChange={e => setParamValue(ex.id, p, i, e.target.value)}
                                      className="w-16 h-7 text-xs border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Intensity picker bottom sheet */}
      <Sheet open={intensityPickerOpen} onOpenChange={setIntensityPickerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[70vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>Day Intensity</SheetTitle>
          </SheetHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="grid grid-cols-1 gap-2 pb-2">
              {intensityLevels.map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setDayIntensity(key)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left active:opacity-70 transition-colors',
                    entry.intensity === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  )}
                >
                  {entry.intensity === key
                    ? <Check className="h-4 w-4 text-primary shrink-0" />
                    : <div className="w-4 shrink-0" />}
                  <span className={cn('text-sm font-medium px-2.5 py-1 rounded-full', cfg.color)}>
                    {cfg.label}
                  </span>
                </button>
              ))}
              <button
                onClick={() => setDayIntensity(null)}
                className="text-xs text-muted-foreground py-3 text-center active:opacity-70"
              >
                Clear intensity
              </button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
