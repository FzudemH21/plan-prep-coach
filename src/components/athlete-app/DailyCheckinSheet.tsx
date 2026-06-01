import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, CheckCircle2, X } from 'lucide-react';
import {
  FRONT_REGIONS,
  BACK_REGIONS,
  nrsSeverityColor,
  getRegionLabel,
} from '@/lib/bodyMapData';
import type { PainArea, DailyCheckinInput } from '@/hooks/useDailyCheckin';

// ── Body map images ───────────────────────────────────────────────────────────
const FRONT_IMG = '/bodymap-front.png';
const BACK_IMG  = '/bodymap-back.png';

// ── McLean scale ──────────────────────────────────────────────────────────────

interface WellnessItem {
  key: WellnessKey;
  label: string;
  anchors: [string, string, string, string, string]; // index = value-1
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
    anchors: ['Very sore', 'Increase in soreness / tightness', 'Normal', 'Feeling good', 'Feeling great'],
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
      'Highly annoyed / irritable / down',
      'Snappiness at team-mates, family & co-workers',
      'Less interested in others / activities than usual',
      'Generally good mood',
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

// ── OSTRC-H illness symptom list ──────────────────────────────────────────────

interface IllnessSymptom {
  id: string;
  label: string;
  isOther?: boolean;
}

const ILLNESS_SYMPTOMS: IllnessSymptom[] = [
  { id: 'fever',           label: 'Fever' },
  { id: 'fatigue',         label: 'Fatigue / feeling unwell' },
  { id: 'lymph_nodes',     label: 'Swollen lymph nodes' },
  { id: 'sore_throat',     label: 'Sore throat' },
  { id: 'blocked_nose',    label: 'Blocked nose / runny nose / sneezing' },
  { id: 'cough',           label: 'Cough' },
  { id: 'breathing',       label: 'Breathing difficulties / shortness of breath' },
  { id: 'headache',        label: 'Headache' },
  { id: 'nausea',          label: 'Nausea' },
  { id: 'vomiting',        label: 'Vomiting' },
  { id: 'diarrhoea',       label: 'Diarrhoea' },
  { id: 'constipation',    label: 'Constipation' },
  { id: 'fainting',        label: 'Fainting / loss of consciousness' },
  { id: 'rash',            label: 'Rash / itching' },
  { id: 'arrhythmia',      label: 'Irregular pulse / arrhythmia' },
  { id: 'chest_pain',      label: 'Chest pressure / tightness / chest pain' },
  { id: 'abdominal_pain',  label: 'Abdominal pain' },
  { id: 'numbness',        label: 'Numbness / tingling' },
  { id: 'anxiety',         label: 'Nervousness / restlessness / anxiety' },
  { id: 'low_mood',        label: 'Sadness / low mood' },
  { id: 'irritability',    label: 'Irritability' },
  { id: 'eye_problems',    label: 'Eye problems' },
  { id: 'ear_problems',    label: 'Ear problems' },
  { id: 'urinary',         label: 'Urinary tract symptoms' },
  { id: 'genital',         label: 'Genital symptoms' },
  { id: 'other',           label: 'Other symptoms / pain', isOther: true },
];

// ── NRS button strip ──────────────────────────────────────────────────────────

function NrsStrip({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] text-muted-foreground px-0.5">
        <span>No pain / symptoms</span>
        <span>Worst imaginable</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 h-10 rounded-lg text-sm font-semibold border transition-all active:scale-95',
              value === n
                ? n === 0
                  ? 'bg-green-500 border-green-500 text-white'
                  : n <= 3
                  ? 'bg-yellow-400 border-yellow-400 text-white'
                  : n <= 6
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-red-600 border-red-600 text-white'
                : 'bg-background border-border text-muted-foreground'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {value === 0 ? 'None'
          : value <= 3 ? `Mild (${value}/10)`
          : value <= 6 ? `Moderate (${value}/10)`
          : `Severe (${value}/10)`}
      </p>
    </div>
  );
}

// ── Body map (single view, fills container) ───────────────────────────────────

type BodySide = 'front' | 'back';

