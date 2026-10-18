/**
 * Inputs (and read-only views) for the structured anamnesis question types — used by the public
 * form link (size "lg", German or English) and the coach's anamnesis record (size "sm", English):
 * multiple choice, scale, yes/no list, repeatable list, body map, weekly schedule grid.
 * Values are the stored text of the answer (JSON for the structured types, see anamnesisAnswers).
 */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Eraser, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  BACK_REGIONS, FRONT_REGIONS, nrsSeverityColor, nrsSeverityStroke, svgRegionKey,
} from '@/lib/bodyMapData';
import type { AnamnesisField, AnamnesisListColumn } from '@/types/anamnesis';
import {
  DAY_LABELS, WEEK_GRID_COLORS, WEEK_GRID_HOURS, WEEK_GRID_LABELS,
  formatAnswer, parseBodyMap, parseDateRanges, parseList, parseMulti, parseWeekGrid, parseYesNoList, regionLabel,
  type AnswerLang, type BodyMapSpot, type DatePeriod, type ListRow, type WeekGridCell,
} from '@/utils/anamnesisAnswers';

type Size = 'sm' | 'lg';

const T = {
  de: {
    yes: 'Ja', no: 'Nein', addRow: 'Weitere hinzufügen', removeRow: 'Entfernen',
    front: 'Vorne', back: 'Hinten', tapBody: 'Tippe auf die Stelle am Körper.',
    whatHappened: 'Was ist passiert / wie fühlt es sich an?', pain: 'Schmerz (0 = kein, 10 = stärkster vorstellbarer)',
    add: 'Übernehmen', save: 'Speichern', remove: 'Entfernen', cancel: 'Abbrechen',
    gridHint: 'Feld antippen zum Eintragen – gedrückt halten und ziehen, um mehrere Felder zu füllen.',
    erase: 'Löschen',
  },
  en: {
    yes: 'Yes', no: 'No', addRow: 'Add another', removeRow: 'Remove',
    front: 'Front', back: 'Back', tapBody: 'Tap the spot on the body.',
    whatHappened: 'What happened / how does it feel?', pain: 'Pain (0 = none, 10 = worst imaginable)',
    add: 'Add', save: 'Save', remove: 'Remove', cancel: 'Cancel',
    gridHint: 'Tap a slot to fill it in — press, hold and drag to fill several.',
    erase: 'Erase',
  },
} as const;

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Multiple choice ───────────────────────────────────────────────────────────

