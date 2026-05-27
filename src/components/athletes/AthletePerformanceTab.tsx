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
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  TrendingUp,
  Activity,
  ChevronRight,
  Check,
  ChevronsUpDown,
  LineChart,
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

const toChartData = (values: ParameterValue[], range: TimeRange) => {
  const filtered = filterByRange(values, range);
  return filtered
    .filter(v => !isNaN(parseFloat(v.value)))
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map(v => ({
      date: format(new Date(v.recordedAt + 'T12:00:00'), 'MMM d'),
      value: parseFloat(v.value),
      id: v.id,
    }));
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ParameterListItem({
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
        'w-full text-left px-3 py-2.5 rounded-md flex items-center gap-2 group transition-colors',
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted/60'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        {latestValue ? (
          <div className="text-xs text-muted-foreground">
            {latestValue.value}{unit ? ` ${unit}` : ''} · {format(new Date(latestValue.recordedAt + 'T12:00:00'), 'MMM d, yyyy')}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No data</div>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!isSystem && onRemove && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onRemove?.())}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-opacity"
          >
            <Trash2 className="h-3 w-3" />
          </span>
        )}
        <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground', isSelected && 'text-primary')} />
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AthletePerformanceTabProps {
  athlete: Athlete;
  athleteData: ReturnType<typeof useAthletes>;
}

export function AthletePerformanceTab({ athlete, athleteData }: AthletePerformanceTabProps) {
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

  // All biometrics for this athlete (including Height & Weight)
  const athleteBiometrics = useMemo(() => {
    return athleteData.getAthleteBiometrics(athlete.id);
  }, [athleteData, athlete.id]);

  const athletePerformanceParams = useMemo(() => {
    return athleteData.getAthletePerformanceParameters(athlete.id);
  }, [athleteData, athlete.id]);

  // Available biometric defs not yet tracked by this athlete
  const availableBiometricDefs = useMemo(() => {
    return athleteData.biometricDefinitions.filter(
      def => !athleteBiometrics.some(ab => ab.biometricDefinitionId === def.id)
    );
  }, [athleteData.biometricDefinitions, athleteBiometrics]);

  // Available athleticism params not yet tracked
  const availableAthleticismParams = useMemo(() => {
    return athleticismParameters.filter(
      p => !athletePerformanceParams.some(pp => pp.athleticismParameterId === p.id)
    );
  }, [athleticismParameters, athletePerformanceParams]);

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

  // Values and chart data for selected item
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
      : true // performance params are always quantitative
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

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left panel: parameter list ───────────────────────────────────── */}
      <div className="w-64 shrink-0 border-r flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Anthropometrics & Biomarkers */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Anthropometrics & Biomarkers
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setShowAddBiometric(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-0.5">
                {athleteBiometrics.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">
                    No metrics tracked yet.
                  </p>
                ) : (
                  athleteBiometrics.map(ab => {
                    const def = athleteData.getBiometricDefinition(ab.biometricDefinitionId);
                    if (!def) return null;
                    const latest = getLatestValue(ab.values);
                    const isSelected = resolvedSelected?.kind === 'biometric' && resolvedSelected.ab.id === ab.id;
                    return (
                      <ParameterListItem
                        key={ab.id}
                        name={def.name}
                        unit={def.unit}
                        latestValue={latest}
                        isSelected={isSelected}
                        isSystem={def.isSystem}
                        onSelect={() => setSelected({ kind: 'biometric', ab, def })}
                        onRemove={() => handleRemoveBiometric(ab)}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Performance Parameters */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Performance
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setShowAddPerformance(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-0.5">
                {athletePerformanceParams.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">
                    No performance parameters tracked.
                  </p>
                ) : (
                  athletePerformanceParams.map(pp => {
                    const param = athleticismParameters.find(p => p.id === pp.athleticismParameterId);
                    if (!param) return null;
                    const latest = getLatestValue(pp.values);
                    const isSelected = resolvedSelected?.kind === 'performance' && resolvedSelected.pp.id === pp.id;
                    return (
                      <ParameterListItem
                        key={pp.id}
                        name={param.name}
                        unit={param.unit}
                        latestValue={latest}
                        isSelected={isSelected}
                        onSelect={() => setSelected({ kind: 'performance', pp, param })}
                        onRemove={() => handleRemovePerformance(pp)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* ── Right panel: chart + history ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!resolvedSelected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <LineChart className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select a parameter to view its history</p>
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
                        as of {format(new Date(latestValue.recordedAt + 'T12:00:00'), 'MMM d, yyyy')}
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
                          {format(new Date(v.recordedAt + 'T12:00:00'), 'MMM d, yyyy')}
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

      {/* ── Add Biometric Dialog ─────────────────────────────────────────── */}
      <Dialog open={showAddBiometric} onOpenChange={setShowAddBiometric}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Metric</DialogTitle>
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
