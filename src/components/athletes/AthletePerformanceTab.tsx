import { useState, useMemo, useCallback } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  TrendingUp,
  Activity,
  Check,
  ChevronsUpDown,
  LineChart,
  Search,
  Dumbbell,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Athlete,
  AthleteBiometric,
  BiometricDefinition,
  AthletePerformanceParameter,
  ParameterValue,
} from '@/types/athlete';
import { ParameterV2 } from '@/types/parametersV2';
import { useAthletes } from '@/hooks/useAthletes';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';

// ── Types ─────────────────────────────────────────────────────────────────────

type SelectedBiometric = {
  kind: 'biometric';
  ab: AthleteBiometric;
  def: BiometricDefinition;
};

type SelectedPerformance = {
  kind: 'performance';
  pp: AthletePerformanceParameter;
  param: ParameterV2;
};

type SelectedItem = SelectedBiometric | SelectedPerformance;
type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'All';
type TopTab = 'body' | 'exercise';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getLatestValue = (values: ParameterValue[]) => {
  if (!values.length) return null;
  return values.reduce((a, b) =>
    new Date(a.recordedAt) > new Date(b.recordedAt) ? a : b
  );
};

const filterByRange = (values: ParameterValue[], range: TimeRange): ParameterValue[] => {
  if (range === 'All') return values;
  const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[range];
  const cutoff = subDays(new Date(), days);
  return values.filter(v => new Date(v.recordedAt) >= cutoff);
};

// recordedAt is always a full ISO string — use parseISO directly
const parseRecordedAt = (recordedAt: string): Date => parseISO(recordedAt);

const toChartData = (values: ParameterValue[], range: TimeRange) => {
  const filtered = filterByRange(values, range);
  return filtered
    .filter(v => !isNaN(parseFloat(v.value)))
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map(v => ({
      date: format(parseRecordedAt(v.recordedAt), 'MMM d'),
      value: parseFloat(v.value),
      id: v.id,
    }));
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  count,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/40 transition-colors"
    >
      {expanded ? (
        <ChevronDown className="h-3 w-3 shrink-0" />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0" />
      )}
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span className="normal-case font-normal text-[11px]">{count}</span>
    </button>
  );
}

function MetricRow({
  name,
  unit,
  latestValue,
  isSelected,
  isSystem,
  onSelect,
  onRemove,
}: {
  name: string;
  unit?: string | null;
  latestValue: ParameterValue | null;
  isSelected: boolean;
  isSystem?: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2 flex items-center gap-1 group transition-colors',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
      )}
    >
      <span className={cn('flex-1 min-w-0 text-sm font-medium truncate', isSelected && 'text-primary')}>
        {name}
      </span>
      <span className="w-[72px] shrink-0 text-xs text-muted-foreground text-right truncate">
        {latestValue ? `${latestValue.value}${unit ? ` ${unit}` : ''}` : '—'}
      </span>
      <span className="w-[68px] shrink-0 text-xs text-muted-foreground text-right">
        {latestValue ? format(parseRecordedAt(latestValue.recordedAt), 'MMM d') : '—'}
      </span>
      {!isSystem && onRemove ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onRemove?.())}
          className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-opacity shrink-0"
        >
          <Trash2 className="h-3 w-3" />
        </span>
      ) : (
        <span className="w-5 shrink-0" />
      )}
    </button>
  );
}