export function MultiChoiceInput({ options, value, onChange, size = 'sm' }: {
  options: string[]; value: string; onChange: (v: string) => void; size?: Size;
}) {
  const picked = parseMulti(value);
  const toggle = (o: string) => {
    const next = picked.includes(o) ? picked.filter(p => p !== o) : [...picked, o];
    onChange(next.length ? JSON.stringify(options.filter(x => next.includes(x))) : '');
  };
  return (
    <div className={size === 'lg' ? 'space-y-2' : 'flex flex-wrap gap-1.5'}>
      {options.map(o => {
        const on = picked.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={cn(
              'flex items-center gap-2 border text-left transition-colors',
              size === 'lg' ? 'w-full min-h-[52px] rounded-lg border-2 px-3 py-2.5 text-base gap-3' : 'rounded-md px-2.5 py-1 text-sm',
              on ? 'border-primary bg-primary/10' : 'border-input bg-background hover:bg-accent active:bg-accent',
            )}
          >
            <span className={cn(
              'shrink-0 rounded border flex items-center justify-center',
              size === 'lg' ? 'w-6 h-6' : 'w-4 h-4',
              on ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40',
            )}>
              {on && <Check className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />}
            </span>
            <span className="flex-1 min-w-0">{o}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Scale ─────────────────────────────────────────────────────────────────────

export function ScaleInput({ field, value, onChange, size = 'sm' }: {
  field: AnamnesisField; value: string; onChange: (v: string) => void; size?: Size;
}) {
  const min = field.scaleMin ?? 0;
  const max = Math.max(min + 1, field.scaleMax ?? 10);
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="space-y-1.5">
      <div className={cn(size === 'lg' ? 'grid grid-cols-6 gap-2' : 'flex flex-wrap gap-1')}>
        {steps.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === String(n) ? '' : String(n))}
            className={cn(
              'border font-medium tabular-nums transition-colors',
              size === 'lg' ? 'h-12 rounded-lg border-2 text-lg' : 'h-8 w-8 rounded-md text-sm',
              value === String(n) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-accent active:bg-accent',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {(field.scaleMinLabel || field.scaleMaxLabel) && (
        <div className={cn('flex justify-between gap-4 text-muted-foreground', size === 'lg' ? 'text-sm' : 'text-xs')}>
          <span>{min} = {field.scaleMinLabel}</span>
          {field.scaleMaxLabel && <span className="text-right">{max} = {field.scaleMaxLabel}</span>}
        </div>
      )}
    </div>
  );
}

// ── Yes / no list ─────────────────────────────────────────────────────────────

export function YesNoListInput({ items, value, onChange, lang, size = 'sm', readOnly }: {
  items: string[]; value: string; onChange: (v: string) => void; lang: AnswerLang; size?: Size; readOnly?: boolean;
}) {
  const t = T[lang];
  const answers = parseYesNoList(value);
  const set = (item: string, a: 'yes' | 'no') => {
    const next = { ...answers };
    if (next[item] === a) delete next[item]; else next[item] = a;
    onChange(Object.keys(next).length ? JSON.stringify(next) : '');
  };
  return (
    <div className="divide-y rounded-lg border">
      {items.map(item => (
        <div key={item} className={cn('flex items-center gap-3', size === 'lg' ? 'px-3 py-2.5' : 'px-2.5 py-1.5')}>
          <span className={cn('flex-1 min-w-0', size === 'lg' ? 'text-base' : 'text-sm')}>{item}</span>
          {readOnly ? (
            <span className={cn('text-sm font-medium shrink-0', answers[item] === 'yes' ? 'text-red-600' : 'text-muted-foreground')}>
              {answers[item] === 'yes' ? t.yes : answers[item] === 'no' ? t.no : '—'}
            </span>
          ) : (
            <div className="flex gap-1.5 shrink-0">
              {(['yes', 'no'] as const).map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set(item, a)}
                  className={cn(
                    'border font-medium transition-colors',
                    size === 'lg' ? 'h-11 min-w-[56px] px-3 rounded-lg border-2 text-base' : 'h-7 px-2.5 rounded-md text-xs',
                    answers[item] === a ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-accent active:bg-accent',
                  )}
                >
                  {a === 'yes' ? t.yes : t.no}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Repeatable list ───────────────────────────────────────────────────────────

function ListCell({ column, value, onChange, size }: {
  column: AnamnesisListColumn; value: string; onChange: (v: string) => void; size: Size;
}) {
  const inputClass = size === 'lg' ? 'h-12 text-base' : 'h-8 text-sm';
  if (column.type === 'select') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {(column.options ?? []).map(o => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(value === o ? '' : o)}
            className={cn(
              'border transition-colors',
              size === 'lg' ? 'min-h-[44px] px-3 rounded-lg text-base' : 'h-7 px-2 rounded-md text-xs',
              value === o ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-accent active:bg-accent',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }
  return (
    <Input
      type={column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'text'}
      inputMode={column.type === 'number' ? 'decimal' : undefined}
      className={inputClass}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

export function ListInput({ columns, value, onChange, lang, size = 'sm', readOnly }: {
  columns: AnamnesisListColumn[]; value: string; onChange: (v: string) => void; lang: AnswerLang; size?: Size; readOnly?: boolean;
}) {
  const t = T[lang];
  const stored = parseList(value);
  const rows: ListRow[] = stored.length > 0 ? stored : [{}];
  const write = (next: ListRow[]) => {
    onChange(next.some(r => Object.values(r).some(v => v?.trim())) ? JSON.stringify(next) : '');
  };

  if (readOnly) {
    const filled = stored.filter(r => Object.values(r).some(v => v?.trim()));
    if (filled.length === 0) return <p className="text-sm text-muted-foreground italic">—</p>;
    return (
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              {columns.map(c => <th key={c.id} className="text-left font-medium px-2.5 py-1.5">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filled.map((r, i) => (
              <tr key={i} className="border-b last:border-0 align-top">
                {columns.map(c => (
                  <td key={c.id} className="px-2.5 py-1.5 whitespace-pre-wrap">
                    {c.type === 'date' && r[c.id] ? new Date(`${r[c.id]}T12:00:00`).toLocaleDateString('en-GB') : (r[c.id] || '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className={cn('rounded-lg border bg-muted/20 space-y-2', size === 'lg' ? 'p-3' : 'p-2')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{i + 1}.</span>
            {(rows.length > 1 || Object.values(row).some(v => v?.trim())) && (
              <button
                type="button"
                onClick={() => write(rows.filter((_, j) => j !== i))}
                className={cn('flex items-center gap-1 text-muted-foreground hover:text-destructive', size === 'lg' ? 'min-h-[36px] text-sm' : 'text-xs')}
              >
                <Trash2 className="h-3.5 w-3.5" />{t.removeRow}
              </button>
            )}
          </div>
          {columns.map(c => (
            <div key={c.id} className="space-y-1">
              <p className={cn('font-medium', size === 'lg' ? 'text-sm' : 'text-xs text-muted-foreground')}>{c.label}</p>
              <ListCell column={c} size={size} value={row[c.id] ?? ''}
                onChange={v => write(rows.map((r, j) => (j === i ? { ...r, [c.id]: v } : r)))} />
            </div>
          ))}
        </div>
      ))}
      <Button type="button" variant="outline" className={cn('gap-1.5', size === 'lg' ? 'h-12 w-full text-base' : 'h-8 text-xs')}
        onClick={() => write([...rows, {}])}>
        <Plus className="h-4 w-4" />{t.addRow}
      </Button>
    </div>
  );
}

// ── Body map ──────────────────────────────────────────────────────────────────

const BODY_IMG = { front: '/bodymap-front.png', back: '/bodymap-back.png' } as const;
const BODY_VIEWBOX = { front: { w: 193, h: 306 }, back: { w: 211, h: 317 } } as const;

function spotFill(spot: BodyMapSpot): { fill: string; stroke: string } {
  if (spot.nrs !== undefined && spot.nrs > 0) return { fill: nrsSeverityColor(spot.nrs), stroke: nrsSeverityStroke(spot.nrs) };
  return { fill: 'rgba(37,99,235,0.8)', stroke: 'rgba(30,64,175,0.95)' };
}

function BodyFigure({ view, spots, pending, onPick, onSpotClick, maxWidth }: {
  view: 'front' | 'back';
  spots: BodyMapSpot[];
  pending?: BodyMapSpot | null;
  onPick?: (spot: Omit<BodyMapSpot, 'id' | 'note'>) => void;
  onSpotClick?: (spot: BodyMapSpot) => void;
  maxWidth: number;
}) {
  const vb = BODY_VIEWBOX[view];
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  // Numbers run through both views (the list below uses the same numbers)
  const numbered = spots.map((s, i) => ({ s, n: i + 1 })).filter(x => x.s.view === view);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const ctm = e.currentTarget.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    // The exact point counts; the region is the (smallest) body region under it
    const hits = regions.filter(r => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h);
    if (hits.length === 0) return;
    const region = hits.sort((a, b) => a.w * a.h - b.w * b.h)[0];
    onPick({ view, x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10, region: svgRegionKey(region) });
  };

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth }}>
      <img src={BODY_IMG[view]} alt="" className="w-full h-auto block select-none" draggable={false} />
      <svg
        className={cn('absolute inset-0 w-full h-full', onPick && 'cursor-crosshair')}
        viewBox={`0 0 ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleClick}
      >
        {numbered.map(({ s, n }) => {
          const c = spotFill(s);
          return (
            <g key={s.id} style={{ cursor: onSpotClick ? 'pointer' : undefined }}
              onClick={onSpotClick ? (e) => { e.stopPropagation(); onSpotClick(s); } : undefined}>
              <circle cx={s.x} cy={s.y} r={6.5} fill={c.fill} stroke={c.stroke} strokeWidth={1.2} />
              <text x={s.x} y={s.y + 2.6} textAnchor="middle" fontSize="7" fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>{n}</text>
            </g>
          );
        })}
        {pending && pending.view === view && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={pending.x} cy={pending.y} r={8} fill="rgba(37,99,235,0.25)" stroke="rgba(30,64,175,0.95)" strokeWidth={1.2} strokeDasharray="3 2" />
            <circle cx={pending.x} cy={pending.y} r={2.5} fill="rgba(30,64,175,0.95)" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function BodyMapInput({ field, value, onChange, lang, size = 'sm', readOnly }: {
  field: AnamnesisField; value: string; onChange: (v: string) => void; lang: AnswerLang; size?: Size; readOnly?: boolean;
}) {
  const t = T[lang];
  const spots = parseBodyMap(value);
  const [view, setView] = useState<'front' | 'back'>('front');
  const [editing, setEditing] = useState<{ spot: BodyMapSpot; isNew: boolean } | null>(null);
  const write = (next: BodyMapSpot[]) => onChange(next.length ? JSON.stringify(next) : '');
  const sideLabel = (v: 'front' | 'back') => (v === 'front' ? t.front : t.back);

  const spotList = spots.length > 0 && (
    <ol className="space-y-1">
      {spots.map((s, i) => (
        <li key={s.id}>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => { setView(s.view); setEditing({ spot: s, isNew: false }); }}
            className={cn(
              'w-full text-left rounded-md flex gap-2',
              size === 'lg' ? 'px-2 py-2 text-base' : 'px-1.5 py-1 text-sm',
              !readOnly && 'hover:bg-accent active:bg-accent',
              editing?.spot.id === s.id && 'bg-accent',
            )}
          >
            <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center"
              style={{ backgroundColor: spotFill(s).stroke }}>{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className="font-medium">{regionLabel(s.region, lang)}</span>
              <span className="text-muted-foreground"> ({sideLabel(s.view)}){s.nrs !== undefined ? ` · ${s.nrs}/10` : ''}</span>
              {s.note.trim() && <span className="block text-muted-foreground whitespace-pre-wrap">{s.note}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );

  if (readOnly) {
    if (spots.length === 0) return <p className="text-sm text-muted-foreground italic">—</p>;
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 max-w-[360px]">
          {(['front', 'back'] as const).map(v => (
            <div key={v} className="space-y-1">
              <p className="text-xs text-muted-foreground text-center">{sideLabel(v)}</p>
              <BodyFigure view={v} spots={spots} maxWidth={170} />
            </div>
          ))}
        </div>
        {spotList}
      </div>
    );
  }

  const saveEditing = () => {
    if (!editing) return;
    const { spot, isNew } = editing;
    write(isNew ? [...spots, spot] : spots.map(s => (s.id === spot.id ? spot : s)));
    setEditing(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex bg-muted rounded-lg p-1 gap-1 max-w-[320px] mx-auto">
        {(['front', 'back'] as const).map(v => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={cn('flex-1 rounded-md font-medium transition-all', size === 'lg' ? 'py-2 text-base' : 'py-1 text-sm',
              view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>
            {sideLabel(v)}
          </button>
        ))}
      </div>
      <p className={cn('text-center text-muted-foreground', size === 'lg' ? 'text-sm' : 'text-xs')}>{t.tapBody}</p>
      <BodyFigure
        view={view}
        spots={spots}
        pending={editing?.isNew ? editing.spot : null}
        maxWidth={size === 'lg' ? 280 : 220}
        onPick={p => setEditing({ spot: { ...p, id: uid(), note: '' }, isNew: true })}
        onSpotClick={s => setEditing({ spot: s, isNew: false })}
      />

      {editing && (
        <div className={cn('rounded-lg border-2 border-primary/40 bg-primary/5 space-y-2.5', size === 'lg' ? 'p-3' : 'p-2.5')}>
          <div className="flex items-center justify-between gap-2">
            <p className={cn('font-semibold', size === 'lg' ? 'text-base' : 'text-sm')}>
              {regionLabel(editing.spot.region, lang)} <span className="font-normal text-muted-foreground">({sideLabel(editing.spot.view)})</span>
            </p>
            <button type="button" onClick={() => setEditing(null)} className="text-muted-foreground p-1" aria-label={t.cancel}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {field.bodyMapIntensity && (
            <div className="space-y-1">
              <p className={size === 'lg' ? 'text-sm' : 'text-xs text-muted-foreground'}>{t.pain}</p>
              <div className={cn(size === 'lg' ? 'grid grid-cols-6 gap-1.5' : 'flex flex-wrap gap-1')}>
                {Array.from({ length: 11 }, (_, n) => (
                  <button key={n} type="button"
                    onClick={() => setEditing(e => e && ({ spot: { ...e.spot, nrs: e.spot.nrs === n ? undefined : n }, isNew: e.isNew }))}
                    className={cn('border font-medium tabular-nums', size === 'lg' ? 'h-11 rounded-lg text-base' : 'h-7 w-7 rounded-md text-xs',
                      editing.spot.nrs === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Textarea
            autoFocus={editing.isNew}
            className={size === 'lg' ? 'text-base min-h-[96px]' : 'text-sm min-h-[64px]'}
            placeholder={field.placeholder || t.whatHappened}
            value={editing.spot.note}
            onChange={e => { const note = e.target.value; setEditing(ed => ed && ({ spot: { ...ed.spot, note }, isNew: ed.isNew })); }}
          />
          <div className="flex gap-2">
            {!editing.isNew && (
              <Button type="button" variant="outline" className={cn('text-destructive hover:text-destructive', size === 'lg' && 'h-11')}
                onClick={() => { write(spots.filter(s => s.id !== editing.spot.id)); setEditing(null); }}>
                {t.remove}
              </Button>
            )}
            <Button type="button" className={cn('flex-1', size === 'lg' && 'h-11 text-base')} onClick={saveEditing}>
              {editing.isNew ? t.add : t.save}
            </Button>
          </div>
        </div>
      )}

      {spotList}
    </div>
  );
}

// ── Weekly schedule grid ──────────────────────────────────────────────────────

type Brush = WeekGridCell | 'erase';

export function WeekGridInput({ value, onChange, lang, size = 'sm', readOnly }: {
  value: string; onChange: (v: string) => void; lang: AnswerLang; size?: Size; readOnly?: boolean;
}) {
  const t = T[lang];
  const grid = parseWeekGrid(value);
  const [brush, setBrush] = useState<Brush>('a');
  // Latest cells for painting several in one gesture (state updates arrive later)
  const cellsRef = useRef(grid.cells);
  cellsRef.current = grid.cells;
  const paintMode = useRef<'set' | 'clear' | null>(null);
  const lastPointer = useRef<string>('mouse');
  const suppressClick = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const apply = (key: string, mode: 'set' | 'clear') => {
    const cells = { ...cellsRef.current };
    const b = brushRef.current;
    if (mode === 'clear' || b === 'erase') delete cells[key];
    else cells[key] = b;
    if (JSON.stringify(cells) === JSON.stringify(cellsRef.current)) return;
    cellsRef.current = cells;
    onChangeRef.current(Object.keys(cells).length ? JSON.stringify({ v: 1, cells }) : '');
  };
  const modeFor = (key: string): 'set' | 'clear' =>
    brushRef.current === 'erase' || cellsRef.current[key] === brushRef.current ? 'clear' : 'set';

  // Touch: hold ~0.3 s, then drag to paint (a quick swipe still scrolls the page)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || readOnly) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number; key: string } | null = null;
    const keyAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-cell]')?.dataset.cell;
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const key = keyAt(touch.clientX, touch.clientY);
      if (!key) return;
      start = { x: touch.clientX, y: touch.clientY, key };
      timer = setTimeout(() => {
        if (!start) return;
        paintMode.current = modeFor(start.key);
        apply(start.key, paintMode.current);
        suppressClick.current = true;
        navigator.vibrate?.(10);
      }, 300);
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (paintMode.current) {
        e.preventDefault();
        const key = keyAt(touch.clientX, touch.clientY);
        if (key) apply(key, paintMode.current);
      } else if (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8) {
        if (timer) clearTimeout(timer);
        start = null;
      }
    };
    const onEnd = () => {
      if (timer) clearTimeout(timer);
      start = null;
      paintMode.current = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Mouse: press and drag paints right away
  useEffect(() => {
    const up = () => { if (lastPointer.current === 'mouse') paintMode.current = null; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const cellH = size === 'lg' ? 'h-9' : readOnly ? 'h-3.5' : 'h-6';

  return (
    <div className="space-y-2">
      {!readOnly && (
        <>
          <div className={cn('grid gap-1.5', size === 'lg' ? 'grid-cols-1' : 'grid-cols-2')}>
            {(['a', 't', 'o', 'erase'] as Brush[]).map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBrush(b)}
                className={cn(
                  'flex items-center gap-2 border text-left transition-colors',
                  size === 'lg' ? 'min-h-[48px] rounded-lg border-2 px-3 text-base' : 'h-8 rounded-md px-2 text-xs',
                  brush === b ? 'border-primary bg-primary/10 font-medium' : 'border-input bg-background',
                )}
              >
                {b === 'erase'
                  ? <Eraser className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: WEEK_GRID_COLORS[b] }} />}
                {b === 'erase' ? t.erase : WEEK_GRID_LABELS[lang][b]}
              </button>
            ))}
          </div>
          <p className={cn('text-muted-foreground', size === 'lg' ? 'text-sm' : 'text-xs')}>{t.gridHint}</p>
        </>
      )}
      {readOnly && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {(['a', 't', 'o'] as WeekGridCell[]).map(k => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: WEEK_GRID_COLORS[k] }} />{WEEK_GRID_LABELS[lang][k]}
            </span>
          ))}
        </div>
      )}
      <div ref={containerRef} className={cn('select-none', readOnly && 'max-w-[420px]')}>
        <div className="grid gap-px" style={{ gridTemplateColumns: `${size === 'lg' ? '2.25rem' : '2rem'} repeat(7, minmax(0, 1fr))` }}>
          <div />
          {DAY_LABELS[lang].map(d => (
            <div key={d} className={cn('text-center font-medium text-muted-foreground', size === 'lg' ? 'text-sm pb-1' : 'text-[11px]')}>{d}</div>
          ))}
          {WEEK_GRID_HOURS.map(h => (
            <div key={h} className="contents">
              <div className={cn('text-right pr-1.5 tabular-nums text-muted-foreground leading-none', size === 'lg' ? 'text-xs pt-1' : 'text-[10px]')}>
                {readOnly && h % 2 === 1 ? '' : h}
              </div>
              {Array.from({ length: 7 }, (_, day) => {
                const key = `${day}-${h}`;
                const cell = grid.cells[key];
                return readOnly ? (
                  <div key={key} className={cn(cellH, 'rounded-[2px]')}
                    style={{ backgroundColor: cell ? WEEK_GRID_COLORS[cell] : 'hsl(var(--muted))' }} />
                ) : (
                  <button
                    key={key}
                    type="button"
                    data-cell={key}
                    aria-label={`${DAY_LABELS[lang][day]} ${h}:00`}
                    aria-pressed={!!cell}
                    className={cn(cellH, 'rounded-[3px] border border-transparent transition-colors', !cell && 'bg-muted hover:border-primary/40')}
                    style={cell ? { backgroundColor: WEEK_GRID_COLORS[cell] } : undefined}
                    onPointerDown={e => { lastPointer.current = e.pointerType; }}
                    onMouseDown={e => {
                      if (lastPointer.current !== 'mouse') return;
                      e.preventDefault();
                      paintMode.current = modeFor(key);
                      apply(key, paintMode.current);
                    }}
                    onMouseEnter={() => { if (lastPointer.current === 'mouse' && paintMode.current) apply(key, paintMode.current); }}
                    onClick={() => {
                      // Mouse is handled on press; a touch tap toggles here (not after a hold-and-drag)
                      if (lastPointer.current === 'mouse') return;
                      if (suppressClick.current) { suppressClick.current = false; return; }
                      apply(key, modeFor(key));
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Field renderer (display + input) ─────────────────────────────────────────

// ── Calendar: mark periods (holidays, competitions, travel …) ─────────────────

const PERIOD_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

/** Colour of a period: by its type (the coach's list of types), otherwise by its position */
export function periodColor(period: DatePeriod, index: number, kinds: string[]): string {
  const k = period.kind ? kinds.indexOf(period.kind) : -1;
  return PERIOD_COLORS[(k >= 0 ? k : index) % PERIOD_COLORS.length];
}

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const C_T = {
  de: {
    hint: 'Klicke auf den ersten Tag und ziehe bis zum letzten – oder tippe nacheinander auf den ersten und den letzten Tag.',
    pickEnd: 'Jetzt auf den letzten Tag tippen (oder denselben Tag für einen einzelnen Tag).',
    name: 'Bezeichnung, z. B. Urlaub Mallorca', type: 'Art', from: 'Von', to: 'Bis',
    add: 'Übernehmen', save: 'Speichern', remove: 'Entfernen', cancel: 'Abbrechen',
    prev: 'Vorheriger Monat', next: 'Nächster Monat', locale: 'de-DE',
  },
  en: {
    hint: 'Click the first day and drag to the last — or tap the first and then the last day.',
    pickEnd: 'Now tap the last day (or the same day for a single day).',
    name: 'Name, e.g. holiday in Spain', type: 'Type', from: 'From', to: 'To',
    add: 'Add', save: 'Save', remove: 'Remove', cancel: 'Cancel',
    prev: 'Previous month', next: 'Next month', locale: 'en-GB',
  },
} as const;

export function DateRangesInput({ field, value, onChange, lang, size = 'sm', readOnly }: {
  field: AnamnesisField; value: string; onChange: (v: string) => void; lang: AnswerLang; size?: Size; readOnly?: boolean;
}) {
  const t = C_T[lang];
  const kinds = field.options ?? [];
  const periods = parseDateRanges(value);
  const [month, setMonth] = useState(() => {
    const first = periods[0]?.from;
    const d = first ? new Date(`${first}T12:00:00`) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1, 12);
  });
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHoverState] = useState<string | null>(null);
  // The day under the mouse, also for the mouseup handler (state is read late there)
  const hoverRef = useRef<string | null>(null);
  const setHover = (d: string | null) => { hoverRef.current = d; setHoverState(d); };
  const [draft, setDraft] = useState<{ period: DatePeriod; isNew: boolean } | null>(null);
  const dragging = useRef<string | null>(null);
  const lastPointer = useRef('mouse');
  const write = (next: DatePeriod[]) => onChange(next.length ? JSON.stringify([...next].sort((a, b) => a.from.localeCompare(b.from))) : '');

  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(t.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const rangeLabel = (p: DatePeriod) => (p.from === p.to ? fmt(p.from) : `${fmt(p.from)} – ${fmt(p.to)}`);

  const finish = (a: string, b: string) => {
    const [from, to] = a <= b ? [a, b] : [b, a];
    setAnchor(null);
    setHover(null);
    setDraft({ period: { id: uid(), from, to, label: '', kind: kinds.length === 1 ? kinds[0] : undefined }, isNew: true });
  };

  // Mouse: a drag ends where the button is released (a click without moving = tap mode: the next
  // click sets the last day)
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    const up = () => {
      const start = dragging.current;
      dragging.current = null;
      const end = hoverRef.current;
      if (start && end && end !== start) finishRef.current(start, end);
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodList = periods.length > 0 && (
    <ul className="space-y-1">
      {periods.map((p, i) => (
        <li key={p.id}>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => { setDraft({ period: p, isNew: false }); setMonth(new Date(Number(p.from.slice(0, 4)), Number(p.from.slice(5, 7)) - 1, 1, 12)); }}
            className={cn('w-full text-left rounded-md flex items-start gap-2', size === 'lg' ? 'px-2 py-2 text-base' : 'px-1.5 py-1 text-sm',
              !readOnly && 'hover:bg-accent active:bg-accent', draft?.period.id === p.id && 'bg-accent')}
          >
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: periodColor(p, i, kinds) }} />
            <span className="flex-1 min-w-0">
              <span className="font-medium">{rangeLabel(p)}</span>
              {(p.kind || p.label) && <span className="text-muted-foreground"> · {[p.kind, p.label].filter(Boolean).join(': ')}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  if (readOnly) {
    return periods.length > 0 ? <>{periodList}</> : <p className="text-sm text-muted-foreground italic">—</p>;
  }

  // Monday-first month grid
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoOf(new Date(month.getFullYear(), month.getMonth(), i + 1, 12))),
  ];
  // Highlighted: the days being selected, or the period being named / edited
  const pendingFrom = anchor && hover ? (anchor <= hover ? anchor : hover) : anchor ?? draft?.period.from ?? null;
  const pendingTo = anchor && hover ? (anchor <= hover ? hover : anchor) : anchor ?? draft?.period.to ?? null;
  const today = isoOf(new Date());
  const monthTitle = month.toLocaleDateString(t.locale, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" className={size === 'lg' ? 'h-11 w-11' : 'h-8 w-8'} aria-label={t.prev}
          onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1, 12))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className={cn('font-semibold capitalize', size === 'lg' ? 'text-base' : 'text-sm')}>{monthTitle}</span>
        <Button type="button" variant="ghost" size="icon" className={size === 'lg' ? 'h-11 w-11' : 'h-8 w-8'} aria-label={t.next}
          onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1, 12))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 select-none">
        {DAY_LABELS[lang].map(d => (
          <div key={d} className={cn('text-center font-medium text-muted-foreground', size === 'lg' ? 'text-sm' : 'text-[11px]')}>{d}</div>
        ))}
        {cells.map((iso, idx) => {
          if (!iso) return <div key={`e${idx}`} />;
          const inPending = !!pendingFrom && !!pendingTo && iso >= pendingFrom && iso <= pendingTo;
          const covering = periods.map((p, i) => ({ p, i })).filter(({ p }) => iso >= p.from && iso <= p.to);
          return (
            <button
              key={iso}
              type="button"
              data-day={iso}
              onPointerDown={e => { lastPointer.current = e.pointerType; }}
              onMouseDown={e => {
                if (lastPointer.current !== 'mouse') return;
                e.preventDefault();
                if (anchor) { finish(anchor, iso); return; }
                dragging.current = iso;
                setAnchor(iso);
                setHover(iso);
              }}
              onMouseEnter={() => { if (dragging.current || anchor) setHover(iso); }}
              onClick={() => {
                if (lastPointer.current === 'mouse') return;
                if (anchor) finish(anchor, iso);
                else { setAnchor(iso); setHover(null); }
              }}
              className={cn(
                'relative rounded-md flex flex-col items-center justify-start border transition-colors overflow-hidden',
                size === 'lg' ? 'h-12 pt-1 text-base' : 'h-9 pt-0.5 text-sm',
                inPending ? 'border-primary bg-primary/20' : 'border-transparent bg-muted/50 hover:border-primary/40',
                iso === today && 'font-bold',
              )}
            >
              <span className="leading-none">{Number(iso.slice(8))}</span>
              {covering.length > 0 && (
                <span className="absolute bottom-1 left-1 right-1 flex gap-0.5">
                  {covering.slice(0, 3).map(({ p, i }) => (
                    <span key={p.id} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: periodColor(p, i, kinds) }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className={cn(anchor ? 'text-primary font-medium' : 'text-muted-foreground', size === 'lg' ? 'text-sm' : 'text-xs')}>
        {anchor ? t.pickEnd : t.hint}
      </p>

      {draft && (
        <div className={cn('rounded-lg border-2 border-primary/40 bg-primary/5 space-y-2.5', size === 'lg' ? 'p-3' : 'p-2.5')}>
          <div className="flex items-center justify-between gap-2">
            <p className={cn('font-semibold', size === 'lg' ? 'text-base' : 'text-sm')}>{rangeLabel(draft.period)}</p>
            <button type="button" onClick={() => setDraft(null)} className="text-muted-foreground p-1" aria-label={t.cancel}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['from', 'to'] as const).map(k => (
              <label key={k} className="space-y-1">
                <span className={size === 'lg' ? 'text-sm' : 'text-xs text-muted-foreground'}>{k === 'from' ? t.from : t.to}</span>
                <Input type="date" className={size === 'lg' ? 'h-11 text-base' : 'h-8 text-sm'} value={draft.period[k]}
                  onChange={e => { const v = e.target.value; if (v) setDraft(d => d && ({ ...d, period: { ...d.period, [k]: v } })); }} />
              </label>
            ))}
          </div>
          {kinds.length > 0 && (
            <div className="space-y-1">
              <p className={size === 'lg' ? 'text-sm' : 'text-xs text-muted-foreground'}>{t.type}</p>
              <div className="flex flex-wrap gap-1.5">
                {kinds.map((k, i) => (
                  <button key={k} type="button"
                    onClick={() => setDraft(d => d && ({ ...d, period: { ...d.period, kind: d.period.kind === k ? undefined : k } }))}
                    className={cn('border flex items-center gap-1.5 transition-colors',
                      size === 'lg' ? 'min-h-[44px] px-3 rounded-lg text-base' : 'h-7 px-2 rounded-md text-xs',
                      draft.period.kind === k ? 'border-primary bg-primary/10 font-medium' : 'border-input bg-background')}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PERIOD_COLORS[i % PERIOD_COLORS.length] }} />{k}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input
            autoFocus={draft.isNew}
            className={size === 'lg' ? 'h-12 text-base' : 'h-8 text-sm'}
            placeholder={field.placeholder || t.name}
            value={draft.period.label}
            onChange={e => { const label = e.target.value; setDraft(d => d && ({ ...d, period: { ...d.period, label } })); }}
          />
          <div className="flex gap-2">
            {!draft.isNew && (
              <Button type="button" variant="outline" className={cn('text-destructive hover:text-destructive', size === 'lg' && 'h-11')}
                onClick={() => { write(periods.filter(p => p.id !== draft.period.id)); setDraft(null); }}>
                {t.remove}
              </Button>
            )}
            <Button type="button" className={cn('flex-1', size === 'lg' && 'h-11 text-base')}
              onClick={() => {
                const p = draft.period.from <= draft.period.to ? draft.period : { ...draft.period, from: draft.period.to, to: draft.period.from };
                write(draft.isNew ? [...periods, p] : periods.map(x => (x.id === p.id ? p : x)));
                setDraft(null);
              }}>
              {draft.isNew ? t.add : t.save}
            </Button>
          </div>
        </div>
      )}

      {periodList}
    </div>
  );
}

/** Answer field of any question type — compact, English (coach record, template editor preview) */
export function AnamnesisFieldInput({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: AnamnesisField;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  // Structured types — the same inputs as the athlete's form link, compact and in English
  switch (field.fieldType) {
    case 'info':
      return field.helpText ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{field.helpText}</p> : null;
    case 'yesnoList':
      return <YesNoListInput lang="en" items={field.options ?? []} value={value} onChange={onChange} readOnly={readOnly} />;
    case 'list':
      return <ListInput lang="en" columns={field.listColumns ?? []} value={value} onChange={onChange} readOnly={readOnly} />;
    case 'bodyMap':
      return <BodyMapInput lang="en" field={field} value={value} onChange={onChange} readOnly={readOnly} />;
    case 'weekGrid':
      if (readOnly && !value) return <p className="text-sm text-muted-foreground italic">—</p>;
      return <WeekGridInput lang="en" value={value} onChange={onChange} readOnly={readOnly} />;
    case 'dateRanges':
      return <DateRangesInput lang="en" field={field} value={value} onChange={onChange} readOnly={readOnly} />;
    default:
      break;
  }

  if (readOnly) {
    if (!value) return <p className="text-sm text-muted-foreground italic">—</p>;
    if (field.fieldType === 'boolean') {
      return (
        <Badge variant={value === 'true' ? 'default' : 'secondary'} className="text-xs">
          {value === 'true' ? 'Yes' : 'No'}
        </Badge>
      );
    }
    return <p className="text-sm whitespace-pre-wrap">{formatAnswer(field, value) || value}</p>;
  }

  switch (field.fieldType) {
    case 'multiselect':
      return <MultiChoiceInput options={field.options ?? []} value={value} onChange={onChange} />;
    case 'scale':
      return <ScaleInput field={field} value={value} onChange={onChange} />;
    case 'date':
      return <Input type="date" className="h-9 text-sm w-48" value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'textarea':
      return (
        <Textarea
          className="min-h-[72px] resize-y text-sm"
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          className="h-9 text-sm"
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'select':
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'boolean':
      return (
        <div className="flex gap-2">
          {['Yes', 'No'].map((opt) => {
            const val = opt === 'Yes' ? 'true' : 'false';
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(value === val ? '' : val)}
                className={cn(
                  'px-3 py-1 rounded-md text-sm border transition-colors',
                  value === val
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-input hover:bg-accent',
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    default:
      return (
        <Input
          type="text"
          className="h-9 text-sm"
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
