// Body / Performance / Exercises progress tabs for the coach-mobile athlete profile.
// All sections are editable by the coach (add values, tag exercise params).

import { useState, useMemo } from 'react';
import {
  Search, Plus, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Tag, Trophy,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { useAthletes } from '@/hooks/useAthletes';
import { useTranslation } from 'react-i18next';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useExerciseMetrics, epley1RM } from '@/hooks/useExerciseMetrics';
import type { ExerciseEntry, ExerciseSession, ParamTags } from '@/hooks/useExerciseMetrics';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateShort(iso: string) {
  try { return format(parseISO(iso), 'MMM d'); } catch { return iso; }
}

// ── Date range ────────────────────────────────────────────────────────────────

type DateRangeKey = '3M' | '6M' | '1Y' | 'All';

const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  '3M': '3M', '6M': '6M', '1Y': '1Y', 'All': 'All',
};
const DATE_RANGE_DAYS: Record<DateRangeKey, number | null> = {
  '3M': 90, '6M': 180, '1Y': 365, 'All': null,
};

function cutoffDate(range: DateRangeKey): Date | null {
  const days = DATE_RANGE_DAYS[range];
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function DateRangeSelector({ value, onChange }: { value: DateRangeKey; onChange: (v: DateRangeKey) => void }) {
  return (
    <div className="flex gap-1.5">
      {(Object.keys(DATE_RANGE_LABELS) as DateRangeKey[]).map(key => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'flex-1 py-1 rounded-md text-xs font-medium transition-colors',
            value === key
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/60',
          )}
        >
          {DATE_RANGE_LABELS[key]}
        </button>
      ))}
    </div>
  );
}

// ── Add-value dialog ──────────────────────────────────────────────────────────

