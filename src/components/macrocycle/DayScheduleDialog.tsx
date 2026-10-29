/**
 * Wizard phase 1, step 2: click a day in the plan calendar → schedule on that day.
 *
 * Test: a test of a main goal or of one of the sub-goals chosen for it (in the goals list), or a
 * new sub-goal with the day already set. Event: a
 * new event (name, description, end date for an event over several days) or the day added to an
 * event that already exists. What is already on the day is listed with an X to take it off.
 * Main goals are folded: their sub-goals show after opening them. The info icon shows a goal's
 * baseline and goal value on hover.
 */
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Check, ChevronDown, Info, Plus, Target, Trophy, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { parseDateStr } from '@/utils/dateUtils';
import { eventDateList, groupConsecutiveDates } from '@/hooks/useCalendarEvents';
import type { Event, SmartGoal, SubGoal } from '@/types/training';
import type { ParameterV2 } from '@/types/parametersV2';
import { formatGoalRange, goalShowsPercent } from '@/utils/goalMeasures';

interface DayScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'yyyy-MM-dd' */
  date: string;
  /** Last day of the plan — an event can't run past it */
  planEndDate?: string;
  smartGoals: SmartGoal[];
  subGoals: SubGoal[];
  events: Event[];
  /** Parameter definitions — goal values per measure ("4/10 → ≤ 0/10", levels by name) */
  parameters?: ParameterV2[];
  /** Tests / events already in the athlete's calendar on this day (other programs) — shown only */
  existingOnDay?: string[];
  onToggleGoalTest: (goalId: string) => void;
  onToggleSubGoalTest: (subGoalId: string) => void;
  onNewSubGoal: () => void;
  onCreateEvent: (event: { name: string; comments: string; dates: string[] }) => void;
  onAddEventDays: (eventId: string, dates: string[]) => void;
  onRemoveEventDays: (eventId: string, dates: string[]) => void;
}

const subGoalLabel = (sg: SubGoal) => sg.testMethod || sg.description || 'Sub-goal';

/** "11.9 → 11.5 s (−3.4 %)"; null when no values are set */
function valuesText(baseline: number | undefined, goal: number | undefined, unit: string, pct: number | undefined): string | null {
  if (!baseline && !goal) return null;
  const u = unit ? ` ${unit}` : '';
  const p = pct ? ` (${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)} %)` : '';
  return `Baseline ${baseline ?? 0}${u} → goal ${goal ?? 0}${u}${p}`;
}

/** A SMART goal's values, per its measure: "Baseline 4.5 s → goal 4.3 s (−4.4 %)", "4/10 → ≤ 0/10" */
function goalValuesText(g: SmartGoal, param: ParameterV2 | undefined): string | null {
  if (!param || (!g.measureId && !g.side)) return valuesText(g.baselineValue, g.desiredValue, g.unit, g.percentChange);
  const pct = goalShowsPercent(g, param) && g.percentChange ? ` (${g.percentChange > 0 ? '+' : '−'}${Math.abs(g.percentChange).toFixed(1)} %)` : '';
  return `${formatGoalRange(g, param)}${pct}${g.phaseNote ? ` · ${g.phaseNote}` : ''}`;
}

