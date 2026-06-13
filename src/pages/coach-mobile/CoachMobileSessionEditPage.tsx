import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronDown, ChevronRight, Plus, Minus, Check,
  Info, RefreshCw, Dumbbell, Trash2, Link2, AlignLeft,
  ArrowUp, ArrowDown, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { AthleteScheduleEntry, ExerciseSummary, SessionSummary } from '@/hooks/useAthleteApp';
import { IntensityBadge, INTENSITY_CONFIG } from '@/components/athlete-app/IntensityBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import { useToolboxData } from '@/hooks/useToolboxData';
import type { CustomLibrary, CustomExercise, Circuit } from '@/contexts/CustomLibrariesContext';
import type { ToolboxEntry } from '@/types/toolbox';

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
  if (ex.plannedParams) {
    const setsKey = Object.keys(ex.plannedParams).find(k => /^sets?$/i.test(k));
    if (setsKey) {
      const n = Number(ex.plannedParams[setsKey]);
      if (n > 0) return n;
    }
  }
  return ex.plannedSets && ex.plannedSets > 0 ? ex.plannedSets : 3;
}

/**
 * Get the columns to display for an exercise.
 * If `visibleParams` is explicitly set, always use those — do NOT filter by
 * "has a value yet", because that causes all other columns to vanish the moment
 * the user fills in the first set of one param.
 */
