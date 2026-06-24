import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Dumbbell, Link2, CheckCircle2, Clock, BedDouble, Activity, AlertTriangle, Plus, BookOpen, Check, GripVertical, Trash2, MessageCircle, Trophy, Calendar, ClipboardCheck } from 'lucide-react';
import { CoachAthleteProgressTab } from '@/components/coach-mobile/CoachAthleteProgressTab';
import { CoachAthleteSettingsTab } from '@/components/coach-mobile/CoachAthleteSettingsTab';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { useAthletes } from '@/hooks/useAthletes';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { supabase } from '@/lib/supabase';
import type { AthleteScheduleEntry, SessionSummary, ExerciseSummary, AthleteCalendarEvent } from '@/hooks/useAthleteApp';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';
import { CalendarEventDialog } from '@/components/shared/CalendarEventDialog';
import { format, parseISO } from 'date-fns';
import { IntensityBadge, INTENSITY_CONFIG } from '@/components/athlete-app/IntensityBadge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAthleteCheckins, wellnessComposite, type AthleteCheckin } from '@/hooks/useAthleteCheckins';
import { DEFAULT_MONITORING_CONFIG, type AthleteNote } from '@/types/athlete';
import { FRONT_REGIONS, BACK_REGIONS, nrsSeverityColor, nrsSeverityStroke, svgRegionKey } from '@/lib/bodyMapData';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useSessionLibrary } from '@/hooks/useSessionLibrary';
import type { SessionLibraryEntry } from '@/types/sessionLibrary';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

// ── Monitoring helpers ─────────────────────────────────────────────────────────

const WELLNESS_LABELS: Record<string, string> = {
  fatigue: 'Energy', sleep: 'Sleep', soreness: 'Soreness', stress: 'Stress', mood: 'Mood',
};
const WELLNESS_DOT_COLORS: Record<number, string> = {
  1: 'bg-red-500', 2: 'bg-orange-400', 3: 'bg-amber-400', 4: 'bg-green-400', 5: 'bg-green-600',
};
const WELLNESS_TEXT_COLORS: Record<number, string> = {
  1: 'text-red-600', 2: 'text-orange-500', 3: 'text-amber-500', 4: 'text-green-500', 5: 'text-green-700',
};
const WELLNESS_KEYS = ['fatigue', 'sleep', 'soreness', 'stress', 'mood'] as const;
type WellnessKey = typeof WELLNESS_KEYS[number];
const WELLNESS_FIELD: Record<WellnessKey, keyof AthleteCheckin> = {
  fatigue: 'wellnessFatigue', sleep: 'wellnessSleep', soreness: 'wellnessSoreness',
  stress: 'wellnessStress', mood: 'wellnessMood',
};

function fmtMonitoringDate(dateStr: string, todayStr: string, t?: (key: string) => string): string {
  if (dateStr === todayStr) return t ? t('coachMobile.athleteProfile.today') : 'Today';
  const yesterday = toLocalDateStr(new Date(Date.now() - 86400000));
  if (dateStr === yesterday) return t ? t('coachMobile.athleteProfile.yesterday') : 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function NoteEntry({ note }: { note: AthleteNote }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <p className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <Clock className="h-3 w-3 shrink-0" />
        {format(new Date(note.timestamp), 'MMM d, yyyy · HH:mm')}
        {note.id === '__migrated__' && <span className="ml-1 italic">{t('coachMobile.athleteProfile.imported')}</span>}
      </p>
      <p className="whitespace-pre-wrap leading-snug">{note.text}</p>
    </div>
  );
}

function ScoreDots({ value, max = 5 }: { value: number | null; max?: number }) {
  const v = value ?? 0;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={cn('w-2.5 h-2.5 rounded-full', i < v ? (WELLNESS_DOT_COLORS[v] ?? 'bg-primary') : 'bg-muted')} />
      ))}
    </div>
  );
}

const ILLNESS_SYMPTOM_LABELS: Record<string, string> = {
  fever: 'Fever', fatigue: 'Fatigue', lymph_nodes: 'Swollen lymph nodes',
  sore_throat: 'Sore throat', blocked_nose: 'Blocked/runny nose', cough: 'Cough',
  breathing: 'Breathing difficulties', headache: 'Headache', nausea: 'Nausea',
  vomiting: 'Vomiting', diarrhoea: 'Diarrhoea', constipation: 'Constipation',
  fainting: 'Fainting', rash: 'Rash/itching', arrhythmia: 'Arrhythmia',
  chest_pain: 'Chest pain', abdominal_pain: 'Abdominal pain', numbness: 'Numbness',
  anxiety: 'Anxiety', low_mood: 'Low mood', irritability: 'Irritability',
  eye_problems: 'Eye problems', ear_problems: 'Ear problems', urinary: 'Urinary symptoms',
};

interface PainDotInfo { cx: number; cy: number; view: 'front' | 'back'; nrs: number }

function buildMobilePainDots(painAreas: AthleteCheckin['painAreas']): PainDotInfo[] {
  const dots: PainDotInfo[] = [];
  for (const area of painAreas) {
    const key = area.regionKey ?? String(area.areaId);
    for (const r of FRONT_REGIONS) {
      if (svgRegionKey(r) === key) { dots.push({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, view: 'front', nrs: area.severity }); break; }
    }
    for (const r of BACK_REGIONS) {
      if (svgRegionKey(r) === key) { dots.push({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, view: 'back',  nrs: area.severity }); break; }
    }
  }
  return dots;
}

