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
import { CalendarEvent } from '@/hooks/useCalendarEvents';
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
  onAdd: (type: 'test' | 'event', title: string, notes?: string, parameterId?: string, targetValue?: string) => void;
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
  const [notes, setNotes] = useState('');
  const [selectedParameterId, setSelectedParameterId] = useState<string | null>(null);
  const [parameterComboOpen, setParameterComboOpen] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [baselineValue, setBaselineValue] = useState(''); // display only, never saved
  const [createParamDialogOpen, setCreateParamDialogOpen] = useState(false);

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

  /** Latest value of a parameter: coach-recorded (profile) or self-reported by the athlete */
  const latestRecordedValue = (paramId: string) => {
    const id = isBioId(paramId) ? bioDefId(paramId) : paramId;
    const recorded = [
      ...(athleteBiometrics.find(b => b.biometricDefinitionId === id)?.values ?? []),
      ...(athletePerformanceParameters.find(p => p.athleticismParameterId === id)?.values ?? []),
    ];
    const own = [...(selfReported.get(id) ?? []), ...(selfReported.get(`bio:${id}`) ?? [])];
    return latestValueOf(withSelfReported(recorded, own));
  };

  // Load baseline value from athlete profile when parameter changes
  useEffect(() => {
    if (!selectedParameterId) { setBaselineValue(''); return; }
    setBaselineValue(latestRecordedValue(selectedParameterId)?.value ?? '');
  }, [selectedParameterId, athletePerformanceParameters, athleteBiometrics, selfReported]);

  const hasAthleteBaseline = selectedParameterId !== null && latestRecordedValue(selectedParameterId) !== null;

  // Resolve display name + unit for whatever is selected
  const selectedParameter = isBioId(selectedParameterId ?? '')
    ? bioMetric(selectedParameterId!)
    : parameters.find(p => p.id === selectedParameterId);

  const resetForm = () => {
    setEventTitle('');
    setNotes('');
    setSelectedParameterId(null);
    setTargetValue('');
    setBaselineValue('');
    setType('test');
  };

  const handleAdd = () => {
    if (type === 'test') {
      if (!selectedParameterId) return;
      const testTitle = selectedParameter?.name ?? '';
      if (!testTitle) return;
      onAdd(type, testTitle, notes.trim() || undefined, selectedParameterId, targetValue.trim() || undefined);
    } else {
      if (!eventTitle.trim()) return;
      onAdd(type, eventTitle.trim(), notes.trim() || undefined);
    }
    setEventTitle('');
    setNotes('');
    setSelectedParameterId(null);
    setTargetValue('');
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
    interactions: unknown[];
    methods: unknown[];
  }) => {
    const newParam = addParameter({
      name: paramData.name,
      unit: paramData.unit,
      category: paramData.category,
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
        const param = parameters.find(p => p.id === ev.parameterId);
        if (param) return param.name;
      }
    }
    return ev.title;
  };

  const isAddDisabled = type === 'test' ? !selectedParameterId : !eventTitle.trim();

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPortal>
          <DialogOverlay className="z-[150] bg-black/30" />
          <DialogContent
            className="sm:max-w-[460px] z-[160]"
            onClick={e => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle>
                Tests & Events — {format(parseDateStr(date), 'PPP')}
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
                                  const unit = isBioId(ev.parameterId)
                                    ? bioMetric(ev.parameterId)?.unit
                                    : parameters.find(p => p.id === ev.parameterId)?.unit;
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

                    {/* Target Value */}
                    <div className="space-y-1.5">
                      <Label htmlFor="cal-target">
                        Target Value{' '}
                        <span className="text-xs text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="cal-target"
                        value={targetValue}
                        onChange={e => setTargetValue(e.target.value)}
                        placeholder={
                          selectedParameter?.unit
                            ? `e.g., 120 ${selectedParameter.unit}`
                            : 'e.g., 120 kg'
                        }
                      />
                    </div>
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
                        if (e.key === 'Enter' && eventTitle.trim()) handleAdd();
                      }}
                    />
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