export function DayScheduleDialog({
  open, onOpenChange, date, planEndDate, smartGoals, subGoals, events, existingOnDay = [], parameters = [],
  onToggleGoalTest, onToggleSubGoalTest, onNewSubGoal, onCreateEvent, onAddEventDays, onRemoveEventDays,
}: DayScheduleDialogProps) {
  const [type, setType] = useState<'test' | 'event'>('test');
  const [name, setName] = useState('');
  const [comments, setComments] = useState('');
  const [endDate, setEndDate] = useState('');
  // Main goals whose sub-goals are shown (folded by default)
  const [openGoals, setOpenGoals] = useState<Set<string>>(new Set());
  // Tests chosen to be added to this day ("g:<goal id>" / "s:<sub-goal id>") — added with the button
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(''); setComments(''); setEndDate(''); setOpenGoals(new Set()); setPicked(new Set());
  }, [open, date]);

  const togglePicked = (key: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const addPicked = () => {
    picked.forEach(key => (key.startsWith('g:') ? onToggleGoalTest(key.slice(2)) : onToggleSubGoalTest(key.slice(2))));
    setPicked(new Set());
  };

  const dayLabel = date ? format(parseDateStr(date), 'EEE, d MMM yyyy') : '';
  const fmtShort = (d: string) => format(parseDateStr(d), 'd MMM');
  const rangeOf = (dates: string[]) => groupConsecutiveDates(dates).find(([a, b]) => date >= a && date <= b);

  // What is on this day
  const goalsOnDay = smartGoals.filter(g => g.testDates?.includes(date));
  const subGoalsOnDay = subGoals.filter(sg => sg.testDates?.includes(date));
  const eventsOnDay = events.filter(e => e.eventDates?.includes(date));
  const nothingOnDay = goalsOnDay.length + subGoalsOnDay.length + eventsOnDay.length + existingOnDay.length === 0;

  const endError = endDate && endDate < date ? 'The end date must be on or after the start date.'
    : endDate && planEndDate && endDate > planEndDate ? 'The end date must lie within the plan.' : null;
  const newEventDays = eventDateList({ date, endDate: endDate && !endError ? endDate : undefined });

  const createEvent = () => {
    if (!name.trim() || endError) return;
    onCreateEvent({ name: name.trim(), comments: comments.trim(), dates: newEventDays });
    setName(''); setComments(''); setEndDate('');
  };

  /** One goal / sub-goal row: click = choose it (added with the button below); already on this day = shown, not clickable */
  const testRow = (key: string, label: string, scheduled: boolean,
    opts: { main?: boolean; dates?: string[]; values?: string | null } = {}) => {
    const chosen = !scheduled && picked.has(key);
    return (
    <button
      key={key}
      type="button"
      disabled={scheduled}
      onClick={() => togglePicked(key)}
      className={cn(
        'flex-1 min-w-0 w-full flex items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors',
        scheduled ? 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 cursor-default'
          : chosen ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/60',
      )}
    >
      <span className={cn('mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center',
        scheduled ? 'bg-amber-500 border-amber-500 text-white' : chosen ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40')}>
        {(scheduled || chosen) && <Check className="h-3 w-3" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          {opts.main ? <Target className="h-3.5 w-3.5 text-primary shrink-0" /> : <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
          <span className={cn('truncate', opts.main && 'font-medium')}>{label}</span>
          {opts.main && !scheduled && <span className="text-[11px] text-muted-foreground shrink-0">main goal</span>}
          {scheduled && <span className="text-[11px] text-amber-700 shrink-0">on this day</span>}
          {/* Baseline → goal on hover, so the list stays short */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span role="img" aria-label={opts.values ?? 'No values set yet'} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                onClick={e => e.stopPropagation()}>
                <Info className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="z-[200] max-w-[240px] text-xs">
              {opts.values ?? 'No baseline or goal value set yet — set them with the pencil in the goals list.'}
            </TooltipContent>
          </Tooltip>
        </span>
        {(opts.dates?.filter(d => d !== date).length ?? 0) > 0 && (
          <span className="block text-xs text-muted-foreground mt-0.5">
            Also on {opts.dates!.filter(d => d !== date).sort().map(fmtShort).join(', ')}
          </span>
        )}
      </span>
    </button>
    );
  };

  const unlinkedSubGoals = subGoals.filter(sg => !sg.parentGoalId || !smartGoals.some(g => g.id === sg.parentGoalId));
  const otherEvents = events.filter(e => !e.eventDates?.includes(date));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tests & events — {dayLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* On this day */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">On this day</Label>
            {nothingOnDay ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
            ) : (
              <div className="space-y-1.5">
                {goalsOnDay.map(g => (
                  <div key={g.id} className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 text-sm">
                    <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 min-w-0 truncate">Test: {g.description || 'Main goal'}</span>
                    <button type="button" className="text-muted-foreground hover:text-destructive" aria-label="Remove from this day" onClick={() => onToggleGoalTest(g.id)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {subGoalsOnDay.map(sg => (
                  <div key={sg.id} className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 text-sm">
                    <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">Test: {subGoalLabel(sg)}</span>
                    <button type="button" className="text-muted-foreground hover:text-destructive" aria-label="Remove from this day" onClick={() => onToggleSubGoalTest(sg.id)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {eventsOnDay.map(e => {
                  const run = rangeOf(e.eventDates);
                  const multi = run && run[0] !== run[1];
                  return (
                    <div key={e.id} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1.5 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{e.name}</span>
                        {multi && <span className="block text-xs text-muted-foreground">{fmtShort(run[0])} – {format(parseDateStr(run[1]), 'd MMM yyyy')}</span>}
                      </span>
                      <button type="button" className="text-muted-foreground hover:text-destructive"
                        aria-label={multi ? 'Remove these days' : 'Remove from this day'}
                        title={multi ? 'Removes all days of this period' : undefined}
                        onClick={() => onRemoveEventDays(e.id, run ? eventDateList({ date: run[0], endDate: run[1] }) : [date])}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                {existingOnDay.map((label, i) => (
                  <p key={`x${i}`} className="text-xs text-muted-foreground px-1">Already in the athlete's calendar: {label}</p>
                ))}
              </div>
            )}
          </div>

          {/* Add */}
          <div className="space-y-3 pt-2 border-t">
            <ToggleGroup type="single" value={type} onValueChange={v => { if (v) setType(v as 'test' | 'event'); }} className="justify-start">
              <ToggleGroupItem value="test" className="flex-1 data-[state=on]:bg-amber-100 data-[state=on]:text-amber-700 data-[state=on]:border-amber-400">
                <Trophy className="h-4 w-4 mr-2" />Test
              </ToggleGroupItem>
              <ToggleGroupItem value="event" className="flex-1 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700 data-[state=on]:border-blue-400">
                <Calendar className="h-4 w-4 mr-2" />Event
              </ToggleGroupItem>
            </ToggleGroup>

            {type === 'test' ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Choose what is tested on this day, then add it.</p>
                {smartGoals.length === 0 && unlinkedSubGoals.length === 0 && (
                  <p className="text-sm text-muted-foreground">No goals yet — add a main goal in step 1.</p>
                )}
                {smartGoals.map(g => {
                  const own = subGoals.filter(sg => sg.parentGoalId === g.id);
                  const count = own.length;
                  const onDay = own.filter(sg => sg.testDates?.includes(date)).length;
                  const isOpen = openGoals.has(g.id);
                  return (
                    <div key={g.id} className="space-y-1.5">
                      <div className="flex items-start gap-1">
                        <button type="button" disabled={count === 0}
                          aria-label={isOpen ? 'Hide sub-goals' : 'Show sub-goals'} aria-expanded={isOpen}
                          onClick={() => setOpenGoals(prev => { const next = new Set(prev); if (next.has(g.id)) next.delete(g.id); else next.add(g.id); return next; })}
                          className="mt-1.5 h-6 w-6 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30">
                          <ChevronDown className={cn('h-4 w-4 transition-transform', !isOpen && '-rotate-90')} />
                        </button>
                        {testRow(`g:${g.id}`, g.description || 'Main goal', !!g.testDates?.includes(date),
                          { main: true, dates: g.testDates, values: goalValuesText(g, parameters.find(p => p.id === g.linkedParameterId)) })}
                      </div>
                      {count > 0 && !isOpen && (
                        <button type="button" className="ml-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setOpenGoals(prev => new Set(prev).add(g.id))}>
                          {count} sub-goal{count === 1 ? '' : 's'}{onDay > 0 ? ` · ${onDay} on this day` : ''}
                        </button>
                      )}
                      {isOpen && (
                        <div className="ml-7 space-y-1.5">
                          {own.map(sg => testRow(`s:${sg.id}`, subGoalLabel(sg), !!sg.testDates?.includes(date),
                            { dates: sg.testDates, values: valuesText(sg.preTestValue, sg.goalValue, sg.unit, sg.percentChange) }))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {unlinkedSubGoals.map(sg =>
                  testRow(`s:${sg.id}`, subGoalLabel(sg), !!sg.testDates?.includes(date),
                    { dates: sg.testDates, values: valuesText(sg.preTestValue, sg.goalValue, sg.unit, sg.percentChange) }))}
                <Button type="button" className="w-full mt-1" disabled={picked.size === 0} onClick={addPicked}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  {picked.size > 1 ? `Add ${picked.size} tests to this day` : 'Add test to this day'}
                </Button>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={onNewSubGoal}>
                  <Plus className="h-3.5 w-3.5 mr-1" />New sub-goal / test on this day
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="day-event-name">Event name</Label>
                  <Input id="day-event-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Competition, holiday, training camp"
                    onKeyDown={e => { if (e.key === 'Enter') createEvent(); }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start date</Label>
                    <Input value={date ? format(parseDateStr(date), 'd MMM yyyy') : ''} readOnly tabIndex={-1} className="bg-muted text-muted-foreground cursor-default" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="day-event-end" className="text-xs text-muted-foreground">End date <span className="font-normal">(optional)</span></Label>
                    <Input id="day-event-end" type="date" min={date} max={planEndDate} value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <p className={cn('text-xs', endError ? 'text-destructive' : 'text-muted-foreground')}>
                  {endError ?? (newEventDays.length > 1 ? `${newEventDays.length} days, ${fmtShort(newEventDays[0])} – ${format(parseDateStr(newEventDays[newEventDays.length - 1]), 'd MMM yyyy')}.` : 'Leave the end date empty for a one-day event.')}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="day-event-notes">Description <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea id="day-event-notes" rows={2} className="text-sm" value={comments} onChange={e => setComments(e.target.value)} placeholder="e.g. venue, what matters for the training" />
                </div>
                <Button type="button" className="w-full" disabled={!name.trim() || !!endError} onClick={createEvent}>
                  <Plus className="h-4 w-4 mr-1.5" />Add event
                </Button>

                {otherEvents.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Or add this day to an event you already have (e.g. a second match day):</p>
                    {otherEvents.map(e => (
                      <div key={e.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="flex-1 min-w-0 truncate">{e.name}</span>
                        <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => onAddEventDays(e.id, [date])}>
                          <Plus className="h-3 w-3 mr-0.5" />Add this day
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
