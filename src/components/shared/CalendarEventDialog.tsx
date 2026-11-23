import { valuesOfMeasure } from '@/utils/goalMeasures';
import { hasCustomMeasures, measureById, measureRef, parameterMeasures, parseMeasureRef } from '@/utils/parameterMeasures';
import type { ParameterMeasure } from '@/types/parametersV2';
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Trophy, Calendar, X, Plus, ChevronsUpDown, Check } from 'lucide-react';
import { CalendarEvent, eventEndDate, isMultiDayEvent } from '@/hooks/useCalendarEvents';
import { format } from 'date-fns';
import { parseDateStr } from '@/utils/dateUtils';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useAthletes } from '@/hooks/useAthletes';
import { latestValueOf, useSelfReportedResults, withSelfReported } from '@/hooks/useSelfReportedResults';
import { AthletePerformanceParameter, AthleteBiometric } from '@/types/athlete';
import { AddParameterDialogV2 } from '@/components/goals/AddParameterDialogV2';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // ISO date
  events: CalendarEvent[]; // events already on this day
  /** endDate: last day of an event over several days (inclusive), only for events. Return the save's
   *  promise: tests for both sides are added one after the other (each also goes into the athlete
   *  app's schedule — two at once overwrote each other there) */
  onAdd: (type: 'test' | 'event', title: string, notes?: string, parameterId?: string, targetValue?: string, endDate?: string) => void | Promise<unknown>;
  onDelete: (eventId: string) => void;
  athletePerformanceParameters?: AthletePerformanceParameter[];
  /** The athlete (for values they reported themselves in the athlete app) */
  athleteId?: string;
  /** Athlete's biometric records — used to show baseline for body-metric tests. */
  athleteBiometrics?: AthleteBiometric[];
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  date,
  events,
  onAdd,
  onDelete,
  athletePerformanceParameters = [],
  athleteBiometrics = [],
  athleteId,
}: CalendarEventDialogProps) {
  // The athlete's own test results from the athlete app count as recorded values too
  const selfReported = useSelfReportedResults(
    athleteId ?? athletePerformanceParameters[0]?.athleteId ?? athleteBiometrics[0]?.athleteId ?? null
  );
  const { data: parametersData, addParameter } = useParametersDataV2();
  const { data: toolboxData } = useToolboxData();
  const athleteData = useAthletes();

  const [type, setType] = useState<'test' | 'event'>('test');
  const [eventTitle, setEventTitle] = useState(''); // For event type only
  // Event over several days: the clicked day is the start date, this the end date (inclusive; empty = one day)
  const [lastDay, setLastDay] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedParameterId, setSelectedParameterId] = useState<string | null>(null);
  // Like a goal in the wizard: which of the parameter's measures is tested, and which side
  const [measureId, setMeasureId] = useState<string | undefined>(undefined);
  const [sideChoice, setSideChoice] = useState<'L' | 'R' | 'both'>('both');
  const [parameterComboOpen, setParameterComboOpen] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  // "Left & right": a target per side (sides often differ, e.g. after an injury)
  const [targetLeft, setTargetLeft] = useState('');
  const [targetRight, setTargetRight] = useState('');
  const [baselineValue, setBaselineValue] = useState(''); // display only, never saved
  const [createParamDialogOpen, setCreateParamDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const parameters = parametersData?.parameters || [];
  // Body metrics are parameters marked "Biometric"; the old separate list is empty once moved
  // (useBiometricsMigration) and only used until then
  const biometricDefinitions = athleteData.biometricDefinitions;
  const performanceParams = parameters.filter(p => !p.isBiometric);
  const biometricParams = parameters.filter(p => p.isBiometric);

  // `bio:${defId}` prefix identifies body metrics of the old list; after the move the parameter with
  // that id is the same metric
  const isBioId = (id: string | null) => id?.startsWith('bio:') ?? false;
  const bioDefId = (id: string) => id.slice(4); // strip 'bio:' prefix
  /** Name + unit of an old "bio:" reference — the old list, else the parameter with that id */
  const bioMetric = (id: string): { name: string; unit?: string } | undefined => {
    const def = biometricDefinitions.find(d => d.id === bioDefId(id));
    if (def) return { name: def.name, unit: def.unit ?? undefined };
    const param = parameters.find(p => p.id === bioDefId(id));
    return param ? { name: param.name, unit: param.unit } : undefined;
  };

  /** Latest value of a parameter's measure (and side): coach-recorded (profile) or self-reported by the athlete */
  const latestRecordedValue = (paramId: string, mId?: string, side?: 'L' | 'R') => {
    const id = isBioId(paramId) ? bioDefId(paramId) : paramId;
    const pp = athletePerformanceParameters.find(p => p.athleticismParameterId === id);
    const recorded = [
      ...(athleteBiometrics.find(b => b.biometricDefinitionId === id)?.values ?? []),
      ...(pp?.allValues ?? pp?.values ?? []),
    ];
    const own = [...(selfReported.get(measureRef(id, mId, side)) ?? []), ...(mId || side ? [] : selfReported.get(`bio:${id}`) ?? [])];
    // This measure (and side) only — values of other measures (e.g. pain) are not this test's baseline
    const mine = valuesOfMeasure(recorded, mId, side).filter(v => side || !v.side);
    return latestValueOf(withSelfReported(mine, own));
  };

  // The selected performance parameter, its measures and sides (like a goal in the wizard)
  const selectedParam = selectedParameterId && !isBioId(selectedParameterId)
    ? parameters.find(p => p.id === selectedParameterId)
    : undefined;
  const measureChoices = selectedParam && hasCustomMeasures(selectedParam) ? parameterMeasures(selectedParam) : [];
  const perSide = !!selectedParam?.perSide;
  const activeMeasure = selectedParam ? measureById(selectedParam, measureId) : undefined;
  /** The sides the test is created for: one, or both (one test per side) */
  const testSides: Array<'L' | 'R' | undefined> = !perSide ? [undefined] : sideChoice === 'both' ? ['L', 'R'] : [sideChoice];

  // A new parameter: its main measure, both sides
  useEffect(() => { setMeasureId(undefined); setSideChoice('both'); }, [selectedParameterId]);

  // Load baseline value from athlete profile when parameter, measure or side changes
  const baselineOf = (side: 'L' | 'R' | undefined) =>
    selectedParameterId ? latestRecordedValue(selectedParameterId, measureId, side)?.value ?? '' : '';
  useEffect(() => {
    if (!selectedParameterId) { setBaselineValue(''); return; }
    setBaselineValue(testSides.map(sd => {
      const v = baselineOf(sd);
      return sd ? `${sd === 'L' ? 'Left' : 'Right'} ${v || '–'}` : v;
    }).filter(Boolean).join(' · '));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParameterId, measureId, sideChoice, athletePerformanceParameters, athleteBiometrics, selfReported]);

  const hasAthleteBaseline = selectedParameterId !== null && testSides.some(sd => !!baselineOf(sd));

  // Resolve display name + unit for whatever is selected
  const selectedParameter = isBioId(selectedParameterId ?? '')
    ? bioMetric(selectedParameterId!)
    : parameters.find(p => p.id === selectedParameterId);

  const resetForm = () => {
    setLastDay('');
    setEventTitle('');
    setNotes('');
    setSelectedParameterId(null);
    setMeasureId(undefined);
    setSideChoice('both');
    setTargetValue('');
    setTargetLeft('');
    setTargetRight('');
    setBaselineValue('');
    setType('test');
  };

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);
    try {
    if (type === 'test') {
      if (!selectedParameterId) return;
      const baseTitle = selectedParameter?.name ?? '';
      if (!baseTitle) return;
      if (!selectedParam) {
        onAdd(type, baseTitle, notes.trim() || undefined, selectedParameterId, targetValue.trim() || undefined);
      } else {
        // Like an assigned plan: the test is of this measure; per side one test per side
        const measureName = measureChoices.length > 0 ? activeMeasure?.name : undefined;
        for (const side of testSides) {
          const title = [baseTitle, measureName, side === 'L' ? 'Left' : side === 'R' ? 'Right' : undefined].filter(Boolean).join(' · ');
          // One after the other — see onAdd
          const target = testSides.length > 1 ? (side === 'L' ? targetLeft : targetRight) : targetValue;
          await onAdd(type, title, notes.trim() || undefined, measureRef(selectedParam.id, measureId, side), target.trim() || undefined);
        }
      }
    } else {
      if (!eventTitle.trim()) return;
      const endDate = lastDay > date ? lastDay : undefined;
      await onAdd(type, eventTitle.trim(), notes.trim() || undefined, undefined, undefined, endDate);
    }
    } finally {
      setAdding(false);
    }
    setLastDay('');
    setEventTitle('');
    setNotes('');
    setSelectedParameterId(null);
    setTargetValue('');
    setTargetLeft('');
    setTargetRight('');
    setBaselineValue('');
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleCreateParameter = (paramData: {
    name: string;
    unit?: string;
    category?: string;
    measures?: ParameterMeasure[];
    perSide?: boolean;
    /** How to perform the test and a demo video — shown to athletes ("Test details") */
    testInstructions?: string;
    testVideoUrl?: string;
    interactions: unknown[];
    methods: unknown[];
  }) => {
    const newParam = addParameter({
      name: paramData.name,
      unit: paramData.unit,
      category: paramData.category,
      measures: paramData.measures,
      perSide: paramData.perSide,
      testInstructions: paramData.testInstructions,
      testVideoUrl: paramData.testVideoUrl,
    });
    setCreateParamDialogOpen(false);
    // Auto-select the newly created parameter
    if (newParam?.id) {
      setSelectedParameterId(newParam.id);
    }
  };

  const tests = events.filter(e => e.type === 'test');
  const eventItems = events.filter(e => e.type === 'event');

  // Live lookup: use parameterId → parameter name; fallback to stored title
  const getTestDisplayName = (ev: CalendarEvent): string => {
    if (ev.parameterId) {
      if (isBioId(ev.parameterId)) {
        const metric = bioMetric(ev.parameterId);
        if (metric) return metric.name;
      } else {
        const ref = parseMeasureRef(ev.parameterId);
        const param = parameters.find(p => p.id === ref.parameterId);
        // A test of a measure / side keeps its title — it names them ("Knee-to-Wall · Left")
        if (param && !ref.measureId && !ref.side) return param.name;
      }
    }
    return ev.title;
  };
  /** Unit of a test's target: its measure's (a plain reference: the parameter's) */
  const unitOfTest = (parameterId: string): string | undefined => {
    if (isBioId(parameterId)) return bioMetric(parameterId)?.unit;
    const ref = parseMeasureRef(parameterId);
    const param = parameters.find(p => p.id === ref.parameterId);
    if (!param) return undefined;
    const m = measureById(param, ref.measureId);
    return m?.kind === 'number' ? m.unit : m?.kind === 'scale' ? `/${m.scaleMax ?? 10}` : undefined;
  };

  const endDateError = lastDay !== '' && lastDay < date;
  const isAddDisabled = adding || (type === 'test' ? !selectedParameterId : (!eventTitle.trim() || endDateError));
  /** "1 Aug – 14 Aug 2026" for an event over several days */
  const rangeLabel = (ev: CalendarEvent) =>
    `${format(parseDateStr(ev.date), 'd MMM')} – ${format(parseDateStr(eventEndDate(ev)), 'd MMM yyyy')}`;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPortal>
          <DialogOverlay className="z-[150] bg-black/30" />
          <DialogContent
            className="w-[calc(100vw-1.5rem)] sm:max-w-[460px] max-h-[88dvh] overflow-y-auto overflow-x-hidden grid-cols-[minmax(0,1fr)] gap-3 p-4 sm:p-6 z-[160]"
            onClick={e => e.stopPropagation()}
          >
            <DialogHeader className="pr-6 text-left">
              <DialogTitle className="text-base sm:text-lg">
                Tests & events — {format(parseDateStr(date), 'EEE, d MMM yyyy')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Currently scheduled */}
              {events.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Scheduled
                  </Label>
                  <div className="space-y-1.5">
                    {tests.map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between gap-2 rounded-md border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-2"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <Trophy className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{getTestDisplayName(ev)}</p>
                            {ev.targetValue && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Target: {ev.targetValue}
                                {ev.parameterId && (() => {
                                  const unit = unitOfTest(ev.parameterId);
                                  return unit ? ` ${unit}` : '';
                                })()}
                              </p>
                            )}
                            {ev.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5">{ev.notes}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onDelete(ev.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {eventItems.map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between gap-2 rounded-md border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-2"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <Calendar className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{ev.title}</p>
                            {(isMultiDayEvent(ev) || ev.source) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {[isMultiDayEvent(ev) ? rangeLabel(ev) : null, ev.source ? 'from the anamnesis' : null].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {ev.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5">{ev.notes}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onDelete(ev.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add new */}
              <div className="space-y-3 pt-1 border-t">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Add New
                </Label>

                {/* Type selector */}
                <ToggleGroup
                  type="single"
                  value={type}
                  onValueChange={v => {
                    if (v) setType(v as 'test' | 'event');
                  }}
                  className="justify-start"
                >
                  <ToggleGroupItem
                    value="test"
                    className="flex-1 data-[state=on]:bg-amber-100 data-[state=on]:text-amber-700 data-[state=on]:border-amber-400 hover:bg-amber-50 hover:text-amber-600 dark:data-[state=on]:bg-amber-950/40 dark:data-[state=on]:text-amber-400 dark:hover:bg-amber-950/20"
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Test
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="event"
                    className="flex-1 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700 data-[state=on]:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:data-[state=on]:bg-blue-950/40 dark:data-[state=on]:text-blue-400 dark:hover:bg-blue-950/20"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Event
                  </ToggleGroupItem>
                </ToggleGroup>

                {type === 'test' ? (
                  <>
                    {/* Parameter Dropdown */}
                    <div className="space-y-1.5">
                      <Label>Parameter</Label>
                      <Popover open={parameterComboOpen} onOpenChange={setParameterComboOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={parameterComboOpen}
                            className="w-full justify-between font-normal"
                          >
                            <span className={cn(!selectedParameter && 'text-muted-foreground')}>
                              {selectedParameter?.name ?? 'Select a parameter...'}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[200]" align="start">
                          <Command>
                            <CommandInput placeholder="Search parameters..." />
                            <CommandList>
                              <CommandEmpty>No parameters found.</CommandEmpty>
                              {performanceParams.length > 0 && (
                                <CommandGroup heading="Performance Parameters">
                                  {performanceParams.map(p => (
                                    <CommandItem
                                      key={p.id}
                                      value={p.name}
                                      onSelect={() => {
                                        setSelectedParameterId(p.id);
                                        setParameterComboOpen(false);
                                      }}
                                    >
                                      <Check className={cn('mr-2 h-4 w-4', selectedParameterId === p.id ? 'opacity-100' : 'opacity-0')} />
                                      {p.name}
                                      {p.unit && <span className="ml-1 text-muted-foreground text-xs">({p.unit})</span>}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              {(biometricDefinitions.length > 0 || biometricParams.length > 0) && (
                                <>
                                  <CommandSeparator />
                                  <CommandGroup heading="Body Metrics">
                                    {biometricParams.map(p => (
                                      <CommandItem
                                        key={p.id}
                                        value={p.name}
                                        onSelect={() => {
                                          setSelectedParameterId(p.id);
                                          setParameterComboOpen(false);
                                        }}
                                      >
                                        <Check className={cn('mr-2 h-4 w-4', selectedParameterId === p.id ? 'opacity-100' : 'opacity-0')} />
                                        {p.name}
                                        {p.unit && <span className="ml-1 text-muted-foreground text-xs">({p.unit})</span>}
                                      </CommandItem>
                                    ))}
                                    {biometricDefinitions.map(def => (
                                      <CommandItem
                                        key={def.id}
                                        value={def.name}
                                        onSelect={() => {
                                          setSelectedParameterId(`bio:${def.id}`);
                                          setParameterComboOpen(false);
                                        }}
                                      >
                                        <Check className={cn('mr-2 h-4 w-4', selectedParameterId === `bio:${def.id}` ? 'opacity-100' : 'opacity-0')} />
                                        {def.name}
                                        {def.unit && <span className="ml-1 text-muted-foreground text-xs">({def.unit})</span>}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </>
                              )}
                              <CommandSeparator />
                              <CommandGroup>
                                <CommandItem
                                  onSelect={() => {
                                    setParameterComboOpen(false);
                                    setCreateParamDialogOpen(true);
                                  }}
                                  className="text-primary"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  ＋ Add new Parameter
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Measure and side — like a goal in the wizard */}
                    {measureChoices.length > 0 && (
                      <div className="space-y-1.5">
                        <Label>Measure</Label>
                        <ToggleGroup type="single" value={measureId ?? measureChoices[0].id}
                          onValueChange={v => { if (v) setMeasureId(v === measureChoices[0].id ? undefined : v); }}
                          className="flex-wrap justify-start gap-1">
                          {measureChoices.map(m => (
                            <ToggleGroupItem key={m.id} value={m.id} size="sm" className="h-8 border data-[state=on]:border-primary">
                              {m.name}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </div>
                    )}
                    {perSide && (
                      <div className="space-y-1.5">
                        <Label>Side</Label>
                        <ToggleGroup type="single" value={sideChoice} onValueChange={v => { if (v) setSideChoice(v as 'L' | 'R' | 'both'); }}
                          className="justify-start gap-1">
                          <ToggleGroupItem value="L" size="sm" className="h-8 border data-[state=on]:border-primary">Left</ToggleGroupItem>
                          <ToggleGroupItem value="R" size="sm" className="h-8 border data-[state=on]:border-primary">Right</ToggleGroupItem>
                          <ToggleGroupItem value="both" size="sm" className="h-8 border data-[state=on]:border-primary">Left &amp; right</ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    )}

                    {/* Baseline: the athlete's latest recorded value, display only — not editable
                        here (a value typed here was never saved; results are recorded through the
                        test itself or the athlete's Performance tab) */}
                    {selectedParameter && (
                      hasAthleteBaseline ? (
                        <div className="space-y-1.5">
                          <Label htmlFor="cal-baseline">
                            Baseline Value{' '}
                            <span className="text-xs text-muted-foreground">(latest from athlete profile)</span>
                          </Label>
                          <Input
                            id="cal-baseline"
                            value={baselineValue}
                            readOnly
                            tabIndex={-1}
                            className="bg-muted text-muted-foreground cursor-default"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No baseline recorded for this athlete yet.
                        </p>
                      )
                    )}

                    {/* Target value — one per side when both sides are added */}
                    {(() => {
                      const placeholder =
                        activeMeasure?.kind === 'levels' ? `e.g., ${activeMeasure.levels?.[activeMeasure.levels.length - 1] ?? 'a level'}`
                        : activeMeasure?.kind === 'passFail' ? 'e.g., Passed'
                        : activeMeasure?.kind === 'scale' ? `e.g., ${activeMeasure.scaleMin ?? 0} (of ${activeMeasure.scaleMax ?? 10})`
                        : (activeMeasure?.unit ?? selectedParameter?.unit)
                          ? `e.g., 120 ${activeMeasure?.unit ?? selectedParameter?.unit}`
                          : 'e.g., 120 kg';
                      return testSides.length > 1 ? (
                        <div className="space-y-1.5">
                          <Label>
                            Target{' '}<span className="text-xs text-muted-foreground">(optional)</span>
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor="cal-target-l" className="text-xs text-muted-foreground">Left</Label>
                              <Input id="cal-target-l" value={targetLeft} onChange={e => setTargetLeft(e.target.value)} placeholder={placeholder} />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="cal-target-r" className="text-xs text-muted-foreground">Right</Label>
                              <Input id="cal-target-r" value={targetRight} onChange={e => setTargetRight(e.target.value)} placeholder={placeholder} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label htmlFor="cal-target">
                            Target Value{' '}
                            <span className="text-xs text-muted-foreground">(optional)</span>
                          </Label>
                          <Input id="cal-target" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder={placeholder} />
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  /* Event: free text title */
                  <div className="space-y-1.5">
                    <Label htmlFor="cal-event-title">Event Name</Label>
                    <Input
                      id="cal-event-title"
                      placeholder="e.g., Regional Competition"
                      value={eventTitle}
                      onChange={e => setEventTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !isAddDisabled) handleAdd();
                      }}
                    />
                    {/* Start date = the clicked day; an end date makes it an event over several days
                        (e.g. a holiday or a training camp) */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Start date</Label>
                        <Input value={format(parseDateStr(date), 'd MMM yyyy')} readOnly tabIndex={-1} className="bg-muted text-muted-foreground cursor-default" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cal-event-last-day" className="text-xs text-muted-foreground">End date <span className="font-normal">(optional)</span></Label>
                        <Input id="cal-event-last-day" type="date" min={date} value={lastDay} onChange={e => setLastDay(e.target.value)} />
                      </div>
                    </div>
                    <p className={cn('text-xs', endDateError ? 'text-destructive' : 'text-muted-foreground')}>
                      {endDateError ? 'The end date must be on or after the start date.' : 'Leave the end date empty for a one-day event.'}
                    </p>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="cal-event-notes">
                    Notes{' '}
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="cal-event-notes"
                    placeholder="Add notes or context..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <Button
                  onClick={handleAdd}
                  disabled={isAddDisabled}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add {type === 'test' ? 'Test' : 'Event'}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Create Parameter Dialog — rendered outside main dialog to avoid nesting issues */}
      <AddParameterDialogV2
        open={createParamDialogOpen}
        onOpenChange={setCreateParamDialogOpen}
        allParameters={parameters}
        toolboxEntries={toolboxData?.entries ?? []}
        onAdd={handleCreateParameter}
        containerClassName="z-[300]"
      />
    </>
  );
}