function MobileBodyMap({ painAreas }: { painAreas: AthleteCheckin['painAreas'] }) {
  const { t: tMap } = useTranslation();
  const dots      = buildMobilePainDots(painAreas);
  const frontDots = dots.filter(d => d.view === 'front');
  const backDots  = dots.filter(d => d.view === 'back');

  function HalfMap({ imgSrc, viewBox, viewDots, label }: { imgSrc: string; viewBox: string; viewDots: PainDotInfo[]; label: string }) {
    return (
      <div className="flex-1">
        <p className="text-[10px] text-muted-foreground text-center mb-1 font-medium uppercase tracking-wide">{label}</p>
        <div className="relative" style={{ height: '155px' }}>
          <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
            {viewDots.map((d, i) => (
              <g key={i}>
                <circle cx={d.cx} cy={d.cy} r={8} fill={nrsSeverityColor(d.nrs)} stroke={nrsSeverityStroke(d.nrs)} strokeWidth={1.5} />
                <text x={d.cx} y={d.cy + 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">{d.nrs}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 pt-1">
      <HalfMap imgSrc="/bodymap-front.png" viewBox="0 0 193 306" viewDots={frontDots} label={tMap('coachMobile.athleteProfile.front')} />
      <HalfMap imgSrc="/bodymap-back.png"  viewBox="0 0 211 317" viewDots={backDots}  label={tMap('coachMobile.athleteProfile.back')}  />
    </div>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

const DAY_OPTIONS = [7, 14, 28, 90] as const;

function DaysSelector({ selected, onChange }: { selected: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1">
      {DAY_OPTIONS.map(d => (
        <button
          key={d}
          onClick={e => { e.stopPropagation(); onChange(d); }}
          className={cn(
            'px-2 py-0.5 text-xs rounded font-medium transition-colors',
            selected === d
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

function WellnessMiniChart({ checkins, days }: { checkins: AthleteCheckin[]; days: number }) {
  const data = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const byDate = new Map(checkins.map(c => [c.date, c]));
    const end = new Date(toLocalDateStr(new Date()) + 'T12:00:00');
    const result: { date: string; label: string; value: number | null }[] = [];
    for (
      let cursor = new Date(toLocalDateStr(cutoff) + 'T12:00:00');
      cursor.getTime() <= end.getTime();
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      const dateStr = toLocalDateStr(cursor);
      const c = byDate.get(dateStr);
      result.push({
        date: dateStr,
        label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: c ? wellnessComposite(c) : null,
      });
    }
    return result;
  }, [checkins, days]);

  const { t: tChart } = useTranslation();
  if (data.filter(d => d.value !== null).length < 2) return (
    <p className="text-xs text-muted-foreground text-center py-4">{tChart('coachMobile.athleteProfile.notEnoughData')}</p>
  );

  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v: number) => [v != null ? v.toFixed(1) : '—', tChart('coachMobile.athleteProfile.wellness')]}
          contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6 }}
          labelStyle={{ fontSize: 10 }}
        />
        <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CustomMetricMiniChart({
  history, days, unit, scaleMax,
}: { history: Array<{ date: string; value: number }>; days: number; unit?: string | null; scaleMax?: number }) {
  const data = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = toLocalDateStr(cutoff);
    return history.filter(h => h.date >= cutoffStr).map(h => ({
      label: new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: h.value,
    }));
  }, [history, days]);

  const { t: tMetric } = useTranslation();
  if (data.length < 2) return (
    <p className="text-xs text-muted-foreground text-center py-4">{tMetric('coachMobile.athleteProfile.notEnoughDataMetric')}</p>
  );

  const domainMax = scaleMax ?? undefined;

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[0, domainMax ?? 'auto']} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v: number) => [unit ? `${v} ${unit}` : String(v), 'Value']}
          contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6 }}
          labelStyle={{ fontSize: 10 }}
        />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Avatar helpers ─────────────────────────────────────────────────────────────

const PALETTE = [
  'bg-blue-500','bg-emerald-500','bg-violet-500',
  'bg-orange-500','bg-pink-500','bg-teal-500','bg-rose-500','bg-indigo-500',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  return toLocalDateStr(new Date(d.getTime() + n * 86_400_000));
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  return toLocalDateStr(new Date(d.getTime() + diff * 86_400_000));
}

function fmtShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

function fmtFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function formatWeekRange(mondayStr: string): string {
  return `${fmtShort(mondayStr)} – ${fmtFull(addDays(mondayStr, 6))}`;
}

function formatDayHeader(dateStr: string): { weekday: string; dateLabel: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    dateLabel: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
  };
}

// ── Schedule hook (coach-side read) ───────────────────────────────────────────

function useAthleteSchedule(connectionId: string | null) {
  const [schedule, setSchedule] = useState<AthleteScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connectionId) return;
    setLoading(true);

    const today = new Date();
    const from = new Date(today); from.setDate(today.getDate() - 14);
    const to   = new Date(today); to.setDate(today.getDate() + 90);
    const fmt  = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    supabase
      .from('athlete_schedule')
      .select('*')
      .eq('athlete_connection_id', connectionId)
      .gte('date', fmt(from))
      .lte('date', fmt(to))
      .order('date', { ascending: true })
      .then(({ data }) => {
        setSchedule(
          (data ?? []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            date: row.date as string,
            intensity: row.intensity as string | null,
            sessions: (row.sessions as AthleteScheduleEntry['sessions']) || [],
            events: (row.events as AthleteScheduleEntry['events']) || [],
            programName: row.program_name as string | null,
            mesocycleName: row.mesocycle_name as string | null,
            microcycleName: row.microcycle_name as string | null,
          }))
        );
        setLoading(false);
      });
  }, [connectionId]);

  return { schedule, setSchedule, loading };
}

// ── Session library → SessionSummary conversion ───────────────────────────────

