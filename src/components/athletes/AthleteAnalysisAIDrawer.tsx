import { useState, useCallback, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase';
import { sendMessage } from '@/utils/anthropicApi';
import { format, subMonths } from 'date-fns';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import type { AthletePerformanceParameter } from '@/types/athlete';
import type { ParameterV2 } from '@/types/parametersV2';

// ── System prompt ──────────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM_PROMPT = `You are an expert sports scientist embedded in Plan Prep Coach, a professional training analysis dashboard used by coaches and sports scientists.

## Role
Interpret individual athlete training data, identify patterns across data sources, flag concerns, and suggest evidence-based adjustments for upcoming training blocks.

## Data definitions and scales
- sRPE (session RPE) = Borg CR10 rating (0–10) × session duration in minutes → internal training load in Arbitrary Units (AU)
- Planned sRPE = planned session intensity × actual session duration (same time denominator, enables direct comparison)
- Adherence = sessions completed / sessions planned
- Performance parameters = objective test results (e.g. 1RM, sprint time, jump height, VO2max) — always report with exact value and unit as recorded
- Wellness = 5-item McLean questionnaire (fatigue, sleep, soreness, stress, mood); each item is scored 1–5 (higher = better); composite is the mean of available items, also on a 1–5 scale. A composite of 3/5 is mid-range, not low. Never interpret these values on a 1–10 or 0–10 scale.
- Pain = Numeric Rating Scale (NRS 0–10; 0 = no pain, 10 = worst imaginable); body area and side also recorded
- Illness = OSTRC-H questionnaire; NRS severity (0–10) also recorded
- Training method panels = aggregated exercise volume (e.g. total sets) or intensity per training method over time

## Analysis principles
1. Cross-source connections: actively look for relationships across load, wellness, performance, and pain — but only draw a connection when it is consistent with established sports science mechanisms. A load increase followed 1–3 days later by a wellness dip is physiologically plausible; a single high-load day preceding a performance PB the next day is unlikely causal. When a pattern fits a known mechanism, name it and briefly note the evidence basis. When a pattern is ambiguous or could have multiple explanations, say so. Never force a connection to fill the narrative.
2. Temporal sequencing: performance adaptations to load typically lag 2–4 weeks; acute wellness responses to overload appear within 1–3 days; chronic wellness decline reflects accumulated fatigue over weeks
3. Distinguish intentional from unplanned: load variation may reflect deliberate periodization (deload weeks, intensification blocks) — do not flag planned low-load periods as problems
4. Specificity: cite actual dates, values, and their scale when making observations (e.g. "wellness composite dropped from 4.1/5 to 2.8/5 over three consecutive days"); generic statements add no value
5. Data gaps: explicitly note when data is absent or too sparse to draw conclusions; never speculate beyond what the data shows
6. Audience: coaches and sports scientists — assume professional literacy, no need for basic explanations

## What to avoid
- Injury diagnoses or medical predictions of any kind
- Generic lifestyle advice ("sleep more", "reduce stress")
- Forcing cross-metric connections that lack a plausible physiological or psychological mechanism
- Mentioning ACWR — it is not used in this system and is scientifically contested
- Over-interpreting noise in sparse datasets

## Response format
Use markdown: **bold** for key values and findings, ## for top-level section headers. Initial full analysis: sections — ## Load Pattern, ## Adherence, ## Training Stimulus (if data available), ## Performance Trajectory (if data available), ## Wellness & Monitoring (if data available), ## Key Observations, ## Suggested Focus. Keep each section to 2–4 sentences unless a finding genuinely warrants more.
Follow-up questions: conversational and direct. Use **bold** for key terms; avoid section headers unless specifically useful.`.trim();

// ── Markdown renderer ──────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (line.startsWith('## '))
          return <p key={i} className="font-semibold text-sm mt-3 mb-0.5">{line.slice(3)}</p>;
        if (line.startsWith('### '))
          return <p key={i} className="font-medium text-sm mt-2">{line.slice(4)}</p>;
        if (line.trim() === '')
          return <div key={i} className="h-1.5" />;
        if (line.startsWith('- ') || line.startsWith('• '))
          return <p key={i} className="pl-3 leading-relaxed">{'• '}{renderInline(line.slice(2))}</p>;
        return <p key={i} className="leading-relaxed">{renderInline(line)}</p>;
      })}
    </div>
  );
}

// ── Data fetching ──────────────────────────────────────────────────────────────

interface ExerciseLogEntry {
  methodId?: string;
  sets?: unknown[];
}

async function fetchAndBuildContext(
  connectionId: string,
  performanceParameters: AthletePerformanceParameter[],
  parametersV2: ParameterV2[],
): Promise<string> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const from = format(subMonths(new Date(), 3), 'yyyy-MM-dd');

  const [logsRes, schedRes, checkinsRes, testRes] = await Promise.all([
    supabase
      .from('athlete_session_logs')
      .select('date, session_name, borg_rating, duration_seconds, completed_at, sets_logged')
      .eq('athlete_connection_id', connectionId)
      .gte('date', from)
      .lte('date', today)
      .order('date'),
    supabase
      .from('athlete_schedule')
      .select('date, sessions')
      .eq('athlete_connection_id', connectionId)
      .gte('date', from)
      .lte('date', today)
      .order('date'),
    supabase
      .from('athlete_daily_checkins')
      .select('date, wellness_fatigue, wellness_sleep, wellness_soreness, wellness_stress, wellness_mood, has_pain, pain_areas, has_illness, illness_nrs')
      .eq('athlete_connection_id', connectionId)
      .gte('date', from)
      .order('date'),
    supabase
      .from('athlete_test_results')
      .select('parameter_id, value, recorded_at')
      .eq('athlete_connection_id', connectionId)
      .order('recorded_at'),
  ]);

  const logs = logsRes.data ?? [];
  const schedule = schedRes.data ?? [];
  const checkins = checkinsRes.data ?? [];
  const testResults = testRes.data ?? [];

  // ── Internal load ─────────────────────────────────────────────────────────
  const completedLogs = logs.filter(
    (l) => l.completed_at && l.borg_rating != null && l.duration_seconds != null
  );
  const loadByDate: Record<string, { sessions: number; totalAU: number }> = {};
  for (const l of completedLogs) {
    const au = Math.round((l.borg_rating as number) * ((l.duration_seconds as number) / 60));
    const d = l.date as string;
    if (!loadByDate[d]) loadByDate[d] = { sessions: 0, totalAU: 0 };
    loadByDate[d].sessions++;
    loadByDate[d].totalAU += au;
  }

  // ── Adherence ─────────────────────────────────────────────────────────────
  const plannedCount = schedule.reduce(
    (n, r) => n + ((r.sessions as unknown[])?.length ?? 0), 0
  );
  const completedCount = logs.filter((l) => l.completed_at).length;

  // ── Training stimulus: method → total sets across window ──────────────────
  const methodSets: Record<string, number> = {};
  for (const l of completedLogs) {
    const entries = Array.isArray(l.sets_logged)
      ? (l.sets_logged as ExerciseLogEntry[])
      : [];
    for (const e of entries) {
      if (e.methodId) {
        methodSets[e.methodId] =
          (methodSets[e.methodId] ?? 0) +
          (Array.isArray(e.sets) ? e.sets.length : 0);
      }
    }
  }

  // ── Performance parameters (coach-entered + self-reported) ────────────────
  const srByParamId = new Map<string, Array<{ date: string; value: string }>>();
  for (const r of testResults as Array<{ parameter_id: string; value: string; recorded_at: string }>) {
    const bucket = srByParamId.get(r.parameter_id) ?? [];
    bucket.push({ date: r.recorded_at.slice(0, 10), value: r.value });
    srByParamId.set(r.parameter_id, bucket);
  }

  const perfSummary = performanceParameters
    .map((pp) => {
      const meta = parametersV2.find((v) => v.id === pp.athleticismParameterId);
      const coachVals = (pp.values ?? []).map((v) => ({
        date: v.recordedAt.slice(0, 10),
        value: v.value,
        source: 'coach',
      }));
      const selfVals = (srByParamId.get(pp.athleticismParameterId) ?? []).map((v) => ({
        date: v.date,
        value: v.value,
        source: 'athlete',
      }));
      const allVals = [...coachVals, ...selfVals].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      return {
        name: meta?.name ?? pp.athleticismParameterId,
        unit: meta?.unit ?? '',
        values: allVals,
      };
    })
    .filter((p) => p.values.length > 0);

  // ── Monitoring ────────────────────────────────────────────────────────────
  const monitoringSummary = checkins.map((c) => {
    const items = [
      c.wellness_fatigue,
      c.wellness_sleep,
      c.wellness_soreness,
      c.wellness_stress,
      c.wellness_mood,
    ].filter((v): v is number => typeof v === 'number');
    const composite =
      items.length > 0
        ? +(items.reduce((a, b) => a + b, 0) / items.length).toFixed(1)
        : null;
    const painAreas =
      (c.pain_areas as Array<{ bodyPart?: string; side?: string; nrs?: number }> | null) ?? [];
    return {
      date: c.date,
      wellness:
        composite !== null
          ? {
              composite,
              fatigue: c.wellness_fatigue,
              sleep: c.wellness_sleep,
              soreness: c.wellness_soreness,
              stress: c.wellness_stress,
              mood: c.wellness_mood,
            }
          : null,
      pain: c.has_pain
        ? painAreas
            .map(
              (a) =>
                `${a.bodyPart ?? '?'}${a.side ? ` (${a.side})` : ''} NRS ${a.nrs ?? '?'}/10`
            )
            .join(', ') || null
        : null,
      illness: c.has_illness ? { severity_nrs: c.illness_nrs } : null,
    };
  });

  return JSON.stringify(
    {
      window: `${from} to ${today}`,
      adherence: {
        planned: plannedCount,
        completed: completedCount,
        pct: plannedCount > 0 ? `${Math.round((completedCount / plannedCount) * 100)}%` : null,
      },
      internalLoad:
        Object.keys(loadByDate).length > 0
          ? Object.entries(loadByDate).map(([date, v]) => ({ date, ...v }))
          : 'No completed sessions with RPE in window',
      trainingStimulus:
        Object.keys(methodSets).length > 0
          ? methodSets
          : 'No method data in session logs',
      performanceParameters:
        perfSummary.length > 0 ? perfSummary : 'No performance data recorded',
      dailyMonitoring:
        monitoringSummary.length > 0 ? monitoringSummary : 'No monitoring data available',
    },
    null,
    2
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface AthleteAnalysisAIDrawerProps {
  athleteId: string;
  performanceParameters: AthletePerformanceParameter[];
  parametersV2: ParameterV2[];
}

type AIMessage = { role: 'user' | 'assistant'; content: string; hidden?: boolean };

export function AthleteAnalysisAIDrawer({
  athleteId,
  performanceParameters,
  parametersV2,
}: AthleteAnalysisAIDrawerProps) {
  const { getConnectionForAthlete } = useAthleteConnections();
  const connectionId = getConnectionForAthlete(athleteId)?.id ?? null;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextStr, setContextStr] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Fetch data once when the drawer is first opened
  const handleOpen = useCallback(async () => {
    setOpen(true);
    if (contextStr !== null || contextLoading || !connectionId) return;
    setContextLoading(true);
    try {
      const ctx = await fetchAndBuildContext(connectionId, performanceParameters, parametersV2);
      setContextStr(ctx);
    } catch (e) {
      console.error('Failed to build AI context', e);
    } finally {
      setContextLoading(false);
    }
  }, [connectionId, contextStr, contextLoading, performanceParameters, parametersV2]);

  const handleAnalyze = useCallback(async () => {
    if (!contextStr || loading) return;
    const userMsg: AIMessage = {
      role: 'user',
      content: `Please provide a structured analysis of the following athlete training data:\n\n${contextStr}`,
      hidden: true,
    };
    setMessages([userMsg]);
    setLoading(true);
    try {
      const reply = await sendMessage(
        [{ role: 'user', content: userMsg.content }],
        ANALYSIS_SYSTEM_PROMPT,
        'claude-sonnet-4-5',
        4096,
      );
      setMessages([userMsg, { role: 'assistant', content: reply }]);
    } catch (e) {
      console.error('AI analysis failed', e);
    } finally {
      setLoading(false);
    }
  }, [contextStr, loading]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    const followUp: AIMessage = { role: 'user', content: input.trim() };
    const next = [...messages, followUp];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const apiMsgs = next.map(({ role, content }) => ({ role, content }));
      const reply = await sendMessage(apiMsgs, ANALYSIS_SYSTEM_PROMPT, 'claude-sonnet-4-5', 4096);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      console.error('AI send failed', e);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  if (!connectionId) return null;

  const visibleMessages = messages.filter((m) => !m.hidden);

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={handleOpen}
        className={cn(
          'fixed bottom-6 right-6 z-[200]',
          'w-14 h-14 rounded-full shadow-lg',
          'bg-primary text-primary-foreground',
          'flex items-center justify-center',
          'hover:scale-105 active:scale-95 transition-transform',
          'ring-2 ring-primary/20',
        )}
        aria-label="AI Analysis Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>

      {/* Wide drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[620px] sm:max-w-[620px] flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-5 py-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <SheetTitle className="text-base">AI Analysis Assistant</SheetTitle>
              </div>
              {visibleMessages.length > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mr-8"
                  onClick={() => {
                    setMessages([]);
                    setInput('');
                  }}
                >
                  Clear conversation
                </button>
              )}
            </div>
          </SheetHeader>

          {/* Message area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto min-h-0 px-5 py-4"
          >
            {visibleMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  {contextLoading
                    ? 'Loading athlete data…'
                    : 'Send all athlete data to Claude and get a structured interpretation of load, stimulus, performance, and monitoring patterns.'}
                </p>
                {!contextLoading && (
                  <Button
                    onClick={handleAnalyze}
                    disabled={loading || !contextStr}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {loading ? 'Analyzing…' : 'Analyze all data'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleMessages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg px-3 py-2.5 text-sm',
                      m.role === 'assistant'
                        ? 'bg-muted'
                        : 'bg-primary/10 ml-12',
                    )}
                  >
                    {m.role === 'assistant' ? (
                      <MarkdownText text={m.content} />
                    ) : (
                      <p>{m.content}</p>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="bg-muted rounded-lg px-3 py-2.5 text-sm text-muted-foreground animate-pulse">
                    Thinking…
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Follow-up input — only after first analysis */}
          {visibleMessages.length > 0 && (
            <div className="shrink-0 border-t px-5 py-3 flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a follow-up question…"
                className="text-sm h-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
