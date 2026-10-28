import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Edit, Loader2, ClipboardList, X, GitBranch, Eye, EyeOff, CalendarDays, MapPin,
} from 'lucide-react';
import { AnamnesisFieldInput } from '@/components/anamnesis/AnamnesisInputs';
import { ANAMNESIS_PRESETS } from '@/data/anamnesisPresets';
import { AnamnesisTranslationEditor } from '@/components/anamnesis/AnamnesisTranslationEditor';
import { translationProgress } from '@/utils/anamnesisI18n';
import { useAnamnesisTemplates } from '@/hooks/useAnamnesisTemplates';
import { ANAMNESIS_LANG_LABELS, ANAMNESIS_PROFILE_STEPS, DEFAULT_ANAMNESIS_TEMPLATE, PROFILE_SEX_SOURCE, isAthleteSection, otherLang, profileStepOn, type AnamnesisLang, type AnamnesisProfileSteps } from '@/types/anamnesis';
import type {
  AnamnesisTemplate, AnamnesisTemplateDraft, AnamnesisSection, AnamnesisField, AnamnesisFieldType, AnamnesisCondition, AnamnesisListColumn,
} from '@/types/anamnesis';
import { BODY_AREAS, CONDITION_SOURCE_TYPES, conditionChoices } from '@/utils/anamnesisAnswers';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankField(): AnamnesisField {
  return { id: uid(), label: '', fieldType: 'text' };
}

function blankSection(): AnamnesisSection {
  return { id: uid(), title: '', fields: [blankField()] };
}

const FIELD_TYPE_LABELS: Record<AnamnesisFieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  date: 'Date',
  select: 'Single choice',
  multiselect: 'Multiple choice',
  boolean: 'Yes / No',
  yesnoList: 'Checklist (yes / no per item)',
  scale: 'Scale (e.g. 0–10)',
  list: 'List of entries (e.g. injuries)',
  bodyMap: 'Body map',
  weekGrid: 'Weekly schedule',
  dateRanges: 'Calendar (periods → athlete calendar)',
  info: 'Info text (no answer)',
};

const LIST_COLUMN_TYPES: Record<AnamnesisListColumn['type'], string> = {
  text: 'Text', number: 'Number', date: 'Date', select: 'Choice',
};

/** Defaults when a question gets a new type (existing settings are kept) */
function withType(field: AnamnesisField, fieldType: AnamnesisFieldType): AnamnesisField {
  const next: AnamnesisField = { ...field, fieldType };
  if ((fieldType === 'select' || fieldType === 'multiselect') && !(field.options?.length)) next.options = ['Option 1', 'Option 2'];
  if (fieldType === 'yesnoList' && !(field.options?.length)) next.options = ['Item 1', 'Item 2'];
  if (fieldType === 'scale') { next.scaleMin = field.scaleMin ?? 0; next.scaleMax = field.scaleMax ?? 10; }
  if (fieldType === 'list' && !(field.listColumns?.length)) next.listColumns = [{ id: uid(), label: '', type: 'text' }];
  return next;
}

/** A question an earlier answer can be a condition on */
interface ConditionSource { id: string; label: string; field: AnamnesisField | 'sex' }

const SEX_SOURCE: ConditionSource = { id: PROFILE_SEX_SOURCE, label: 'Sex (from the profile)', field: 'sex' };

function conditionSources(fields: AnamnesisField[], withSex = true): ConditionSource[] {
  return [
    ...fields
      .filter((f) => CONDITION_SOURCE_TYPES.has(f.fieldType) && f.label.trim())
      .map((f) => ({ id: f.id, label: f.label, field: f })),
    ...(withSex ? [SEX_SOURCE] : []),
  ];
}

/** Types a question per spot can have (no body map / schedule / calendar inside a spot) */
const SPOT_FIELD_TYPES: AnamnesisFieldType[] = (Object.keys(FIELD_TYPE_LABELS) as AnamnesisFieldType[])
  .filter((t) => t !== 'bodyMap' && t !== 'weekGrid' && t !== 'dateRanges');

/** Questions per spot a condition can look at (choices and yes/no) */
const spotConditionFields = (bodyMap: AnamnesisField): AnamnesisField[] =>
  (bodyMap.spotFields ?? []).filter((f) => CONDITION_SOURCE_TYPES.has(f.fieldType) && f.fieldType !== 'bodyMap' && f.label.trim());