function sessionLibraryToSummary(entry: SessionLibraryEntry, order: number): SessionSummary {
  const exercises: ExerciseSummary[] = entry.exercises.map((ex, i) => {
    const section = entry.sections.find(s => s.id === ex.sectionId);
    return {
      id: `mobile_lib_ex_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 4)}`,
      name: ex.exerciseName,
      order: ex.order ?? i,
      sectionId: ex.sectionId,
      sectionName: section?.name,
      sectionOrder: section?.order,
      exerciseLibraryId: ex.exerciseId,
      isCircuit: ex.isCircuit,
      circuitRounds: ex.isCircuit ? (ex as unknown as Record<string, unknown>).circuitRounds as string | undefined : undefined,
      mobileEdited: true,
      mobileAdded: true,
      plannedSets: 3,
      plannedParams: { Sets: 3, Reps_set1: '', Reps_set2: '', Reps_set3: '' },
      visibleParams: ['Reps'],
    };
  });
  return {
    id: `mobile_lib_session_${Date.now()}`,
    name: entry.name,
    order,
    methodCount: 0,
    exerciseCount: exercises.length,
    exercises,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'training' | 'progress' | 'settings';

export default function CoachMobileAthleteProfilePage() {
  const { t } = useTranslation();
  const { athleteId } = useParams<{ athleteId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Restore the tab the user was on before navigating into a session (returnState from session edit)
  const restoredTab = (location.state as { tab?: Tab } | null)?.tab;
  const [tab, setTab] = useState<Tab>(restoredTab ?? 'overview');

  // Sync tab from location.state on every navigation — location.key changes even when
  // path and state are identical (e.g. notification clicked twice to same tab), so this
  // handles both the first visit and repeated navigations to the same athlete page.
  useEffect(() => {
    const state = location.state as { tab?: Tab } | null;
    if (state?.tab) {
      setTab(state.tab);
    }
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = toLocalDateStr(new Date());
  const [weekMonday, setWeekMonday] = useState<string>(() => getMondayOf(today));

  const { athletes, updateAthlete, athletePerformanceParameters, getAthleteBiometrics } = useAthletes();
  const { getEventsForAthlete, addEvent: addCalendarEvent, deleteEvent: deleteCalendarEvent } = useCalendarEvents();
  const { connections } = useAthleteConnections();

  const athlete = athletes.find(a => a.id === athleteId);
  const connection = connections.find(c => c.athleteLocalId === athleteId);
  const { schedule, setSchedule, loading: schedLoading } = useAthleteSchedule(connection?.id ?? null);
  const { entries: sessionLibraryEntries } = useSessionLibrary();
  const { toast } = useToast();

  // ── Session logs for the visible week — keyed by "date|sessionId" ─────────
  interface SessionLogSummary { durationSeconds: number | null; borgRating: number | null; completedAt: string | null; }
  const [sessionLogs, setSessionLogs] = useState<Map<string, SessionLogSummary>>(new Map());
  useEffect(() => {
    if (!connection?.id) return;
    const weekEnd = addDays(weekMonday, 6);
    supabase
      .from('athlete_session_logs')
      .select('date, session_id, completed_at, duration_seconds, borg_rating')
      .eq('athlete_connection_id', connection.id)
      .gte('date', weekMonday)
      .lte('date', weekEnd)
      .not('completed_at', 'is', null)
      .then(({ data }) => {
        const m = new Map<string, SessionLogSummary>();
        for (const r of (data ?? []) as Record<string, unknown>[]) {
          m.set(`${r.date}|${r.session_id}`, {
            durationSeconds: r.duration_seconds as number | null,
            borgRating: r.borg_rating as number | null,
            completedAt: r.completed_at as string | null,
          });
        }
        setSessionLogs(m);
      });
  }, [connection?.id, weekMonday]);

  // ── Training-tab mutation state ────────────────────────────────────────────────
  const [dayActionTarget, setDayActionTarget] = useState<string | null>(null);
  const [dayActionsMenuDate, setDayActionsMenuDate] = useState<string | null>(null);
  const [dayIntensityPickerOpen, setDayIntensityPickerOpen] = useState(false);
  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false);
  const [clearWeekConfirmOpen, setClearWeekConfirmOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [sessionLibraryPickerOpen, setSessionLibraryPickerOpen] = useState(false);
  const [sessionSourcePickerOpen, setSessionSourcePickerOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Derive all notes (newest-first), appending the legacy `notes` string as the
  // oldest entry until it's been migrated — keeps it visible even after newer
  // notesHistory entries exist, instead of only showing it while history is empty.
  const allNotes = useMemo((): AthleteNote[] => {
    const history = athlete.notesHistory ?? [];
    const alreadyMigrated = history.some(n => n.id === '__migrated__');
    if (!alreadyMigrated && athlete.notes) {
      return [...history, { id: '__migrated__', text: athlete.notes, timestamp: athlete.createdAt }];
    }
    return history;
  }, [athlete.notesHistory, athlete.notes, athlete.createdAt]);

  const handleAddNote = async () => {
    const text = notesInput.trim();
    if (!text) return;
    const newEntry: AthleteNote = { id: `note-${Date.now()}`, text, timestamp: new Date().toISOString() };
    await updateAthlete(athleteId!, { notesHistory: [newEntry, ...(athlete.notesHistory ?? [])] });
    setNotesInput('');
    setEditingNotes(false);
  };

  // Tests & events
  const [eventDialogDate, setEventDialogDate] = useState<string | null>(null);
  const [testResultTarget, setTestResultTarget] = useState<{ event: AthleteCalendarEvent; date: string } | null>(null);
  const [testResultValue, setTestResultValue] = useState('');
  const [testResultNote, setTestResultNote] = useState('');
  const [testResultSaving, setTestResultSaving] = useState(false);
  const [testResultSaved, setTestResultSaved] = useState(false);
  const [existingTestResults, setExistingTestResults] = useState<Map<string, string>>(new Map());

  // Fetch already-entered test results for this athlete (keyed by parameterId, most recent wins)
  useEffect(() => {
    if (!connection?.id) return;
    supabase
      .from('athlete_test_results')
      .select('parameter_id, value, recorded_at')
      .eq('athlete_connection_id', connection.id)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => {
        const map = new Map<string, string>();
        for (const row of (data ?? []) as { parameter_id: string; value: string; recorded_at: string }[]) {
          const date = row.recorded_at.slice(0, 10);
          const key = `${row.parameter_id}:${date}`;
          if (!map.has(key)) map.set(key, row.value);
        }
        setExistingTestResults(map);
      });
  }, [connection?.id]);

  // ── Event handlers (tests & events) ───────────────────────────────────────────

  const handleAddEvent = useCallback(async (date: string, payload: Omit<CalendarEvent, 'id'>) => {
    if (!connection || !athleteId) return;
    const newEvent = await addCalendarEvent(athleteId, payload);
    const newEntry = {
      id: newEvent.id,
      type: newEvent.type,
      title: newEvent.title,
      notes: newEvent.notes ?? undefined,
      targetValue: newEvent.targetValue ?? undefined,
      parameterId: newEvent.parameterId ?? undefined,
    };
    const { data: row } = await supabase
      .from('athlete_schedule')
      .select('id, events')
      .eq('athlete_connection_id', connection.id)
      .eq('date', date)
      .maybeSingle();
    if (row) {
      const existing = (row.events as unknown[]) ?? [];
      await supabase.from('athlete_schedule').update({ events: [...existing, newEntry] }).eq('id', row.id);
      setSchedule(prev => prev.map(e => e.date === date ? { ...e, events: [...e.events, newEntry as AthleteCalendarEvent] } : e));
    } else {
      const { data: inserted } = await supabase.from('athlete_schedule').insert({
        athlete_connection_id: connection.id,
        date,
        sessions: [],
        events: [newEntry],
      }).select('id').single();
      setSchedule(prev => [...prev, {
        id: inserted?.id ?? `tmp-${date}`,
        date,
        intensity: null,
        sessions: [],
        events: [newEntry as AthleteCalendarEvent],
        programName: null,
        mesocycleName: null,
        microcycleName: null,
      }]);
    }
  }, [addCalendarEvent, athleteId, connection, setSchedule]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!connection || !athleteId) return;
    const allEvents = getEventsForAthlete(athleteId);
    const ev = allEvents.find(e => e.id === eventId);
    await deleteCalendarEvent(athleteId, eventId);
    if (!ev) return;
    const { data: row } = await supabase
      .from('athlete_schedule')
      .select('id, events')
      .eq('athlete_connection_id', connection.id)
      .eq('date', ev.date)
      .maybeSingle();
    if (row) {
      const updated = ((row.events as Array<{ id: string }>) ?? []).filter(e => e.id !== eventId);
      await supabase.from('athlete_schedule').update({ events: updated }).eq('id', row.id);
      setSchedule(prev => prev.map(e => e.date === ev.date ? { ...e, events: e.events.filter(ce => ce.id !== eventId) } : e));
    }
  }, [deleteCalendarEvent, athleteId, getEventsForAthlete, connection, setSchedule]);

  const handleSubmitTestResult = useCallback(async () => {
    if (!testResultTarget || !testResultValue.trim() || !connection) return;
    const { event, date } = testResultTarget;
    if (!event.parameterId) return;
    setTestResultSaving(true);
    try {
      const recordedAt = new Date(`${date}T12:00:00`).toISOString();
      const { error } = await supabase.from('athlete_test_results').insert({
        athlete_connection_id: connection.id,
        parameter_id: event.parameterId,
        value: testResultValue.trim(),
        recorded_at: recordedAt,
        note: testResultNote.trim() || null,
      });
      if (error) {
        toast({ title: 'Failed to save result', description: error.message, variant: 'destructive' });
        return;
      }
      setExistingTestResults(prev => new Map(prev).set(`${event.parameterId!}:${date}`, testResultValue.trim()));
      setTestResultSaved(true);
      setTimeout(() => {
        setTestResultTarget(null);
        setTestResultSaved(false);
        setTestResultValue('');
        setTestResultNote('');
      }, 1200);
    } finally {
      setTestResultSaving(false);
    }
  }, [testResultTarget, testResultValue, testResultNote, connection]);

  // Intensity levels for picker
  const intensityLevels = Object.entries(INTENSITY_CONFIG)
    .filter(([k]) => /^\d+$/.test(k))
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  // ── Monitoring ────────────────────────────────────────────────────────────────
  const monitoringEnabled   = connection?.monitoringEnabled ?? false;
  const monitoringConfig    = connection?.monitoringConfig ?? DEFAULT_MONITORING_CONFIG;
  const enabledBlocks       = monitoringEnabled ? (monitoringConfig?.blocks ?? []).filter(b => b.enabled) : [];
  const hasWellbeing        = enabledBlocks.some(b => b.type === 'wellbeing');
  const hasOstrc            = enabledBlocks.some(b => b.type === 'ostrc');
  const enabledCustomBlocks = enabledBlocks.filter(
    (b): b is typeof b & { config: NonNullable<typeof b.config> } => b.type === 'custom_metric' && !!b.config
  );
  const customBlockParamIds = enabledCustomBlocks.map(b => b.config.parameterId).join(',');

  const { checkins, loading: checkinsLoading } = useAthleteCheckins(connection?.id ?? null, 90);
  const todayCheckin   = checkins.find(c => c.date === today) ?? null;
  const latestCheckin  = checkins[0] ?? null;
  const todayComposite = todayCheckin ? wellnessComposite(todayCheckin) : null;

  // Expanded / chart state
  const [wellnessExpanded, setWellnessExpanded] = useState(false);
  const [wellnessDays, setWellnessDays] = useState(28);
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);
  const [metricDays, setMetricDays] = useState(28);

  const [customMetricValues, setCustomMetricValues] = useState<Map<string, { value: string; recordedAt: string }>>(new Map());
  const [customMetricHistory, setCustomMetricHistory] = useState<Map<string, Array<{ date: string; value: number }>>>(new Map());

  useEffect(() => {
    if (!connection?.id || enabledCustomBlocks.length === 0) {
      setCustomMetricValues(new Map());
      setCustomMetricHistory(new Map());
      return;
    }
    let cancelled = false;
    Promise.all(
      enabledCustomBlocks.map(async (block) => {
        const { data } = await supabase
          .from('athlete_test_results')
          .select('value, recorded_at')
          .eq('athlete_connection_id', connection.id)
          .eq('parameter_id', block.config.parameterId)
          .order('recorded_at', { ascending: true });
        const rows = (data ?? []).map((r: { value: string; recorded_at: string }) => ({
          date: (r.recorded_at as string).slice(0, 10),
          value: parseFloat(String(r.value)),
        }));
        return { parameterId: block.config.parameterId, rows };
      })
    ).then(results => {
      if (cancelled) return;
      const valMap = new Map<string, { value: string; recordedAt: string }>();
      const histMap = new Map<string, Array<{ date: string; value: number }>>();
      results.forEach(({ parameterId, rows }) => {
        histMap.set(parameterId, rows);
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          valMap.set(parameterId, { value: String(last.value), recordedAt: last.date });
        }
      });
      setCustomMetricValues(valMap);
      setCustomMetricHistory(histMap);
    });
    return () => { cancelled = true; };
  }, [connection?.id, customBlockParamIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutation helpers ──────────────────────────────────────────────────────────

  const upsertDayRow = useCallback(async (
    dateStr: string,
    patch: Partial<{ intensity: string | null; sessions: SessionSummary[] }>,
  ) => {
    if (!connection) return;

    // Always attempt UPDATE first using the stable composite key.
    // Returning 'id' lets us detect whether any row was matched.
    // This correctly handles rows that exist in Supabase but are absent
    // from local state (e.g. event-only rows written by syncAthleteSchedule).
    const { data: updatedRows, error: updError } = await supabase
      .from('athlete_schedule')
      .update(patch)
      .eq('athlete_connection_id', connection.id)
      .eq('date', dateStr)
      .select('id');

    if (updError) throw updError;

    if (((updatedRows as Array<{ id: string }> | null) ?? []).length > 0) {
      // Row existed and was updated — sync local state
      setSchedule(prev => {
        const exists = prev.some(e => e.date === dateStr);
        if (exists) {
          return prev.map(e => e.date === dateStr ? { ...e, ...patch } : e);
        }
        // Row was in Supabase but not in local state (e.g. created by syncAthleteSchedule)
        const rowId = (updatedRows as Array<{ id: string }>)[0]?.id ?? dateStr;
        return [...prev, {
          id: rowId,
          date: dateStr,
          intensity: patch.intensity ?? null,
          sessions: patch.sessions ?? [],
          events: [],
          programName: null,
          mesocycleName: null,
          microcycleName: null,
        }].sort((a, b) => a.date.localeCompare(b.date));
      });
    } else {
      // No row found in Supabase — INSERT a new row.
      // Do NOT use .select().single() here: if RLS blocks the coach from SELECTing
      // back the row it just inserted, Supabase throws PGRST116 even though the
      // INSERT succeeded. We know what we inserted so we update local state directly.
      const { error: insError } = await supabase
        .from('athlete_schedule')
        .insert({
          athlete_connection_id: connection.id,
          date: dateStr,
          sessions: patch.sessions ?? [],
          events: [],
          intensity: patch.intensity ?? null,
        });

      if (insError) {
        // Unique constraint: another process (e.g. syncAthleteSchedule) created
        // the row concurrently between our UPDATE (0 rows) and this INSERT.
        // Retry with a plain UPDATE — no .select() to avoid RLS SELECT issues.
        if ((insError as { code?: string }).code === '23505') {
          const { error: retryErr } = await supabase
            .from('athlete_schedule')
            .update(patch)
            .eq('athlete_connection_id', connection.id)
            .eq('date', dateStr);
          if (retryErr) throw retryErr;
        } else {
          throw insError;
        }
      }

      // Update local state from patch data (we don't need the DB row back)
      setSchedule(prev => {
        if (prev.some(e => e.date === dateStr)) {
          // Entry already exists (e.g. from an optimistic update) — just apply the patch
          return prev.map(e => e.date === dateStr ? { ...e, ...patch } : e);
        }
        return [...prev, {
          id: dateStr,   // temporary id; real UUID is only needed if we query this row
          date: dateStr,
          intensity: patch.intensity ?? null,
          sessions: patch.sessions ?? [],
          events: [],
          programName: null,
          mesocycleName: null,
          microcycleName: null,
        }].sort((a, b) => a.date.localeCompare(b.date));
      });
    }
  }, [connection, setSchedule]);

  const handleSetDayIntensity = useCallback(async (intensity: string | null) => {
    if (!dayActionTarget) return;
    setMutating(true);
    try {
      await upsertDayRow(dayActionTarget, { intensity });
      setDayIntensityPickerOpen(false);
      setDayActionTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Could not update intensity.', variant: 'destructive' });
    } finally {
      setMutating(false);
    }
  }, [dayActionTarget, upsertDayRow, toast]);

  const handleCreateSession = useCallback(async () => {
    if (!dayActionTarget) return;
    const name = newSessionName.trim() || 'Session';
    const existing = schedule.find(e => e.date === dayActionTarget);
    const order = existing?.sessions.length ?? 0;
    const newSession: SessionSummary = {
      id: `mobile_session_${Date.now()}`,
      name,
      order,
      methodCount: 0,
      exerciseCount: 0,
      exercises: [],
    };
    const sessions = [...(existing?.sessions ?? []), newSession];
    setMutating(true);
    try {
      await upsertDayRow(dayActionTarget, { sessions });
      setNewSessionDialogOpen(false);
      setNewSessionName('');
      setDayActionTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Could not create session.', variant: 'destructive' });
    } finally {
      setMutating(false);
    }
  }, [dayActionTarget, newSessionName, schedule, upsertDayRow, toast]);

  const handleAddFromLibrary = useCallback(async (libEntry: SessionLibraryEntry) => {
    if (!dayActionTarget) return;
    const existing = schedule.find(e => e.date === dayActionTarget);
    const order = existing?.sessions.length ?? 0;
    const newSession = sessionLibraryToSummary(libEntry, order);
    const sessions = [...(existing?.sessions ?? []), newSession];
    setMutating(true);
    try {
      await upsertDayRow(dayActionTarget, { sessions });
      setSessionLibraryPickerOpen(false);
      setDayActionTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Could not add session from library.', variant: 'destructive' });
    } finally {
      setMutating(false);
    }
  }, [dayActionTarget, schedule, upsertDayRow, toast]);

  const handleDeleteSession = useCallback(async (dateStr: string, sessionIdx: number) => {
    const dayEntry = schedule.find(e => e.date === dateStr);
    if (!dayEntry) return;
    const newSessions = dayEntry.sessions
      .filter((_, i) => i !== sessionIdx)
      .map((s, i) => ({ ...s, order: i }));
    setMutating(true);
    try {
      await upsertDayRow(dateStr, { sessions: newSessions });
    } catch {
      toast({ title: 'Error', description: 'Could not delete session.', variant: 'destructive' });
    } finally {
      setMutating(false);
    }
  }, [schedule, upsertDayRow, toast]);

  const handleClearDay = useCallback(async (dateStr: string) => {
    if (!connection) return;
    setSchedule(prev => prev.filter(e => e.date !== dateStr));
    setMutating(true);
    try {
      await supabase
        .from('athlete_schedule')
        .delete()
        .eq('athlete_connection_id', connection.id)
        .eq('date', dateStr);
    } catch {
      toast({ title: 'Error', description: 'Could not clear day.', variant: 'destructive' });
    } finally {
      setMutating(false);
    }
  }, [connection, toast]);

  const handleClearWeek = useCallback(async () => {
    if (!connection) return;
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));
    setSchedule(prev => prev.filter(e => !days.includes(e.date)));
    setMutating(true);
    try {
      await supabase
        .from('athlete_schedule')
        .delete()
        .eq('athlete_connection_id', connection.id)
        .in('date', days);
    } catch {
      toast({ title: 'Error', description: 'Could not clear week.', variant: 'destructive' });
    } finally {
      setMutating(false);
    }
  }, [connection, weekMonday, toast]);

  const onSessionDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceDate = source.droppableId;
    const destDate   = destination.droppableId;
    const schedMap   = new Map(schedule.map(e => [e.date, e]));
    const srcEntry   = schedMap.get(sourceDate);
    if (!srcEntry) return;
    const movedSession = srcEntry.sessions[source.index];
    if (!movedSession) return;

    if (sourceDate === destDate) {
      // Within-day reorder
      const sessions = [...srcEntry.sessions];
      const [mv] = sessions.splice(source.index, 1);
      sessions.splice(destination.index, 0, mv);
      const reordered = sessions.map((s, i) => ({ ...s, order: i }));

      // Optimistic update — show result immediately
      setSchedule(prev => prev.map(e => e.date === sourceDate ? { ...e, sessions: reordered } : e));
      setMutating(true);
      try {
        await upsertDayRow(sourceDate, { sessions: reordered });
      } catch {
        // Rollback
        setSchedule(prev => prev.map(e => e.date === sourceDate ? { ...e, sessions: srcEntry.sessions } : e));
        toast({ title: 'Error', description: 'Could not reorder session.', variant: 'destructive' });
      } finally {
        setMutating(false);
      }
      return;
    }

    // Cross-day move — remove from source, insert into destination
    const srcSessions = [...srcEntry.sessions];
    srcSessions.splice(source.index, 1);
    const newSrc = srcSessions.map((s, i) => ({ ...s, order: i }));

    const dstEntry = schedMap.get(destDate);
    const dstSessions = [...(dstEntry?.sessions ?? [])];
    // Track the original plan date so syncAthleteSchedule can reverse the
    // plan's session placement and honour this mobile rearrangement.
    const originalDate = movedSession.originalDate ?? sourceDate;
    const isBackToOriginal = destDate === originalDate;
    const taggedSession: typeof movedSession = {
      ...movedSession,
      mobileRearranged: isBackToOriginal ? undefined : true,
      originalDate: isBackToOriginal ? undefined : originalDate,
    };
    dstSessions.splice(destination.index, 0, taggedSession);
    const newDst = dstSessions.map((s, i) => ({ ...s, order: i }));

    // Optimistic update — move session in UI immediately, before any Supabase call.
    // This prevents the session from disappearing if one of the two writes partially
    // completes before the other fails.
    setSchedule(prev => {
      const dstInPrev = prev.some(e => e.date === destDate);
      const next = prev.map(e => {
        if (e.date === sourceDate) return { ...e, sessions: newSrc };
        if (e.date === destDate)   return { ...e, sessions: newDst };
        return e;
      });
      // If destDate had no local entry yet, add one
      if (!dstInPrev) {
        next.push({
          id: destDate,
          date: destDate,
          intensity: null,
          sessions: newDst,
          events: [],
          programName: null,
          mesocycleName: null,
          microcycleName: null,
        });
        next.sort((a, b) => a.date.localeCompare(b.date));
      }
      return next;
    });

    setMutating(true);
    try {
      await Promise.all([
        upsertDayRow(sourceDate, { sessions: newSrc }),
        upsertDayRow(destDate,   { sessions: newDst }),
      ]);
    } catch (err) {
      console.error('[drag] upsert failed → rolling back:', err);
      // Rollback to original state
      setSchedule(prev => prev.map(e => {
        if (e.date === sourceDate) return { ...e, sessions: srcEntry.sessions };
        if (e.date === destDate)   return { ...e, sessions: dstEntry?.sessions ?? [] };
        return e;
      }));
      toast({ title: 'Error', description: 'Could not move session.', variant: 'destructive' });
    } finally {
      setMutating(false);
    }
  }, [schedule, setSchedule, upsertDayRow, toast]);

  if (!athlete) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
        {t('coachMobile.athleteProfile.notFound')}
      </div>
    );
  }

  const fullName = `${athlete.firstName} ${athlete.lastName}`;
  const bg = avatarColor(fullName);
  const ini = `${athlete.firstName?.[0] ?? ''}${athlete.lastName?.[0] ?? ''}`.toUpperCase();
  const sports = athlete.sports?.length ? athlete.sports : athlete.sport ? [athlete.sport] : [];
  const isConnected = !!connection?.connectedAt;
  const isPending   = connection && !connection.connectedAt;

  // ── Week navigation ──────────────────────────────────────────────────────────
  const prevMonday = addDays(weekMonday, -7);
  const nextMonday = addDays(weekMonday, 7);
  const weekDays   = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));
  const scheduleMap = new Map(schedule.map(e => [e.date, e]));
  const isCurrentWeek = weekMonday === getMondayOf(today);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Compact header: back · avatar + name + badge · chat */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b">
        <button
          onClick={() => navigate('/coach-mobile/athletes')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent shrink-0 -ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>
          <span className="text-sm font-bold text-white">{ini}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{fullName}</p>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5',
              isConnected ? 'bg-emerald-100 text-emerald-700'
              : isPending  ? 'bg-amber-100 text-amber-700'
              : 'bg-muted text-muted-foreground'
            )}
          >
            {isConnected ? <><CheckCircle2 className="h-2.5 w-2.5" /> {t('coachMobile.athleteProfile.connection.connected')}</>
            : isPending   ? <><Clock className="h-2.5 w-2.5" /> {t('coachMobile.athleteProfile.connection.invitePending')}</>
            : t('coachMobile.athleteProfile.connection.noApp')}
          </span>
        </div>

        {connection?.athleteAuthUserId && (
          <button
            onClick={() => navigate(`/coach-mobile/athletes/${athleteId}/chat`)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b px-2 shrink-0">
        {([
          { key: 'overview',  label: t('coachMobile.athleteProfile.tabs.overview')  },
          { key: 'training',  label: t('coachMobile.athleteProfile.tabs.training')  },
          { key: 'progress',  label: t('coachMobile.athleteProfile.tabs.progress')  },
          { key: 'settings',  label: t('coachMobile.athleteProfile.tabs.info')      },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 py-2 text-xs font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <ScrollArea className="flex-1">
          <div className="px-4 py-4 space-y-4 pb-6">

            {/* Athlete app — only show when invite pending (connected shown in top badge) */}
            {connection && !isConnected && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('coachMobile.athleteProfile.athleteApp')}
                </h3>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('coachMobile.athleteProfile.inviteCode')}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-base font-mono font-bold tracking-widest">
                      {connection.inviteCode}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(connection.inviteCode)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Monitoring cards ── */}
            {connection && monitoringEnabled && (
              <div className="space-y-3">
                {/* Section header */}
                <div className="flex items-center justify-between px-0.5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {t('coachMobile.athleteProfile.monitoring')}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Wellness card — tap to expand */}
                {hasWellbeing && (
                  <div
                    className="rounded-xl border bg-card p-4 space-y-3 cursor-pointer active:opacity-80"
                    onClick={() => setWellnessExpanded(v => !v)}
                  >
                    {/* Header row — always visible */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{t('coachMobile.athleteProfile.wellness')}</span>
                      {checkinsLoading ? (
                        <span className="text-xs text-muted-foreground">{t('common.loading')}</span>
                      ) : todayComposite !== null ? (
                        <span className={cn('text-sm font-bold', WELLNESS_TEXT_COLORS[Math.round(todayComposite)])}>
                          {todayComposite.toFixed(1)} / 5
                        </span>
                      ) : !todayCheckin ? (
                        <span className="text-xs text-muted-foreground">{t('coachMobile.athleteProfile.noCheckinToday')}</span>
                      ) : null}
                    </div>

                    {/* Progress bar — always visible when data exists */}
                    {!checkinsLoading && todayComposite !== null && (
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all',
                            todayComposite >= 4 ? 'bg-green-500' : todayComposite >= 3 ? 'bg-amber-400' : 'bg-red-500'
                          )}
                          style={{ width: `${((todayComposite - 1) / 4) * 100}%` }}
                        />
                      </div>
                    )}

                    {/* Expanded: dimension rows + chart */}
                    {wellnessExpanded && !checkinsLoading && todayCheckin && (
                      <div className="space-y-3 pt-1 border-t" onClick={e => e.stopPropagation()}>
                        {WELLNESS_KEYS.map(key => {
                          const value = todayCheckin[WELLNESS_FIELD[key]] as number | null;
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-16 shrink-0">{WELLNESS_LABELS[key]}</span>
                              <ScoreDots value={value} />
                              <span className={cn('text-xs font-semibold ml-auto', value ? WELLNESS_TEXT_COLORS[value] : 'text-muted-foreground')}>
                                {value ?? '—'}
                              </span>
                            </div>
                          );
                        })}
                        {todayCheckin.notes && (
                          <p className="text-xs text-muted-foreground italic border-t pt-2">"{todayCheckin.notes}"</p>
                        )}
                        <div className="border-t pt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">{t('coachMobile.athleteProfile.trend')}</span>
                            <DaysSelector selected={wellnessDays} onChange={setWellnessDays} />
                          </div>
                          <WellnessMiniChart checkins={checkins} days={wellnessDays} />
                        </div>
                      </div>
                    )}

                    {!checkinsLoading && !todayCheckin && latestCheckin && (
                      <p className="text-xs text-muted-foreground/60">{t('coachMobile.athleteProfile.lastCheckin', { date: fmtMonitoringDate(latestCheckin.date, today) })}</p>
                    )}
                  </div>
                )}

                {/* Pain & Body Map card — always shown when OSTRC enabled */}
                {hasOstrc && (
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{t('coachMobile.athleteProfile.painInjury')}</span>
                      {todayCheckin?.hasPain ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          {t('coachMobile.athleteProfile.painAreas', { count: todayCheckin.painAreas.length })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('coachMobile.athleteProfile.noPain')}
                        </span>
                      )}
                    </div>
                    <MobileBodyMap painAreas={todayCheckin?.painAreas ?? []} />
                  </div>
                )}

                {/* Illness card */}
                {hasOstrc && (
                  <div className="rounded-xl border bg-card p-3">
                    {todayCheckin?.hasIllness ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="text-sm font-semibold text-red-700">
                            {t('coachMobile.athleteProfile.illness')}{todayCheckin.illnessNrs !== null ? ` · ${todayCheckin.illnessNrs}/10` : ''}
                          </span>
                        </div>
                        {(todayCheckin.illnessSymptoms.length > 0 || todayCheckin.illnessSymptomOther) && (
                          <p className="text-xs text-muted-foreground pl-6">
                            {[
                              ...todayCheckin.illnessSymptoms.map(id => ILLNESS_SYMPTOM_LABELS[id] ?? id),
                              todayCheckin.illnessSymptomOther,
                            ].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-sm text-muted-foreground">{t('coachMobile.athleteProfile.noIllness')}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom metric cards — tap to expand chart */}
                {enabledCustomBlocks.map(block => {
                  const pid = block.config.parameterId;
                  const metric = customMetricValues.get(pid);
                  const history = customMetricHistory.get(pid) ?? [];
                  const isExpanded = expandedMetricId === pid;
                  const isToday = metric?.recordedAt === today;
                  const isScale = block.config.scaleMin !== undefined && block.config.scaleMax !== undefined;
                  const displayValue = metric
                    ? (isScale ? `${metric.value}/${block.config.scaleMax}` : metric.value)
                    : '—';

                  return (
                    <div
                      key={block.id}
                      className="rounded-xl border bg-card p-4 space-y-3 cursor-pointer active:opacity-80"
                      onClick={() => setExpandedMetricId(isExpanded ? null : pid)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">
                            {block.config.label || block.config.parameterName}
                          </p>
                          {isScale && (
                            <p className="text-[10px] text-muted-foreground/60">
                              {t('coachMobile.athleteProfile.scale')} · {block.config.scaleMin}–{block.config.scaleMax}
                            </p>
                          )}
                          {!isScale && block.config.parameterUnit && (
                            <p className="text-[10px] text-muted-foreground/60">{block.config.parameterUnit}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-2xl font-bold leading-none', metric ? '' : 'text-muted-foreground')}>
                            {displayValue}
                          </p>
                          {metric && !isToday && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {fmtMonitoringDate(metric.recordedAt, today)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Expanded: chart with range picker */}
                      {isExpanded && (
                        <div className="border-t pt-3 space-y-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">{t('coachMobile.athleteProfile.history')}</span>
                            <DaysSelector selected={metricDays} onChange={setMetricDays} />
                          </div>
                          <CustomMetricMiniChart
                            history={history}
                            days={metricDays}
                            unit={!isScale ? (block.config.parameterUnit ?? undefined) : undefined}
                            scaleMax={isScale ? block.config.scaleMax : undefined}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notes card */}
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('coachMobile.athleteProfile.notes')}
                </h3>
                <button
                  onClick={() => { setNotesInput(''); setEditingNotes(true); }}
                  className="text-muted-foreground hover:text-foreground active:opacity-60 transition-colors"
                  aria-label="Add note"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {allNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{t('coachMobile.athleteProfile.noNotes')}</p>
              ) : (
                <>
                  <NoteEntry note={allNotes[0]} />

                  {allNotes.length > 1 && (
                    <button
                      onClick={() => setNotesExpanded(v => !v)}
                      className="flex items-center gap-1 text-xs text-primary active:opacity-60 transition-opacity"
                    >
                      {notesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {notesExpanded ? t('coachMobile.athleteProfile.hidePastNotes') : t('coachMobile.athleteProfile.showMore', { count: allNotes.length - 1 })}
                    </button>
                  )}

                  {notesExpanded && (
                    <div className="space-y-2 pt-1 border-t">
                      {allNotes.slice(1).map(note => <NoteEntry key={note.id} note={note} />)}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Add note dialog */}
            <Dialog open={editingNotes} onOpenChange={o => { if (!o) setEditingNotes(false); }}>
              <DialogContent className="w-[calc(100vw-32px)] max-w-[380px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle>{t('coachMobile.athleteProfile.addNoteFor', { name: fullName })}</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                  <Textarea
                    value={notesInput}
                    onChange={e => setNotesInput(e.target.value)}
                    placeholder={t('coachMobile.athleteProfile.notePlaceholder')}
                    className="min-h-[140px] resize-none"
                    autoFocus
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setEditingNotes(false)}>{t('common.cancel')}</Button>
                  <Button onClick={handleAddNote} disabled={!notesInput.trim()}>{t('coachMobile.athleteProfile.saveNote')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </ScrollArea>
      )}

      {/* ── Training tab ── */}
      {tab === 'training' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Week navigation header — matches athlete Plan page style */}
          <div className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
            <button
              onClick={() => setWeekMonday(prevMonday)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 shrink-0"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="flex-1 text-center text-sm font-semibold tabular-nums">
              {formatWeekRange(weekMonday)}
            </p>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekMonday(getMondayOf(today))}
                className="text-xs px-2.5 py-1 rounded-full bg-primary text-primary-foreground font-medium shrink-0 active:opacity-70 transition-opacity"
              >
                {t('coachMobile.athleteProfile.today')}
              </button>
            )}
            <button
              onClick={() => setClearWeekConfirmOpen(true)}
              disabled={mutating}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-destructive/10 active:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0 transition-colors"
              aria-label="Clear week"
              title="Clear entire week"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekMonday(nextMonday)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 shrink-0"
              aria-label="Next week"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </button>
          </div>

          {schedLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : (
            <DragDropContext onDragEnd={onSessionDragEnd}>
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-3 pb-6">
                  {weekDays.map((dateStr, dayIdx) => {
                    const entry    = scheduleMap.get(dateStr) ?? null;
                    const isToday  = dateStr === today;
                    const isPast   = dateStr < today;
                    const { weekday, dateLabel } = formatDayHeader(dateStr);
                    const hasSessions = (entry?.sessions.length ?? 0) > 0;

                    return (
                      <div key={dateStr}>
                      {dayIdx > 0 && <div className="my-3 border-t border-border" />}
                      <div
                        className={cn(
                          'rounded-xl p-3 space-y-2',
                          isToday && 'bg-primary/5 ring-1 ring-primary/20',
                        )}
                      >
                        {/* Day header */}
                        {/* Day header */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'text-sm font-semibold',
                            isToday ? 'text-primary' : isPast ? 'text-muted-foreground' : 'text-foreground'
                          )}>
                            {weekday}
                          </span>
                          <span className="text-xs text-muted-foreground">{dateLabel}</span>
                          {isToday && (
                            <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                              {t('coachMobile.athleteProfile.today')}
                            </span>
                          )}
                        </div>

                        {/* Daily intensity — tap to edit */}
                        <button
                          onClick={() => {
                            setDayActionTarget(dateStr);
                            setDayIntensityPickerOpen(true);
                          }}
                          className="flex items-center gap-1.5 active:opacity-60 transition-opacity"
                        >
                          {entry?.intensity
                            ? <IntensityBadge intensity={entry.intensity} />
                            : <span className="opacity-40"><IntensityBadge intensity="0" /></span>}
                        </button>

                        {/* Tests & Events */}
                        {(entry?.events ?? []).length > 0 && (
                          <div className="space-y-1.5">
                            {entry!.events.map(ev => {
                              const resultValue = ev.parameterId ? existingTestResults.get(`${ev.parameterId}:${dateStr}`) : undefined;
                              const hasResult = resultValue !== undefined;
                              return (
                                <button
                                  key={ev.id}
                                  onClick={() => setEventDialogDate(dateStr)}
                                  className={cn(
                                    'w-full text-left rounded-lg border p-2.5 active:opacity-70 transition-opacity',
                                    ev.type === 'test' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200',
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    {ev.type === 'test'
                                      ? <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                      : <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />}
                                    <div className="flex-1 min-w-0">
                                      <p className={cn('text-xs font-medium truncate', ev.type === 'test' ? 'text-amber-800' : 'text-blue-800')}>
                                        {ev.title}
                                      </p>
                                      {ev.type === 'test' && ev.targetValue && (
                                        <p className="text-xs text-amber-700 mt-0.5">{t('coachMobile.athleteProfile.goal', { value: ev.targetValue })}</p>
                                      )}
                                    </div>
                                  </div>
                                  {ev.type === 'test' && ev.parameterId && (
                                    hasResult ? (
                                      <div className="mt-1.5 flex items-center gap-1 text-xs text-green-700 font-medium">
                                        <Check className="h-3 w-3 shrink-0" />
                                        {resultValue}
                                      </div>
                                    ) : (
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          setTestResultTarget({ event: ev, date: dateStr });
                                          setTestResultValue('');
                                          setTestResultNote('');
                                        }}
                                        className="mt-1.5 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-md py-1.5 transition-colors"
                                      >
                                        <ClipboardCheck className="h-3.5 w-3.5" />
                                        {t('coachMobile.athleteProfile.enterResult')}
                                      </button>
                                    )
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Sessions droppable — always mounted so cross-day drops work */}
                        <Droppable droppableId={dateStr} type="SESSION">
                          {(sessDrop, sessDropSnap) => (
                            <div
                              ref={sessDrop.innerRef}
                              {...sessDrop.droppableProps}
                              className={cn(
                                'space-y-1.5 rounded-lg transition-colors',
                                sessDropSnap.isDraggingOver && 'bg-primary/5 min-h-12',
                              )}
                            >
                              {hasSessions ? entry!.sessions.map((s, sIdx) => (
                                <Draggable key={s.id} draggableId={s.id} index={sIdx}>
                                  {(sessDrag, sessSnap) => (
                                    <div
                                      ref={sessDrag.innerRef}
                                      {...sessDrag.draggableProps}
                                      className={cn(sessSnap.isDragging && 'shadow-lg opacity-95')}
                                    >
                                      <Card className={cn('overflow-hidden', isPast && 'opacity-60', sessionLogs.has(`${dateStr}|${s.id}`) && 'bg-green-50 border-green-200')}>
                                        <CardContent className="flex items-center gap-1.5 p-2.5">
                                          {/* Drag handle */}
                                          <div
                                            {...sessDrag.dragHandleProps}
                                            className="flex items-center justify-center w-7 h-7 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </div>

                                          {/* Tap to open session */}
                                          <button
                                            className="flex items-center gap-2 flex-1 min-w-0 text-left active:opacity-70"
                                            onClick={() => navigate(`/coach-mobile/athletes/${athleteId}/session`, {
                                              state: {
                                                entry, sessionIdx: sIdx, connectionId: connection?.id,
                                                returnPath: `/coach-mobile/athletes/${athleteId}`,
                                                returnState: { tab },
                                              },
                                            })}
                                          >
                                            {(() => {
                                              const log = sessionLogs.get(`${dateStr}|${s.id}`);
                                              return log ? (
                                                <div className="w-7 h-7 rounded-md bg-green-100 flex items-center justify-center shrink-0">
                                                  <Check className="h-3 w-3 text-green-600" />
                                                </div>
                                              ) : (
                                                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                                  <Dumbbell className="h-3 w-3 text-primary" />
                                                </div>
                                              );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium truncate">{s.name || 'Session'}</p>
                                              {(() => {
                                                const log = sessionLogs.get(`${dateStr}|${s.id}`);
                                                if (log) {
                                                  const mins = log.durationSeconds !== null ? Math.round(log.durationSeconds / 60) : null;
                                                  const rpe = log.borgRating;
                                                  const srpe = rpe !== null && mins !== null ? rpe * mins : null;
                                                  return (
                                                    <p className="text-xs text-green-700 mt-0.5">
                                                      {t('coachMobile.athleteProfile.completed')}
                                                      {mins !== null && ` · ${mins} min`}
                                                      {rpe !== null && ` · RPE ${rpe}`}
                                                      {srpe !== null && ` · sRPE: ${srpe} AU`}
                                                    </p>
                                                  );
                                                }
                                                return (
                                                  <p className="text-xs text-muted-foreground">
                                                    {t('coachMobile.athleteProfile.exercises', { count: s.exerciseCount })}
                                                  </p>
                                                );
                                              })()}
                                              {s.intensity && !sessionLogs.has(`${dateStr}|${s.id}`) && (
                                                <div className="mt-1">
                                                  <IntensityBadge intensity={s.intensity} />
                                                </div>
                                              )}
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                          </button>

                                          {/* Delete session */}
                                          <button
                                            onClick={() => handleDeleteSession(dateStr, sIdx)}
                                            disabled={mutating}
                                            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:opacity-60 transition-colors shrink-0"
                                            aria-label="Delete session"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  )}
                                </Draggable>
                              )) : (
                                /* Rest-day label — hide when dragging over so the drop zone shows cleanly */
                                !sessDropSnap.isDraggingOver && (
                                  <div className={cn(
                                    'flex items-center gap-1.5 text-xs py-0.5',
                                    isPast ? 'text-muted-foreground/30' : 'text-slate-400'
                                  )}>
                                    <BedDouble className="h-3.5 w-3.5 shrink-0" />
                                    <span>{t('coachMobile.athleteProfile.restDay')}</span>
                                  </div>
                                )
                              )}
                              {sessDrop.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {/* Per-day action menu trigger */}
                        <div className="flex pt-0.5">
                          <button
                            onClick={() => { setDayActionTarget(dateStr); setDayActionsMenuDate(dateStr); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border bg-background hover:bg-muted active:opacity-60 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                            {t('coachMobile.athleteProfile.add')}
                          </button>
                        </div>
                      </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </DragDropContext>
          )}

        </div>
      )}

      {/* ── Progress tab ── */}
      {tab === 'progress' && (
        <ScrollArea className="flex-1">
          <div className="px-4 py-4 pb-6">
            <CoachAthleteProgressTab athleteId={athleteId!} connectionId={connection?.id ?? null} />
          </div>
        </ScrollArea>
      )}

      {/* ── Settings tab ── */}
      {tab === 'settings' && connection && (
        <ScrollArea className="flex-1">
          <div className="px-4 py-4 pb-6">
            <CoachAthleteSettingsTab athleteId={athleteId!} connection={connection} />
          </div>
        </ScrollArea>
      )}

      {/* ── Day intensity picker ── */}
      <Sheet open={dayIntensityPickerOpen} onOpenChange={o => { if (!o) { setDayIntensityPickerOpen(false); setDayActionTarget(null); } }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          style={{ maxHeight: '75vh', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        >
          <SheetHeader className="mb-4 px-4 pt-4 shrink-0">
            <SheetTitle>{t('coachMobile.athleteProfile.dayIntensity')}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 px-4">
            <div className="grid grid-cols-1 gap-2 pb-4">
              {intensityLevels.map(([key, cfg]) => {
                const currentIntensity = dayActionTarget ? (scheduleMap.get(dayActionTarget)?.intensity ?? null) : null;
                return (
                  <button
                    key={key}
                    disabled={mutating}
                    onClick={() => handleSetDayIntensity(key)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left active:opacity-70 transition-colors',
                      currentIntensity === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    )}
                  >
                    {currentIntensity === key
                      ? <Check className="h-4 w-4 text-primary shrink-0" />
                      : <div className="w-4 shrink-0" />}
                    <span className={cn('text-sm font-medium px-2.5 py-1 rounded-full', cfg.color)}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
              <button
                disabled={mutating}
                onClick={() => handleSetDayIntensity(null)}
                className="text-xs text-muted-foreground py-3 text-center active:opacity-70"
              >
                {t('coachMobile.athleteProfile.clearIntensity')}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Day actions menu ── */}
      <Sheet open={dayActionsMenuDate !== null} onOpenChange={o => { if (!o) setDayActionsMenuDate(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        >
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="text-base">
              {dayActionsMenuDate ? format(parseISO(dayActionsMenuDate), 'EEEE, MMM d') : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col px-2 pb-2">
            <button
              onClick={() => {
                setDayActionsMenuDate(null);
                if (sessionLibraryEntries.length > 0) {
                  setSessionSourcePickerOpen(true);
                } else {
                  setNewSessionDialogOpen(true);
                }
              }}
              className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium hover:bg-muted active:bg-muted/80 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              {t('coachMobile.athleteProfile.addSession')}
            </button>
            <button
              onClick={() => {
                const date = dayActionsMenuDate;
                setDayActionsMenuDate(null);
                navigate(`/coach-mobile/athletes/${athleteId}/assign-program?startDate=${date ?? ''}`);
              }}
              className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium hover:bg-muted active:bg-muted/80 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              {t('coachMobile.athleteProfile.assignProgram')}
            </button>
            <button
              onClick={() => {
                const date = dayActionsMenuDate;
                setDayActionsMenuDate(null);
                setEventDialogDate(date);
              }}
              className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium hover:bg-muted active:bg-muted/80 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              {t('coachMobile.athleteProfile.addTestEvent')}
            </button>
            {dayActionsMenuDate && (scheduleMap.get(dayActionsMenuDate)?.sessions?.length ?? 0) > 0 && (
              <button
                disabled={mutating}
                onClick={() => {
                  const date = dayActionsMenuDate;
                  setDayActionsMenuDate(null);
                  handleClearDay(date!);
                }}
                className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium hover:bg-destructive/10 active:bg-destructive/20 transition-colors text-left text-destructive"
              >
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </div>
                {t('coachMobile.athleteProfile.clearDay')}
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Session source picker ── */}
      <Sheet open={sessionSourcePickerOpen} onOpenChange={o => { if (!o) { setSessionSourcePickerOpen(false); setDayActionTarget(null); } }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        >
          <SheetHeader className="mb-4 px-4 pt-4 shrink-0">
            <SheetTitle>{t('coachMobile.athleteProfile.addSessionTitle')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2 space-y-3">
            <button
              onClick={() => { setSessionSourcePickerOpen(false); setNewSessionDialogOpen(true); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted active:opacity-70 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t('coachMobile.athleteProfile.createFromScratch')}</p>
                <p className="text-xs text-muted-foreground">{t('coachMobile.athleteProfile.createFromScratchDesc')}</p>
              </div>
            </button>
            <button
              onClick={() => { setSessionSourcePickerOpen(false); setSessionLibraryPickerOpen(true); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted active:opacity-70 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t('coachMobile.athleteProfile.chooseFromLibrary')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('coachMobile.athleteProfile.sessionsAvailable', { count: sessionLibraryEntries.length })}
                </p>
              </div>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── New session dialog ── */}
      <Dialog open={newSessionDialogOpen} onOpenChange={o => { if (!o) { setNewSessionDialogOpen(false); setNewSessionName(''); setDayActionTarget(null); } }}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[380px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('coachMobile.athleteProfile.newSessionTitle')}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newSessionName}
              onChange={e => setNewSessionName(e.target.value)}
              placeholder={t('coachMobile.athleteProfile.sessionNamePlaceholder')}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateSession(); }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setNewSessionDialogOpen(false); setNewSessionName(''); setDayActionTarget(null); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateSession} disabled={mutating}>
              {mutating ? t('coachMobile.athleteProfile.creating') : t('coachMobile.athleteProfile.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clear week confirmation ── */}
      <AlertDialog open={clearWeekConfirmOpen} onOpenChange={setClearWeekConfirmOpen}>
        <AlertDialogContent className="w-[calc(100vw-32px)] max-w-[380px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('coachMobile.athleteProfile.clearWeekTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('coachMobile.athleteProfile.clearWeekDesc', { range: formatWeekRange(weekMonday) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleClearWeek(); setClearWeekConfirmOpen(false); }}
            >
              {t('coachMobile.athleteProfile.clearWeekConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Tests & Events dialog ── */}
      {athleteId && (
        <CalendarEventDialog
          open={eventDialogDate !== null}
          onOpenChange={open => { if (!open) setEventDialogDate(null); }}
          date={eventDialogDate ?? today}
          events={eventDialogDate ? getEventsForAthlete(athleteId).filter(e => e.date === eventDialogDate) : []}
          onAdd={(type, title, notes, parameterId, targetValue) => {
            if (eventDialogDate) {
              handleAddEvent(eventDialogDate, { date: eventDialogDate, type, title, notes, parameterId, targetValue });
            }
          }}
          onDelete={handleDeleteEvent}
          athletePerformanceParameters={athletePerformanceParameters.filter(p => p.athleteId === athleteId)}
          athleteBiometrics={getAthleteBiometrics(athleteId)}
        />
      )}

      {/* ── Test result entry sheet ── */}
      <Sheet
        open={testResultTarget !== null}
        onOpenChange={open => {
          if (!open) { setTestResultTarget(null); setTestResultValue(''); setTestResultNote(''); }
        }}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        >
          <SheetHeader className="mb-4 px-4 pt-4 shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-600" />
              {testResultTarget?.event.title ?? t('coachMobile.athleteProfile.enterResult')}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 space-y-3 pb-2">
            {testResultTarget?.event.targetValue && (
              <p className="text-sm text-amber-700">
                {t('coachMobile.athleteProfile.goal', { value: testResultTarget.event.targetValue })}
              </p>
            )}
            {testResultSaved ? (
              <div className="flex items-center justify-center gap-2 py-6 text-green-600 font-medium">
                <Check className="h-5 w-5" />
                {t('coachMobile.athleteProfile.resultSaved')}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('coachMobile.athleteProfile.resultValue')}
                  </label>
                  <Input
                    value={testResultValue}
                    onChange={e => setTestResultValue(e.target.value)}
                    placeholder={t('coachMobile.athleteProfile.resultPlaceholder')}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && testResultValue.trim()) handleSubmitTestResult(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('coachMobile.athleteProfile.noteOptional')}
                  </label>
                  <Textarea
                    value={testResultNote}
                    onChange={e => setTestResultNote(e.target.value)}
                    placeholder={t('coachMobile.athleteProfile.noteContextPlaceholder')}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <Button
                  onClick={handleSubmitTestResult}
                  disabled={!testResultValue.trim() || testResultSaving}
                  className="w-full"
                >
                  {testResultSaving ? t('coachMobile.athleteProfile.saving') : t('coachMobile.athleteProfile.saveResult')}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Session library picker ── */}
      <Sheet open={sessionLibraryPickerOpen} onOpenChange={o => { if (!o) { setSessionLibraryPickerOpen(false); setDayActionTarget(null); } }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          style={{ maxHeight: '80vh', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        >
          <SheetHeader className="mb-3 shrink-0 px-4 pt-4">
            <SheetTitle>{t('coachMobile.athleteProfile.addFromLibraryTitle')}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 px-4">
            <div className="space-y-2 pb-4">
              {sessionLibraryEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('coachMobile.athleteProfile.noLibrarySessions')}
                </p>
              ) : sessionLibraryEntries.map(entry => (
                <button
                  key={entry.id}
                  disabled={mutating}
                  onClick={() => handleAddFromLibrary(entry)}
                  className="w-full flex items-start gap-3 px-3 py-3 rounded-xl border hover:bg-muted/50 active:bg-muted text-left transition-colors"
                >
                  <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('coachMobile.athleteProfile.exercises', { count: entry.exercises.length })}
                      {entry.sections.length > 0 ? ` · ${t('coachMobile.athleteProfile.sections', { count: entry.sections.length })}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