function ColumnHeaders() {
  return (
    <div className="flex items-center px-3 py-1 border-b">
      <span className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Name</span>
      <span className="w-[72px] shrink-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-right">Value</span>
      <span className="w-[68px] shrink-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-right">Updated</span>
      <span className="w-5 shrink-0" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AthletePerformanceTabProps {
  athlete: Athlete;
  athleteData: ReturnType<typeof useAthletes>;
}

export function AthletePerformanceTab({ athlete, athleteData }: AthletePerformanceTabProps) {
  const [topTab, setTopTab] = useState<TopTab>('body');
  const [search, setSearch] = useState('');
  const [expandBio, setExpandBio] = useState(true);
  const [expandPerf, setExpandPerf] = useState(true);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('All');
  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Add dialogs
  const [showAddBiometric, setShowAddBiometric] = useState(false);
  const [showAddPerformance, setShowAddPerformance] = useState(false);
  const [selectedBiometricDefId, setSelectedBiometricDefId] = useState('');
  const [newBiometricName, setNewBiometricName] = useState('');
  const [newBiometricType, setNewBiometricType] = useState<'text' | 'quantitative'>('quantitative');
  const [newBiometricUnit, setNewBiometricUnit] = useState('');
  const [selectedAthleticismParamId, setSelectedAthleticismParamId] = useState('');
  const [performanceComboOpen, setPerformanceComboOpen] = useState(false);

  const { data: athleticismData } = useParametersDataV2();
  const athleticismParameters = athleticismData?.parameters || [];

  const athleteBiometrics = useMemo(
    () => athleteData.getAthleteBiometrics(athlete.id),
    [athleteData, athlete.id]
  );

  const athletePerformanceParams = useMemo(
    () => athleteData.getAthletePerformanceParameters(athlete.id),
    [athleteData, athlete.id]
  );

  const availableBiometricDefs = useMemo(
    () => athleteData.biometricDefinitions.filter(
      def => !athleteBiometrics.some(ab => ab.biometricDefinitionId === def.id)
    ),
    [athleteData.biometricDefinitions, athleteBiometrics]
  );

  const availableAthleticismParams = useMemo(
    () => athleticismParameters.filter(
      p => !athletePerformanceParams.some(pp => pp.athleticismParameterId === p.id)
    ),
    [athleticismParameters, athletePerformanceParams]
  );

  // Filtered lists driven by search
  const filteredBiometrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return athleteBiometrics;
    return athleteBiometrics.filter(ab => {
      const def = athleteData.getBiometricDefinition(ab.biometricDefinitionId);
      return def?.name.toLowerCase().includes(q);
    });
  }, [athleteBiometrics, search, athleteData]);

  const filteredPerformance = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return athletePerformanceParams;
    return athletePerformanceParams.filter(pp => {
      const param = athleticismParameters.find(p => p.id === pp.athleticismParameterId);
      return param?.name.toLowerCase().includes(q);
    });
  }, [athletePerformanceParams, search, athleticismParameters]);

  // Keep selected item in sync when underlying data changes
  const resolvedSelected = useMemo<SelectedItem | null>(() => {
    if (!selected) return null;
    if (selected.kind === 'biometric') {
      const ab = athleteBiometrics.find(x => x.id === selected.ab.id);
      if (!ab) return null;
      return { kind: 'biometric', ab, def: selected.def };
    } else {
      const pp = athletePerformanceParams.find(x => x.id === selected.pp.id);
      if (!pp) return null;
      return { kind: 'performance', pp, param: selected.param };
    }
  }, [selected, athleteBiometrics, athletePerformanceParams]);

  const selectedValues = resolvedSelected
    ? resolvedSelected.kind === 'biometric'
      ? resolvedSelected.ab.values
      : resolvedSelected.pp.values
    : [];

  const selectedUnit = resolvedSelected
    ? resolvedSelected.kind === 'biometric'
      ? resolvedSelected.def.unit
      : resolvedSelected.param.unit
    : null;

  const selectedName = resolvedSelected
    ? resolvedSelected.kind === 'biometric'
      ? resolvedSelected.def.name
      : resolvedSelected.param.name
    : '';

  const latestValue = getLatestValue(selectedValues);
  const chartData = toChartData(selectedValues, timeRange);
  const isQuantitative = resolvedSelected
    ? resolvedSelected.kind === 'biometric'
      ? resolvedSelected.def.type === 'quantitative'
      : true
    : false;

  const sortedHistory = [...selectedValues].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAddValue = useCallback(() => {
    if (!resolvedSelected || !newValue.trim()) return;
    const recordedAt = newDate
      ? new Date(newDate + 'T12:00:00').toISOString()
      : new Date().toISOString();
    if (resolvedSelected.kind === 'biometric') {
      athleteData.addBiometricValue(resolvedSelected.ab.id, newValue.trim(), recordedAt);
    } else {
      athleteData.addPerformanceParameterValue(resolvedSelected.pp.id, newValue.trim(), recordedAt);
    }
    setNewValue('');
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  }, [resolvedSelected, newValue, newDate, athleteData]);

  const handleDeleteValue = useCallback((valueId: string) => {
    if (!resolvedSelected) return;
    if (resolvedSelected.kind === 'biometric') {
      athleteData.deleteBiometricValue(resolvedSelected.ab.id, valueId);
    } else {
      athleteData.deletePerformanceParameterValue(resolvedSelected.pp.id, valueId);
    }
  }, [resolvedSelected, athleteData]);

  const handleRemoveBiometric = useCallback((ab: AthleteBiometric) => {
    if (resolvedSelected?.kind === 'biometric' && resolvedSelected.ab.id === ab.id) {
      setSelected(null);
    }
    athleteData.removeBiometricFromAthlete(ab.id);
  }, [resolvedSelected, athleteData]);

  const handleRemovePerformance = useCallback((pp: AthletePerformanceParameter) => {
    if (resolvedSelected?.kind === 'performance' && resolvedSelected.pp.id === pp.id) {
      setSelected(null);
    }
    athleteData.removePerformanceParameter(pp.id);
  }, [resolvedSelected, athleteData]);

  const handleAddBiometric = () => {
    if (selectedBiometricDefId === 'new') {
      if (!newBiometricName.trim()) return;
      const def = athleteData.createBiometricDefinition({
        name: newBiometricName.trim(),
        type: newBiometricType,
        unit: newBiometricType === 'quantitative' ? newBiometricUnit || null : null,
      });
      athleteData.addBiometricToAthlete(athlete.id, def.id);
    } else if (selectedBiometricDefId) {
      athleteData.addBiometricToAthlete(athlete.id, selectedBiometricDefId);
    }
    setShowAddBiometric(false);
    setSelectedBiometricDefId('');
    setNewBiometricName('');
    setNewBiometricUnit('');
  };

  const handleAddPerformance = () => {
    if (!selectedAthleticismParamId) return;
    athleteData.addPerformanceParameter(athlete.id, selectedAthleticismParamId);
    setShowAddPerformance(false);
    setSelectedAthleticismParamId('');
    setPerformanceComboOpen(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Top section tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <button
          onClick={() => setTopTab('body')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            topTab === 'body'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          Body Metrics
        </button>
        <button
          onClick={() => setTopTab('exercise')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            topTab === 'exercise'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Dumbbell className="h-3.5 w-3.5" />
          Exercise Metrics
        </button>
      </div>

      {topTab === 'body' ? (
        <div className="flex flex-1 min-h-0">

          {/* ── Left panel: metric list ──────────────────────────────────── */}
          <div className="w-72 shrink-0 border-r flex flex-col">

            {/* Search + Add New */}
            <div className="p-3 border-b flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search metrics…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <DropdownMenu open={addMenuOpen} onOpenChange={setAddMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 shrink-0 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Add New
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setAddMenuOpen(false); setShowAddBiometric(true); }}>
                    <Activity className="h-4 w-4 mr-2 text-muted-foreground" />
                    Body Metric
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setAddMenuOpen(false); setShowAddPerformance(true); }}>
                    <TrendingUp className="h-4 w-4 mr-2 text-muted-foreground" />
                    Performance Parameter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ScrollArea className="flex-1">
              <div>

                {/* ── Anthropometrics & Biomarkers ─────────────────────── */}
                <SectionHeader
                  icon={<Activity className="h-3 w-3" />}
                  label="Anthropometrics & Biomarkers"
                  count={filteredBiometrics.length}
                  expanded={expandBio}
                  onToggle={() => setExpandBio(v => !v)}
                />
                {expandBio && (
                  <>
                    <ColumnHeaders />
                    {filteredBiometrics.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2.5">
                        {search ? 'No matches.' : 'No metrics tracked yet.'}
                      </p>
                    ) : (
                      filteredBiometrics.map(ab => {
                        const def = athleteData.getBiometricDefinition(ab.biometricDefinitionId);
                        if (!def) return null;
                        const latest = getLatestValue(ab.values);
                        const isSel = resolvedSelected?.kind === 'biometric' && resolvedSelected.ab.id === ab.id;
                        return (
                          <MetricRow
                            key={ab.id}
                            name={def.name}
                            unit={def.unit}
                            latestValue={latest}
                            isSelected={isSel}
                            isSystem={def.isSystem}
                            onSelect={() => setSelected({ kind: 'biometric', ab, def })}
                            onRemove={() => handleRemoveBiometric(ab)}
                          />
                        );
                      })
                    )}
                  </>
                )}

                <div className="border-t my-1" />

                {/* ── Performance Parameters ───────────────────────────── */}
                <SectionHeader
                  icon={<TrendingUp className="h-3 w-3" />}
                  label="Performance"
                  count={filteredPerformance.length}
                  expanded={expandPerf}
                  onToggle={() => setExpandPerf(v => !v)}
                />
                {expandPerf && (
                  <>
                    <ColumnHeaders />
                    {filteredPerformance.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2.5">
                        {search ? 'No matches.' : 'No performance parameters tracked.'}
                      </p>
                    ) : (
                      filteredPerformance.map(pp => {
                        const param = athleticismParameters.find(p => p.id === pp.athleticismParameterId);
                        if (!param) return null;
                        const latest = getLatestValue(pp.values);
                        const isSel = resolvedSelected?.kind === 'performance' && resolvedSelected.pp.id === pp.id;
                        return (
                          <MetricRow
                            key={pp.id}
                            name={param.name}
                            unit={param.unit}
                            latestValue={latest}
                            isSelected={isSel}
                            onSelect={() => setSelected({ kind: 'performance', pp, param })}
                            onRemove={() => handleRemovePerformance(pp)}
                          />
                        );
                      })
                    )}
                  </>
                )}

              </div>
            </ScrollArea>
          </div>

          {/* ── Right panel: chart + history ─────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {!resolvedSelected ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <LineChart className="h-10 w-10 opacity-30" />
                <p className="text-sm">Select a metric to view its history</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-5">

                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedName}</h3>
                      {latestValue ? (
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-3xl font-bold">{latestValue.value}</span>
                          {selectedUnit && (
                            <span className="text-muted-foreground text-sm">{selectedUnit}</span>
                          )}
                          <span className="text-xs text-muted-foreground ml-1">
                            as of {format(parseRecordedAt(latestValue.recordedAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">No measurements yet</p>
                      )}
                    </div>
                    {resolvedSelected.kind === 'performance' && (
                      <Badge variant="secondary" className="text-xs">
                        {resolvedSelected.param.category || 'Performance'}
                      </Badge>
                    )}
                  </div>

                  {/* Chart */}
                  {isQuantitative && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        {(['1M', '3M', '6M', '1Y', 'All'] as TimeRange[]).map(r => (
                          <Button
                            key={r}
                            variant={timeRange === r ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => setTimeRange(r)}
                          >
                            {r}
                          </Button>
                        ))}
                      </div>
                      {chartData.length >= 2 ? (
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="performanceGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                domain={['auto', 'auto']}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--popover))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                }}
                                formatter={(v: number) => [`${v}${selectedUnit ? ` ${selectedUnit}` : ''}`, selectedName]}
                                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fill="url(#performanceGrad)"
                                dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                                activeDot={{ r: 5 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-48 w-full flex items-center justify-center border rounded-lg bg-muted/20">
                          <p className="text-sm text-muted-foreground">
                            {selectedValues.length === 0
                              ? 'Add measurements to see the chart'
                              : 'Add at least 2 measurements to see the chart'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add measurement */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-medium">Add measurement</h4>
                    <div className="flex gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={newDate}
                          onChange={e => setNewDate(e.target.value)}
                          className="h-8 text-sm w-36"
                        />
                      </div>
                      <div className="space-y-1 flex-1">
                        <Label className="text-xs">Value{selectedUnit ? ` (${selectedUnit})` : ''}</Label>
                        <Input
                          value={newValue}
                          onChange={e => setNewValue(e.target.value)}
                          placeholder={isQuantitative ? '0.0' : 'Enter value'}
                          className="h-8 text-sm"
                          onKeyDown={e => e.key === 'Enter' && handleAddValue()}
                        />
                      </div>
                      <Button size="sm" className="h-8" onClick={handleAddValue} disabled={!newValue.trim()}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </div>

                  {/* History */}
                  {sortedHistory.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">History</h4>
                      <div className="border rounded-lg divide-y">
                        {sortedHistory.map(v => (
                          <div key={v.id} className="flex items-center justify-between px-4 py-2.5 text-sm group">
                            <span className="text-muted-foreground text-xs w-28 shrink-0">
                              {format(parseRecordedAt(v.recordedAt), 'MMM d, yyyy')}
                            </span>
                            <span className="font-medium flex-1">
                              {v.value}{selectedUnit ? ` ${selectedUnit}` : ''}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteValue(v.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </ScrollArea>
            )}
          </div>

        </div>
      ) : (

        /* ── Exercise Metrics tab ─────────────────────────────────────────── */
        <div className="flex flex-1 min-h-0">

          {/* Left panel */}
          <div className="w-72 shrink-0 border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search exercises…"
                  className="pl-8 h-8 text-sm"
                  disabled
                />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                Exercise data will appear here once the athlete app integration is live.
              </p>
            </div>
          </div>

          {/* Right panel — placeholder */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-muted/50 p-5">
              <Dumbbell className="h-10 w-10 text-muted-foreground opacity-40" />
            </div>
            <div className="max-w-xs space-y-2">
              <h3 className="font-semibold text-base">Exercise Metrics</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Whenever an athlete logs a workout in the athlete app — sets, reps, weight, tempo — the data will automatically sync and appear here.
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">Coming soon</Badge>
          </div>

        </div>
      )}

      {/* ── Add Biometric Dialog ─────────────────────────────────────────── */}
      <Dialog open={showAddBiometric} onOpenChange={setShowAddBiometric}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Body Metric</DialogTitle>
            <DialogDescription>
              Track a biometric or anthropometric measurement for this athlete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select metric</Label>
              <Select value={selectedBiometricDefId} onValueChange={setSelectedBiometricDefId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a metric" />
                </SelectTrigger>
                <SelectContent>
                  {availableBiometricDefs.map(def => (
                    <SelectItem key={def.id} value={def.id}>
                      {def.name}{def.unit ? ` (${def.unit})` : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Create custom metric</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedBiometricDefId === 'new' && (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g., Blood Pressure"
                    value={newBiometricName}
                    onChange={e => setNewBiometricName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newBiometricType} onValueChange={v => setNewBiometricType(v as 'text' | 'quantitative')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantitative">Quantitative (number)</SelectItem>
                      <SelectItem value="text">Text (qualitative)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newBiometricType === 'quantitative' && (
                  <div className="space-y-2">
                    <Label>Unit (optional)</Label>
                    <Input
                      placeholder="e.g., mmHg, bpm"
                      value={newBiometricUnit}
                      onChange={e => setNewBiometricUnit(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBiometric(false)}>Cancel</Button>
            <Button
              onClick={handleAddBiometric}
              disabled={!selectedBiometricDefId || (selectedBiometricDefId === 'new' && !newBiometricName.trim())}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Performance Parameter Dialog ─────────────────────────────── */}
      <Dialog open={showAddPerformance} onOpenChange={setShowAddPerformance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Performance Parameter</DialogTitle>
            <DialogDescription>
              Select a parameter from the Athleticism Database to track for this athlete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select parameter</Label>
              <Popover open={performanceComboOpen} onOpenChange={setPerformanceComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {selectedAthleticismParamId
                      ? athleticismParameters.find(p => p.id === selectedAthleticismParamId)?.name
                      : 'Select a parameter…'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search parameters…" />
                    <CommandList>
                      <CommandEmpty>No parameters found. Add them in the Athleticism Database first.</CommandEmpty>
                      <CommandGroup>
                        {availableAthleticismParams.map(param => (
                          <CommandItem
                            key={param.id}
                            value={param.name}
                            onSelect={() => {
                              setSelectedAthleticismParamId(param.id);
                              setPerformanceComboOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selectedAthleticismParamId === param.id ? 'opacity-100' : 'opacity-0')} />
                            <span>{param.name}</span>
                            {param.unit && <span className="ml-2 text-muted-foreground text-sm">({param.unit})</span>}
                            {param.category && <Badge variant="secondary" className="ml-2 text-xs">{param.category}</Badge>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPerformance(false)}>Cancel</Button>
            <Button onClick={handleAddPerformance} disabled={!selectedAthleticismParamId}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