function AddValueDialog({
  open, onClose, paramName, unit, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  paramName: string;
  unit?: string | null;
  onAdd: (value: string, date: string, note: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onAdd(value.trim(), date, note.trim());
      setValue(''); setDate(today); setNote('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="w-[92vw] sm:w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('coachMobile.athleteProgress.addValueTitle', { name: paramName })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">{unit ? t('coachMobile.athleteProgress.valueLabelWithUnit', { unit }) : t('coachMobile.athleteProgress.valueLabel')}</Label>
            <Input
              type="number"
              placeholder={unit ? t('coachMobile.athleteProgress.valuePlaceholderWithUnit', { unit }) : t('coachMobile.athleteProgress.valuePlaceholder')}
              value={value}
              onChange={e => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('coachMobile.athleteProgress.dateLabel')}</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('coachMobile.athleteProgress.noteOptional')}</Label>
            <Input placeholder={t('coachMobile.athleteProgress.notePlaceholder')} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="sm" disabled={saving || !value.trim()} onClick={handleSave}>
            {saving ? t('coachMobile.athleteProgress.saving') : t('coachMobile.athleteProgress.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared metric type + components (Body + Performance) ──────────────────────

interface MetricItem {
  id: string;
  name: string;
  unit?: string | null;
  latestValue: string | null;
  latestDate: string | null;
  values: Array<{ id: string; value: string; recordedAt: string; note?: string }>;
}

function MetricRow({ item, onClick }: { item: MetricItem; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 border-b last:border-0 hover:bg-accent/40 active:bg-accent/60 text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.name}</p>
        {item.latestDate && (
          <p className="text-xs text-muted-foreground">{fmtDate(item.latestDate)}</p>
        )}
      </div>
      <p className="text-sm shrink-0">
        {item.latestValue != null
          ? <span className="font-semibold">{item.latestValue}{item.unit ? ' ' + item.unit : ''}</span>
          : <span className="text-muted-foreground text-xs">{t('coachMobile.athleteProgress.noData')}</span>}
      </p>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function MetricDetail({
  item, onBack, onAddValue,
}: {
  item: MetricItem;
  onBack: () => void;
  onAddValue: (value: string, date: string, note: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);

  const chartData = useMemo(() =>
    item.values
      .slice()
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .map(v => ({
        date: new Date(v.recordedAt.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: parseFloat(v.value) || null,
      }))
      .filter(d => d.value !== null),
    [item.values],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 rounded hover:bg-accent">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold flex-1">
          {item.name}{item.unit ? ` (${item.unit})` : ''}
        </h3>
        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> {t('coachMobile.athleteProgress.add')}
        </Button>
      </div>

      {chartData.length >= 2 && (
        <div className="rounded-xl border bg-card p-3">
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="metGradCoach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: number) => [`${v}${item.unit ? ' ' + item.unit : ''}`, item.name]}
                contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6 }}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#metGradCoach)" dot={{ r: 3 }} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl border bg-card divide-y">
        {item.values.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-8 text-center">
            {t('coachMobile.athleteProgress.noValues')}
          </p>
        ) : (
          item.values
            .slice()
            .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
            .map((v, i) => (
              <div key={v.id ?? i} className="flex items-baseline justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs text-muted-foreground">{fmtDate(v.recordedAt.slice(0, 10))}</p>
                  {v.note && <p className="text-xs text-muted-foreground/70 italic">{v.note}</p>}
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {v.value}{item.unit ? ' ' + item.unit : ''}
                </p>
              </div>
            ))
        )}
      </div>

      <AddValueDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        paramName={item.name}
        unit={item.unit}
        onAdd={onAddValue}
      />
    </div>
  );
}

// ── Session row (accordion, expanded by default) ───────────────────────────────

function SessionRow({
  session,
  tags,
  allParamNames,
}: {
  session: ExerciseSession;
  tags: ParamTags | null;
  allParamNames: string[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const sessionParamNames = useMemo(() => {
    const seen = new Set<string>();
    for (const set of session.sets) {
      for (const [k, v] of Object.entries(set.values)) {
        if (v !== undefined && v !== null && v !== '') seen.add(k);
      }
    }
    return allParamNames.filter(p => seen.has(p));
  }, [session.sets, allParamNames]);

  // Context chips: plannedParams whose base name is not a grid-logged param.
  // plannedParams stores per-set planned values as Reps_set1, Intensity_set2 etc.;
  // strip the _setN suffix to get the base name and skip if the athlete logged it per-set.
  const contextChips = useMemo(() => {
    if (!session.plannedParams) return [];
    const gridSet = new Set(sessionParamNames);
    const seen = new Map<string, string>();
    for (const [k, v] of Object.entries(session.plannedParams)) {
      if (!v || v === '' || k.endsWith('_unit')) continue;
      const base = k.replace(/_set\d+$/i, '');
      if (gridSet.has(base) || base.toLowerCase() === 'sets') continue;
      if (!seen.has(base)) seen.set(base, v);
    }
    return Array.from(seen.entries()).map(([label, value]) => ({ label, value }));
  }, [session.plannedParams, sessionParamNames]);

  const bestSetIdx = useMemo(() => {
    if (!tags || session.e1rm === null) return -1;
    let best: { idx: number; e1rm: number } | null = null;
    session.sets.forEach((s, i) => {
      if (!s.completed) return;
      const w = parseFloat(s.values[tags.weightParam] ?? '');
      const r = parseFloat(s.values[tags.repsParam] ?? '');
      if (isNaN(w) || isNaN(r)) return;
      const rir = tags.rirParam ? parseFloat(s.values[tags.rirParam] ?? '0') : 0;
      const est = epley1RM(w, r, isNaN(rir) ? 0 : rir);
      if (!best || est > best.e1rm) best = { idx: i, e1rm: est };
    });
    return best?.idx ?? -1;
  }, [session, tags]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-3 bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">
            {format(parseISO(session.date + 'T12:00:00'), 'MMM d, yyyy')}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">{session.sessionName}</span>
        </div>
        {session.e1rm !== null && (
          <span className="text-xs font-bold text-primary tabular-nums shrink-0">
            e1RM {session.e1rm.toFixed(1)}
          </span>
        )}
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <>
          {contextChips.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 py-2 border-t bg-muted/5">
              {contextChips.map(({ label, value }) => (
                <span key={label} className="inline-flex items-center gap-1 text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                  <span className="font-medium text-foreground/60">{label}:</span>{value}
                </span>
              ))}
            </div>
          )}
          {sessionParamNames.length > 0 ? (
          <div>
            <table className="table-fixed w-full text-xs">
              <thead>
                <tr className="border-t bg-muted/10">
                  <th className="text-left px-1.5 py-1.5 text-[9px] font-medium text-muted-foreground uppercase w-8">Set</th>
                  {sessionParamNames.map(p => (
                    <th key={p} className="text-left px-1.5 py-1.5 text-[9px] font-medium text-muted-foreground uppercase truncate">{p}</th>
                  ))}
                  {tags && session.e1rm !== null && (
                    <th className="text-left px-1.5 py-1.5 text-[9px] font-medium text-muted-foreground uppercase">e1RM</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {session.sets.map((s, i) => {
                  const isBest = i === bestSetIdx;
                  const w = tags ? parseFloat(s.values[tags.weightParam] ?? '') : NaN;
                  const r = tags ? parseFloat(s.values[tags.repsParam] ?? '') : NaN;
                  const rir = tags?.rirParam ? parseFloat(s.values[tags.rirParam] ?? '0') : 0;
                  const setE1rm = (!isNaN(w) && !isNaN(r) && r > 0 && s.completed && tags)
                    ? epley1RM(w, r, isNaN(rir) ? 0 : rir) : null;
                  return (
                    <tr key={i} className={cn(!s.completed && 'opacity-40', isBest && 'bg-primary/5')}>
                      <td className="px-1.5 py-1.5 text-[10px] text-muted-foreground font-medium">
                        {String(s.setNumber).padStart(2, '0')}
                      </td>
                      {sessionParamNames.map(p => (
                        <td key={p} className="px-1.5 py-1.5 tabular-nums">
                          {s.values[p] ?? <span className="text-muted-foreground/40">—</span>}
                        </td>
                      ))}
                      {tags && session.e1rm !== null && (
                        <td className={cn('px-1.5 py-1.5 tabular-nums', isBest && 'font-bold text-primary')}>
                          {setE1rm !== null
                            ? <>{setE1rm.toFixed(1)}{isBest && <Trophy className="inline h-3 w-3 ml-1 text-amber-500" />}</>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t('coachMobile.athleteProgress.noSetData')}</div>
          )}
        </>
      )}
    </div>
  );
}

// ── e1RM tag dialog ───────────────────────────────────────────────────────────

function TagDialog({
  open, onClose, exerciseName, paramNames, tags, onSave,
}: {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  paramNames: string[];
  tags: ParamTags | null;
  onSave: (tags: ParamTags | null) => void;
}) {
  const { t } = useTranslation();
  const [weightParam, setWeightParam] = useState(tags?.weightParam ?? '');
  const [repsParam, setRepsParam]     = useState(tags?.repsParam   ?? '');
  const [rirParam, setRirParam]       = useState(tags?.rirParam    ?? '');
  const NONE = '__none__';

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="w-[92vw] sm:w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('coachMobile.athleteProgress.tagDialogTitle', { name: exerciseName })}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          {t('coachMobile.athleteProgress.tagDialogDesc')}
        </p>
        <div className="space-y-3 py-1">
          {([
            { label: t('coachMobile.athleteProgress.weightLoad'), value: weightParam, set: setWeightParam },
            { label: t('coachMobile.athleteProgress.reps'),       value: repsParam,   set: setRepsParam   },
            { label: t('coachMobile.athleteProgress.rirOptional'), value: rirParam,   set: setRirParam    },
          ] as { label: string; value: string; set: (v: string) => void }[]).map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Select value={value || NONE} onValueChange={v => set(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('coachMobile.athleteProgress.selectParam')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('coachMobile.athleteProgress.noneOption')}</SelectItem>
                  {paramNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          {tags && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30"
              onClick={() => { onSave(null); onClose(); }}
            >
              {t('coachMobile.athleteProgress.clearTags')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="sm"
            disabled={!weightParam || !repsParam}
            onClick={() => { onSave({ weightParam, repsParam, rirParam: rirParam || undefined }); onClose(); }}
          >
            {t('coachMobile.athleteProgress.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Exercise detail ───────────────────────────────────────────────────────────

function ExerciseDetail({
  entry, sessions, tags, onBack, onTagSave,
}: {
  entry: ExerciseEntry;
  sessions: ExerciseSession[];
  tags: ParamTags | null;
  onBack: () => void;
  onTagSave: (tags: ParamTags | null) => void;
}) {
  const { t } = useTranslation();
  const [tagOpen, setTagOpen] = useState(false);
  const [range, setRange] = useState<DateRangeKey>('All');

  const filteredSessions = useMemo(() => {
    const cutoff = cutoffDate(range);
    if (!cutoff) return sessions;
    return sessions.filter(s => new Date(s.date + 'T12:00:00') >= cutoff);
  }, [sessions, range]);

  const chartData = useMemo(() => {
    if (!tags) return [];
    return filteredSessions
      .filter(s => s.e1rm !== null)
      .map(s => ({
        date: fmtDateShort(s.date),
        value: parseFloat((s.e1rm as number).toFixed(1)),
      }));
  }, [filteredSessions, tags]);

  const latestE1RM = sessions.filter(s => s.e1rm !== null).pop()?.e1rm ?? null;
  const weightUnit = tags?.weightParam ? (entry.allParamUnits[tags.weightParam] ?? '') : '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-1 active:opacity-60 transition-opacity"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('coachMobile.athleteProgress.back')}
        </button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs shrink-0" onClick={() => setTagOpen(true)}>
          <Tag className="h-3.5 w-3.5" /> {t('coachMobile.athleteProgress.tag')}
        </Button>
      </div>

      {/* Title + e1RM summary */}
      <div>
        <h3 className="text-lg font-semibold">{entry.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('coachMobile.athleteProgress.sessionsLogged', { count: sessions.length })}
        </p>
        {tags && latestE1RM !== null && (
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-3xl font-bold tabular-nums">{latestE1RM.toFixed(1)}</span>
            <span className="text-muted-foreground">
              {weightUnit ? `${weightUnit} ` : ''}{t('coachMobile.athleteProgress.estOneRM')}
            </span>
          </div>
        )}
      </div>

      {/* Date range selector */}
      <DateRangeSelector value={range} onChange={setRange} />

      {/* e1RM chart */}
      {tags && (
        chartData.length >= 2 ? (
          <>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="e1rmGradCoach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                    formatter={(v: number) => [`${v.toFixed(1)}${weightUnit ? ` ${weightUnit}` : ''}`, t('coachMobile.athleteProgress.estOneRM')]}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#e1rmGradCoach)" dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-right -mt-2">
              {tags.rirParam ? t('coachMobile.athleteProgress.epleyFormulaRir') : t('coachMobile.athleteProgress.epleyFormula')}
            </p>
          </>
        ) : (
          <div className="h-16 flex items-center justify-center border rounded-lg bg-muted/20">
            <p className="text-xs text-muted-foreground text-center px-4">
              {chartData.length === 0
                ? (range === 'All'
                    ? t('coachMobile.athleteProgress.logSetsHint')
                    : t('coachMobile.athleteProgress.noE1rmInRange', { range: DATE_RANGE_LABELS[range] }))
                : t('coachMobile.athleteProgress.logMoreSessions')}
            </p>
          </div>
        )
      )}

      {!tags && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          {t('coachMobile.athleteProgress.tagHint')}
        </p>
      )}

      {/* Session history */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {filteredSessions.length !== sessions.length
            ? t('coachMobile.athleteProgress.sessionHistoryFiltered', { count: filteredSessions.length, total: sessions.length })
            : t('coachMobile.athleteProgress.sessionHistory')}
        </p>
        {filteredSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {range === 'All' ? t('coachMobile.athleteProgress.noSessionsYet') : t('coachMobile.athleteProgress.noSessionsInRange', { range: DATE_RANGE_LABELS[range] })}
          </p>
        ) : (
          [...filteredSessions].reverse().map((s, i) => (
            <SessionRow
              key={`${s.logId}-${i}`}
              session={s}
              tags={tags}
              allParamNames={entry.allParamNames}
            />
          ))
        )}
      </div>

      <TagDialog
        open={tagOpen}
        onClose={() => setTagOpen(false)}
        exerciseName={entry.name}
        paramNames={entry.allParamNames}
        tags={tags}
        onSave={onTagSave}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Section = 'body' | 'performance' | 'exercises';

interface Props {
  athleteId: string;
  connectionId: string | null;
}

export function CoachAthleteProgressTab({ athleteId, connectionId }: Props) {
  const {
    biometricDefinitions,
    getAthleteBiometrics,
    addBiometricValue,
    getAthletePerformanceParameters,
    addPerformanceParameterValue,
    athletePerformanceParameters,
  } = useAthletes();
  const { data: paramDb } = useParametersDataV2();
  const { exercises, loading: exLoading, paramTags, setParamTags, getExerciseHistory } = useExerciseMetrics(connectionId);

  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('body');
  const [search, setSearch] = useState('');
  const [selectedBioId, setSelectedBioId]   = useState<string | null>(null);
  const [selectedPerfId, setSelectedPerfId] = useState<string | null>(null);
  const [selectedExName, setSelectedExName] = useState<string | null>(null);

  function changeSection(s: Section) {
    setSection(s); setSearch('');
    setSelectedBioId(null); setSelectedPerfId(null); setSelectedExName(null);
  }

  // ── Body items ────────────────────────────────────────────────────────────

  const bodyItems = useMemo((): MetricItem[] =>
    getAthleteBiometrics(athleteId).map(bio => {
      const def = biometricDefinitions.find(d => d.id === bio.biometricDefinitionId);
      const sorted = [...bio.values].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      return {
        id: bio.id,
        name: def?.name ?? '?',
        unit: def?.unit,
        latestValue: sorted[0]?.value ?? null,
        latestDate: sorted[0]?.recordedAt?.slice(0, 10) ?? null,
        values: sorted,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [athleteId, biometricDefinitions, getAthleteBiometrics],
  );

  const selectedBio    = bodyItems.find(i => i.id === selectedBioId) ?? null;
  const selectedBioObj = getAthleteBiometrics(athleteId).find(b => b.id === selectedBioId) ?? null;

  // ── Performance items ─────────────────────────────────────────────────────

  const perfItems = useMemo((): MetricItem[] =>
    getAthletePerformanceParameters(athleteId).map(pp => {
      const def = paramDb.parameters.find(p => p.id === pp.athleticismParameterId);
      const sorted = [...pp.values].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      return {
        id: pp.id,
        name: def?.name ?? '?',
        unit: def?.unit,
        latestValue: sorted[0]?.value ?? null,
        latestDate: sorted[0]?.recordedAt?.slice(0, 10) ?? null,
        values: sorted,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [athleteId, athletePerformanceParameters, paramDb.parameters, getAthletePerformanceParameters],
  );

  const selectedPerf = perfItems.find(i => i.id === selectedPerfId) ?? null;

  // ── Derived ───────────────────────────────────────────────────────────────

  const inDetail = !!(selectedBioId || selectedPerfId || selectedExName);

  const filteredBody = !inDetail && search
    ? bodyItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : bodyItems;

  const filteredPerf = !inDetail && search
    ? perfItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : perfItems;

  const filteredEx = !inDetail && search
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises;

  const selectedEntry   = exercises.find(e => e.name === selectedExName) ?? null;
  const selectedHistory = selectedExName ? getExerciseHistory(selectedExName) : [];
  const selectedTags    = selectedExName ? (paramTags[selectedExName] ?? null) : null;

  return (
    <div className="space-y-3 py-2">

      {/* Section tab strip */}
      {!inDetail && (
        <div className="flex border-b">
          {([
            { key: 'body',        label: t('coachMobile.athleteProgress.body')        },
            { key: 'performance', label: t('coachMobile.athleteProgress.performance') },
            { key: 'exercises',   label: t('coachMobile.athleteProgress.exercises')   },
          ] as { key: Section; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => changeSection(key)}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                section === key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {!inDetail && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={
              section === 'body'        ? t('coachMobile.athleteProgress.searchBody')        :
              section === 'performance' ? t('coachMobile.athleteProgress.searchPerformance') :
              t('coachMobile.athleteProgress.searchExercises')
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      )}

      {/* ── Body ── */}
      {section === 'body' && !inDetail && (
        <div className="rounded-xl border bg-card divide-y px-4">
          {filteredBody.length === 0
            ? <p className="text-sm text-muted-foreground py-8 text-center">{t('coachMobile.athleteProgress.noBodyMetrics')}</p>
            : filteredBody.map(item => (
              <MetricRow key={item.id} item={item} onClick={() => setSelectedBioId(item.id)} />
            ))}
        </div>
      )}
      {section === 'body' && selectedBio && selectedBioObj && (
        <MetricDetail
          item={selectedBio}
          onBack={() => setSelectedBioId(null)}
          onAddValue={async (value, date, note) =>
            addBiometricValue(selectedBioObj.id, value, new Date(date + 'T12:00:00').toISOString(), note || undefined)
          }
        />
      )}

      {/* ── Performance ── */}
      {section === 'performance' && !inDetail && (
        <div className="rounded-xl border bg-card divide-y px-4">
          {filteredPerf.length === 0
            ? <p className="text-sm text-muted-foreground py-8 text-center">{t('coachMobile.athleteProgress.noPerfParams')}</p>
            : filteredPerf.map(item => (
              <MetricRow key={item.id} item={item} onClick={() => setSelectedPerfId(item.id)} />
            ))}
        </div>
      )}
      {section === 'performance' && selectedPerf && (
        <MetricDetail
          item={selectedPerf}
          onBack={() => setSelectedPerfId(null)}
          onAddValue={async (value, date, note) => {
            const pp = getAthletePerformanceParameters(athleteId).find(p => p.id === selectedPerf.id);
            if (pp) await addPerformanceParameterValue(pp.id, value, new Date(date + 'T12:00:00').toISOString(), note || undefined);
          }}
        />
      )}

      {/* ── Exercises ── */}
      {section === 'exercises' && !inDetail && (
        <div className="space-y-px">
          {exLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('common.loading')}</p>
          ) : filteredEx.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('coachMobile.athleteProgress.noExercisesYet')}</p>
          ) : filteredEx.map(entry => (
            <button
              key={entry.name}
              onClick={() => setSelectedExName(entry.name)}
              className="w-full flex items-center gap-3 px-1 py-3 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entry.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('coachMobile.athleteProgress.sessions', { count: entry.sessionCount })}
                </p>
              </div>
              {!!paramTags[entry.name] && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 shrink-0">
                  e1RM
                </span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {format(parseISO(entry.lastDate + 'T12:00:00'), 'MMM d')}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
      {section === 'exercises' && selectedEntry && (
        <ExerciseDetail
          entry={selectedEntry}
          sessions={selectedHistory}
          tags={selectedTags}
          onBack={() => setSelectedExName(null)}
          onTagSave={tags => setParamTags(selectedEntry.name, tags)}
        />
      )}

    </div>
  );
}