function getParamColumns(ex: ExerciseSummary): string[] {
  const REST_RE = /rest|pause|recovery/i;

  // visibleParams is the explicit source of truth — respect it fully
  if (ex.visibleParams && ex.visibleParams.length > 0) {
    return ex.visibleParams.filter(p => p !== ex.restParamName && !REST_RE.test(p));
  }

  // Fall back: derive from plannedParams keys (strip _setN suffix)
  if (ex.plannedParams) {
    const bases = new Set<string>();
    for (const key of Object.keys(ex.plannedParams)) {
      if (/^sets?$/i.test(key)) continue;
      const m = key.match(/^(.+)_set\d+$/);
      if (m) bases.add(m[1]);
    }
    const candidates = Array.from(bases).filter(p => p !== ex.restParamName && !REST_RE.test(p));
    if (candidates.length > 0) return candidates;
  }

  return ['Reps'];
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

/** Collect all candidate param names an exercise could display. */
function getCandidateParams(ex: ExerciseSummary, toolboxEntries: ToolboxEntry[]): string[] {
  const REST_RE = /rest|pause|recovery/i;
  const params = new Set<string>();

  if (ex.visibleParams) {
    for (const p of ex.visibleParams) params.add(p);
  }
  if (ex.plannedParams) {
    for (const key of Object.keys(ex.plannedParams)) {
      if (/^sets?$/i.test(key)) continue;
      const m = key.match(/^(.+)_set\d+$/);
      if (m) params.add(m[1]);
      else params.add(key);
    }
  }
  if (ex.methodKey) {
    const stripped = ex.methodKey.includes('::') ? ex.methodKey.split('::')[0] : ex.methodKey;
    for (const entry of toolboxEntries) {
      const methodId = entry.subCategory ? `${entry.category} - ${entry.subCategory}` : entry.category;
      if (methodId !== stripped) continue;
      if (entry.isFrequencyParameter || entry.isSetParameter) continue;
      params.add(entry.parameterName);
    }
  }
  return Array.from(params).filter(
    p => p !== ex.restParamName && !REST_RE.test(p) && !/^sets?$/i.test(p),
  );
}

// ── Exercise detail dialog ─────────────────────────────────────────────────────

interface ExerciseDetailTarget { name: string; videoUrl?: string; description?: string }

function ExerciseDetailDialog({ target, onClose }: { target: ExerciseDetailTarget | null; onClose: () => void }) {
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
            <p className="text-sm text-muted-foreground text-center py-6">No details available.</p>
          )}
          {target.videoUrl && (
            <a href={target.videoUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors">
              Watch video
            </a>
          )}
          {target.description && (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{target.description}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared constraint for portal sheets (phone-shell centering on desktop) ────
const SHEET_CENTER = 'sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2';

// ── Intensity picker sheet ─────────────────────────────────────────────────────

function IntensityPickerSheet({
  open, title, current, onSelect, onClose,
}: {
  open: boolean; title: string; current: string | null | undefined;
  onSelect: (v: string | null) => void; onClose: () => void;
}) {
  const levels = Object.entries(INTENSITY_CONFIG)
    .filter(([k]) => /^\d+$/.test(k))
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className={cn('rounded-t-2xl flex flex-col', SHEET_CENTER)}
        style={{ maxHeight: '75vh', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
        <SheetHeader className="mb-4 px-4 pt-4 shrink-0">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 px-4">
          <div className="grid grid-cols-1 gap-2 pb-4">
            {levels.map(([key, cfg]) => (
              <button key={key} onClick={() => onSelect(key)}
                className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left active:opacity-70 transition-colors',
                  current === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
                {current === key ? <Check className="h-4 w-4 text-primary shrink-0" /> : <div className="w-4 shrink-0" />}
                <span className={cn('text-sm font-medium px-2.5 py-1 rounded-full', cfg.color)}>{cfg.label}</span>
              </button>
            ))}
            <button onClick={() => onSelect(null)} className="text-xs text-muted-foreground py-3 text-center active:opacity-70">
              Clear intensity
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Exercise / Circuit picker sheet ───────────────────────────────────────────

function ExercisePickerSheet({
  open, onClose, onSelectExercise, onSelectCircuit,
}: {
  open: boolean; onClose: () => void;
  onSelectExercise: (lib: CustomLibrary, ex: CustomExercise) => void;
  onSelectCircuit: (circuit: Circuit, lib: CustomLibrary) => void;
}) {
  const { libraries } = useCustomLibraries();
  const [tab, setTab] = useState<'exercises' | 'circuits'>('exercises');
  const [libIdx, setLibIdx] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => { if (open) { setSearch(''); setLibIdx(0); setTab('exercises'); } }, [open]);

  function getExName(lib: CustomLibrary, ex: CustomExercise): string {
    const col = lib.columns.find(c => c.required) ?? lib.columns.find(c => !c.role) ?? lib.columns[0];
    return col ? (String(ex.data[col.id] ?? '') || 'Exercise') : 'Exercise';
  }

  const currentLib = libraries[libIdx] ?? null;
  const allCircuits = libraries.flatMap(lib => (lib.circuits ?? []).map(c => ({ circuit: c, lib })));
  const filteredExercises = currentLib
    ? currentLib.exercises.filter(ex => !search || getExName(currentLib, ex).toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className={cn('rounded-t-2xl pb-safe flex flex-col gap-0 p-0', SHEET_CENTER)}
        style={{ maxHeight: '85vh' }}>
        <div className="px-4 pt-4 pb-3 border-b shrink-0">
          <SheetHeader><SheetTitle>Add to Session</SheetTitle></SheetHeader>
          <div className="flex gap-0 border rounded-lg overflow-hidden mt-3">
            {(['exercises', 'circuits'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 py-2 text-sm font-medium capitalize transition-colors',
                  tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground bg-background')}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {tab === 'exercises' ? (
          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 gap-2">
            {libraries.length > 1 && (
              <div className="flex gap-1 flex-wrap shrink-0">
                {libraries.map((l, i) => (
                  <button key={l.id} onClick={() => setLibIdx(i)}
                    className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      libIdx === i ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises…"
              className="w-full h-9 border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary shrink-0" />
            <div className="flex-1 overflow-y-auto -mx-1">
              <div className="space-y-0.5 pb-6 px-1">
                {libraries.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No exercise libraries found.</p>}
                {filteredExercises.length === 0 && libraries.length > 0 && <p className="text-sm text-muted-foreground text-center py-8">No exercises match your search.</p>}
                {filteredExercises.map(ex => (
                  <button key={ex.id} onClick={() => { if (currentLib) onSelectExercise(currentLib, ex); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 active:bg-muted text-left transition-colors">
                    <Plus className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">{getExName(currentLib!, ex)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pt-3">
            <div className="space-y-0.5 pb-6">
              {allCircuits.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">No circuits in your libraries.</p>
                : allCircuits.map(({ circuit, lib: cLib }) => (
                  <button key={circuit.id} onClick={() => onSelectCircuit(circuit, cLib)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 active:bg-muted text-left transition-colors">
                    <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{circuit.name}</p>
                      <p className="text-xs text-muted-foreground">{circuit.exercises.length} ex · {circuit.rounds ?? 3} rounds · {cLib.name}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Superset picker sheet ─────────────────────────────────────────────────────

function SupersetPickerSheet({
  open, sourceId, sectionExercises, onLink, onClose,
}: {
  open: boolean; sourceId: string | null; sectionExercises: ExerciseSummary[];
  onLink: (targetId: string) => void; onClose: () => void;
}) {
  const sourceEx = sectionExercises.find(e => e.id === sourceId);
  const candidates = sectionExercises.filter(e => {
    if (e.id === sourceId || e.isCircuit) return false;
    if (sourceEx?.supersetId && e.supersetId === sourceEx.supersetId) return false;
    return true;
  });
  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className={cn('rounded-t-2xl', SHEET_CENTER)}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}>
        <SheetHeader className="mb-4"><SheetTitle>Link to Superset</SheetTitle></SheetHeader>
        {sourceEx && <p className="text-xs text-muted-foreground mb-3 px-1">Linking with: <span className="font-semibold text-foreground">{sourceEx.name}</span></p>}
        {candidates.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-6">No other exercises available to link in this section.</p>
          : <div className="space-y-2">
              {candidates.map(ex => (
                <button key={ex.id} onClick={() => onLink(ex.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border hover:bg-muted/50 active:bg-muted transition-colors text-left">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">{ex.name}</span>
                </button>
              ))}
            </div>}
      </SheetContent>
    </Sheet>
  );
}

// ── Method selection sheet ────────────────────────────────────────────────────

interface MethodEntry { id: string; category: string; subCategory: string; params: ToolboxEntry[] }

function MethodSelectionSheet({ open, onClose, onConfirm }: {
  open: boolean; onClose: () => void;
  onConfirm: (methodId: string, visibleParams: string[], initialParams: Record<string, string | number>) => void;
}) {
  const { data: toolboxData } = useToolboxData();
  const [step, setStep] = useState<'method' | 'params'>('method');
  const [search, setSearch] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [paramVisibility, setParamVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) { setStep('method'); setSearch(''); setSelectedMethodId(''); setExpandedCats(new Set()); setParamVisibility({}); }
  }, [open]);

  const allMethods: MethodEntry[] = useMemo(() => {
    const map = new Map<string, MethodEntry>();
    for (const entry of toolboxData?.entries ?? []) {
      const id = entry.subCategory ? `${entry.category} - ${entry.subCategory}` : entry.category;
      if (!map.has(id)) map.set(id, { id, category: entry.category, subCategory: entry.subCategory ?? '', params: [] });
      map.get(id)!.params.push(entry);
    }
    return Array.from(map.values());
  }, [toolboxData]);

  const byCategory = useMemo(() => {
    const groups: Record<string, MethodEntry[]> = {};
    for (const m of allMethods) { if (!groups[m.category]) groups[m.category] = []; groups[m.category].push(m); }
    return groups;
  }, [allMethods]);

  const filteredByCategory = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return byCategory;
    const result: Record<string, MethodEntry[]> = {};
    for (const [cat, methods] of Object.entries(byCategory)) {
      const matching = methods.filter(m => m.id.toLowerCase().includes(q) || m.subCategory.toLowerCase().includes(q));
      if (matching.length > 0) result[cat] = matching;
    }
    return result;
  }, [byCategory, search]);

  const selectedMethod = allMethods.find(m => m.id === selectedMethodId) ?? null;
  const displayParams = selectedMethod?.params.filter(p => !p.isFrequencyParameter && !p.isSetParameter) ?? [];

  function handleSelectMethod(methodId: string) {
    setSelectedMethodId(methodId);
    const method = allMethods.find(m => m.id === methodId);
    const init: Record<string, boolean> = {};
    for (const p of method?.params ?? []) {
      if (p.isFrequencyParameter || p.isSetParameter) continue;
      init[p.parameterName] = p.showInGridByDefault !== false;
    }
    setParamVisibility(init);
    setStep('params');
  }

  function buildAndConfirm(methodId: string) {
    const method = allMethods.find(m => m.id === methodId);
    const vis = displayParams.filter(p => paramVisibility[p.parameterName] !== false).map(p => p.parameterName);
    const setParam = method?.params.find(p => p.isSetParameter);
    const setsKey = setParam?.parameterName ?? 'Sets';
    const initial: Record<string, string | number> = { [setsKey]: 3 };
    for (const p of (method?.params ?? [])) {
      if (p.isFrequencyParameter || p.isSetParameter) continue;
      initial[p.parameterName] = '';
      for (let i = 1; i <= 3; i++) initial[`${p.parameterName}_set${i}`] = '';
    }
    onConfirm(methodId, vis.length > 0 ? vis : ['Reps'], initial);
  }

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className={cn('rounded-t-2xl flex flex-col gap-0 p-0', SHEET_CENTER)} style={{ maxHeight: '85vh' }}>
        <div className="px-4 pt-4 pb-3 border-b shrink-0 flex items-center gap-3">
          {step === 'params' && (
            <button onClick={() => setStep('method')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold leading-snug">{step === 'method' ? 'Select Training Method' : 'Configure Parameters'}</h2>
            {step === 'params' && selectedMethod && <p className="text-xs text-muted-foreground truncate mt-0.5">{selectedMethod.subCategory || selectedMethod.category}</p>}
          </div>
        </div>

        {step === 'method' && (
          <>
            <div className="px-4 pt-3 shrink-0">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search methods…"
                className="w-full h-9 border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
              {allMethods.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">No training methods found. Add methods in the Training Toolbox.</p>
                : Object.entries(filteredByCategory).map(([cat, methods]) => {
                    const isOpen = expandedCats.has(cat);
                    return (
                      <div key={cat} className="mb-1">
                        <button onClick={() => setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; })}
                          className="w-full flex items-center justify-between py-2.5 text-left">
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{cat}</span>
                          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                        </button>
                        {isOpen && (
                          <div className="space-y-1 pb-1">
                            {methods.map(m => (
                              <button key={m.id} onClick={() => handleSelectMethod(m.id)}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border hover:bg-muted/50 active:bg-muted transition-colors text-left gap-2">
                                <span className="text-sm">{m.subCategory || m.category}</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              <button onClick={() => onConfirm('', ['Reps'], { Sets: 3, Reps_set1: '', Reps_set2: '', Reps_set3: '' })}
                className="w-full text-xs text-muted-foreground py-4 text-center hover:text-foreground transition-colors">
                Skip — add without method
              </button>
            </div>
          </>
        )}

        {step === 'params' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 pt-3">
              {displayParams.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">No configurable parameters for this method.</p>
                : (
                  <div className="space-y-2 pb-4">
                    <p className="text-xs text-muted-foreground mb-3">Choose which parameters to show for each set:</p>
                    {displayParams.map(p => {
                      const isOn = paramVisibility[p.parameterName] !== false;
                      return (
                        <button key={p.parameterName}
                          onClick={() => setParamVisibility(prev => ({ ...prev, [p.parameterName]: !isOn }))}
                          className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left',
                            isOn ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                          <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                            isOn ? 'bg-primary border-primary' : 'border-muted-foreground/40')}>
                            {isOn && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <span className="text-sm font-medium">{p.parameterName}</span>
                          {p.parameterType === 'qualitative' && <span className="text-xs text-muted-foreground ml-auto">qualitative</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>
            <div className="px-4 pb-6 pt-3 border-t shrink-0">
              <Button className="w-full" onClick={() => buildAndConfirm(selectedMethodId)}>Add Exercise</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Param config sheet ────────────────────────────────────────────────────────

function ParamConfigSheet({ open, exercise, toolboxEntries, onSave, onClose }: {
  open: boolean; exercise: ExerciseSummary | null; toolboxEntries: ToolboxEntry[];
  onSave: (exId: string, visibleParams: string[]) => void; onClose: () => void;
}) {
  const [localVisible, setLocalVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!exercise || !open) return;
    const all = getCandidateParams(exercise, toolboxEntries);
    const cur = new Set(exercise.visibleParams ?? all);
    const init: Record<string, boolean> = {};
    for (const p of all) init[p] = cur.has(p);
    setLocalVisible(init);
  }, [exercise, open, toolboxEntries]);

  if (!exercise) return null;
  const candidates = getCandidateParams(exercise, toolboxEntries);

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className={cn('rounded-t-2xl flex flex-col gap-0 p-0', SHEET_CENTER)} style={{ maxHeight: '70vh' }}>
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <SheetTitle className="text-base truncate">{exercise.name}</SheetTitle>
          <p className="text-xs text-muted-foreground">Toggle visible parameters</p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pt-3">
          {candidates.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-8">No configurable parameters found.</p>
            : (
              <div className="space-y-2 pb-4">
                {candidates.map(p => {
                  const isOn = localVisible[p] !== false;
                  return (
                    <button key={p} onClick={() => setLocalVisible(prev => ({ ...prev, [p]: !isOn }))}
                      className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left',
                        isOn ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                      <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        isOn ? 'bg-primary border-primary' : 'border-muted-foreground/40')}>
                        {isOn && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className="text-sm font-medium">{p}</span>
                    </button>
                  );
                })}
              </div>
            )}
        </div>
        <div className="px-4 pb-6 pt-3 border-t shrink-0">
          <Button className="w-full" onClick={() => {
            const chosen = candidates.filter(p => localVisible[p] !== false);
            onSave(exercise.id, chosen.length > 0 ? chosen : ['Reps']);
          }}>Done</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Superset connector (between exercises) ────────────────────────────────────

function SupersetConnector({
  exA, exB, onLink, onUnlink, editMode,
}: {
  exA: ExerciseSummary; exB: ExerciseSummary;
  onLink: () => void; onUnlink: () => void; editMode: boolean;
}) {
  const linked = !!(exA.supersetId && exB.supersetId && exA.supersetId === exB.supersetId);
  if (!editMode && !linked) return null;

  return (
    <div className="flex items-center gap-2 py-0 px-3">
      <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      {linked ? (
        editMode ? (
          <button onClick={onUnlink}
            title="Tap to unlink from superset"
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-primary border border-primary/40 bg-primary/5 rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors shrink-0 active:opacity-60">
            <Link2 className="h-3 w-3" /> SS
          </button>
        ) : (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-primary border border-primary/30 bg-primary/5 rounded-full shrink-0">
            <Link2 className="h-3 w-3" /> SS
          </span>
        )
      ) : (
        editMode && (
          <button onClick={onLink}
            title="Link to superset"
            className="flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted transition-colors shrink-0 active:opacity-60">
            <Link2 className="h-3 w-3" />
          </button>
        )
      )}
      <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
    </div>
  );
}

// ── Circuit exercise list (inline) ────────────────────────────────────────────

function CircuitExerciseList({ ex }: { ex: ExerciseSummary }) {
  if (!ex.circuitExercises || ex.circuitExercises.length === 0) return null;
  return (
    <div className="border-t divide-y divide-border/30">
      {ex.circuitExercises.map((ce, ci) => (
        <div key={ce.id} className="flex items-center gap-2 pl-7 pr-4 py-1.5">
          <span className="text-xs text-muted-foreground w-4 tabular-nums shrink-0">{ci + 1}</span>
          <span className="text-xs flex-1 truncate">{ce.exerciseName}</span>
          {ce.reps && <span className="text-xs text-muted-foreground shrink-0">{ce.reps}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'view' | 'edit';
interface LocationState { entry: AthleteScheduleEntry; sessionIdx: number; connectionId?: string }

// ── Main component ────────────────────────────────────────────────────────────

export default function CoachMobileSessionEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { libraries } = useCustomLibraries();
  const { data: toolboxData } = useToolboxData();

  const state = location.state as LocationState | null;
  const originalEntry = useRef<AthleteScheduleEntry | null>(state?.entry ?? null);
  // connectionId from navigation state — used to identify the row by (athlete_connection_id, date)
  // instead of by the row UUID (which changes after every loadSync/autoSync DELETE+UPSERT).
  const connectionId = state?.connectionId ?? null;

  const [mode, setMode] = useState<Mode>('view');
  const [entry, setEntry] = useState<AthleteScheduleEntry | null>(state?.entry ?? null);
  const sessionIdx = state?.sessionIdx ?? 0;
  const [saving, setSaving] = useState(false);

  // ── Section state ──────────────────────────────────────────────────────────
  const [sectionNotesMap, setSectionNotesMap] = useState<Record<string, string>>({});
  const [sectionNotesOpen, setSectionNotesOpen] = useState<Set<string>>(new Set());
  const [extraSections, setExtraSections] = useState<Array<{ id: string; name: string; order: number }>>([]);
  const [newSectionDialogOpen, setNewSectionDialogOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // ── Exercise notes state ───────────────────────────────────────────────────
  const [exerciseNotesOpen, setExerciseNotesOpen] = useState<Set<string>>(new Set());

  // ── Intensity pickers ──────────────────────────────────────────────────────
  const [dayIntensityOpen, setDayIntensityOpen] = useState(false);
  const [sessionIntensityOpen, setSessionIntensityOpen] = useState(false);

  // ── Exercise/circuit picker ────────────────────────────────────────────────
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [pickerTargetSectionId, setPickerTargetSectionId] = useState<string | null>(null);

  // ── Method selection ───────────────────────────────────────────────────────
  const [pendingExercise, setPendingExercise] = useState<{ lib: CustomLibrary; ex: CustomExercise } | null>(null);
  const [methodSheetOpen, setMethodSheetOpen] = useState(false);

  // ── Param config ───────────────────────────────────────────────────────────
  const [paramConfigTarget, setParamConfigTarget] = useState<ExerciseSummary | null>(null);
  const [paramConfigOpen, setParamConfigOpen] = useState(false);

  // ── Superset picker ────────────────────────────────────────────────────────
  const [supersetPickerOpen, setSupersetPickerOpen] = useState(false);
  const [supersetSourceId, setSupersetSourceId] = useState<string | null>(null);
  const [supersetSectionId, setSupersetSectionId] = useState<string | null>(null);

  // ── Exercise detail dialog ─────────────────────────────────────────────────
  const [detailTarget, setDetailTarget] = useState<ExerciseDetailTarget | null>(null);

  // ── Derived sections ───────────────────────────────────────────────────────
  const sections = useMemo(
    () => groupIntoSections(entry?.sessions[sessionIdx]?.exercises ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry?.sessions[sessionIdx]?.exercises],
  );

  const allSections = useMemo(() => {
    const existingIds = new Set(sections.map(s => s.id));
    const extra = extraSections.filter(s => !existingIds.has(s.id)).map(s => ({
      id: s.id, name: s.name, order: s.order, notes: undefined as string | undefined, exercises: [] as ExerciseSummary[],
    }));
    return [...sections, ...extra].sort((a, b) => a.order - b.order);
  }, [sections, extraSections]);

  // ── Expanded sections: view=all open, edit=all collapsed ──────────────────
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const init = groupIntoSections(state?.entry?.sessions[state?.sessionIdx ?? 0]?.exercises ?? []);
    return new Set(init.map(s => s.id));
  });

  const prevModeRef = useRef<Mode>('view');
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    setExpandedSections(mode === 'edit' ? new Set() : new Set(allSections.map(s => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Init section notes once
  const sectionNotesInitRef = useRef(false);
  useEffect(() => {
    if (!entry || sectionNotesInitRef.current) return;
    sectionNotesInitRef.current = true;
    setSectionNotesMap(initSectionNotesMap(entry.sessions[sessionIdx]?.exercises ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!entry || !state) {
    return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Session not found.</div>;
  }
  const session: SessionSummary = entry.sessions[sessionIdx];

  // ── Helpers ────────────────────────────────────────────────────────────────
  function toggleSection(id: string) {
    setExpandedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // ── Edit helpers ───────────────────────────────────────────────────────────
  function updateSession(updater: (s: SessionSummary) => SessionSummary) {
    setEntry(prev => prev ? ({ ...prev, sessions: prev.sessions.map((s, i) => i !== sessionIdx ? s : updater(s)) }) : prev);
  }

  function updateExercise(exId: string, updater: (ex: ExerciseSummary) => ExerciseSummary) {
    updateSession(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? updater(ex) : ex) }));
  }

  function setParamValue(exId: string, paramName: string, setIdx: number, value: string) {
    updateExercise(exId, ex => {
      const params = { ...(ex.plannedParams ?? {}) };
      params[`${paramName}_set${setIdx + 1}`] = value;
      // Keep the plain key in sync with set 1 so existing code that reads it works
      if (setIdx === 0) params[paramName] = value;
      return { ...ex, plannedParams: params, mobileEdited: true };
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
        for (const base of paramBases)
          for (let i = current + 1; i <= next; i++) { const k = `${base}_set${i}`; if (!(k in newParams)) newParams[k] = ''; }
      } else {
        for (const base of paramBases)
          for (let i = next + 1; i <= current; i++) delete newParams[`${base}_set${i}`];
      }
      return { ...e, plannedSets: next, plannedParams: newParams };
    });
  }

  function deleteExercise(exId: string) {
    updateSession(s => ({ ...s, exercises: s.exercises.filter(ex => ex.id !== exId) }));
  }

  function deleteSection(sectionId: string) {
    setExtraSections(prev => prev.filter(s => s.id !== sectionId));
    updateSession(s => ({ ...s, exercises: s.exercises.filter(ex => ex.sectionId !== sectionId) }));
  }

  function addSection() {
    const name = newSectionName.trim() || 'New Section';
    const id = `mobile_sec_${Date.now()}`;
    const maxOrder = allSections.reduce((m, s) => Math.max(m, s.order), -1);
    setExtraSections(prev => [...prev, { id, name, order: maxOrder + 1 }]);
    setNewSectionName('');
    setNewSectionDialogOpen(false);
    setExpandedSections(prev => new Set([...prev, id]));
  }

  const moveSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
    const sorted = allSections;
    const idx = sorted.findIndex(s => s.id === sectionId);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const sec = sorted[idx]; const swap = sorted[swapIdx];
    const orderA = sec.order; const orderB = swap.order;
    updateSession(s => ({ ...s, exercises: s.exercises.map(ex => {
      if (ex.sectionId === sec.id) return { ...ex, sectionOrder: orderB };
      if (ex.sectionId === swap.id) return { ...ex, sectionOrder: orderA };
      return ex;
    }) }));
    setExtraSections(prev => prev.map(s => {
      if (s.id === sec.id) return { ...s, order: orderB };
      if (s.id === swap.id) return { ...s, order: orderA };
      return s;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSections]);

  const moveExercise = useCallback((exId: string, direction: 'up' | 'down') => {
    const ex = session.exercises.find(e => e.id === exId);
    if (!ex) return;
    const section = allSections.find(s => s.id === (ex.sectionId ?? '__none__'));
    if (!section) return;
    const idx = section.exercises.findIndex(e => e.id === exId);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= section.exercises.length - 1) return;
    const swapEx = section.exercises[direction === 'up' ? idx - 1 : idx + 1];
    updateSession(s => ({ ...s, exercises: s.exercises.map(e => {
      if (e.id === exId) return { ...e, order: swapEx.order };
      if (e.id === swapEx.id) return { ...e, order: ex.order };
      return e;
    }) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSections, session]);

  function handleSupersetLink(targetId: string) {
    if (!supersetSourceId) return;
    const sourceEx = session.exercises.find(e => e.id === supersetSourceId);
    const newSupersetId = sourceEx?.supersetId ?? `ss_mobile_${Date.now()}`;
    updateSession(s => ({ ...s, exercises: s.exercises.map(ex => {
      if (ex.id === supersetSourceId || ex.id === targetId) return { ...ex, supersetId: newSupersetId };
      return ex;
    }) }));
    setSupersetPickerOpen(false); setSupersetSourceId(null); setSupersetSectionId(null);
  }

  function removeFromSuperset(exId: string) {
    updateSession(s => ({ ...s, exercises: s.exercises.map(ex => {
      if (ex.id !== exId) return ex;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { supersetId: _r, ...rest } = ex;
      return rest as ExerciseSummary;
    }) }));
  }

  function linkAdjacentAsSuperset(exA: ExerciseSummary, exB: ExerciseSummary) {
    const newSupersetId = exA.supersetId ?? exB.supersetId ?? `ss_mobile_${Date.now()}`;
    updateSession(s => ({ ...s, exercises: s.exercises.map(ex => {
      if (ex.id === exA.id || ex.id === exB.id) return { ...ex, supersetId: newSupersetId };
      return ex;
    }) }));
  }

  function handleExerciseFromLibraryPick(lib: CustomLibrary, ex: CustomExercise) {
    setPendingExercise({ lib, ex });
    setExercisePickerOpen(false);
    setMethodSheetOpen(true);
  }

  function handleMethodConfirm(methodId: string, visibleParams: string[], initialParams: Record<string, string | number>) {
    if (!pendingExercise) return;
    const { lib, ex } = pendingExercise;
    const targetSection = allSections.find(s => s.id === pickerTargetSectionId);
    const nameCol = lib.columns.find(c => c.required) ?? lib.columns.find(c => !c.role) ?? lib.columns[0];
    const name = nameCol ? (String(ex.data[nameCol.id] ?? '') || 'Exercise') : 'Exercise';
    const videoCol = lib.columns.find(c => c.role === 'video');
    const descCol = lib.columns.find(c => c.role === 'description');
    const newEx: ExerciseSummary = {
      id: `mobile_ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name, order: entry?.sessions[sessionIdx]?.exercises.length ?? 0,
      sectionId: targetSection?.id, sectionName: targetSection?.name, sectionOrder: targetSection?.order,
      exerciseLibraryId: ex.id,
      exerciseVideoUrl: (videoCol ? String(ex.data[videoCol.id] ?? '') : '') || (ex.videoUrl ?? undefined) || undefined,
      exerciseDescription: (descCol ? String(ex.data[descCol.id] ?? '') : '') || (ex.description ?? undefined) || undefined,
      mobileEdited: true, mobileAdded: true,
      methodKey: methodId || undefined,
      plannedSets: Number(initialParams['Sets'] ?? 3),
      plannedParams: initialParams,
      visibleParams: visibleParams.length > 0 ? visibleParams : ['Reps'],
    };
    updateSession(s => ({ ...s, exercises: [...s.exercises, newEx] }));
    setPendingExercise(null); setMethodSheetOpen(false);
    if (targetSection?.id) setExpandedSections(prev => new Set([...prev, targetSection.id]));
  }

  function addCircuitFromLibrary(circuit: Circuit) {
    const targetSection = allSections.find(s => s.id === pickerTargetSectionId);
    const newEx: ExerciseSummary = {
      id: `mobile_circuit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: circuit.name, order: entry?.sessions[sessionIdx]?.exercises.length ?? 0,
      sectionId: targetSection?.id, sectionName: targetSection?.name, sectionOrder: targetSection?.order,
      isCircuit: true,
      circuitRounds: circuit.rounds ?? '3',
      circuitRestBetweenRounds: circuit.restBetweenRounds,
      circuitRestBetweenExercises: circuit.restBetweenExercises,
      circuitComments: circuit.comments,
      circuitExercises: circuit.exercises.map(e => ({
        id: e.id, exerciseId: e.exerciseId, exerciseName: e.exerciseName,
        reps: e.reps, time: e.time, distance: e.distance, enabledParams: e.enabledParams, order: e.order,
      })),
      mobileEdited: true, mobileAdded: true,
      plannedSets: 1, plannedParams: { Sets: 1 },
    };
    updateSession(s => ({ ...s, exercises: [...s.exercises, newEx] }));
    setExercisePickerOpen(false);
    if (targetSection?.id) setExpandedSections(prev => new Set([...prev, targetSection.id]));
  }

  function updateExerciseVisibleParams(exId: string, params: string[]) {
    updateExercise(exId, ex => ({ ...ex, visibleParams: params }));
    setParamConfigOpen(false); setParamConfigTarget(null);
  }

  function handleCancel() {
    setEntry(originalEntry.current);
    setExtraSections([]);
    setSectionNotesMap(initSectionNotesMap(originalEntry.current?.sessions[sessionIdx]?.exercises ?? []));
    setSectionNotesOpen(new Set());
    setExerciseNotesOpen(new Set());
    setMode('view');
  }

  // ── Auto-save intensity from view mode ────────────────────────────────────

  /** Build a Supabase query filter that targets the row by (connection_id, date) when possible,
   *  falling back to the UUID. This is critical because loadSync/autoSync DELETEs and re-INSERTs
   *  rows (generating new UUIDs), so a stale UUID from the initial fetch will miss the row. */
  function buildRowFilter(query: ReturnType<typeof supabase.from>) {
    if (connectionId) {
      return (query as any).eq('athlete_connection_id', connectionId).eq('date', entry!.date);
    }
    return (query as any).eq('id', entry!.id);
  }

  async function autoSaveDayIntensity(newIntensity: string | null) {
    const updated = { ...entry, intensity: newIntensity };
    setEntry(updated);
    try {
      await buildRowFilter(supabase.from('athlete_schedule').update({ intensity: newIntensity }));
      originalEntry.current = updated;
    } catch { toast({ title: 'Error saving intensity', variant: 'destructive' }); }
    setDayIntensityOpen(false);
  }

  async function autoSaveSessionIntensity(newIntensity: string | null) {
    const updatedSessions = entry.sessions.map((s, i) => i !== sessionIdx ? s : { ...s, intensity: newIntensity ?? undefined });
    setEntry(prev => prev ? { ...prev, sessions: updatedSessions } : prev);
    try {
      await buildRowFilter(supabase.from('athlete_schedule').update({ sessions: updatedSessions }));
      originalEntry.current = { ...entry, sessions: updatedSessions };
    } catch { toast({ title: 'Error saving intensity', variant: 'destructive' }); }
    setSessionIntensityOpen(false);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!entry) return;
    setSaving(true);
    try {
      const sessionsWithFlag = entry.sessions.map((s, i) =>
        i !== sessionIdx ? s : {
          ...s,
          exercises: s.exercises.map(ex => {
            // Ensure plannedParams always contains the set count so the desktop
            // WorkoutSectionCard knows how many parameter rows to render.
            const effectiveSets = getSetCount(ex);
            const params = { ...(ex.plannedParams ?? {}) };
            const hasSetsKey = Object.keys(params).some(k => /^sets?$/i.test(k));
            if (!hasSetsKey && !ex.isCircuit) params['Sets'] = effectiveSets;

            // Propagate plain-key values to empty per-set keys so the desktop
            // shows the same values as mobile. Mobile's getPlannedValue() falls back
            // to the plain key when a per-set key is empty, giving the appearance
            // of "all sets filled" — but the stored data stays empty. Fix at save
            // time so both apps agree on the actual stored values.
            if (!ex.isCircuit) {
              const paramBases = new Set<string>();
              for (const key of Object.keys(params)) {
                if (/^sets?$/i.test(key)) continue;
                const m = key.match(/^(.+)_set\d+$/);
                if (m) paramBases.add(m[1]);
                else paramBases.add(key);
              }
              for (const base of paramBases) {
                const plainVal = params[base];
                if (plainVal === undefined || plainVal === null || plainVal === '') continue;
                for (let si = 1; si <= effectiveSets; si++) {
                  const k = `${base}_set${si}`;
                  if (!(k in params) || params[k] === '' || params[k] === null || params[k] === undefined) {
                    params[k] = plainVal;
                  }
                }
              }
            }

            return {
              ...ex,
              plannedParams: params,
              plannedSets: effectiveSets,
              mobileEdited: true,
              sectionNotes: ex.sectionId ? (sectionNotesMap[ex.sectionId] ?? ex.sectionNotes) : ex.sectionNotes,
            };
          }),
        },
      );
      // Identify the row by (athlete_connection_id, date) rather than by the row UUID.
      // The UUID changes after every loadSync/autoSync DELETE+UPSERT, so updating by UUID
      // silently hits 0 rows when the desktop has re-synced since the mobile app last fetched.
      let queryError: unknown = null;
      if (connectionId) {
        const { error } = await supabase
          .from('athlete_schedule')
          .update({ sessions: sessionsWithFlag, intensity: entry.intensity })
          .eq('athlete_connection_id', connectionId)
          .eq('date', entry.date);
        queryError = error;
      } else {
        // Fallback: use the row UUID (works if the row hasn't been re-synced since mobile fetched)
        const { error } = await supabase
          .from('athlete_schedule')
          .update({ sessions: sessionsWithFlag, intensity: entry.intensity })
          .eq('id', entry.id);
        queryError = error;
      }
      if (queryError) throw queryError;
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
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <button onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-base truncate">{session?.name || 'Session'}</h1>
          <button onClick={() => setMode('edit')}
            className="text-sm font-medium text-primary hover:opacity-80 active:opacity-60 transition-opacity w-8 text-right shrink-0">
            Edit
          </button>
        </div>

        {sections.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Dumbbell className="h-8 w-8 opacity-30" />
            <p className="text-sm">No exercises assigned yet.</p>
            <Button size="sm" variant="outline" onClick={() => setMode('edit')}>Edit Session</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-4 space-y-3">
                {/* Day intensity — tappable */}
                <button onClick={() => setDayIntensityOpen(true)}
                  className="flex items-center gap-3 w-full py-1 text-left active:opacity-70">
                  <p className="text-xs text-muted-foreground min-w-[96px]">Day Intensity</p>
                  {entry.intensity ? <IntensityBadge intensity={entry.intensity} /> : <span className="text-xs text-muted-foreground/50 italic">Tap to set…</span>}
                </button>
                {/* Session intensity — tappable */}
                <button onClick={() => setSessionIntensityOpen(true)}
                  className="flex items-center gap-3 w-full py-1 text-left active:opacity-70">
                  <p className="text-xs text-muted-foreground min-w-[96px]">Session Intensity</p>
                  {session.intensity ? <IntensityBadge intensity={session.intensity} /> : <span className="text-xs text-muted-foreground/50 italic">Tap to set…</span>}
                </button>
                {session.notes && <p className="text-sm text-muted-foreground leading-relaxed pb-1">{session.notes}</p>}

                {/* Section cards */}
                {sections.map(sec => {
                  const isOpen = expandedSections.has(sec.id);
                  return (
                    <Card key={sec.id} className="overflow-hidden">
                      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors"
                        onClick={() => toggleSection(sec.id)}>
                        <div className="text-left">
                          <p className="font-semibold text-sm">{sec.name}</p>
                          {sec.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sec.notes}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{sec.exercises.length} exercise{sec.exercises.length !== 1 ? 's' : ''}</p>
                        </div>
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0', isOpen && 'rotate-180')} />
                      </button>

                      {isOpen && (
                        <div className="border-t">
                          {sec.exercises.map((ex, i) => (
                            <div key={ex.id}>
                              {/* Exercise row */}
                              <div className={cn('px-4 py-2.5', i > 0 && 'border-t border-border/50')}>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground w-4 shrink-0 text-right tabular-nums">{i + 1}</span>
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {ex.isCircuit && <RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" />}
                                    <span className="text-sm truncate">{ex.name}</span>
                                    {(ex.exerciseVideoUrl || ex.exerciseDescription) && !ex.isCircuit && (
                                      <button onClick={() => setDetailTarget({ name: ex.name, videoUrl: ex.exerciseVideoUrl, description: ex.exerciseDescription })}
                                        className="shrink-0 text-muted-foreground hover:text-foreground active:opacity-60">
                                        <Info className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  {ex.isCircuit
                                    ? <span className="text-xs text-muted-foreground shrink-0">{ex.circuitRounds ?? 3} rounds</span>
                                    : <span className="text-xs text-muted-foreground shrink-0">{getSetCount(ex)} sets</span>}
                                </div>
                                {/* Exercise notes in view mode */}
                                {ex.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 ml-7 leading-snug">{ex.notes}</p>
                                )}
                              </div>
                              {/* Circuit exercise list */}
                              {ex.isCircuit && <CircuitExerciseList ex={ex} />}
                              {/* Superset connector in view mode */}
                              {i < sec.exercises.length - 1 && (
                                <SupersetConnector
                                  exA={ex} exB={sec.exercises[i + 1]}
                                  onLink={() => {}} onUnlink={() => {}} editMode={false}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t shrink-0">
              <Button className="w-full" onClick={() => setMode('edit')}>Edit Session</Button>
            </div>
          </>
        )}

        {/* Intensity pickers in view mode (auto-save) */}
        <IntensityPickerSheet open={dayIntensityOpen} title="Day Intensity" current={entry.intensity}
          onSelect={v => autoSaveDayIntensity(v)} onClose={() => setDayIntensityOpen(false)} />
        <IntensityPickerSheet open={sessionIntensityOpen} title="Session Intensity" current={session.intensity}
          onSelect={v => autoSaveSessionIntensity(v)} onClose={() => setSessionIntensityOpen(false)} />
        <ExerciseDetailDialog target={detailTarget} onClose={() => setDetailTarget(null)} />
      </div>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────

  const supersetSectionExercises = supersetSectionId
    ? (allSections.find(s => s.id === supersetSectionId)?.exercises ?? [])
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b shrink-0">
        <button onClick={handleCancel}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent -ml-1 shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="flex-1 text-sm font-semibold truncate text-center">{session?.name || 'Session'}</p>
        <Button size="sm" onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Session notes */}
      <div className="px-4 pt-3 pb-2 border-b shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Session Notes</p>
        <textarea value={session.notes ?? ''} onChange={e => updateSession(s => ({ ...s, notes: e.target.value }))}
          placeholder="Add notes for this session…" rows={2}
          className="w-full text-sm border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
      </div>

      {/* Day intensity */}
      <button onClick={() => setDayIntensityOpen(true)}
        className="flex items-center justify-between px-4 py-3 border-b shrink-0 w-full text-left active:bg-accent/40">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Day Intensity</p>
        {entry.intensity ? <IntensityBadge intensity={entry.intensity} /> : <span className="text-xs text-muted-foreground italic">Tap to set…</span>}
      </button>

      {/* Session intensity */}
      <button onClick={() => setSessionIntensityOpen(true)}
        className="flex items-center justify-between px-4 py-3 border-b shrink-0 w-full text-left active:bg-accent/40">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Session Intensity</p>
        {session.intensity ? <IntensityBadge intensity={session.intensity} /> : <span className="text-xs text-muted-foreground italic">Tap to set…</span>}
      </button>

      {allSections.length > 0 && expandedSections.size === 0 && (
        <p className="px-4 pt-3 pb-1 text-xs text-muted-foreground shrink-0">Tap a section to expand and edit · Use ↑↓ to reorder</p>
      )}

      {/* Section list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-3 pb-10">
          {allSections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sections yet. Create a section first, then add exercises.</p>
          ) : allSections.map((section, secIdx) => {
            const isExpanded = expandedSections.has(section.id);
            return (
              <div key={section.id} className="rounded-xl border bg-card overflow-hidden">
                {/* Section header */}
                <button className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/30 text-left active:bg-muted/50 transition-colors"
                  onClick={() => toggleSection(section.id)}>
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => moveSection(section.id, 'up')} disabled={secIdx === 0}
                      className={cn('w-5 h-5 rounded flex items-center justify-center transition-colors',
                        secIdx === 0 ? 'text-muted-foreground/20 cursor-default' : 'text-muted-foreground hover:text-foreground hover:bg-muted active:opacity-60')}>
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => moveSection(section.id, 'down')} disabled={secIdx === allSections.length - 1}
                      className={cn('w-5 h-5 rounded flex items-center justify-center transition-colors',
                        secIdx === allSections.length - 1 ? 'text-muted-foreground/20 cursor-default' : 'text-muted-foreground hover:text-foreground hover:bg-muted active:opacity-60')}>
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  <span className="flex-1 text-sm font-semibold truncate">{section.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{section.exercises.length} ex</span>

                  {/* Notes toggle */}
                  <div onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSectionNotesOpen(prev => { const n = new Set(prev); n.has(section.id) ? n.delete(section.id) : n.add(section.id); return n; })}
                      className={cn('w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                        sectionNotesOpen.has(section.id) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                      <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Delete section */}
                  <div onClick={e => e.stopPropagation()}>
                    <button onClick={() => deleteSection(section.id)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isExpanded && 'rotate-180')} />
                </button>

                {/* Section notes */}
                {sectionNotesOpen.has(section.id) && (
                  <div className="px-3 pb-2 border-b bg-muted/10">
                    <textarea value={sectionNotesMap[section.id] ?? section.notes ?? ''}
                      onChange={e => setSectionNotesMap(prev => ({ ...prev, [section.id]: e.target.value }))}
                      placeholder="Section notes…" rows={2}
                      className="w-full text-sm border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 mt-2" />
                  </div>
                )}

                {/* Exercises (when expanded) */}
                {isExpanded && (
                  <div>
                    {section.exercises.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 px-3 border border-dashed rounded-lg mx-3 my-2">
                        No exercises yet — add one below
                      </p>
                    ) : section.exercises.map((ex, exIdx) => {
                      const params = getParamColumns(ex);
                      const sets = getSetCount(ex);
                      const hasNotes = exerciseNotesOpen.has(ex.id);

                      return (
                        <div key={ex.id}>
                          {/* Exercise card */}
                          <div className={cn('border-t', exIdx === 0 && 'border-t')}>
                            {/* Exercise header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-muted/10 gap-1.5">
                              {/* Reorder */}
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button onClick={() => moveExercise(ex.id, 'up')} disabled={exIdx === 0}
                                  className={cn('w-5 h-5 rounded flex items-center justify-center',
                                    exIdx === 0 ? 'text-muted-foreground/20 cursor-default' : 'text-muted-foreground hover:text-foreground hover:bg-muted active:opacity-60')}>
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button onClick={() => moveExercise(ex.id, 'down')} disabled={exIdx === section.exercises.length - 1}
                                  className={cn('w-5 h-5 rounded flex items-center justify-center',
                                    exIdx === section.exercises.length - 1 ? 'text-muted-foreground/20 cursor-default' : 'text-muted-foreground hover:text-foreground hover:bg-muted active:opacity-60')}>
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>

                              {ex.isCircuit && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <p className="text-sm font-semibold truncate flex-1 min-w-0">{ex.name}</p>

                              {/* Param config */}
                              {!ex.isCircuit && (
                                <button onClick={() => { setParamConfigTarget(ex); setParamConfigOpen(true); }}
                                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                                  title="Configure visible parameters">
                                  <Settings2 className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Exercise notes toggle */}
                              <button onClick={() => setExerciseNotesOpen(prev => { const n = new Set(prev); n.has(ex.id) ? n.delete(ex.id) : n.add(ex.id); return n; })}
                                className={cn('w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0',
                                  hasNotes || ex.notes ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-primary/10')}
                                title="Exercise notes">
                                <AlignLeft className="h-3.5 w-3.5" />
                              </button>

                              {/* Sets ± */}
                              {!ex.isCircuit && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-xs text-muted-foreground">Sets</span>
                                  <button onClick={() => changeSetCount(ex.id, -1)}
                                    className="w-6 h-6 rounded-full border bg-background flex items-center justify-center active:bg-accent">
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-sm font-bold w-4 text-center tabular-nums">{sets}</span>
                                  <button onClick={() => changeSetCount(ex.id, +1)}
                                    className="w-6 h-6 rounded-full border bg-background flex items-center justify-center active:bg-accent">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              )}

                              {/* Delete */}
                              <button onClick={() => deleteExercise(ex.id)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Exercise notes textarea */}
                            {(hasNotes || ex.notes) && (
                              <div className="px-3 pt-1.5 pb-2 bg-muted/5">
                                <textarea value={ex.notes ?? ''} onChange={e => updateExercise(ex.id, x => ({ ...x, notes: e.target.value, mobileEdited: true }))}
                                  placeholder="Exercise notes…" rows={2}
                                  className="w-full text-sm border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                              </div>
                            )}

                            {/* Params table */}
                            {params.length > 0 && !ex.isCircuit && (
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
                                            <input type="text" inputMode="decimal" value={getPlannedValue(ex, p, i)}
                                              onChange={e => setParamValue(ex.id, p, i, e.target.value)}
                                              className="w-16 h-7 text-xs border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Circuit info + exercise list */}
                            {ex.isCircuit && (
                              <>
                                <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                                  {ex.circuitRounds ?? 3} rounds · {ex.circuitExercises?.length ?? 0} exercises
                                </div>
                                <CircuitExerciseList ex={ex} />
                              </>
                            )}
                          </div>

                          {/* Superset connector BETWEEN exercises */}
                          {exIdx < section.exercises.length - 1 && (
                            <SupersetConnector
                              exA={ex} exB={section.exercises[exIdx + 1]}
                              onLink={() => linkAdjacentAsSuperset(ex, section.exercises[exIdx + 1])}
                              onUnlink={() => removeFromSuperset(section.exercises[exIdx + 1].id)}
                              editMode
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Add exercise / circuit buttons */}
                    <div className="flex gap-2 p-3 border-t">
                      <button onClick={() => { setPickerTargetSectionId(section.id); setExercisePickerOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-primary hover:border-primary active:opacity-60 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Add Exercise
                      </button>
                      <button onClick={() => { setPickerTargetSectionId(section.id); setExercisePickerOpen(true); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-primary hover:border-primary active:opacity-60 transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" /> Circuit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => setNewSectionDialogOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm text-muted-foreground hover:text-primary hover:border-primary active:opacity-60 transition-colors">
            <Plus className="h-4 w-4" /> New Section
          </button>

          {/* Exercises can only be added inside sections — no top-level Add Exercise button */}
        </div>
      </div>

      {/* ── Sheets & Dialogs ── */}
      <IntensityPickerSheet open={dayIntensityOpen} title="Day Intensity" current={entry.intensity}
        onSelect={v => { setEntry(prev => prev ? { ...prev, intensity: v } : prev); setDayIntensityOpen(false); }}
        onClose={() => setDayIntensityOpen(false)} />
      <IntensityPickerSheet open={sessionIntensityOpen} title="Session Intensity" current={session.intensity}
        onSelect={v => { updateSession(s => ({ ...s, intensity: v ?? undefined })); setSessionIntensityOpen(false); }}
        onClose={() => setSessionIntensityOpen(false)} />

      <ExercisePickerSheet open={exercisePickerOpen} onClose={() => setExercisePickerOpen(false)}
        onSelectExercise={(lib, ex) => handleExerciseFromLibraryPick(lib, ex)}
        onSelectCircuit={(circuit) => addCircuitFromLibrary(circuit)} />

      <MethodSelectionSheet open={methodSheetOpen} onClose={() => { setMethodSheetOpen(false); setPendingExercise(null); }} onConfirm={handleMethodConfirm} />

      <ParamConfigSheet open={paramConfigOpen} exercise={paramConfigTarget}
        toolboxEntries={toolboxData?.entries ?? []} onSave={updateExerciseVisibleParams}
        onClose={() => { setParamConfigOpen(false); setParamConfigTarget(null); }} />

      <SupersetPickerSheet open={supersetPickerOpen} sourceId={supersetSourceId} sectionExercises={supersetSectionExercises}
        onLink={handleSupersetLink} onClose={() => { setSupersetPickerOpen(false); setSupersetSourceId(null); setSupersetSectionId(null); }} />

      <Dialog open={newSectionDialogOpen} onOpenChange={o => { if (!o) setNewSectionDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[380px] rounded-2xl">
          <DialogHeader><DialogTitle>New Section</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
              placeholder="Section name (e.g. Warm-up)" onKeyDown={e => { if (e.key === 'Enter') addSection(); }} autoFocus />
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
