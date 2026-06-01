import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, X, CheckCircle2 } from 'lucide-react';
import {
  FRONT_REGIONS,
  BACK_REGIONS,
  nrsSeverityColor,
  getRegionLabel,
  type SvgRegion,
} from '@/lib/bodyMapData';
import type { PainArea, IllnessType, IllnessSeverity, DailyCheckinInput } from '@/hooks/useDailyCheckin';

// ── Base64 body images (reused from OSTRC study body map) ─────────────────────
// Stored in /public to keep component size manageable
const FRONT_IMG = '/bodymap-front.png';
const BACK_IMG  = '/bodymap-back.png';

// ── McLean scale data ─────────────────────────────────────────────────────────

interface WellnessItem {
  key: keyof WellnessState;
  label: string;
  anchors: [string, string, string, string, string]; // 1→5
}

interface WellnessState {
  fatigue: number | null;
  sleep: number | null;
  soreness: number | null;
  stress: number | null;
  mood: number | null;
}

const WELLNESS_ITEMS: WellnessItem[] = [
  {
    key: 'fatigue',
    label: 'Fatigue',
    anchors: ['Always tired', 'More tired than normal', 'Normal', 'Fresh', 'Very fresh'],
  },
  {
    key: 'sleep',
    label: 'Sleep Quality',
    anchors: ['Insomnia', 'Restless sleep', 'Difficulty falling asleep', 'Good', 'Very restful'],
  },
  {
    key: 'soreness',
    label: 'Muscle Soreness',
    anchors: ['Very sore', 'Increase in soreness/tightness', 'Normal', 'Feeling good', 'Feeling great'],
  },
  {
    key: 'stress',
    label: 'Stress',
    anchors: ['Highly stressed', 'Feeling stressed', 'Normal', 'Relaxed', 'Very relaxed'],
  },
  {
    key: 'mood',
    label: 'Mood',
    anchors: [
      'Highly annoyed/irritable/down',
      'Snappiness at team-mates, family & co-workers',
      'Less interested in others/activities than usual',
      'Generally good mood',
      'Very positive mood',
    ],
  },
];

// ── Wellness score color ──────────────────────────────────────────────────────

function wellnessColor(v: number): string {
  if (v <= 2) return 'bg-red-500 text-white border-red-500';
  if (v === 3) return 'bg-amber-400 text-white border-amber-400';
  return 'bg-green-500 text-white border-green-500';
}

// ── Body map component ────────────────────────────────────────────────────────

interface BodyMapProps {
  selected: Map<number, number>; // areaId → NRS severity
  onToggle: (areaId: number, label: string) => void;
}

