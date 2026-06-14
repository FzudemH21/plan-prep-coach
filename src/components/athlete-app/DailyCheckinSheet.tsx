import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, CheckCircle2, X } from 'lucide-react';
import {
  FRONT_REGIONS,
  BACK_REGIONS,
  nrsSeverityColor,
  nrsSeverityStroke,
  svgRegionKey,
  getRegionKeyLabel,
} from '@/lib/bodyMapData';
import type { DailyCheckinInput } from '@/hooks/useDailyCheckin';
import type { MonitoringConfig, MonitoringBlock } from '@/types/athlete';
import { DEFAULT_MONITORING_CONFIG } from '@/types/athlete';

// ── Body map images ───────────────────────────────────────────────────────────
const FRONT_IMG = '/bodymap-front.png';
const BACK_IMG  = '/bodymap-back.png';

// ── McLean scale ──────────────────────────────────────────────────────────────

interface WellnessItem {
  key: WellnessKey;
  label: string;
  anchors: [string, string, string, string, string]; // index 0 = value 1
}

type WellnessKey = 'fatigue' | 'sleep' | 'soreness' | 'stress' | 'mood';

const WELLNESS_ITEMS: WellnessItem[] = [
  {
    key: 'fatigue',
    label: 'How is your energy level today?',
    anchors: ['Always tired', 'More tired than normal', 'Normal', 'Fresh', 'Very fresh'],
  },
  {
    key: 'sleep',
    label: 'How did you sleep last night?',
    anchors: ['Insomnia', 'Restless sleep', 'Difficulty falling asleep', 'Good', 'Very restful'],
  },
  {
    key: 'soreness',
    label: 'How are your muscles feeling?',
    anchors: ['Very sore', 'Increased soreness / tightness', 'Normal', 'Feeling good', 'Feeling great'],
  },
  {
    key: 'stress',
    label: 'How stressed are you feeling?',
    anchors: ['Highly stressed', 'Feeling stressed', 'Normal', 'Relaxed', 'Very relaxed'],
  },
  {
    key: 'mood',
    label: 'How is your mood?',
    anchors: [
      'Highly annoyed / irritable',
      'Snappy with others',
      'Less interested than usual',
      'Generally good',
      'Very positive mood',
    ],
  },
];

const WELLNESS_COLORS: Record<number, string> = {
  1: 'border-red-500 bg-red-500 text-white',
  2: 'border-orange-400 bg-orange-400 text-white',
  3: 'border-amber-400 bg-amber-400 text-white',
  4: 'border-green-400 bg-green-400 text-white',
  5: 'border-green-600 bg-green-600 text-white',
};

const WELLNESS_LABEL_COLORS: Record<number, string> = {
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-amber-500',
  4: 'text-green-500',
  5: 'text-green-700',
};

// ── OSTRC-H illness symptom list ──────────────────────────────────────────────

interface IllnessSymptom {
  id: string;
  label: string;
  isOther?: boolean;
}

const ILLNESS_SYMPTOMS: IllnessSymptom[] = [
  { id: 'fever',          label: 'Fever' },
  { id: 'fatigue',        label: 'Fatigue / feeling unwell' },
  { id: 'lymph_nodes',    label: 'Swollen lymph nodes' },
  { id: 'sore_throat',    label: 'Sore throat' },
  { id: 'blocked_nose',   label: 'Blocked nose / runny nose / sneezing' },
  { id: 'cough',          label: 'Cough' },
  { id: 'breathing',      label: 'Breathing difficulties / shortness of breath' },
  { id: 'headache',       label: 'Headache' },
  { id: 'nausea',         label: 'Nausea' },
  { id: 'vomiting',       label: 'Vomiting' },
  { id: 'diarrhoea',      label: 'Diarrhoea' },
  { id: 'constipation',   label: 'Constipation' },
  { id: 'fainting',       label: 'Fainting / loss of consciousness' },
  { id: 'rash',           label: 'Rash / itching' },
  { id: 'arrhythmia',     label: 'Irregular pulse / arrhythmia' },
  { id: 'chest_pain',     label: 'Chest pressure / tightness / chest pain' },
  { id: 'abdominal_pain', label: 'Abdominal pain' },
  { id: 'numbness',       label: 'Numbness / tingling' },
  { id: 'anxiety',        label: 'Nervousness / restlessness / anxiety' },
  { id: 'low_mood',       label: 'Sadness / low mood' },
  { id: 'irritability',   label: 'Irritability' },
  { id: 'eye_problems',   label: 'Eye problems' },
  { id: 'ear_problems',   label: 'Ear problems' },
  { id: 'urinary',        label: 'Urinary tract symptoms' },
  { id: 'genital',        label: 'Genital symptoms' },
  { id: 'other',          label: 'Other symptoms / pain', isOther: true },
];