/** Text area with one entry per line — written back when leaving the box */
function LinesInput({ label, value, onCommit, placeholder }: {
  label: string; value: string[]; onCommit: (lines: string[]) => void; placeholder: string;
}) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Textarea
        className="min-h-[64px] text-xs resize-y"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text.split('\n').map((o) => o.trim()).filter(Boolean))}
      />
    </div>
  );
}

// ── "Show only if" ────────────────────────────────────────────────────────────

function ConditionEditor({ condition, sources, onChange }: {
  condition: AnamnesisCondition;
  sources: ConditionSource[];
  onChange: (c: AnamnesisCondition | undefined) => void;
}) {
  const source = sources.find((s) => s.id === condition.sourceId);
  // A body map with questions per spot: the body area, or a spot's answer to one of its questions
  const spotSubs = source && source.field !== 'sex' && source.field.fieldType === 'bodyMap' ? spotConditionFields(source.field) : [];
  const sub = condition.spotFieldId ? spotSubs.find((f) => f.id === condition.spotFieldId) : undefined;
  const choices = sub ? conditionChoices(sub) : source && !condition.spotFieldId ? conditionChoices(source.field) : [];
  const missing = (!!condition.sourceId && !source) || (!!condition.spotFieldId && !sub);
  return (
    <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium shrink-0">Show only if</span>
        <Select
          value={source ? condition.sourceId : ''}
          onValueChange={(v) => onChange({ sourceId: v, values: [] })}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue placeholder={sources.length > 1 ? 'Pick an earlier question…' : 'No earlier choice / yes-no question'} />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onChange(undefined)} title="Remove condition">
          <X className="h-3 w-3" />
        </Button>
      </div>
      {spotSubs.length > 0 && (
        <div className="flex items-center gap-2 pl-0.5">
          <span className="text-xs text-muted-foreground shrink-0">looking at</span>
          <Select
            value={condition.spotFieldId ?? '__area'}
            onValueChange={(v) => onChange({ sourceId: condition.sourceId, values: [], spotFieldId: v === '__area' ? undefined : v })}
          >
            <SelectTrigger className="h-7 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__area" className="text-xs">The body area of a marked spot</SelectItem>
              {spotSubs.map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-xs">A spot&apos;s answer to: {f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {missing && (
        <p className="text-xs text-amber-700">The question this depended on was removed or moved below — the condition is ignored until you pick another one.</p>
      )}
      {source && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pl-0.5">
          <span className="text-xs text-muted-foreground">is</span>
          {choices.map(([val, label]) => (
            <label key={val} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox
                className="h-3.5 w-3.5"
                checked={condition.values.includes(val)}
                onCheckedChange={(v) => onChange({
                  ...condition,
                  values: v === true ? [...condition.values, val] : condition.values.filter((x) => x !== val),
                })}
              />
              {label}
            </label>
          ))}
          {condition.values.length === 0 && <span className="text-xs text-amber-700">pick at least one answer</span>}
          {sub && <span className="w-full text-[11px] text-muted-foreground">— true when at least one marked spot has this answer</span>}
        </div>
      )}
    </div>
  );
}

// ── Question per spot: "only for these body areas" ────────────────────────────

function SpotRegionsEditor({ regions, onChange }: { regions: string[]; onChange: (r: string[] | undefined) => void }) {
  return (
    <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium flex-1">Only for spots on</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onChange(undefined)} title="Ask for every spot">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pl-0.5">
        {BODY_AREAS.map((r) => {
          const id = String(r.id);
          return (
            <label key={id} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox className="h-3.5 w-3.5" checked={regions.includes(id)}
                onCheckedChange={(v) => onChange(v === true ? [...regions, id] : regions.filter((x) => x !== id))} />
              {r.label}
            </label>
          );
        })}
        {regions.length === 0 && <span className="text-xs text-amber-700">pick at least one area</span>}
      </div>
    </div>
  );
}

// ── List columns ──────────────────────────────────────────────────────────────

