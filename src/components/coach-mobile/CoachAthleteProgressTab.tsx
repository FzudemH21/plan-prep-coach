// Body / Performance / Exercises progress tabs for the coach-mobile athlete profile.
// All sections are editable by the coach (add values, tag exercise params).

import { useState, useMemo } from 'react';
import {
  Search, Plus, ChevronRight, ChevronLeft, Tag,
} from 'lucide-react';
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
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { useAthletes } from '@/hooks/useAthletes';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useExerciseMetrics } from '@/hooks/useExerciseMetrics';
import type { ExerciseEntry, ExerciseSession, ParamTags } from '@/hooks/useExerciseMetrics';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
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
          <DialogTitle>Add {paramName} value</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">Value{unit ? ` (${unit})` : ''}</Label>
            <Input
              type="number"
              placeholder={unit ? `e.g. 75 ${unit}` : 'Enter value'}
              value={value}
              onChange={e => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note (optional)</Label>
            <Input placeholder="Optional note…" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving || !value.trim()} onClick={handleSave}>
            {saving ? 'Saving…' : 'Add'}
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
          : <span className="text-muted-foreground text-xs">No data</span>}
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
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {chartData.length >= 2 && (
        <div className="rounded-xl border bg-card p-3">
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`${v}${item.unit ? ' ' + item.unit : ''}`, item.name]}
                contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6 }}
              />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl border bg-card divide-y">
        {item.values.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-8 text-center">
            No values yet — tap Add to record the first measurement.
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

// ── Exercise detail ───────────────────────────────────────────────────────────

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
  const [weightParam, setWeightParam] = useState(tags?.weightParam ?? '');
  const [repsParam, setRepsParam]     = useState(tags?.repsParam   ?? '');
  const [rirParam, setRirParam]       = useState(tags?.rirParam    ?? '');
  const NONE = '__none__';

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="w-[92vw] sm:w-[400px]">
        <DialogHeader>
          <DialogTitle>Tag parameters — {exerciseName}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Used to calculate estimated 1RM (Epley formula)
        </p>
        <div className="space-y-3 py-1">
          {([
            { label: 'Weight / Load', value: weightParam, set: setWeightParam },
            { label: 'Reps',          value: repsParam,   set: setRepsParam   },
            { label: 'RIR (optional)', value: rirParam,   set: setRirParam    },
          ] as { label: string; value: string; set: (v: string) => void }[]).map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Select value={value || NONE} onValueChange={v => set(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select param…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
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
              Clear tags
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!weightParam || !repsParam}
            onClick={() => { onSave({ weightParam, repsParam, rirParam: rirParam || undefined }); onClose(); }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExerciseDetail({
  entry, sessions, tags, onBack, onTagSave,
}: {
  entry: ExerciseEntry;
  sessions: ExerciseSession[];
  tags: ParamTags | null;
  onBack: () => void;
  onTagSave: (tags: ParamTags | null) => void;
}) {
  const [tagOpen, setTagOpen] = useState(false);

  const latestE1RM = sessions.filter(s => s.e1rm !== null).slice(-1)[0]?.e1rm ?? null;
  const chartData = sessions
    .filter(s => s.e1rm !== null)
    .map(s => ({
      date: new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      e1rm: +(s.e1rm!.toFixed(1)),
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 rounded hover:bg-accent">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold flex-1 truncate">{entry.name}</h3>
        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs shrink-0" onClick={() => setTagOpen(true)}>
          <Tag className="h-3.5 w-3.5" /> Tag
        </Button>
      </div>

      {latestE1RM !== null && (
        <div className="rounded-xl border bg-card p-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{latestE1RM.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground">kg e1RM · {entry.sessionCount} sessions</span>
        </div>
      )}

      {chartData.length >= 2 && (
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Estimated 1RM trend</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`${v} kg`, 'e1RM']} contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6 }} />
              <Line type="monotone" dataKey="e1rm" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!tags && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          Tap <strong>Tag</strong> to mark weight, reps and RIR params — enables e1RM calculation.
        </p>
      )}

      <div className="rounded-xl border bg-card divide-y">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-8 text-center">No logged sessions yet.</p>
        ) : (
          sessions
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)
            .map(s => {
              const paramNames = Array.from(new Set(s.sets.flatMap(set => Object.keys(set.values))));
              return (
                <div key={s.logId} className="px-4 py-2.5 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold">{fmtDate(s.date)}</p>
                    <p className="text-xs text-muted-foreground truncate ml-2">{s.sessionName}</p>
                  </div>
                  {paramNames.length > 0 && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left pb-1 font-medium text-muted-foreground w-5">#</th>
                          {paramNames.map(k => (
                            <th key={k} className="text-left pb-1 px-1 font-medium text-muted-foreground">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.sets.map(set => (
                          <tr key={set.setNumber} className="border-b last:border-0">
                            <td className="py-0.5 text-muted-foreground">{set.setNumber}</td>
                            {paramNames.map(k => (
                              <td key={k} className="py-0.5 px-1 tabular-nums">{set.values[k] || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
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
            { key: 'body',        label: 'Body'        },
            { key: 'performance', label: 'Performance' },
            { key: 'exercises',   label: 'Exercises'   },
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
              section === 'body'        ? 'Search body metrics…'        :
              section === 'performance' ? 'Search performance metrics…' :
              'Search exercises…'
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
            ? <p className="text-sm text-muted-foreground py-8 text-center">No body metrics assigned yet.</p>
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
            ? <p className="text-sm text-muted-foreground py-8 text-center">No performance parameters linked yet.</p>
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
        <div className="rounded-xl border bg-card divide-y px-4">
          {exLoading
            ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
            : filteredEx.length === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">No exercises logged yet.</p>
              : filteredEx.map(entry => (
                <button
                  key={entry.name}
                  onClick={() => setSelectedExName(entry.name)}
                  className="w-full flex items-center gap-3 py-3 border-b last:border-0 hover:bg-accent/40 active:bg-accent/60 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.sessionCount} session{entry.sessionCount !== 1 ? 's' : ''} · last {fmtDate(entry.lastDate)}
                    </p>
                  </div>
                  {paramTags[entry.name] && (
                    <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" title="Tagged for e1RM" />
                  )}
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