// ── NRS button strip ──────────────────────────────────────────────────────────

function NrsStrip({
  value,
  onChange,
  label = 'Pain severity',
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex justify-between text-[11px] text-muted-foreground px-0.5">
        <span>No pain</span>
        <span>Worst imaginable</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 h-9 rounded text-xs font-bold border transition-all active:scale-95',
              value === n
                ? n === 0
                  ? 'bg-green-500 border-green-500 text-white'
                  : n <= 3
                  ? 'bg-yellow-400 border-yellow-400 text-white'
                  : n <= 6
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-red-600 border-red-600 text-white'
                : 'bg-background border-border text-muted-foreground hover:border-primary/40'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-center text-sm font-medium text-muted-foreground">
        {value === 0 ? 'None'
          : value <= 3 ? `Mild · ${value}/10`
          : value <= 6 ? `Moderate · ${value}/10`
          : `Severe · ${value}/10`}
      </p>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-300"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

// ── Body map component ────────────────────────────────────────────────────────

type BodySide = 'front' | 'back';

// Dot positions stored alongside NRS: regionKey → { nrs, cx, cy }
export interface PainDot { nrs: number; cx: number; cy: number }

function BodyMap({
  painDots,
  pendingKey,
  pendingDot,
  pendingNrs,
  onSelect,
}: {
  painDots: Map<string, PainDot>;
  pendingKey: string | null;
  pendingDot: { cx: number; cy: number } | null;
  pendingNrs: number;
  onSelect: (regionKey: string, cx: number, cy: number) => void;
}) {
  const [side, setSide] = useState<BodySide>('front');
  const regions = side === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  const imgSrc  = side === 'front' ? FRONT_IMG : BACK_IMG;
  const viewBox = side === 'front' ? '0 0 193 306' : '0 0 211 317';

  return (
    <div className="space-y-2">
      {/* Front / Back tabs */}
      <div className="flex bg-muted rounded-lg p-1 gap-1">
        {(['front', 'back'] as BodySide[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              'flex-1 py-1.5 rounded-md text-sm font-medium transition-all',
              side === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {s === 'front' ? 'Front' : 'Back'}
          </button>
        ))}
      </div>

      {/* Body image + SVG overlay */}
      <div className="flex justify-center">
        <div className="relative" style={{ width: '100%', maxWidth: 260 }}>
          <img
            src={imgSrc}
            alt={`${side} body view`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Invisible hit-area rects */}
            {regions.map((r) => {
              const key = svgRegionKey(r);
              return (
                <rect
                  key={r.uid}
                  x={r.x} y={r.y} width={r.w} height={r.h}
                  rx={3}
                  fill="rgba(0,0,0,0)"
                  stroke="rgba(0,0,0,0)"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect(key, r.x + r.w / 2, r.y + r.h / 2)}
                />
              );
            })}

            {/* Confirmed dots */}
            {Array.from(painDots.entries()).map(([key, dot]) => (
              <g key={key} style={{ pointerEvents: 'none' }}>
                <circle cx={dot.cx} cy={dot.cy} r={7}
                  fill={nrsSeverityColor(dot.nrs) || 'rgba(234,179,8,0.55)'}
                  stroke={nrsSeverityStroke(dot.nrs) || 'rgba(180,130,0,0.8)'}
                  strokeWidth={1.5}
                />
                <text x={dot.cx} y={dot.cy + 4} textAnchor="middle"
                  fontSize="7" fontWeight="bold" fill="white">
                  {dot.nrs}
                </text>
              </g>
            ))}

            {/* Pending dot — coloured by current NRS selection */}
            {pendingKey && pendingDot && (
              <g style={{ pointerEvents: 'none' }}>
                <circle cx={pendingDot.cx} cy={pendingDot.cy} r={9}
                  fill={nrsSeverityColor(pendingNrs)}
                  stroke={nrsSeverityStroke(pendingNrs)}
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                />
                <circle cx={pendingDot.cx} cy={pendingDot.cy} r={4}
                  fill={nrsSeverityStroke(pendingNrs)}
                />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// Step is now a plain string to support dynamic custom_<blockId> steps and 'notes'.
// Well-known step names: 'wellness' | 'wellness_confirm' | 'health_q' | 'body_map'
//   | 'illness_symptoms' | 'illness_nrs' | 'notes' | `custom_${string}` | 'done'
type Step = string;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: DailyCheckinInput) => Promise<boolean>;
  athleteName?: string;
  monitoringConfig?: MonitoringConfig;
}

// ── Navigation helpers (config-aware) ─────────────────────────────────────────

/** Returns the ordered "main" steps — one entry per enabled block, then 'notes', 'done'. */
function computeMainSteps(config?: MonitoringConfig): string[] {
  const blocks = (config?.blocks ?? DEFAULT_MONITORING_CONFIG.blocks).filter(b => b.enabled);
  const steps: string[] = [];
  for (const b of blocks) {
    if (b.type === 'wellbeing') steps.push('wellness');
    else if (b.type === 'ostrc') steps.push('health_q');
    else if (b.type === 'custom_metric') steps.push(`custom_${b.id}`);
  }
  steps.push('notes');
  steps.push('done');
  return steps;
}

function initialStep(config?: MonitoringConfig): string {
  return computeMainSteps(config)[0] ?? 'notes';
}

function nextMainStep(currentMain: string, config?: MonitoringConfig): string {
  const main = computeMainSteps(config);
  const idx = main.indexOf(currentMain);
  if (idx === -1 || idx >= main.length - 1) return 'notes';
  return main[idx + 1];
}

/** Returns the previous step for Back navigation. Going back past 'wellness' lands on 'wellness_confirm'. */
function prevOfMainStep(currentMain: string, config?: MonitoringConfig): string | null {
  const main = computeMainSteps(config);
  const idx = main.indexOf(currentMain);
  if (idx <= 0) return null;
  const prev = main[idx - 1];
  return prev === 'wellness' ? 'wellness_confirm' : prev;
}

export function DailyCheckinSheet({ open, onClose, onSave, athleteName, monitoringConfig }: Props) {
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep]               = useState<string>(initialStep(monitoringConfig));
  const [wellnessIdx, setWellnessIdx] = useState(0);
  const [wellness, setWellness]       = useState<Record<WellnessKey, number | null>>({
    fatigue: null, sleep: null, soreness: null, stress: null, mood: null,
  });

  const [hasPain, setHasPain]         = useState<boolean | null>(null);
  const [hasIllness, setHasIllness]   = useState<boolean | null>(null);

  // painDots: regionKey → { nrs, cx, cy } — confirmed areas
  const [painDots, setPainDots]       = useState<Map<string, PainDot>>(new Map());
  // pending: area selected on map but not yet rated
  const [pendingKey, setPendingKey]   = useState<string | null>(null);
  const [pendingDot, setPendingDot]   = useState<{ cx: number; cy: number } | null>(null);
  const [pendingNrs, setPendingNrs]   = useState(5);

  const [illnessSymptoms, setIllnessSymptoms] = useState<Set<string>>(new Set());
  const [illnessOther, setIllnessOther]       = useState('');
  const [illnessNrs, setIllnessNrs]           = useState(0);

  // Global notes (always collected, regardless of blocks)
  const [notes, setNotes]             = useState('');
  // Custom metric block values: blockId → numeric value entered by athlete
  const [customMetricValues, setCustomMetricValues] = useState<Record<string, number>>({});

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // ── Reset on open ──────────────────────────────────────────────────────────
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) {
    wasOpen.current = true;
    setStep(initialStep(monitoringConfig));
    setWellnessIdx(0);
    setWellness({ fatigue: null, sleep: null, soreness: null, stress: null, mood: null });
    setHasPain(null);
    setHasIllness(null);
    setPainDots(new Map());
    setPendingKey(null);
    setPendingDot(null);
    setPendingNrs(5);
    setIllnessSymptoms(new Set());
    setIllnessOther('');
    setIllnessNrs(0);
    setNotes('');
    setCustomMetricValues({});
    setSaving(false);
    setSaveError(false);
  }
  if (!open) wasOpen.current = false;

  // ── Auto-advance wellness ──────────────────────────────────────────────────
  const advanceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnToConfirm   = useRef(false); // set when editing from confirm screen

  function selectWellness(val: number) {
    const key = WELLNESS_ITEMS[wellnessIdx].key;
    setWellness((prev) => ({ ...prev, [key]: val }));

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      if (returnToConfirm.current) {
        returnToConfirm.current = false;
        setStep('wellness_confirm');
      } else if (wellnessIdx < WELLNESS_ITEMS.length - 1) {
        setWellnessIdx((i) => i + 1);
      } else {
        setStep('wellness_confirm');
      }
    }, 150);
  }

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  // ── Body map handlers ──────────────────────────────────────────────────────

  function handleMapSelect(regionKey: string, cx: number, cy: number) {
    // If already confirmed, remove it (deselect)
    if (painDots.has(regionKey)) {
      setPainDots((prev) => { const n = new Map(prev); n.delete(regionKey); return n; });
      if (pendingKey === regionKey) { setPendingKey(null); setPendingDot(null); }
      return;
    }
    // Set as pending for inline NRS rating
    setPendingKey(regionKey);
    setPendingDot({ cx, cy });
    setPendingNrs(5);
  }

  function confirmPending() {
    if (!pendingKey || !pendingDot) return;
    setPainDots((prev) => { const n = new Map(prev); n.set(pendingKey, { nrs: pendingNrs, ...pendingDot }); return n; });
    setPendingKey(null);
    setPendingDot(null);
    setPendingNrs(5);
  }

  function cancelPending() {
    setPendingKey(null);
    setPendingDot(null);
    setPendingNrs(5);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function doSave() {
    setSaving(true);
    const input: DailyCheckinInput = {
      date: today,
      wellnessFatigue:  wellness.fatigue,
      wellnessSleep:    wellness.sleep,
      wellnessSoreness: wellness.soreness,
      wellnessStress:   wellness.stress,
      wellnessMood:     wellness.mood,
      hasPain: hasPain === true && painDots.size > 0,
      painAreas: Array.from(painDots.entries()).map(([regionKey, dot]) => ({
        regionKey,
        areaLabel: getRegionKeyLabel(regionKey),
        severity: dot.nrs,
      })),
      hasIllness: hasIllness === true,
      illnessSymptoms: Array.from(illnessSymptoms),
      illnessSymptomOther: illnessSymptoms.has('other') ? illnessOther : '',
      illnessNrs: hasIllness ? illnessNrs : null,
      notes: notes.trim() || undefined,
      customMetricValues: Object.keys(customMetricValues).length > 0 ? customMetricValues : undefined,
    };
    const ok = await onSave(input);
    setSaving(false);
    if (ok) {
      setSaveError(false);
      setStep('done');
    } else {
      setSaveError(true);
    }
  }

  // ── Progress — dynamic, based on config-driven step sequence ─────────────

  function progressValue(): number {
    const main = computeMainSteps(monitoringConfig);
    // Total interactive slots: each main step counts as 1 unit
    const total = main.length; // includes 'done'

    if (step === 'wellness') {
      // Interpolate within the wellness block
      const wellIdx = main.indexOf('wellness');
      const frac = wellIdx / total + (wellnessIdx / WELLNESS_ITEMS.length) / total;
      return Math.max(0.04, frac);
    }
    if (step === 'wellness_confirm') {
      const wellIdx = main.indexOf('wellness');
      return (wellIdx + 0.9) / total;
    }
    if (step === 'body_map') {
      const hqIdx = main.indexOf('health_q');
      return (hqIdx + 0.4) / total;
    }
    if (step === 'illness_symptoms') {
      const hqIdx = main.indexOf('health_q');
      return (hqIdx + 0.65) / total;
    }
    if (step === 'illness_nrs') {
      const hqIdx = main.indexOf('health_q');
      return (hqIdx + 0.85) / total;
    }
    const idx = main.indexOf(step);
    if (idx === -1) return 0;
    return idx / total;
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function Header({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
      <div className="shrink-0 pb-3">
        <p className="text-lg font-bold leading-snug">{title}</p>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    );
  }

  // ── Content per step ───────────────────────────────────────────────────────

  function renderContent() {
    // ── Wellness: one question at a time ──
    if (step === 'wellness') {
      const item = WELLNESS_ITEMS[wellnessIdx];
      const current = wellness[item.key];
      return (
        <>
          <Header
            title={item.label}
            subtitle={`Question ${wellnessIdx + 1} of ${WELLNESS_ITEMS.length}`}
          />
          <div className="flex-1 overflow-y-auto space-y-2">
            {([5, 4, 3, 2, 1] as const).map((val) => (
              <button
                key={val}
                onClick={() => selectWellness(val)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all active:scale-[0.98]',
                  current === val
                    ? WELLNESS_COLORS[val]
                    : 'border-border bg-background hover:border-primary/30'
                )}
              >
                <span className={cn(
                  'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0',
                  current === val ? 'border-white/60 text-white' : 'border-border text-muted-foreground'
                )}>
                  {val}
                </span>
                <span className={cn(
                  'text-sm font-medium leading-snug',
                  current === val ? 'text-white' : 'text-foreground'
                )}>
                  {item.anchors[val - 1]}
                </span>
              </button>
            ))}
          </div>
          <div className="shrink-0 flex gap-3 pt-4">
            {wellnessIdx > 0
              ? (
                <Button variant="outline" className="flex-1" onClick={() => setWellnessIdx((i) => i - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              ) : (
                <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={onClose}>
                  Skip
                </Button>
              )
            }
            <Button
              className="flex-1"
              disabled={current === null}
              onClick={() => {
                if (wellnessIdx < WELLNESS_ITEMS.length - 1) setWellnessIdx((i) => i + 1);
                else setStep('wellness_confirm');
              }}
            >
              {wellnessIdx < WELLNESS_ITEMS.length - 1
                ? <><span>Next</span><ChevronRight className="h-4 w-4 ml-1" /></>
                : <><span>Review</span><ChevronRight className="h-4 w-4 ml-1" /></>
              }
            </Button>
          </div>
        </>
      );
    }

    // ── Wellness confirm ──
    if (step === 'wellness_confirm') {
      return (
        <>
          <Header title="Wellness summary" subtitle="Tap any answer to change it." />
          <div className="flex-1 overflow-y-auto space-y-2">
            {WELLNESS_ITEMS.map((item, idx) => {
              const val = wellness[item.key];
              return (
                <button
                  key={item.key}
                  onClick={() => { returnToConfirm.current = true; setWellnessIdx(idx); setStep('wellness'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-all active:scale-[0.98] text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                    <p className={cn('text-sm font-semibold mt-0.5', val ? WELLNESS_LABEL_COLORS[val] : 'text-muted-foreground')}>
                      {val ? `${val} – ${item.anchors[val - 1]}` : '—'}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
          <div className="shrink-0 flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setWellnessIdx(4); setStep('wellness'); }}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              className="flex-1"
              disabled={Object.values(wellness).some((v) => v === null)}
              onClick={() => setStep(nextMainStep('wellness', monitoringConfig))}
            >
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      );
    }

    // ── Health question ──
    if (step === 'health_q') {
      const canContinue = hasPain !== null && hasIllness !== null;
      return (
        <>
          <Header title="Any health issues today?" subtitle="Pain, illness, or neither." />
          <div className="flex-1 overflow-y-auto space-y-5">
            <div>
              <p className="text-sm font-semibold mb-2">Do you have any pain or discomfort?</p>
              <div className="flex gap-3">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => setHasPain(val)}
                    className={cn(
                      'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all active:scale-[0.98]',
                      hasPain === val
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-background hover:border-primary/30'
                    )}
                  >
                    {val ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Are you feeling ill?</p>
              <div className="flex gap-3">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => setHasIllness(val)}
                    className={cn(
                      'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all active:scale-[0.98]',
                      hasIllness === val
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-background hover:border-primary/30'
                    )}
                  >
                    {val ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {saveError && (
            <p className="text-xs text-destructive text-center pb-1">
              Something went wrong — please try again.
            </p>
          )}
          <div className="shrink-0 flex gap-3 pt-2">
            {prevOfMainStep('health_q', monitoringConfig) !== null ? (
              <Button variant="outline" className="flex-1" onClick={() => setStep(prevOfMainStep('health_q', monitoringConfig)!)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            ) : (
              <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={onClose}>Skip</Button>
            )}
            <Button
              className="flex-1"
              disabled={!canContinue || saving}
              onClick={() => {
                if (hasPain) setStep('body_map');
                else if (hasIllness) setStep('illness_symptoms');
                else setStep(nextMainStep('health_q', monitoringConfig));
              }}
            >
              <><span>Continue</span><ChevronRight className="h-4 w-4 ml-1" /></>
            </Button>
          </div>
        </>
      );
    }

    // ── Body map: select → inline NRS → confirm / add more ──
    if (step === 'body_map') {
      return (
        <>
          <Header
            title="Where do you feel pain?"
            subtitle={pendingKey
              ? `Rate ${getRegionKeyLabel(pendingKey)}`
              : 'Tap an area on the map.'}
          />
          <div className="flex-1 overflow-y-auto space-y-3">
            <BodyMap
              painDots={painDots}
              pendingKey={pendingKey}
              pendingDot={pendingDot}
              pendingNrs={pendingNrs}
              onSelect={handleMapSelect}
            />

            {/* Inline NRS for pending area */}
            {pendingKey && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
                <p className="text-sm font-semibold text-indigo-900">
                  {getRegionKeyLabel(pendingKey)}
                </p>
                <NrsStrip value={pendingNrs} onChange={setPendingNrs} label="Pain severity" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={cancelPending}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={confirmPending}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm area
                  </Button>
                </div>
              </div>
            )}

            {/* Confirmed areas list */}
            {painDots.size > 0 && !pendingKey && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Confirmed ({painDots.size})
                </p>
                {Array.from(painDots.entries()).map(([key, dot]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg px-3 py-2"
                    style={{ background: nrsSeverityColor(dot.nrs) || 'rgba(0,0,0,0.04)' }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: nrsSeverityStroke(dot.nrs) }} />
                    <span className="text-sm flex-1 font-medium">{getRegionKeyLabel(key)}</span>
                    <span className="text-xs font-semibold mr-1 opacity-80">{dot.nrs}/10</span>
                    <button onClick={() => setPainDots((p) => { const n = new Map(p); n.delete(key); return n; })}>
                      <X className="h-3.5 w-3.5 text-foreground/60 hover:text-destructive" />
                    </button>
                  </div>
                ))}
                <p className="text-center text-xs text-muted-foreground py-1">
                  Tap the map to add more areas
                </p>
              </div>
            )}
          </div>
          {saveError && (
            <p className="text-xs text-destructive text-center pb-1">
              Something went wrong — please try again.
            </p>
          )}
          <div className="shrink-0 flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('health_q')}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              className="flex-1"
              disabled={painDots.size === 0 || !!pendingKey || saving}
              onClick={() => {
                if (hasIllness) setStep('illness_symptoms');
                else setStep(nextMainStep('health_q', monitoringConfig));
              }}
            >
              {hasIllness
                ? <><span>Next: Illness</span><ChevronRight className="h-4 w-4 ml-1" /></>
                : <><span>Continue</span><ChevronRight className="h-4 w-4 ml-1" /></>}
            </Button>
          </div>
        </>
      );
    }

    // ── Illness symptoms ──
    if (step === 'illness_symptoms') {
      return (
        <>
          <Header title="Which symptoms do you have?" subtitle="Select all that apply." />
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {ILLNESS_SYMPTOMS.map((sym) => (
              <div key={sym.id}>
                <button
                  onClick={() => {
                    setIllnessSymptoms((prev) => {
                      const next = new Set(prev);
                      if (next.has(sym.id)) next.delete(sym.id); else next.add(sym.id);
                      return next;
                    });
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98]',
                    illnessSymptoms.has(sym.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background hover:border-primary/30'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                    illnessSymptoms.has(sym.id) ? 'bg-white/20 border-white/60' : 'border-border'
                  )}>
                    {illnessSymptoms.has(sym.id) && (
                      <div className="w-2 h-2 rounded-sm bg-white" />
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-medium',
                    illnessSymptoms.has(sym.id) ? 'text-white' : 'text-foreground'
                  )}>
                    {sym.label}
                  </span>
                </button>
                {sym.isOther && illnessSymptoms.has('other') && (
                  <input
                    className="mt-1 w-full text-sm border border-border rounded-xl px-4 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Please describe…"
                    value={illnessOther}
                    onChange={(e) => setIllnessOther(e.target.value)}
                    maxLength={200}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="shrink-0 flex gap-3 pt-4">
            <Button variant="outline" className="flex-1"
              onClick={() => hasPain ? setStep('body_map') : setStep('health_q')}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              className="flex-1"
              disabled={illnessSymptoms.size === 0}
              onClick={() => setStep('illness_nrs')}
            >
              Rate severity <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      );
    }

    // ── Illness NRS ──
    if (step === 'illness_nrs') {
      return (
        <>
          <Header title="Overall illness severity" subtitle="How bad are your symptoms right now?" />
          <div className="flex-1 overflow-y-auto py-4">
            <NrsStrip value={illnessNrs} onChange={setIllnessNrs} label="Illness severity" />
          </div>
          {saveError && (
            <p className="text-xs text-destructive text-center pb-2">
              Something went wrong — please try again.
            </p>
          )}
          <div className="shrink-0 flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('illness_symptoms')}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button className="flex-1" disabled={saving} onClick={() => setStep(nextMainStep('health_q', monitoringConfig))}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      );
    }

    // ── Custom metric block ──
    if (step.startsWith('custom_')) {
      const blockId = step.slice(7); // strip 'custom_'
      const block = (monitoringConfig?.blocks ?? DEFAULT_MONITORING_CONFIG.blocks)
        .find((b): b is MonitoringBlock => b.id === blockId && b.type === 'custom_metric');
      const cfg = block?.config;
      if (!cfg) return null;

      // Key by cfg.parameterId so athlete_test_results rows match what useSquadOverview queries.
      const metricKey = cfg.parameterId;
      const currentVal = customMetricValues[metricKey] ?? null;
      const questionLabel = cfg.label || cfg.parameterName;
      const unitSuffix = cfg.parameterUnit ? ` (${cfg.parameterUnit})` : '';

      const goBack = () => {
        const prev = prevOfMainStep(step, monitoringConfig);
        if (prev) setStep(prev);
      };
      const goNext = () => setStep(nextMainStep(step, monitoringConfig));

      if (cfg.inputType === 'scale') {
        const min = cfg.scaleMin ?? 0;
        const max = cfg.scaleMax ?? 10;
        const count = max - min + 1;
        return (
          <>
            <Header title={questionLabel} subtitle={`${max} = highest · ${min} = lowest${unitSuffix}`} />
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {Array.from({ length: count }, (_, i) => max - i).map((n) => {
                const anchor = cfg.scaleAnchors?.find(a => a.value === n)?.label;
                const isSelected = currentVal === n;
                return (
                  <button
                    key={n}
                    onClick={() => setCustomMetricValues(prev => ({ ...prev, [metricKey]: n }))}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98]',
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border bg-background hover:border-primary/30'
                    )}
                  >
                    <span className={cn(
                      'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0',
                      isSelected ? 'border-white/60 text-white' : 'border-border text-muted-foreground'
                    )}>
                      {n}
                    </span>
                    {anchor && (
                      <span className={cn(
                        'text-sm font-medium leading-snug',
                        isSelected ? 'text-white' : 'text-foreground'
                      )}>
                        {anchor}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="shrink-0 flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button className="flex-1" onClick={goNext}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        );
      }

      // Number input type
      return (
        <>
          <Header title={questionLabel} subtitle={`Enter today's value${unitSuffix}`} />
          <div className="flex-1 overflow-y-auto flex flex-col justify-center py-4">
            <div className="flex items-center gap-2 w-full">
              <input
                type="number"
                inputMode="decimal"
                className="min-w-0 flex-1 h-11 text-base font-semibold text-center rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="–"
                value={currentVal ?? ''}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setCustomMetricValues(prev => isNaN(v) ? (({ [metricKey]: _, ...rest }) => rest)(prev) : { ...prev, [metricKey]: v });
                }}
              />
              {cfg.parameterUnit && (
                <span className="text-muted-foreground text-sm font-medium shrink-0">{cfg.parameterUnit}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button className="flex-1" onClick={goNext}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      );
    }

    // ── Notes ──
    if (step === 'notes') {
      return (
        <>
          <Header
            title="Any notes for your coach?"
            subtitle="Optional — leave blank if there's nothing to add."
          />
          <div className="flex-1 overflow-y-auto">
            <textarea
              className="w-full h-32 resize-none rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              placeholder="How are you feeling overall? Anything your coach should know…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          {saveError && (
            <p className="text-xs text-destructive text-center pb-1">
              Something went wrong — please try again.
            </p>
          )}
          <div className="shrink-0 flex gap-3 pt-4">
            {prevOfMainStep('notes', monitoringConfig) !== null ? (
              <Button variant="outline" className="flex-1" onClick={() => setStep(prevOfMainStep('notes', monitoringConfig)!)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            ) : (
              <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={onClose}>Skip</Button>
            )}
            <Button className="flex-1" disabled={saving} onClick={doSave}>
              {saving ? 'Saving…' : 'Finish'}
            </Button>
          </div>
        </>
      );
    }

    // ── Done ──
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 py-8">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <div className="text-center">
          <p className="text-xl font-bold">All done!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Check-in saved. Have a great day 💪
          </p>
        </div>
        <Button className="w-full mt-2" onClick={onClose}>
          Go to Today
        </Button>
      </div>
    );
  }

  // ── Dialog wrapper (single instance — no re-animation) ─────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-[440px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden"
        // Remove the default close button — we handle navigation ourselves
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Progress bar */}
        <div className="px-5 pt-5 pb-1 shrink-0">
          <ProgressBar value={progressValue()} />
          {athleteName && step !== 'done' && (
            <p className="text-xs text-muted-foreground mt-2">
              Daily check-in · {athleteName.split(' ')[0]}
            </p>
          )}
        </div>

        {/* Step content */}
        <div className="flex flex-col flex-1 overflow-hidden px-5 pb-5 min-h-0">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