function BodyMap({
  selected,
  onToggle,
}: {
  selected: Map<number, number>;
  onToggle: (areaId: number) => void;
}) {
  const [side, setSide] = useState<BodySide>('front');
  const regions = side === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  const imgSrc  = side === 'front' ? FRONT_IMG : BACK_IMG;
  const viewBox = side === 'front' ? '0 0 193 306' : '0 0 211 317';

  return (
    <div className="space-y-3">
      {/* Front / Back tabs */}
      <div className="flex bg-muted rounded-lg p-1 gap-1">
        {(['front', 'back'] as BodySide[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              'flex-1 py-1.5 rounded-md text-sm font-medium transition-all',
              side === s
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            )}
          >
            {s === 'front' ? 'Front' : 'Back'}
          </button>
        ))}
      </div>

      {/* Body image + SVG overlay */}
      <div className="flex justify-center">
        <div className="relative" style={{ display: 'inline-block', width: '100%', maxWidth: 280 }}>
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
            {regions.map((r) => {
              const nrs = selected.get(r.areaId) ?? 0;
              const isSelected = selected.has(r.areaId);
              return (
                <rect
                  key={r.uid}
                  x={r.x} y={r.y} width={r.w} height={r.h}
                  rx={3}
                  fill={isSelected ? nrsSeverityColor(nrs) : 'rgba(70,130,200,0)'}
                  stroke={isSelected ? 'rgba(30,80,180,0.7)' : 'rgba(70,130,200,0)'}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
                  className="hover:fill-[rgba(70,130,200,0.25)]"
                  onClick={() => onToggle(r.areaId)}
                />
              );
            })}
          </svg>
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Tap an area to select it. Tap again to deselect.
      </p>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  // value 0–1
  return (
    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-300"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Step =
  | 'wellness'
  | 'health_q'
  | 'body_map'
  | 'pain_nrs'
  | 'illness_symptoms'
  | 'illness_nrs'
  | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: DailyCheckinInput) => Promise<boolean>;
  athleteName?: string;
}