function ListColumnsEditor({ columns, onChange }: { columns: AnamnesisListColumn[]; onChange: (c: AnamnesisListColumn[]) => void }) {
  const update = (idx: number, col: AnamnesisListColumn) => onChange(columns.map((c, i) => (i === idx ? col : c)));
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground block">Columns of each entry</Label>
      {columns.map((col, idx) => (
        <div key={col.id} className="flex gap-1.5 items-start">
          <Input className="h-7 text-xs flex-1" placeholder="Column label, e.g. When" value={col.label}
            onChange={(e) => update(idx, { ...col, label: e.target.value })} />
          <Select value={col.type} onValueChange={(v) => update(idx, { ...col, type: v as AnamnesisListColumn['type'], options: v === 'select' ? (col.options ?? []) : undefined })}>
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(LIST_COLUMN_TYPES) as [AnamnesisListColumn['type'], string][]).map(([v, l]) => (
                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {col.type === 'select' && (
            <Input className="h-7 text-xs flex-1" placeholder="Choices, comma-separated" defaultValue={(col.options ?? []).join(', ')}
              onBlur={(e) => update(idx, { ...col, options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })} />
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={columns.length <= 1} onClick={() => onChange(columns.filter((_, i) => i !== idx))}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => onChange([...columns, { id: uid(), label: '', type: 'text' }])}>
        <Plus className="h-3 w-3" />Add column
      </Button>
    </div>
  );
}

// ── Field row editor ──────────────────────────────────────────────────────────
// Also used for the questions added to a single anamnesis record (AnamnesisQuestionEditor) — every
// question type with its settings, without "show only if" there.

export function AnamnesisQuestionEditor(props: Omit<Parameters<typeof FieldRow>[0], 'sources'>) {
  return <FieldRow {...props} sources={[]} allowCondition={false} />;
}

function FieldRow({
  field,
  isFirst,
  isLast,
  sources,
  allowCondition = true,
  perSpot = false,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  field: AnamnesisField;
  isFirst: boolean;
  isLast: boolean;
  /** Earlier questions this one can depend on */
  sources: ConditionSource[];
  allowCondition?: boolean;
  /** A question per spot of a body map (fewer types, "only for these body areas") */
  perSpot?: boolean;
  onChange: (updated: AnamnesisField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [showHelp, setShowHelp] = useState(!!field.helpText);
  const [showPreview, setShowPreview] = useState(false);
  const [previewValue, setPreviewValue] = useState('');
  const type = field.fieldType;

  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-md border bg-background">
      <div className="flex gap-2 items-start">
        <div className="flex-1 flex gap-2">
          <Input
            className="flex-1 h-8 text-sm"
            placeholder={type === 'info' ? 'Heading' : 'Question'}
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
          />
          <Select value={type} onValueChange={(v) => onChange(withType(field, v as AnamnesisFieldType))}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(FIELD_TYPE_LABELS) as [AnamnesisFieldType, string][])
                .filter(([val]) => !perSpot || SPOT_FIELD_TYPES.includes(val))
                .map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {(type === 'select' || type === 'multiselect') && (
        <LinesInput key={`${field.id}-${type}`} label="Choices (one per line)" placeholder={'Option 1\nOption 2'}
          value={field.options ?? []} onCommit={(options) => onChange({ ...field, options })} />
      )}
      {(type === 'multiselect' || type === 'yesnoList') && (
        <label className="flex items-center gap-2 text-xs cursor-pointer w-fit">
          <Checkbox className="h-3.5 w-3.5" checked={!!field.allowOther}
            onCheckedChange={(v) => onChange({ ...field, allowOther: v === true || undefined })} />
          Add "Sonstiges" with free text
        </label>
      )}
      {type !== 'info' && (
        <label className="flex items-center gap-2 text-xs cursor-pointer w-fit">
          <Checkbox className="h-3.5 w-3.5" checked={!!field.allowFiles}
            onCheckedChange={(v) => onChange({ ...field, allowFiles: v === true || undefined })} />
          Allow file upload <span className="text-muted-foreground">(e.g. a report — PDF or photo, below the answer; the AI doesn't read the files)</span>
        </label>
      )}
      {type === 'yesnoList' && (
        <LinesInput key={`${field.id}-${type}`} label="Items, each answered with yes / no (one per line)" placeholder={'Unintended weight loss\nFever or night sweats'}
          value={field.options ?? []} onCommit={(options) => onChange({ ...field, options })} />
      )}
      {type === 'scale' && (
        <div className="grid grid-cols-[64px_64px_1fr_1fr] gap-1.5 items-end">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
            <Input type="number" className="h-7 text-xs" value={field.scaleMin ?? 0}
              onChange={(e) => onChange({ ...field, scaleMin: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
            <Input type="number" className="h-7 text-xs" value={field.scaleMax ?? 10}
              onChange={(e) => onChange({ ...field, scaleMax: Number(e.target.value) || 10 })} />
          </div>
          <Input className="h-7 text-xs" placeholder="Low end, e.g. no pain" value={field.scaleMinLabel ?? ''}
            onChange={(e) => onChange({ ...field, scaleMinLabel: e.target.value || undefined })} />
          <Input className="h-7 text-xs" placeholder="High end, e.g. worst imaginable pain" value={field.scaleMaxLabel ?? ''}
            onChange={(e) => onChange({ ...field, scaleMaxLabel: e.target.value || undefined })} />
        </div>
      )}
      {type === 'list' && (
        <>
          <p className="text-xs text-muted-foreground">The athlete adds as many entries as needed ("Add another") — each entry has the columns below. E.g. injuries: When / What / Time out / Treatment; events: Type / From / To / Note.</p>
          <ListColumnsEditor columns={field.listColumns ?? []} onChange={(listColumns) => onChange({ ...field, listColumns })} />
        </>
      )}
      {type === 'bodyMap' && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs cursor-pointer w-fit">
            <Checkbox className="h-3.5 w-3.5" checked={!!field.bodyMapIntensity}
              onCheckedChange={(v) => onChange({ ...field, bodyMapIntensity: v === true || undefined })} />
            Also ask for the pain intensity (0–10) of each spot
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer w-fit">
            <Checkbox className="h-3.5 w-3.5" checked={!!field.bodyMapNone}
              onCheckedChange={(v) => onChange({ ...field, bodyMapNone: v === true || undefined })} />
            Offer &quot;None of these&quot; <span className="text-muted-foreground">(nothing to mark — counts as answered, e.g. so everyone answers it)</span>
          </label>
          <Input className="h-7 text-xs" placeholder={field.spotFields?.length
            ? 'Prompt for the optional note at the end of each spot (e.g. "Anything else that matters?")'
            : 'Prompt for the note at each spot (default: "What happened / how does it feel?")'}
            value={field.placeholder ?? ''} onChange={(e) => onChange({ ...field, placeholder: e.target.value || undefined })} />
          <SpotFieldsEditor field={field} onChange={onChange} />
        </div>
      )}
      {type === 'dateRanges' && (
        <>
          <p className="text-xs text-muted-foreground">The athlete marks a period in a month calendar (tap the first and then the last day, double-tap for a single day) and types what it is — e.g. holidays, competitions, travel, training camps.</p>
          <p className="text-xs text-blue-700 flex items-start gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 mt-px" />
            Every period lands in the athlete&apos;s calendar as an event (over several days where it has them) once the anamnesis is submitted — and from there in the athlete app. The form tells the athlete.
          </p>
          <Input className="h-7 text-xs" placeholder='Prompt for the name (default: "What is it? e.g. holiday in Spain, competition, training camp")'
            value={field.placeholder ?? ''} onChange={(e) => onChange({ ...field, placeholder: e.target.value || undefined })} />
        </>
      )}
      {type === 'weekGrid' && (
        <p className="text-xs text-muted-foreground">Mon–Sun, 5:00–23:00 in hours. The athlete marks: available for training · regular training (team/club) · other physical load.</p>
      )}

      {type === 'info' ? (
        <Textarea className="min-h-[56px] text-xs resize-y" placeholder="Text shown to the athlete (no answer)"
          value={field.helpText ?? ''} onChange={(e) => onChange({ ...field, helpText: e.target.value || undefined })} />
      ) : showHelp ? (
        <div className="flex gap-1.5">
          <Input className="h-7 text-xs flex-1" placeholder="Help text under the question, e.g. an explanation in plain words" autoFocus={!field.helpText}
            value={field.helpText ?? ''} onChange={(e) => onChange({ ...field, helpText: e.target.value || undefined })} />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowHelp(false); onChange({ ...field, helpText: undefined }); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : null}

      {allowCondition && field.condition && (
        <ConditionEditor condition={field.condition} sources={sources} onChange={(condition) => onChange({ ...field, condition })} />
      )}
      {perSpot && field.spotRegions && (
        <SpotRegionsEditor regions={field.spotRegions} onChange={(spotRegions) => onChange({ ...field, spotRegions })} />
      )}

      {showPreview && (
        <div className="rounded-md border bg-muted/30 p-2.5 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preview (answers here are not saved)</p>
          {field.label && <p className={cn(type === 'info' ? 'text-sm font-semibold' : 'text-xs font-medium')}>{field.label}</p>}
          {field.helpText && type !== 'info' && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{field.helpText}</p>}
          <AnamnesisFieldInput field={field} value={previewValue} onChange={setPreviewValue} />
        </div>
      )}

      {/* Preview only in the template editor — a record's own questions show the real answer field below */}
      {(!showHelp && type !== 'info') || allowCondition ? (
        <div className="flex gap-1">
          {!showHelp && type !== 'info' && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground gap-1" onClick={() => setShowHelp(true)}>
              <Plus className="h-3 w-3" />Help text
            </Button>
          )}
          {allowCondition && !field.condition && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground gap-1"
              onClick={() => onChange({ ...field, condition: { sourceId: '', values: [] } })}>
              <GitBranch className="h-3 w-3" />Show only if…
            </Button>
          )}
          {perSpot && !field.spotRegions && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground gap-1"
              onClick={() => onChange({ ...field, spotRegions: [] })}>
              <MapPin className="h-3 w-3" />Only for some body areas…
            </Button>
          )}
          {allowCondition && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground gap-1 ml-auto"
              onClick={() => setShowPreview((p) => !p)}>
              {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{showPreview ? 'Hide preview' : 'Preview'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Body map: questions per spot ──────────────────────────────────────────────

function SpotFieldsEditor({ field, onChange }: { field: AnamnesisField; onChange: (f: AnamnesisField) => void }) {
  const subs = field.spotFields ?? [];
  const write = (spotFields: AnamnesisField[]) => onChange({ ...field, spotFields: spotFields.length ? spotFields : undefined });
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...subs];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    write(next);
  };
  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
      <div>
        <p className="text-xs font-medium">Questions per spot</p>
        <p className="text-[11px] text-muted-foreground">
          Asked for every spot the athlete marks — in the form link one per screen right after tapping the spot, then back to the body.
          They can depend on an earlier answer of the same spot or only be asked for some body areas. A spot can be marked as part of an
          earlier one (e.g. pain radiating into the leg) — then its questions are not asked again.
          {subs.length > 0 && ' The note comes last (optional).'}
        </p>
      </div>
      {subs.map((sub, idx) => (
        <FieldRow
          key={sub.id}
          field={sub}
          isFirst={idx === 0}
          isLast={idx === subs.length - 1}
          sources={conditionSources(subs.slice(0, idx), false)}
          perSpot
          onChange={(updated) => write(subs.map((x, i) => (i === idx ? updated : x)))}
          onDelete={() => write(subs.filter((_, i) => i !== idx))}
          onMoveUp={() => move(idx, -1)}
          onMoveDown={() => move(idx, 1)}
        />
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => write([...subs, blankField()])}>
        <Plus className="h-3 w-3" />Add question per spot
      </Button>
    </div>
  );
}

// ── Section editor ────────────────────────────────────────────────────────────

function SectionEditor({
  section,
  isFirst,
  isLast,
  previousFields,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  section: AnamnesisSection;
  isFirst: boolean;
  isLast: boolean;
  /** Questions of the sections above (conditions can only refer to earlier questions) */
  previousFields: AnamnesisField[];
  onChange: (updated: AnamnesisSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [showHelp, setShowHelp] = useState(!!section.helpText);
  const updateField = (idx: number, updated: AnamnesisField) => {
    const fields = section.fields.map((f, i) => (i === idx ? updated : f));
    onChange({ ...section, fields });
  };

  const deleteField = (idx: number) => {
    onChange({ ...section, fields: section.fields.filter((_, i) => i !== idx) });
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const fields = [...section.fields];
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    [fields[idx], fields[target]] = [fields[target], fields[idx]];
    onChange({ ...section, fields });
  };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex gap-2 items-center">
        <Input
          className="flex-1 h-8 text-sm font-medium"
          placeholder="Section title"
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
        />
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {showHelp && (
        <div className="flex gap-1.5 pl-1">
          <Input className="h-7 text-xs flex-1" placeholder="Short text under the section title (optional)" autoFocus={!section.helpText}
            value={section.helpText ?? ''} onChange={(e) => onChange({ ...section, helpText: e.target.value || undefined })} />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowHelp(false); onChange({ ...section, helpText: undefined }); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      {section.condition && (
        <div className="pl-1">
          <ConditionEditor condition={section.condition} sources={conditionSources(previousFields)}
            onChange={(condition) => onChange({ ...section, condition })} />
        </div>
      )}

      {/* Who fills in this section: the athlete via the online form link, or the coach */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
          <Checkbox
            checked={isAthleteSection(section)}
            onCheckedChange={(v) => onChange({ ...section, athleteFills: v === true })}
            className="h-3.5 w-3.5"
          />
          Filled in by the athlete (online form link)
        </label>
        {!showHelp && (
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground gap-1" onClick={() => setShowHelp(true)}>
            <Plus className="h-3 w-3" />Section text
          </Button>
        )}
        {!section.condition && (
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground gap-1"
            onClick={() => onChange({ ...section, condition: { sourceId: '', values: [] } })}>
            <GitBranch className="h-3 w-3" />Show section only if…
          </Button>
        )}
      </div>

      <div className="space-y-1.5 pl-1">
        {section.fields.map((field, idx) => (
          <FieldRow
            key={field.id}
            field={field}
            isFirst={idx === 0}
            isLast={idx === section.fields.length - 1}
            sources={conditionSources([...previousFields, ...section.fields.slice(0, idx)])}
            onChange={(u) => updateField(idx, u)}
            onDelete={() => deleteField(idx)}
            onMoveUp={() => moveField(idx, -1)}
            onMoveDown={() => moveField(idx, 1)}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground w-full justify-start gap-1.5"
          onClick={() => onChange({ ...section, fields: [...section.fields, blankField()] })}
        >
          <Plus className="h-3 w-3" />
          Add question
        </Button>
      </div>
    </div>
  );
}

// ── Template editor dialog ────────────────────────────────────────────────────

export function TemplateEditorDialog({
  initial,
  open,
  onClose,
  onSave,
  isSaving,
  onSaveAsNew,
  isSavingAsNew,
  onDelete,
  isDeleting,
  showPresets,
}: {
  initial: { name: string; sections: AnamnesisSection[]; introText?: string } & Pick<AnamnesisTemplateDraft, 'language' | 'translations' | 'profileSteps'>;
  /** New template: offer the built-in templates to start from (ANAMNESIS_PRESETS) */
  showPresets?: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (draft: AnamnesisTemplateDraft) => Promise<void>;
  isSaving: boolean;
  onSaveAsNew?: (draft: AnamnesisTemplateDraft) => Promise<void>;
  isSavingAsNew?: boolean;
  onDelete?: () => Promise<void>;
  isDeleting?: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [sections, setSections] = useState<AnamnesisSection[]>(initial.sections);
  const [introText, setIntroText] = useState(initial.introText ?? '');
  // Language versions: the main language and the template-level translations (name / intro); the
  // questions' translations live in the sections
  const [language, setLanguage] = useState<AnamnesisLang>(initial.language ?? 'de');
  const [translations, setTranslations] = useState(initial.translations);
  // The fixed "About you" steps at the start of the form: which ones are asked
  const [profileSteps, setProfileSteps] = useState<AnamnesisProfileSteps | undefined>(initial.profileSteps);
  const [mode, setMode] = useState<'questions' | 'translation'>('questions');
  const translationLang = otherLang(language);
  const draft = (): AnamnesisTemplateDraft => ({ name, sections, introText, language, translations, profileSteps });
  const applyDraft = (d: AnamnesisTemplateDraft) => {
    setName(d.name); setSections(d.sections); setIntroText(d.introText); setLanguage(d.language ?? 'de'); setTranslations(d.translations);
    setProfileSteps(d.profileSteps);
  };
  const [doneTr, totalTr] = translationProgress(draft(), translationLang);
  const [presetId, setPresetId] = useState('');
  const startFrom = (id: string) => {
    const preset = ANAMNESIS_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const hasContent = sections.some((s) => s.title.trim() || s.fields.some((f) => f.label.trim()));
    if (hasContent && !window.confirm('Replace what you have entered with this template?')) return;
    setPresetId(id);
    // A copy — editing must not change the built-in template
    applyDraft(JSON.parse(JSON.stringify({ ...preset.draft, introText: preset.draft.introText ?? '' })) as AnamnesisTemplateDraft);
  };

  // Reset local state when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
  };

  const updateSection = (idx: number, updated: AnamnesisSection) => {
    setSections(sections.map((s, i) => (i === idx ? updated : s)));
  };

  const deleteSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Opens over the anamnesis record too — its own, darker layer above that dialog */}
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 z-[130]" overlayClassName="z-[120] bg-black/85">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>

        {/* Main language + the translation into the other one */}
        <div className="px-6 pb-3 shrink-0 flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button type="button" onClick={() => setMode('questions')}
              className={cn('px-3 py-1.5', mode === 'questions' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')}>
              Questions ({ANAMNESIS_LANG_LABELS[language]})
            </button>
            <button type="button" onClick={() => setMode('translation')}
              className={cn('px-3 py-1.5 border-l', mode === 'translation' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')}>
              {ANAMNESIS_LANG_LABELS[translationLang]} version · {doneTr}/{totalTr}
            </button>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Label className="text-xs text-muted-foreground">Main language</Label>
            <Select value={language} onValueChange={(v) => {
              if (v === language) return;
              if ((doneTr > 0) && !window.confirm('Change the main language? The questions stay as written — only the label of the language changes; the existing translation is then treated as the other language.')) return;
              setLanguage(v as AnamnesisLang);
            }}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="de" className="text-xs">German</SelectItem>
                <SelectItem value="en" className="text-xs">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === 'translation' ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            <AnamnesisTranslationEditor draft={draft()} lang={translationLang} onChange={applyDraft} />
          </div>
        ) : (<>
        <div className="px-6 pb-2 shrink-0">
          {showPresets && (
            <div className="mb-3 rounded-md border bg-muted/30 p-2.5 flex items-center gap-2">
              <Label className="text-sm shrink-0">Start from</Label>
              <Select value={presetId} onValueChange={startFrom}>
                <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Blank template — or pick a ready-made one…" /></SelectTrigger>
                <SelectContent>
                  {ANAMNESIS_PRESETS.map((p) => <SelectItem key={p.id} value={p.id} className="text-sm">{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Label className="text-sm mb-1 block">Template Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. General Anamnesis, Rehab Assessment"
            className="h-9"
          />
          <Label className="text-sm mt-3 mb-1 block">Introduction for the form link <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            placeholder="e.g. Hi! Before our first appointment, please answer a few questions about your health and training — it takes about 10 minutes."
            className="min-h-[72px] text-sm resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Shown on the start screen when the athlete opens the link. Leave empty for the standard text. The number of questions, the expiry date and "answers are saved" are added automatically.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-2 pb-4">
            {/* The fixed start of every form link — filled from / into the athlete profile */}
            <div className="rounded-lg border border-dashed bg-muted/20 p-3 space-y-2">
              <div>
                <p className="text-sm font-semibold">About the athlete <span className="font-normal text-muted-foreground">(always first in the form link)</span></p>
                <p className="text-xs text-muted-foreground">Pre-filled from the athlete profile; the athlete's answers can be applied to the profile afterwards. Switch off what you don't need.</p>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ANAMNESIS_PROFILE_STEPS.map(stepDef => {
                  const on = profileStepOn(profileSteps, stepDef.key);
                  const fixed = stepDef.key === 'name';
                  return (
                    <label key={stepDef.key} className={cn('flex items-start gap-2 rounded-md border bg-background px-2.5 py-2 text-sm', !fixed && 'cursor-pointer', !on && 'opacity-60')}>
                      <Checkbox className="h-3.5 w-3.5 mt-0.5" checked={on} disabled={fixed}
                        onCheckedChange={(v) => setProfileSteps(prev => {
                          const next = { ...(prev ?? {}) };
                          if (v === true) delete next[stepDef.key]; else next[stepDef.key] = false;
                          return Object.keys(next).length ? next : undefined;
                        })} />
                      <span className="min-w-0">
                        <span className="block font-medium">{stepDef.label}</span>
                        <span className="block text-xs text-muted-foreground">{language === 'en' ? stepDef.en : stepDef.de}</span>
                        {stepDef.note && <span className="block text-[11px] text-muted-foreground italic">{stepDef.note}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            {sections.map((section, idx) => (
              <SectionEditor
                key={section.id}
                section={section}
                isFirst={idx === 0}
                isLast={idx === sections.length - 1}
                previousFields={sections.slice(0, idx).flatMap((s) => s.fields)}
                onChange={(u) => updateSection(idx, u)}
                onDelete={() => deleteSection(idx)}
                onMoveUp={() => moveSection(idx, -1)}
                onMoveDown={() => moveSection(idx, 1)}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setSections([...sections, blankSection()])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Section
            </Button>
          </div>
        </div>

        </>)}

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row items-center">
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive gap-1.5 mr-auto"
                  disabled={isSaving || isSavingAsNew || isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="z-[150]" overlayClassName="z-[140]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this template?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The template will be removed. Existing anamnesis records that used it are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onDelete}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={onClose} disabled={isSaving || isSavingAsNew || isDeleting}>Cancel</Button>
          {onSaveAsNew && (
            <Button
              variant="outline"
              onClick={() => onSaveAsNew(draft())}
              disabled={!name.trim() || isSaving || isSavingAsNew || isDeleting}
            >
              {isSavingAsNew && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save as new
            </Button>
          )}
          <Button
            onClick={() => onSave(draft())}
            disabled={!name.trim() || isSaving || isSavingAsNew || isDeleting}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AnamnesisTemplateEditor() {
  const { toast } = useToast();
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useAnamnesisTemplates();

  const [editingTemplate, setEditingTemplate] = useState<AnamnesisTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAsNew, setIsSavingAsNew] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newFromDefault, setNewFromDefault] = useState(false);

  const handleEdit = (t: AnamnesisTemplate) => {
    setEditingTemplate(t);
    setIsCreating(false);
  };

  const handleNew = (fromDefault = false) => {
    setNewFromDefault(fromDefault);
    setEditingTemplate(null);
    setIsCreating(true);
  };

  const handleSaveNew = async ({ name, sections, introText, language, translations, profileSteps }: AnamnesisTemplateDraft) => {
    setIsSaving(true);
    const created = await createTemplate(name, sections, introText, { language, translations, profileSteps });
    setIsSaving(false);
    if (created) {
      toast({ title: 'Template created', description: `"${name}" is ready to use.` });
      setIsCreating(false);
    } else {
      toast({ title: 'Error', description: 'Failed to create template.', variant: 'destructive' });
    }
  };

  const handleSaveEdit = async ({ name, sections, introText, language, translations, profileSteps }: AnamnesisTemplateDraft) => {
    if (!editingTemplate) return;
    setIsSaving(true);
    const ok = await updateTemplate(editingTemplate.id, { name, sections, introText, language, translations, profileSteps });
    setIsSaving(false);
    if (ok) {
      toast({ title: 'Template saved' });
      setEditingTemplate(null);
    } else {
      toast({ title: 'Error', description: 'Failed to save template.', variant: 'destructive' });
    }
  };

  const handleSaveEditAsNew = async ({ name, sections, introText, language, translations, profileSteps }: AnamnesisTemplateDraft) => {
    setIsSavingAsNew(true);
    const created = await createTemplate(name, sections, introText, { language, translations, profileSteps });
    setIsSavingAsNew(false);
    if (created) {
      toast({ title: 'Template created', description: `"${name}" saved as a new template.` });
      setEditingTemplate(null);
    } else {
      toast({ title: 'Error', description: 'Failed to create template.', variant: 'destructive' });
    }
  };

  const handleDeleteFromDialog = async () => {
    if (!editingTemplate) return;
    setIsDeleting(true);
    const ok = await deleteTemplate(editingTemplate.id);
    setIsDeleting(false);
    if (ok) {
      toast({ title: 'Template deleted' });
      setEditingTemplate(null);
    } else {
      toast({ title: 'Error', description: 'Failed to delete template.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await deleteTemplate(id);
    if (ok) {
      toast({ title: 'Template deleted', description: `"${name}" has been removed.` });
    } else {
      toast({ title: 'Error', description: 'Failed to delete template.', variant: 'destructive' });
    }
  };

  const totalFields = (t: AnamnesisTemplate) =>
    t.sections.reduce((sum, s) => sum + s.fields.filter((f) => f.fieldType !== 'info').length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Define reusable intake templates. Coaches fill these out during athlete onboarding sessions.
          </p>
        </div>
        <Button size="sm" onClick={() => handleNew(false)} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          New Template
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div className="text-center py-10 border rounded-lg bg-muted/20">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium mb-1">No templates yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Start with the default template based on a full sports-science protocol.
          </p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={() => handleNew(true)}>
              Load Default Template
            </Button>
            <Button size="sm" onClick={() => handleNew(false)}>
              Start Blank
            </Button>
          </div>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.sections.length} section{t.sections.length !== 1 ? 's' : ''} · {totalFields(t)} field{totalFields(t) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleEdit(t)}>
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete template?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{t.name}" will be removed. Existing athlete anamnesis records that used this template will be unaffected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(t.id, t.name)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New template dialog */}
      {isCreating && (
        <TemplateEditorDialog
          key="new"
          initial={newFromDefault
            ? { name: DEFAULT_ANAMNESIS_TEMPLATE.name, sections: DEFAULT_ANAMNESIS_TEMPLATE.sections }
            : { name: '', sections: [blankSection()] }
          }
          open
          onClose={() => setIsCreating(false)}
          onSave={handleSaveNew}
          showPresets
          isSaving={isSaving}
        />
      )}

      {/* Edit existing template dialog */}
      {editingTemplate && (
        <TemplateEditorDialog
          key={editingTemplate.id}
          initial={{ name: editingTemplate.name, sections: editingTemplate.sections, introText: editingTemplate.introText, language: editingTemplate.language, translations: editingTemplate.translations, profileSteps: editingTemplate.profileSteps }}
          open
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveEdit}
          isSaving={isSaving}
          onSaveAsNew={handleSaveEditAsNew}
          isSavingAsNew={isSavingAsNew}
          onDelete={handleDeleteFromDialog}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
