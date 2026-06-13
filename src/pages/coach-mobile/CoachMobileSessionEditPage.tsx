import { useState, useRef, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronDown, Plus, Minus, Check,
  Info, RefreshCw, Dumbbell, Trash2, Link2, Unlink2, AlignLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { AthleteScheduleEntry, ExerciseSummary, SessionSummary } from '@/hooks/useAthleteApp';
import { IntensityBadge, INTENSITY_CONFIG } from '@/components/athlete-app/IntensityBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import type { CustomLibrary, CustomExercise, Circuit } from '@/contexts/CustomLibrariesContext';

// ── Section helpers ───────────────────────────────────────────────────────────

interface SectionData {
  id: string;
  name: string;
  order: number;
  notes?: string;
  exercises: ExerciseSummary[];
}

function groupIntoSections(exercises: ExerciseSummary[]): SectionData[] {
  if (exercises.length === 0) return [];
  const map = new Map<string, SectionData>();
  for (const ex of exercises) {
    const sid = ex.sectionId ?? '__none__';
    if (!map.has(sid)) {
      map.set(sid, {
        id: sid,
        name: ex.sectionName ?? (sid === '__none__' ? 'Workout' : 'Section'),
        order: ex.sectionOrder ?? 0,
        notes: ex.sectionNotes || undefined,
        exercises: [],
      });
    }
    map.get(sid)!.exercises.push(ex);
  }
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map(s => ({ ...s, exercises: [...s.exercises].sort((a, b) => a.order - b.order) }));
}

function getSetCount(ex: ExerciseSummary): number {
  if (ex.isCircuit) return Math.max(1, Number(ex.circuitRounds ?? 3));
  // Prefer plannedParams['Sets'] as canonical set count (matches desktop).
  if (ex.plannedParams) {
    const setsKey = Object.keys(ex.plannedParams).find(k => /^sets?$/i.test(k));
    if (setsKey) {
      const n = Number(ex.plannedParams[setsKey]);
      if (n > 0) return n;
    }
  }
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

function initSectionNotesMap(exercises: ExerciseSummary[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const ex of exercises) {
    if (ex.sectionId && ex.sectionNotes && !map[ex.sectionId]) {
      map[ex.sectionId] = ex.sectionNotes;
    }
  }
  return map;
}

// ── Exercise detail dialog ─────────────────────────────────────────────────────

interface ExerciseDetailTarget { name: string; videoUrl?: string; description?: string }

function ExerciseDetailDialog({
  target, onClose,
}: { target: ExerciseDetailTarget | null; onClose: () => void }) {
  if (!target) return null;
  const hasContent = !!(target.videoUrl || target.description);
  return (
    <Dialog open={!!target} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl max-h-[80vh] overflow-y-auto p-0">
        <div className="px-5 pt-5 pb-7 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-left">{target.name}</DialogTitle>
          </DialogHeader>
          {!hasContent && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No details available for this exercise.
            </p>
          )}
          {target.videoUrl && (
            <a
              href={target.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
            >
              Watch video
            </a>
          )}
          {target.description && (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {target.description}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Intensity picker sheet ─────────────────────────────────────────────────────

function IntensityPickerSheet({
  open,
  title,
  current,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  current: string | null | undefined;
  onSelect: (v: string | null) => void;
  onClose: () => void;
}) {
  const levels = Object.entries(INTENSITY_CONFIG)
    .filter(([k]) => /^\d+$/.test(k))
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[70vh]">
        <SheetHeader className="mb-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="max-h-[50vh]">
          <div className="grid grid-cols-1 gap-2 pb-2">
            {levels.map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => onSelect(key)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left active:opacity-70 transition-colors',
                  current === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
              >
                {current === key
                  ? <Check className="h-4 w-4 text-primary shrink-0" />
                  : <div className="w-4 shrink-0" />}
                <span className={cn('text-sm font-medium px-2.5 py-1 rounded-full', cfg.color)}>
                  {cfg.label}
                </span>
              </button>
            ))}
            <button
              onClick={() => onSelect(null)}
              className="text-xs text-muted-foreground py-3 text-center active:opacity-70"
            >
              Clear intensity
            </button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── Exercise / Circuit picker sheet ───────────────────────────────────────────

function ExercisePickerSheet({
  open,
  onClose,
  onSelectExercise,
  onSelectCircuit,
}: {
  open: boolean;
  onClose: () => void;
  onSelectExercise: (lib: CustomLibrary, ex: CustomExercise) => void;
  onSelectCircuit: (circuit: Circuit, lib: CustomLibrary) => void;
}) {
  const { libraries } = useCustomLibraries();
  const [tab, setTab] = useState<'exercises' | 'circuits'>('exercises');
  const [libIdx, setLibIdx] = useState(0);
  const [search, setSearch] = useState('');

  // Reset search when opened
  useEffect(() => {
    if (open) { setSearch(''); setLibIdx(0); setTab('exercises'); }
  }, [open]);

  function getExName(lib: CustomLibrary, ex: CustomExercise): string {
    const nameCol =
      lib.columns.find(c => c.required) ??
      lib.columns.find(c => !c.role) ??
      lib.columns[0];
    return nameCol ? (String(ex.data[nameCol.id] ?? '') || 'Exercise') : 'Exercise';
  }

  const currentLib = libraries[libIdx] ?? null;
  const allCircuits = libraries.flatMap(lib => (lib.circuits ?? []).map(c => ({ circuit: c, lib })));

  const filteredExercises = currentLib
    ? currentLib.exercises.filter(ex => {
        if (!search) return true;
        return getExName(currentLib, ex).toLowerCase().includes(search.toLowerCase());
      })
    : [];

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe max-h-[85vh] flex flex-col gap-0 p-0">
        <div className="px-4 pt-4 pb-3 border-b shrink-0">
          <SheetHeader>
            <SheetTitle>Add to Session</SheetTitle>
          </SheetHeader>
          {/* Tab bar */}
          <div className="flex gap-0 border rounded-lg overflow-hidden mt-3">
            {(['exercises', 'circuits'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium capitalize transition-colors',
                  tab === t
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground bg-background'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === 'exercises' ? (
          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 gap-2">
            {/* Library selector */}
            {libraries.length > 1 && (
              <div className="flex gap-1 flex-wrap shrink-0">
                {libraries.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => setLibIdx(i)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      libIdx === i
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises…"
              className="w-full h-9 border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
            />
            {/* Exercise list */}
            <ScrollArea className="flex-1 -mx-1">
              <div className="space-y-0.5 pb-6 px-1">
                {libraries.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No exercise libraries found.</p>
                )}
                {filteredExercises.length === 0 && libraries.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No exercises match your search.</p>
                )}
                {filteredExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => { if (currentLib) onSelectExercise(currentLib, ex); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 active:bg-muted text-left transition-colors"
                  >
                    <Plus className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">{getExName(currentLib!, ex)}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          /* Circuits */
          <ScrollArea className="flex-1 px-4 pt-3">
            <div className="space-y-0.5 pb-6">
              {allCircuits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No circuits in your libraries.</p>
              ) : allCircuits.map(({ circuit, lib: cLib }) => (
                <button
                  key={circuit.id}
                  onClick={() => onSelectCircuit(circuit, cLib)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 active:bg-muted text-left transition-colors"
                >
                  <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{circuit.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {circuit.exercises.length} ex · {circuit.rounds ?? 3} rounds · {cLib.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Superset picker sheet ─────────────────────────────────────────────────────

function SupersetPickerSheet({
  open,
  sourceId,
  sectionExercises,
  onLink,
  onClose,
}: {
  open: boolean;
  sourceId: string | null;
  sectionExercises: ExerciseSummary[];
  onLink: (targetId: string) => void;
  onClose: () => void;
}) {
  const sourceEx = sectionExercises.find(e => e.id === sourceId);
  const candidates = sectionExercises.filter(e => {
    if (e.id === sourceId) return false;
    if (e.isCircuit) return false;
    if (sourceEx?.supersetId && e.supersetId === sourceEx.supersetId) return false;
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>Link to Superset</SheetTitle>
        </SheetHeader>
        {sourceEx && (
          <p className="text-xs text-muted-foreground mb-3">
            Linking with: <span className="font-semibold text-foreground">{sourceEx.name}</span>
          </p>
        )}
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No other exercises available to link in this section.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map(ex => (
              <button
                key={ex.id}
                onClick={() => onLink(ex.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border hover:bg-muted/50 active:bg-muted transition-colors text-left"
              >
                <Link2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium">{ex.name}</span>
              </button>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'view' | 'edit';

interface LocationState {
  entry: AthleteScheduleEntry;
  sessionIdx: number;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CoachMobileSessionEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { libraries } = useCustomLibraries();

  const state = location.state as LocationState | null;
  const originalEntry = useRef<AthleteScheduleEntry | null>(state?.entry ?? null);

  const [mode, setMode] = useState<Mode>('view');
  const [entry, setEntry] = useState<AthleteScheduleEntry | null>(state?.entry ?? null);
  const sessionIdx = state?.sessionIdx ?? 0;
  const [saving, setSaving] = useState(false);

  // ── New state ──────────────────────────────────────────────────────────────
  const [sectionNotesMap, setSectionNotesMap] = useState<Record<string, string>>({});
  const [sectionNotesOpen, setSectionNotesOpen] = useState<Set<string>>(new Set());
  const [extraSections, setExtraSections] = useState<Array<{ id: string; name: string }>>([]);
  const [newSectionDialogOpen, setNewSectionDialogOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Intensity pickers
  const [dayIntensityOpen, setDayIntensityOpen] = useState(false);
  const [sessionIntensityOpen, setSessionIntensityOpen] = useState(false);

  // Exercise/circuit picker
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [pickerTargetSectionId, setPickerTargetSectionId] = useState<string | null>(null);

  // Superset picker
  const [supersetPickerOpen, setSupersetPickerOpen] = useState(false);
  const [supersetSourceId, setSupersetSourceId] = useState<string | null>(null);
  const [supersetSectionId, setSupersetSectionId] = useState<string | null>(null);

  // Exercise detail dialog
  const [detailTarget, setDetailTarget] = useState<ExerciseDetailTarget | null>(null);

  // ── Derived sections ───────────────────────────────────────────────────────

  const sections = useMemo(
    () => groupIntoSections(entry?.sessions[sessionIdx]?.exercises ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry?.sessions[sessionIdx]?.exercises],
  );

  const allSections = useMemo(() => {
    const existingIds = new Set(sections.map(s => s.id));
    const extra = extraSections
      .filter(s => !existingIds.has(s.id))
      .map((s, i) => ({
        id: s.id,
        name: s.name,
        order: sections.length + i,
        notes: undefined as string | undefined,
        exercises: [] as ExerciseSummary[],
      }));
    return [...sections, ...extra];
  }, [sections, extraSections]);

  // All sections start expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set<string>());
  const expandedInitRef = useRef(false);
  useEffect(() => {
    if (!expandedInitRef.current && sections.length > 0) {
      expandedInitRef.current = true;
      setExpandedSections(new Set(sections.map(s => s.id)));
    }
  }, [sections]);

  // Init section notes map once from entry
  const sectionNotesInitRef = useRef(false);
  useEffect(() => {
    if (!entry || sectionNotesInitRef.current) return;
    sectionNotesInitRef.current = true;
    setSectionNotesMap(initSectionNotesMap(entry.sessions[sessionIdx]?.exercises ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!entry || !state) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Session not found. Go back and try again.
      </div>
    );
  }

  const session: SessionSummary = entry.sessions[sessionIdx];

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSectionNotes(id: string) {
    setSectionNotesOpen(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Edit helpers ───────────────────────────────────────────────────────────

  function updateSession(updater: (s: SessionSummary) => SessionSummary) {
    setEntry(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map((s, i) => i !== sessionIdx ? s : updater(s)),
      };
    });
  }

  function updateExercise(exId: string, updater: (ex: ExerciseSummary) => ExerciseSummary) {
    updateSession(s => ({
      ...s,
      exercises: s.exercises.map(ex => ex.id === exId ? updater(ex) : ex),
    }));
  }

  function setParamValue(exId: string, paramName: string, setIdx: number, value: string) {
    updateExercise(exId, ex => {
      const params = { ...(ex.plannedParams ?? {}) };
      params[`${paramName}_set${setIdx + 1}`] = value;
      if (setIdx === 0) params[paramName] = value;
      return { ...ex, plannedParams: params };
    });
  }

  function changeSetCount(exId: string, delta: number) {
    const ex = session.exercises.find(e => e.id === exId);
    if (!ex) return;
    const current = getSetCount(ex);
    const next = Math.max(1, current + delta);
    updateExercise(exId, e => {
      const newParams = { ...(e.plannedParams ?? {}) };
      const setsKey = Object.keys(newParams).find(k => /^sets?$/i.test(k)) ?? 'Sets';
      newParams[setsKey] = next;
      const paramBases = new Set<string>();
      for (const key of Object.keys(newParams)) {
        const m = key.match(/^(.+)_set\d+$/);
        if (m && m[1] !== setsKey) paramBases.add(m[1]);
      }
      if (next > current) {
        for (const base of paramBases) {
          for (let i = current + 1; i <= next; i++) {
            const k = `${base}_set${i}`;
            if (!(k in newParams)) newParams[k] = '';
          }
        }
      } else if (next < current) {
        for (const base of paramBases) {
          for (let i = next + 1; i <= current; i++) {
            delete newParams[`${base}_set${i}`];
          }
        }
      }
      return { ...e, plannedSets: next, plannedParams: newParams };
    });
  }

  function deleteExercise(exId: string) {
    updateSession(s => ({
      ...s,
      exercises: s.exercises.filter(ex => ex.id !== exId),
    }));
  }

  function deleteSection(sectionId: string) {
    setExtraSections(prev => prev.filter(s => s.id !== sectionId));
    updateSession(s => ({
      ...s,
      exercises: s.exercises.filter(ex => ex.sectionId !== sectionId),
    }));
  }

  function addSection() {
    const name = newSectionName.trim() || 'New Section';
    const id = `mobile_sec_${Date.now()}`;
    setExtraSections(prev => [...prev, { id, name }]);
    setNewSectionName('');
    setNewSectionDialogOpen(false);
    // Auto-expand the new section
    setExpandedSections(prev => new Set([...prev, id]));
  }

  function handleSupersetLink(targetId: string) {
    if (!supersetSourceId) return;
    const sourceEx = session.exercises.find(e => e.id === supersetSourceId);
    const existingSupersetId = sourceEx?.supersetId;
    const newSupersetId = existingSupersetId ?? `ss_mobile_${Date.now()}`;
    updateSession(s => ({
      ...s,
      exercises: s.exercises.map(ex => {
        if (ex.id === supersetSourceId || ex.id === targetId) {
          return { ...ex, supersetId: newSupersetId };
        }
        return ex;
      }),
    }));
    setSupersetPickerOpen(false);
    setSupersetSourceId(null);
    setSupersetSectionId(null);
  }

  function removeFromSuperset(exId: string) {
    updateSession(s => ({
      ...s,
      exercises: s.exercises.map(ex => {
        if (ex.id !== exId) return ex;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { supersetId: _removed, ...rest } = ex;
        return rest as ExerciseSummary;
      }),
    }));
  }

  function addExerciseFromLibrary(lib: CustomLibrary, ex: CustomExercise) {
    const sectionId = pickerTargetSectionId;
    const targetSection = allSections.find(s => s.id === sectionId);
    const nameCol =
      lib.columns.find(c => c.required) ??
      lib.columns.find(c => !c.role) ??
      lib.columns[0];
    const name = nameCol ? (String(ex.data[nameCol.id] ?? '') || 'Exercise') : 'Exercise';
    const videoCol = lib.columns.find(c => c.role === 'video');
    const descCol = lib.columns.find(c => c.role === 'description');
    const videoUrl =
      (videoCol ? String(ex.data[videoCol.id] ?? '') : '') ||
      (ex.videoUrl ?? undefined);
    const description =
      (descCol ? String(ex.data[descCol.id] ?? '') : '') ||
      (ex.description ?? undefined);

    const order = (entry?.sessions[sessionIdx]?.exercises.length ?? 0);
    const newEx: ExerciseSummary = {
      id: `mobile_ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      order,
      sectionId: targetSection?.id,
      sectionName: targetSection?.name,
      sectionOrder: targetSection?.order,
      exerciseLibraryId: ex.id,
      exerciseVideoUrl: videoUrl || undefined,
      exerciseDescription: description || undefined,
      mobileEdited: true,
      mobileAdded: true,
      plannedSets: 3,
      plannedParams: { Sets: 3, Reps_set1: '', Reps_set2: '', Reps_set3: '' },
      visibleParams: ['Reps'],
    };
    updateSession(s => ({ ...s, exercises: [...s.exercises, newEx] }));
    setExercisePickerOpen(false);
    // Also expand the target section so the new exercise is visible
    if (targetSection?.id) {
      setExpandedSections(prev => new Set([...prev, targetSection.id]));
    }
  }

  function addCircuitFromLibrary(circuit: Circuit) {
    const sectionId = pickerTargetSectionId;
    const targetSection = allSections.find(s => s.id === sectionId);
    const order = (entry?.sessions[sessionIdx]?.exercises.length ?? 0);
    const newEx: ExerciseSummary = {
      id: `mobile_circuit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: circuit.name,
      order,
      sectionId: targetSection?.id,
      sectionName: targetSection?.name,
      sectionOrder: targetSection?.order,
      isCircuit: true,
      circuitRounds: circuit.rounds ?? '3',
      circuitRestBetweenRounds: circuit.restBetweenRounds,
      circuitRestBetweenExercises: circuit.restBetweenExercises,
      circuitComments: circuit.comments,
      circuitExercises: circuit.exercises.map(e => ({
        id: e.id,
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        reps: e.reps,
        time: e.time,
        distance: e.distance,
        enabledParams: e.enabledParams,
        order: e.order,
      })),
      mobileEdited: true,
      mobileAdded: true,
      plannedSets: 1,
      plannedParams: { Sets: 1 },
    };
    updateSession(s => ({ ...s, exercises: [...s.exercises, newEx] }));
    setExercisePickerOpen(false);
    if (targetSection?.id) {
      setExpandedSections(prev => new Set([...prev, targetSection.id]));
    }
  }

  function handleCancel() {
    setEntry(originalEntry.current);
    setExtraSections([]);
    setSectionNotesMap(
      initSectionNotesMap(originalEntry.current?.sessions[sessionIdx]?.exercises ?? [])
    );
    setSectionNotesOpen(new Set());
    setMode('view');
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!entry) return;
    setSaving(true);
    try {
      const sessionsWithFlag = entry.sessions.map((s, i) =>
        i !== sessionIdx ? s : {
          ...s,
          exercises: s.exercises.map(ex => ({
            ...ex,
            mobileEdited: true,
            // Apply section notes from the local map
            sectionNotes: ex.sectionId
              ? (sectionNotesMap[ex.sectionId] ?? ex.sectionNotes)
              : ex.sectionNotes,
          })),
        }
      );
      const { error } = await supabase
        .from('athlete_schedule')
        .update({ sessions: sessionsWithFlag, intensity: entry.intensity })
        .eq('id', entry.id);
      if (error) throw error;
      originalEntry.current = { ...entry, sessions: sessionsWithFlag };
      toast({ title: 'Saved ✓', description: 'Session updated in athlete schedule.' });
      setMode('view');
    } catch {
      toast({ title: 'Error', description: 'Could not save. Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── VIEW MODE ──────────────────────────────────────────────────────────────

  if (mode === 'view') {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-base truncate">
            {session?.name || 'Session'}
          </h1>
          <button
            onClick={() => setMode('edit')}
            className="text-sm font-medium text-primary hover:opacity-80 active:opacity-60 transition-opacity w-8 text-right shrink-0"
          >
            Edit
          </button>
        </div>

        {sections.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Dumbbell className="h-8 w-8 opacity-30" />
            <p className="text-sm">No exercises assigned yet.</p>
            <Button size="sm" variant="outline" onClick={() => setMode('edit')}>
              Edit Session
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="px-4 py-4 space-y-3">
                {/* Day intensity */}
                {entry.intensity && (
                  <div className="pb-1">
                    <p className="text-xs text-muted-foreground mb-1">Day Intensity</p>
                    <IntensityBadge intensity={entry.intensity} />
                  </div>
                )}

                {/* Session intensity */}
                {session.intensity && (
                  <div className="pb-1">
                    <p className="text-xs text-muted-foreground mb-1">Session Intensity</p>
                    <IntensityBadge intensity={session.intensity} />
                  </div>
                )}

                {/* Session notes */}
                {session.notes && (
                  <p className="text-sm text-muted-foreground leading-relaxed pb-1">
                    {session.notes}
                  </p>
                )}

                {/* Collapsible section cards */}
                {sections.map(sec => {
                  const isOpen = expandedSections.has(sec.id);
                  return (
                    <Card key={sec.id} className="overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors"
                        onClick={() => toggleSection(sec.id)}
                      >
                        <div className="text-left">
                          <p className="font-semibold text-sm">{sec.name}</p>
                          {sec.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sec.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {sec.exercises.length} exercise{sec.exercises.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t divide-y divide-border/50">
                          {sec.exercises.map((ex, i) => (
                            <div
                              key={ex.id}
                              className={cn(
                                'flex items-center gap-3 px-4 py-2.5',
                                ex.supersetId && 'border-l-2 border-primary/40 pl-3'
                              )}
                            >
                              <span className="text-xs text-muted-foreground w-4 shrink-0 text-right tabular-nums">
                                {i + 1}
                              </span>
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {ex.isCircuit && (
                                  <RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" />
                                )}
                                <span className="text-sm truncate">{ex.name}</span>
                                {(ex.exerciseVideoUrl || ex.exerciseDescription) && !ex.isCircuit && (
                                  <button
                                    onClick={() => setDetailTarget({
                                      name: ex.name,
                                      videoUrl: ex.exerciseVideoUrl,
                                      description: ex.exerciseDescription,
                                    })}
                                    className="shrink-0 text-muted-foreground hover:text-foreground active:opacity-60"
                                    aria-label="View exercise details"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              {ex.isCircuit ? (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {ex.circuitRounds ?? 3} rounds
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {getSetCount(ex)} sets
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="p-4 border-t shrink-0">
              <Button className="w-full" onClick={() => setMode('edit')}>
                Edit Session
              </Button>
            </div>
          </>
        )}

        <ExerciseDetailDialog target={detailTarget} onClose={() => setDetailTarget(null)} />
      </div>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────

  // Collect exercises in same section as supersetSourceId (for picker)
  const supersetSectionExercises = supersetSectionId
    ? (allSections.find(s => s.id === supersetSectionId)?.exercises ?? [])
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b shrink-0">
        <button
          onClick={handleCancel}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent -ml-1 shrink-0"
          aria-label="Cancel"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="flex-1 text-sm font-semibold truncate text-center">
          {session?.name || 'Session'}
        </p>
        <Button size="sm" onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Session notes */}
      <div className="px-4 pt-3 pb-2 border-b shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
          Session Notes
        </p>
        <textarea
          value={session.notes ?? ''}
          onChange={e => updateSession(s => ({ ...s, notes: e.target.value }))}
          placeholder="Add notes for this session…"
          rows={2}
          className="w-full text-sm border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Day intensity */}
      <button
        onClick={() => setDayIntensityOpen(true)}
        className="flex items-center justify-between px-4 py-3 border-b shrink-0 w-full text-left active:bg-accent/40"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Day Intensity
        </p>
        {entry.intensity
          ? <IntensityBadge intensity={entry.intensity} />
          : <span className="text-xs text-muted-foreground italic">Tap to set…</span>}
      </button>

      {/* Session intensity */}
      <button
        onClick={() => setSessionIntensityOpen(true)}
        className="flex items-center justify-between px-4 py-3 border-b shrink-0 w-full text-left active:bg-accent/40"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Session Intensity
        </p>
        {session.intensity
          ? <IntensityBadge intensity={session.intensity} />
          : <span className="text-xs text-muted-foreground italic">Tap to set…</span>}
      </button>

      {/* Section list */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5 pb-10">
          {allSections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sections yet. Add exercises or create a section.
            </p>
          ) : allSections.map(section => (
            <div key={section.id} className="space-y-2">
              {/* Section header */}
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground truncate">
                  {section.name}
                </p>
                {/* Notes toggle */}
                <button
                  onClick={() => toggleSectionNotes(section.id)}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                    sectionNotesOpen.has(section.id)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label="Toggle section notes"
                  title="Section notes"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
                {/* Delete section */}
                <button
                  onClick={() => deleteSection(section.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Delete section"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Section notes textarea */}
              {sectionNotesOpen.has(section.id) && (
                <textarea
                  value={sectionNotesMap[section.id] ?? section.notes ?? ''}
                  onChange={e =>
                    setSectionNotesMap(prev => ({ ...prev, [section.id]: e.target.value }))
                  }
                  placeholder="Section notes…"
                  rows={2}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                />
              )}

              {/* Exercises */}
              {section.exercises.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-xl">
                  No exercises yet — add one below
                </p>
              ) : section.exercises.map(ex => {
                const params = getParamColumns(ex);
                const sets = getSetCount(ex);
                const inSuperset = !!ex.supersetId;

                return (
                  <div
                    key={ex.id}
                    className={cn(
                      'rounded-xl border bg-card overflow-hidden',
                      inSuperset && 'border-l-4 border-l-primary/60'
                    )}
                  >
                    {/* Exercise header */}
                    <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-b gap-2">
                      <p className="text-sm font-semibold truncate flex-1 min-w-0">{ex.name}</p>

                      {/* Superset link/unlink */}
                      {!ex.isCircuit && (
                        <button
                          onClick={() => {
                            if (inSuperset) {
                              removeFromSuperset(ex.id);
                            } else {
                              setSupersetSourceId(ex.id);
                              setSupersetSectionId(section.id);
                              setSupersetPickerOpen(true);
                            }
                          }}
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0',
                            inSuperset
                              ? 'bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive'
                              : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                          )}
                          aria-label={inSuperset ? 'Remove from superset' : 'Add to superset'}
                          title={inSuperset ? 'Remove from superset' : 'Link to superset'}
                        >
                          {inSuperset ? <Unlink2 className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                        </button>
                      )}

                      {/* Sets ± */}
                      {!ex.isCircuit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground">Sets</span>
                          <button
                            onClick={() => changeSetCount(ex.id, -1)}
                            className="w-6 h-6 rounded-full border bg-background flex items-center justify-center active:bg-accent"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm font-bold w-4 text-center tabular-nums">{sets}</span>
                          <button
                            onClick={() => changeSetCount(ex.id, +1)}
                            className="w-6 h-6 rounded-full border bg-background flex items-center justify-center active:bg-accent"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => deleteExercise(ex.id)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        aria-label="Delete exercise"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Params table */}
                    {params.length > 0 && !ex.isCircuit && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/10">
                              <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground w-8">
                                Set
                              </th>
                              {params.map(p => (
                                <th key={p} className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                  {p}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: sets }, (_, i) => (
                              <tr
                                key={i}
                                className={cn('border-b last:border-0', i % 2 === 1 && 'bg-muted/10')}
                              >
                                <td className="px-3 py-2 text-xs font-medium text-muted-foreground">
                                  {i + 1}
                                </td>
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

                    {/* Circuit info */}
                    {ex.isCircuit && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        {ex.circuitRounds ?? 3} rounds · {ex.circuitExercises?.length ?? 0} exercises
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add exercise / circuit buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setPickerTargetSectionId(section.id);
                    setExercisePickerOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-primary hover:border-primary active:opacity-60 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Exercise
                </button>
                <button
                  onClick={() => {
                    setPickerTargetSectionId(section.id);
                    setExercisePickerOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-primary hover:border-primary active:opacity-60 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Circuit
                </button>
              </div>
            </div>
          ))}

          {/* Add section */}
          <button
            onClick={() => setNewSectionDialogOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm text-muted-foreground hover:text-primary hover:border-primary active:opacity-60 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Section
          </button>

          {/* If no sections at all, also show quick add */}
          {allSections.length === 0 && libraries.length > 0 && (
            <button
              onClick={() => {
                setPickerTargetSectionId('__none__');
                setExercisePickerOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium hover:bg-muted/50 active:opacity-60 transition-colors"
            >
              <Dumbbell className="h-4 w-4 text-primary" />
              Add Exercise
            </button>
          )}
        </div>
      </ScrollArea>

      {/* ── Sheets & Dialogs ── */}

      {/* Day intensity picker */}
      <IntensityPickerSheet
        open={dayIntensityOpen}
        title="Day Intensity"
        current={entry.intensity}
        onSelect={v => {
          setEntry(prev => prev ? { ...prev, intensity: v } : prev);
          setDayIntensityOpen(false);
        }}
        onClose={() => setDayIntensityOpen(false)}
      />

      {/* Session intensity picker */}
      <IntensityPickerSheet
        open={sessionIntensityOpen}
        title="Session Intensity"
        current={session.intensity}
        onSelect={v => {
          updateSession(s => ({ ...s, intensity: v ?? undefined }));
          setSessionIntensityOpen(false);
        }}
        onClose={() => setSessionIntensityOpen(false)}
      />

      {/* Exercise / circuit picker */}
      <ExercisePickerSheet
        open={exercisePickerOpen}
        onClose={() => setExercisePickerOpen(false)}
        onSelectExercise={(lib, ex) => addExerciseFromLibrary(lib, ex)}
        onSelectCircuit={(circuit) => addCircuitFromLibrary(circuit)}
      />

      {/* Superset picker */}
      <SupersetPickerSheet
        open={supersetPickerOpen}
        sourceId={supersetSourceId}
        sectionExercises={supersetSectionExercises}
        onLink={handleSupersetLink}
        onClose={() => {
          setSupersetPickerOpen(false);
          setSupersetSourceId(null);
          setSupersetSectionId(null);
        }}
      />

      {/* New section dialog */}
      <Dialog open={newSectionDialogOpen} onOpenChange={o => { if (!o) setNewSectionDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[380px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>New Section</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              placeholder="Section name (e.g. Warm-up)"
              onKeyDown={e => { if (e.key === 'Enter') addSection(); }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewSectionDialogOpen(false)}>Cancel</Button>
            <Button onClick={addSection}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExerciseDetailDialog target={detailTarget} onClose={() => setDetailTarget(null)} />
    </div>
  );
}