export function DailyCheckinSheet({ open, onClose, onSave, athleteName }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [step, setStep]                   = useState<Step>('wellness');
  const [wellnessIdx, setWellnessIdx]     = useState(0);
  const [wellness, setWellness]           = useState<Record<WellnessKey, number | null>>({
    fatigue: null, sleep: null, soreness: null, stress: null, mood: null,
  });

  const [hasPain, setHasPain]             = useState<boolean | null>(null);
  const [hasIllness, setHasIllness]       = useState<boolean | null>(null);

  // Pain
  const [painMap, setPainMap]             = useState<Map<number, number>>(new Map());
  const [nrsAreaList, setNrsAreaList]     = useState<number[]>([]); // ordered area IDs for NRS flow
  const [nrsIdx, setNrsIdx]               = useState(0);

  // Illness
  const [illnessSymptoms, setIllnessSymptoms] = useState<Set<string>>(new Set());
  const [illnessOther, setIllnessOther]       = useState('');
  const [illnessNrs, setIllnessNrs]           = useState(0);

  const [saving, setSaving] = useState(false);

  // Reset on open
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) {
    wasOpen.current = true;
    setStep('wellness');
    setWellnessIdx(0);
    setWellness({ fatigue: null, sleep: null, soreness: null, stress: null, mood: null });
    setHasPain(null);
    setHasIllness(null);
    setPainMap(new Map());
    setNrsAreaList([]);
    setNrsIdx(0);
    setIllnessSymptoms(new Set());
    setIllnessOther('');
    setIllnessNrs(0);
    setSaving(false);
  }
  if (!open) wasOpen.current = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const currentWellnessItem = WELLNESS_ITEMS[wellnessIdx];
  const currentWellnessVal  = wellness[currentWellnessItem?.key];

  function selectWellness(val: number) {
    const key = currentWellnessItem.key;
    setWellness((prev) => ({ ...prev, [key]: val }));
  }

  function nextWellness() {
    if (wellnessIdx < WELLNESS_ITEMS.length - 1) {
      setWellnessIdx((i) => i + 1);
    } else {
      setStep('health_q');
    }
  }

  function prevWellness() {
    if (wellnessIdx > 0) setWellnessIdx((i) => i - 1);
  }

  function handleBodyToggle(areaId: number) {
    setPainMap((prev) => {
      const next = new Map(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.set(areaId, 5); // default NRS = 5 until they rate it
      }
      return next;
    });
  }

  function startPainNrs() {
    const areas = Array.from(painMap.keys());
    setNrsAreaList(areas);
    setNrsIdx(0);
    setStep('pain_nrs');
  }

  function handleNrsChange(nrs: number) {
    const areaId = nrsAreaList[nrsIdx];
    setPainMap((prev) => { const n = new Map(prev); n.set(areaId, nrs); return n; });
  }

  function nextNrs() {
    if (nrsIdx < nrsAreaList.length - 1) {
      setNrsIdx((i) => i + 1);
    } else {
      // Pain NRS done — go to illness if needed, else save
      if (hasIllness) {
        setStep('illness_symptoms');
      } else {
        doSave();
      }
    }
  }

  function toggleIllnessSymptom(id: string) {
    setIllnessSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function doSave() {
    setSaving(true);
    const input: DailyCheckinInput = {
      date: today,
      wellnessFatigue: wellness.fatigue,
      wellnessSleep: wellness.sleep,
      wellnessSoreness: wellness.soreness,
      wellnessStress: wellness.stress,
      wellnessMood: wellness.mood,
      hasPain: hasPain === true && painMap.size > 0,
      painAreas: Array.from(painMap.entries()).map(([areaId, severity]) => ({
        areaId, areaLabel: getRegionLabel(areaId), severity,
      })),
      hasIllness: hasIllness === true,
      illnessSymptoms: Array.from(illnessSymptoms),
      illnessSymptomOther: illnessSymptoms.has('other') ? illnessOther : '',
      illnessNrs: hasIllness ? illnessNrs : null,
    };
    const ok = await onSave(input);
    setSaving(false);
    if (ok) setStep('done');
  }

  // ── Progress calculation ───────────────────────────────────────────────────

  function progressValue(): number {
    const totalSteps = 5 + 1 + (hasPain ? 1 : 0) + (hasIllness ? 1 : 0); // rough estimate
    if (step === 'wellness') return wellnessIdx / totalSteps;
    if (step === 'health_q') return 5 / totalSteps;
    if (step === 'body_map') return 6 / totalSteps;
    if (step === 'pain_nrs') return (6 + nrsIdx + 1) / (totalSteps + nrsAreaList.length);
    if (step === 'illness_symptoms') return 0.85;
    if (step === 'illness_nrs') return 0.92;
    return 1;
  }

  // ── Sheet wrapper ──────────────────────────────────────────────────────────

  function Wrapper({ children, title, subtitle }: {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
  }) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 rounded-t-2xl max-h-[92vh] flex flex-col"
        >
          <div className="px-1 pt-1 pb-3 shrink-0">
            <ProgressBar value={progressValue()} />
          </div>
          {(title || subtitle) && (
            <SheetHeader className="shrink-0 pb-1">
              {title   && <SheetTitle className="text-lg leading-snug">{title}</SheetTitle>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </SheetHeader>
          )}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── STEP: Wellness (one question at a time) ────────────────────────────────

  if (step === 'wellness') {
    const item = currentWellnessItem;
    return (
      <Wrapper
        title={item.label}
        subtitle={`Question ${wellnessIdx + 1} of ${WELLNESS_ITEMS.length}`}
      >
        <div className="px-1 py-3 space-y-2.5">
          {([5, 4, 3, 2, 1] as const).map((val) => (
            <button
              key={val}
              onClick={() => selectWellness(val)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all active:scale-[0.98]',
                wellness[item.key] === val
                  ? WELLNESS_COLORS[val]
                  : 'border-border bg-background hover:border-primary/40'
              )}
            >
              <span className={cn(
                'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0',
                wellness[item.key] === val ? 'border-white/60 text-white' : 'border-border text-muted-foreground'
              )}>
                {val}
              </span>
              <span className={cn(
                'text-sm font-medium leading-snug',
                wellness[item.key] === val ? 'text-white' : 'text-foreground'
              )}>
                {item.anchors[val - 1]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-3 px-1 py-4 shrink-0">
          {wellnessIdx > 0 && (
            <Button variant="outline" className="flex-1" onClick={prevWellness}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {wellnessIdx === 0 && (
            <Button variant="outline" className="flex-1" onClick={onClose}>Skip</Button>
          )}
          <Button
            className="flex-1"
            disabled={currentWellnessVal === null}
            onClick={nextWellness}
          >
            {wellnessIdx < WELLNESS_ITEMS.length - 1 ? (
              <>Next <ChevronRight className="h-4 w-4 ml-1" /></>
            ) : (
              <>Continue <ChevronRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ── STEP: Health question ──────────────────────────────────────────────────

  if (step === 'health_q') {
    const canContinue = hasPain !== null && hasIllness !== null;

    return (
      <Wrapper
        title="Any health issues today?"
        subtitle="Pain, illness, or both — or neither."
      >
        <div className="px-1 py-4 space-y-5">
          {/* Pain */}
          <div>
            <p className="text-sm font-semibold mb-2">Do you have any pain or discomfort?</p>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => setHasPain(val)}
                  className={cn(
                    'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all active:scale-[0.98]',
                    hasPain === val
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/40'
                  )}
                >
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* Illness */}
          <div>
            <p className="text-sm font-semibold mb-2">Are you feeling ill?</p>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => setHasIllness(val)}
                  className={cn(
                    'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all active:scale-[0.98]',
                    hasIllness === val
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/40'
                  )}
                >
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-1 py-4">
          <Button variant="outline" className="flex-1"
            onClick={() => { setStep('wellness'); setWellnessIdx(4); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={!canContinue}
            onClick={() => {
              if (hasPain) setStep('body_map');
              else if (hasIllness) setStep('illness_symptoms');
              else doSave();
            }}
          >
            {hasPain === false && hasIllness === false ? 'Finish' : 'Continue'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ── STEP: Body map ─────────────────────────────────────────────────────────

  if (step === 'body_map') {
    return (
      <Wrapper
        title="Where do you feel pain?"
        subtitle="Select all affected areas."
      >
        <div className="px-1 py-3">
          <BodyMap selected={painMap} onToggle={handleBodyToggle} />

          {/* Selected areas summary */}
          {painMap.size > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Selected ({painMap.size})
              </p>
              {Array.from(painMap.keys()).map((areaId) => (
                <div key={areaId}
                  className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-primary/60" />
                  <span className="text-sm flex-1">{getRegionLabel(areaId)}</span>
                  <button onClick={() => setPainMap((p) => {
                    const n = new Map(p); n.delete(areaId); return n;
                  })}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-1 py-4">
          <Button variant="outline" className="flex-1" onClick={() => setStep('health_q')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={painMap.size === 0}
            onClick={startPainNrs}
          >
            Rate pain <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ── STEP: Pain NRS per area ────────────────────────────────────────────────

  if (step === 'pain_nrs') {
    const areaId = nrsAreaList[nrsIdx];
    const currentNrs = painMap.get(areaId) ?? 5;
    const isLast = nrsIdx === nrsAreaList.length - 1;

    return (
      <Wrapper
        title={getRegionLabel(areaId)}
        subtitle={`Area ${nrsIdx + 1} of ${nrsAreaList.length} — How severe is the pain right now?`}
      >
        <div className="px-1 py-6">
          <NrsStrip value={currentNrs} onChange={handleNrsChange} />
        </div>

        <div className="flex gap-3 px-1 py-4">
          <Button variant="outline" className="flex-1"
            onClick={() => nrsIdx > 0 ? setNrsIdx((i) => i - 1) : setStep('body_map')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button className="flex-1" onClick={nextNrs}>
            {isLast
              ? (hasIllness ? 'Next: Illness' : saving ? 'Saving…' : 'Finish')
              : 'Next area'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ── STEP: Illness symptoms ─────────────────────────────────────────────────

  if (step === 'illness_symptoms') {
    const canContinue = illnessSymptoms.size > 0;

    return (
      <Wrapper
        title="Which symptoms do you have?"
        subtitle="Select all that apply."
      >
        <div className="px-1 py-3 space-y-1.5">
          {ILLNESS_SYMPTOMS.map((sym) => (
            <div key={sym.id}>
              <button
                onClick={() => toggleIllnessSymptom(sym.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98]',
                  illnessSymptoms.has(sym.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border bg-background hover:border-primary/40'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                  illnessSymptoms.has(sym.id)
                    ? 'bg-white/20 border-white/60'
                    : 'border-border'
                )}>
                  {illnessSymptoms.has(sym.id) && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                <span className={cn(
                  'text-sm font-medium',
                  illnessSymptoms.has(sym.id) ? 'text-white' : 'text-foreground'
                )}>
                  {sym.label}
                </span>
              </button>

              {/* Free text for "other" */}
              {sym.isOther && illnessSymptoms.has('other') && (
                <input
                  className="mt-1.5 w-full text-sm border border-border rounded-xl px-4 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Please describe…"
                  value={illnessOther}
                  onChange={(e) => setIllnessOther(e.target.value)}
                  maxLength={200}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 px-1 py-4">
          <Button variant="outline" className="flex-1"
            onClick={() => hasPain ? setStep('pain_nrs') : setStep('health_q')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={!canContinue}
            onClick={() => setStep('illness_nrs')}
          >
            Rate severity <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ── STEP: Illness NRS ──────────────────────────────────────────────────────

  if (step === 'illness_nrs') {
    return (
      <Wrapper
        title="How severe are your symptoms?"
        subtitle="Overall illness severity right now."
      >
        <div className="px-1 py-6">
          <NrsStrip value={illnessNrs} onChange={setIllnessNrs} />
        </div>

        <div className="flex gap-3 px-1 py-4">
          <Button variant="outline" className="flex-1"
            onClick={() => setStep('illness_symptoms')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button className="flex-1" disabled={saving} onClick={doSave}>
            {saving ? 'Saving…' : 'Finish'}
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ── STEP: Done ─────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 rounded-t-2xl pb-safe"
      >
        <div className="flex flex-col items-center gap-4 py-12 px-4">
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
      </SheetContent>
    </Sheet>
  );
}