function BodyMapView({
  regions,
  imgSrc,
  imgW,
  imgH,
  viewBox,
  label,
  selected,
  onToggle,
}: {
  regions: SvgRegion[];
  imgSrc: string;
  imgW: number;
  imgH: number;
  viewBox: string;
  label: string;
  selected: Map<number, number>;
  onToggle: (areaId: number, areaLabel: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="relative inline-block">
        <img src={imgSrc} width={imgW} height={imgH} alt={`${label} body view`} className="block" />
        <svg
          width={imgW}
          height={imgH}
          viewBox={viewBox}
          className="absolute top-0 left-0"
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
                stroke={isSelected ? nrsSeverityColor(nrs).replace('0.55','0.9').replace('0.60','0.9').replace('0.65','0.9') : 'rgba(70,130,200,0)'}
                strokeWidth={isSelected ? 1.5 : 0.5}
                className="cursor-pointer transition-all duration-100 hover:fill-[rgba(70,130,200,0.28)] hover:stroke-[rgba(40,100,180,0.7)]"
                style={{ fill: isSelected ? nrsSeverityColor(nrs) : undefined }}
                onClick={() => onToggle(r.areaId, getRegionLabel(r.areaId))}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── NRS Slider ────────────────────────────────────────────────────────────────

function NrsSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const levels = Array.from({ length: 11 }, (_, i) => i);
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-[10px] text-muted-foreground">No pain</span>
        <span className="text-[10px] text-muted-foreground">Worst imaginable</span>
      </div>
      <div className="flex gap-1">
        {levels.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 h-8 rounded text-xs font-medium border transition-colors',
              value === n
                ? n === 0
                  ? 'bg-green-500 text-white border-green-500'
                  : n <= 3
                  ? 'bg-yellow-400 text-white border-yellow-400'
                  : n <= 6
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-red-600 text-white border-red-600'
                : 'bg-background border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Step = 'wellness' | 'pain_illness' | 'pain_detail' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: DailyCheckinInput) => Promise<boolean>;
  athleteName?: string;
}

export function DailyCheckinSheet({ open, onClose, onSave, athleteName }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // Step
  const [step, setStep] = useState<Step>('wellness');

  // Wellness
  const [wellness, setWellness] = useState<WellnessState>({
    fatigue: null, sleep: null, soreness: null, stress: null, mood: null,
  });

  // Pain / illness
  const [hasPain, setHasPain]       = useState<boolean | null>(null);
  const [hasIllness, setHasIllness] = useState<boolean | null>(null);

  // Pain areas: areaId → nrs
  const [painMap, setPainMap] = useState<Map<number, number>>(new Map());
  // Active area being edited in detail step
  const [activeArea, setActiveArea] = useState<{ id: number; label: string } | null>(null);

  // Illness
  const [illnessType, setIllnessType]             = useState<IllnessType | null>(null);
  const [illnessTypeOther, setIllnessTypeOther]   = useState('');
  const [illnessSeverity, setIllnessSeverity]     = useState<IllnessSeverity | null>(null);

  const [saving, setSaving] = useState(false);

  // Reset on open
  const prevOpen = useRef(false);
  if (open && !prevOpen.current) {
    prevOpen.current = true;
    setStep('wellness');
    setWellness({ fatigue: null, sleep: null, soreness: null, stress: null, mood: null });
    setHasPain(null);
    setHasIllness(null);
    setPainMap(new Map());
    setActiveArea(null);
    setIllnessType(null);
    setIllnessTypeOther('');
    setIllnessSeverity(null);
    setSaving(false);
  }
  if (!open) prevOpen.current = false;

  // Wellness complete when all 5 items selected
  const wellnessComplete = Object.values(wellness).every((v) => v !== null);

  function handleWellnessSelect(key: keyof WellnessState, val: number) {
    setWellness((prev) => ({ ...prev, [key]: val }));
  }

  function handleBodyToggle(areaId: number, label: string) {
    setPainMap((prev) => {
      const next = new Map(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.set(areaId, 0); // default NRS = 0 until they rate it
        setActiveArea({ id: areaId, label });
        setStep('pain_detail');
      }
      return next;
    });
  }

  function handleNrsChange(areaId: number, nrs: number) {
    setPainMap((prev) => {
      const next = new Map(prev);
      next.set(areaId, nrs);
      return next;
    });
  }

  async function handleSave() {
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
        areaId,
        areaLabel: getRegionLabel(areaId),
        severity,
      })),
      hasIllness: hasIllness === true,
      illnessType: hasIllness ? illnessType : null,
      illnessTypeOther: hasIllness && illnessType === 'other' ? illnessTypeOther : null,
      illnessSeverity: hasIllness ? illnessSeverity : null,
    };
    const ok = await onSave(input);
    setSaving(false);
    if (ok) setStep('done');
  }

  // ── Step: Wellness ───────────────────────────────────────────────────────

  if (step === 'wellness') {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 rounded-t-2xl max-h-[92vh] overflow-y-auto pb-safe"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-lg">
              Good {getTimeOfDay()}{athleteName ? `, ${athleteName.split(' ')[0]}` : ''}! 👋
            </SheetTitle>
            <p className="text-sm text-muted-foreground">Quick daily check-in — how are you feeling?</p>
          </SheetHeader>

          <div className="space-y-5 pt-2 pb-4">
            {WELLNESS_ITEMS.map((item) => (
              <div key={item.key}>
                <p className="text-sm font-semibold mb-2">{item.label}</p>
                <div className="flex gap-1.5">
                  {([1, 2, 3, 4, 5] as const).map((val) => (
                    <button
                      key={val}
                      onClick={() => handleWellnessSelect(item.key, val)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-center transition-all',
                        wellness[item.key] === val
                          ? wellnessColor(val)
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      <span className="text-sm font-bold">{val}</span>
                      <span className="text-[9px] leading-tight">{item.anchors[val - 1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2 pb-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Skip
            </Button>
            <Button
              className="flex-1"
              disabled={!wellnessComplete}
              onClick={() => setStep('pain_illness')}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Step: Pain / Illness ─────────────────────────────────────────────────

  if (step === 'pain_illness') {
    const canProceed = hasPain !== null && hasIllness !== null;
    const needsIllnessDetail = hasIllness === true;
    const illnessDetailComplete = !needsIllnessDetail || (illnessType !== null && illnessSeverity !== null);

    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 rounded-t-2xl max-h-[92vh] overflow-y-auto pb-safe"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-lg">Any health issues today?</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 py-3">
            {/* Pain */}
            <div>
              <p className="text-sm font-semibold mb-2">Do you have any pain or discomfort?</p>
              <div className="flex gap-3">
                {(['yes', 'no'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setHasPain(opt === 'yes')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all',
                      (hasPain === true && opt === 'yes') || (hasPain === false && opt === 'no')
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/40'
                    )}
                  >
                    {opt === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>

              {/* Body map */}
              {hasPain === true && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Tap the area(s) where you feel pain. Tap again to deselect.
                  </p>
                  <div className="flex justify-center gap-6">
                    <BodyMapView
                      regions={FRONT_REGIONS}
                      imgSrc={FRONT_IMG}
                      imgW={120} imgH={191}
                      viewBox="0 0 193 306"
                      label="Front"
                      selected={painMap}
                      onToggle={handleBodyToggle}
                    />
                    <BodyMapView
                      regions={BACK_REGIONS}
                      imgSrc={BACK_IMG}
                      imgW={131} imgH={197}
                      viewBox="0 0 211 317"
                      label="Back"
                      selected={painMap}
                      onToggle={handleBodyToggle}
                    />
                  </div>
                  {/* Selected areas summary */}
                  {painMap.size > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Selected areas
                      </p>
                      {Array.from(painMap.entries()).map(([areaId, nrs]) => (
                        <div key={areaId} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: nrs === 0 ? '#94a3b8' : nrs <= 3 ? '#eab308' : nrs <= 6 ? '#f97316' : '#dc2626' }}
                          />
                          <span className="text-sm flex-1">{getRegionLabel(areaId)}</span>
                          <button
                            className="text-xs text-primary underline"
                            onClick={() => { setActiveArea({ id: areaId, label: getRegionLabel(areaId) }); setStep('pain_detail'); }}
                          >
                            {nrs === 0 ? 'Rate pain' : `NRS ${nrs}`}
                          </button>
                          <button
                            onClick={() => setPainMap((p) => { const n = new Map(p); n.delete(areaId); return n; })}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Illness */}
            <div>
              <p className="text-sm font-semibold mb-2">Are you feeling ill?</p>
              <div className="flex gap-3">
                {(['yes', 'no'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setHasIllness(opt === 'yes')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all',
                      (hasIllness === true && opt === 'yes') || (hasIllness === false && opt === 'no')
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/40'
                    )}
                  >
                    {opt === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>

              {hasIllness === true && (
                <div className="mt-4 space-y-4">
                  {/* Type */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Type</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { value: 'cold_flu', label: '🤧 Cold / Flu' },
                          { value: 'stomach',  label: '🤢 Stomach' },
                          { value: 'fever',    label: '🌡️ Fever' },
                          { value: 'other',    label: '❓ Other' },
                        ] as { value: IllnessType; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setIllnessType(opt.value)}
                          className={cn(
                            'py-2.5 rounded-lg border text-sm font-medium transition-all',
                            illnessType === opt.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border bg-background text-foreground hover:border-primary/40'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {illnessType === 'other' && (
                      <input
                        className="mt-2 w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Please describe…"
                        value={illnessTypeOther}
                        onChange={(e) => setIllnessTypeOther(e.target.value)}
                        maxLength={100}
                      />
                    )}
                  </div>
                  {/* Severity */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Severity</p>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: 'mild',     label: 'Mild',     desc: 'Can train normally' },
                          { value: 'moderate', label: 'Moderate', desc: 'Need to modify training' },
                          { value: 'severe',   label: 'Severe',   desc: 'Cannot train' },
                        ] as { value: IllnessSeverity; label: string; desc: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setIllnessSeverity(opt.value)}
                          className={cn(
                            'flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-lg border text-center transition-all',
                            illnessSeverity === opt.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border bg-background text-foreground hover:border-primary/40'
                          )}
                        >
                          <span className="text-sm font-semibold">{opt.label}</span>
                          <span className="text-[9px] leading-tight opacity-80">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pb-4">
            <Button variant="outline" className="flex-1" onClick={() => setStep('wellness')}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!canProceed || !illnessDetailComplete || saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Done'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Step: Pain detail (NRS for a selected area) ──────────────────────────

  if (step === 'pain_detail' && activeArea) {
    const currentNrs = painMap.get(activeArea.id) ?? 0;
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 rounded-t-2xl pb-safe"
        >
          <SheetHeader className="pb-3">
            <SheetTitle className="text-lg">Rate: {activeArea.label}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              How severe is the pain / discomfort right now?
            </p>
          </SheetHeader>

          <div className="py-4">
            <NrsSlider
              value={currentNrs}
              onChange={(v) => handleNrsChange(activeArea.id, v)}
            />
            <p className="text-center text-sm text-muted-foreground mt-3">
              {currentNrs === 0
                ? 'No pain'
                : currentNrs <= 3
                ? `Mild (${currentNrs}/10)`
                : currentNrs <= 6
                ? `Moderate (${currentNrs}/10)`
                : `Severe (${currentNrs}/10)`}
            </p>
          </div>

          <div className="pb-4">
            <Button
              className="w-full"
              onClick={() => setStep('pain_illness')}
            >
              Confirm
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Step: Done ───────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 rounded-t-2xl pb-safe"
      >
        <div className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2 className="h-14 w-14 text-green-500" />
          <div className="text-center">
            <p className="text-xl font-bold">All done!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check-in saved. Have a great training day 💪
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
