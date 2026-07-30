import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  Plus, Trash2, Loader2, ClipboardList, Sparkles, ChevronRight, X,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import { useAthleteAnamneses } from '@/hooks/useAthleteAnamneses';
import { useAnamnesisTemplates } from '@/hooks/useAnamnesisTemplates';
import { TemplateEditorDialog } from '@/components/anamnesis/AnamnesisTemplateEditor';
import { sendMessage } from '@/utils/anthropicApi';
import type { Athlete } from '@/types/athlete';
import type {
  AthleteAnamnesis, AnamnesisField, AnamnesisFieldType, AnamnesisSection,
} from '@/types/anamnesis';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function blankCustomField(): AnamnesisField {
  return { id: uid(), label: '', fieldType: 'text' };
}

const FIELD_TYPE_LABELS: Record<AnamnesisFieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  select: 'Dropdown',
  boolean: 'Yes / No',
};

// ── Field renderer (display + input) ─────────────────────────────────────────

function AnamnesisFieldInput({
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
  if (readOnly) {
    if (!value) return <p className="text-sm text-muted-foreground italic">—</p>;
    if (field.fieldType === 'boolean') {
      return (
        <Badge variant={value === 'true' ? 'default' : 'secondary'} className="text-xs">
          {value === 'true' ? 'Yes' : 'No'}
        </Badge>
      );
    }
    return <p className="text-sm whitespace-pre-wrap">{value}</p>;
  }

  switch (field.fieldType) {
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

// ── Custom question editor row ────────────────────────────────────────────────

function CustomFieldEditor({
  field,
  isFirst,
  isLast,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  field: AnamnesisField;
  isFirst: boolean;
  isLast: boolean;
  onChange: (f: AnamnesisField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex gap-2 items-center p-2 rounded border bg-background">
      <Input
        className="flex-1 h-8 text-sm"
        placeholder="Question label"
        value={field.label}
        onChange={(e) => onChange({ ...field, label: e.target.value })}
      />
      <Select
        value={field.fieldType}
        onValueChange={(v) => onChange({ ...field, fieldType: v as AnamnesisFieldType })}
      >
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(FIELD_TYPE_LABELS) as [AnamnesisFieldType, string][]).map(([val, label]) => (
            <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  );
}

// ── AI summary builder ────────────────────────────────────────────────────────

function buildSummaryPrompt(
  record: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'>,
  athleteName: string,
): string {
  const sections = record.templateSnapshot.sections;
  const parts: string[] = [`Athlete: ${athleteName}`, `Date: ${record.conductedAt}`, ''];

  for (const section of sections) {
    const rows: string[] = [];
    for (const field of section.fields) {
      const val = record.fieldValues[field.id];
      if (val) rows.push(`  ${field.label}: ${val}`);
    }
    if (rows.length > 0) {
      parts.push(`${section.title}:`);
      parts.push(...rows);
      parts.push('');
    }
  }

  if (record.customQuestions.length > 0) {
    const rows: string[] = [];
    for (const field of record.customQuestions) {
      const val = record.customFieldValues[field.id];
      if (val) rows.push(`  ${field.label}: ${val}`);
    }
    if (rows.length > 0) {
      parts.push('Additional Questions:');
      parts.push(...rows);
      parts.push('');
    }
  }

  if (record.notes) {
    parts.push(`Additional Notes:\n${record.notes}`);
  }

  return parts.join('\n');
}

// ── Record form (create / edit) ───────────────────────────────────────────────

interface RecordFormProps {
  initial: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'> | null;
  athleteLocalId: string;
  athleteName: string;
  onSave: (data: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSaving: boolean;
  isDeleting: boolean;
}

function RecordForm({
  initial,
  athleteLocalId,
  athleteName,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: RecordFormProps) {
  const { templates, createTemplate } = useAnamnesisTemplates();

  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [savingNewTemplate, setSavingNewTemplate] = useState(false);

  const [conductedAt, setConductedAt] = useState(initial?.conductedAt ?? todayIso());
  const [templateId, setTemplateId] = useState<string | null>(initial?.templateId ?? null);
  const [templateSnapshot, setTemplateSnapshot] = useState(
    initial?.templateSnapshot ?? { name: '', sections: [] },
  );
  const [customQuestions, setCustomQuestions] = useState<AnamnesisField[]>(
    initial?.customQuestions ?? [],
  );
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    initial?.fieldValues ?? {},
  );
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(
    initial?.customFieldValues ?? {},
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [aiSummary, setAiSummary] = useState<string | null>(initial?.aiSummary ?? null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const { toast } = useToast();

  const handleTemplateChange = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setTemplateSnapshot({ name: t.name, sections: t.sections });
    setFieldValues({});
    setCustomFieldValues({});
    setAiSummary(null);
  };

  const handleSaveNewTemplate = async (name: string, sections: AnamnesisSection[]) => {
    setSavingNewTemplate(true);
    const created = await createTemplate(name, sections);
    setSavingNewTemplate(false);
    if (created) {
      setShowNewTemplate(false);
      handleTemplateChange(created.id);
    }
  };

  const setFieldValue = (fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const setCustomFieldValue = (fieldId: string, value: string) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const addCustomQuestion = () => {
    setCustomQuestions((prev) => [...prev, blankCustomField()]);
  };

  const updateCustomQuestion = (idx: number, updated: AnamnesisField) => {
    setCustomQuestions((prev) => prev.map((f, i) => (i === idx ? updated : f)));
  };

  const deleteCustomQuestion = (idx: number) => {
    const removed = customQuestions[idx];
    setCustomQuestions((prev) => prev.filter((_, i) => i !== idx));
    setCustomFieldValues((prev) => {
      const next = { ...prev };
      delete next[removed.id];
      return next;
    });
  };

  const moveCustomQuestion = (idx: number, dir: -1 | 1) => {
    const next = [...customQuestions];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setCustomQuestions(next);
  };

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const dataSnapshot = {
        athleteLocalId,
        templateId,
        templateSnapshot,
        conductedAt,
        customQuestions,
        fieldValues,
        customFieldValues,
        notes,
        aiSummary: null,
      };
      const prompt = buildSummaryPrompt(dataSnapshot, athleteName);
      const summary = await sendMessage(
        [{ role: 'user', content: prompt }],
        `You are an experienced sports science assistant helping a coach document an athlete intake assessment.
Based on the provided intake data, write a concise professional summary (3–5 sentences) covering:
the athlete's background and main complaint, relevant health and medical history, key movement screening findings, and the main training implications or priorities.
Use clear, clinical language suitable for professional documentation. Skip sections with no data.`,
        'claude-haiku-4-5',
        512,
      );
      setAiSummary(summary);
    } catch (err) {
      console.error('[AnamnesisTab] AI summary error', err);
      toast({ title: 'Summary failed', description: 'Could not generate summary.', variant: 'destructive' });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleSave = async () => {
    await onSave({
      athleteLocalId,
      templateId,
      templateSnapshot,
      conductedAt,
      customQuestions,
      fieldValues,
      customFieldValues,
      notes,
      aiSummary,
    });
  };

  const allSections: (AnamnesisSection & { isCustom?: boolean })[] = templateSnapshot.sections;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky meta row */}
      <div className="shrink-0 px-6 pb-4 border-b space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Date of Session</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={conductedAt}
              onChange={(e) => setConductedAt(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Template</Label>
            <div className="flex gap-1.5">
              <Select value={templateId ?? ''} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-9 text-sm flex-1">
                  <SelectValue placeholder={templates.length === 0 ? 'No templates yet…' : 'Select template…'} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setShowNewTemplate(true)}
                title="Create new template"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showNewTemplate && (
            <TemplateEditorDialog
              key="new-from-anamnesis"
              initial={{ name: '', sections: [{ id: uid(), title: '', fields: [{ id: uid(), label: '', fieldType: 'text' as const }] }] }}
              open
              onClose={() => setShowNewTemplate(false)}
              onSave={handleSaveNewTemplate}
              isSaving={savingNewTemplate}
            />
          )}
        </div>
      </div>

      {/* Scrollable form body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4 space-y-6">
          {allSections.length === 0 && !initial && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Select a template above to load the form fields.
            </p>
          )}

          {/* Template sections */}
          {allSections.map((section) => (
            <div key={section.id} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">{section.title}</h3>
              <div className="space-y-3">
                {section.fields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <AnamnesisFieldInput
                      field={field}
                      value={fieldValues[field.id] ?? ''}
                      onChange={(v) => setFieldValue(field.id, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Custom questions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Custom Questions</h3>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addCustomQuestion}>
                <Plus className="h-3 w-3" />
                Add question
              </Button>
            </div>
            {customQuestions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add questions specific to this athlete or session.
              </p>
            )}
            {customQuestions.map((field, idx) => (
              <div key={field.id} className="space-y-1.5">
                <CustomFieldEditor
                  field={field}
                  isFirst={idx === 0}
                  isLast={idx === customQuestions.length - 1}
                  onChange={(u) => updateCustomQuestion(idx, u)}
                  onDelete={() => deleteCustomQuestion(idx)}
                  onMoveUp={() => moveCustomQuestion(idx, -1)}
                  onMoveDown={() => moveCustomQuestion(idx, 1)}
                />
                {field.label && (
                  <div className="pl-1">
                    <AnamnesisFieldInput
                      field={field}
                      value={customFieldValues[field.id] ?? ''}
                      onChange={(v) => setCustomFieldValue(field.id, v)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Notes</Label>
            <Textarea
              className="min-h-[100px] resize-y text-sm"
              placeholder="Free-form observations, additional context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* AI Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">AI Summary</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
              >
                {generatingSummary
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Sparkles className="h-3 w-3" />}
                {aiSummary ? 'Regenerate' : 'Generate'}
              </Button>
            </div>
            {aiSummary ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {aiSummary}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Click "Generate" to create a professional summary of the filled-in data.
              </p>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 px-6 py-4 border-t flex items-center justify-between gap-3">
        {onDelete ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this anamnesis record?</AlertDialogTitle>
                <AlertDialogDescription>
                  This record will be permanently deleted. This action cannot be undone.
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
        ) : (
          <div />
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Record list item ──────────────────────────────────────────────────────────

function RecordCard({
  record,
  onClick,
}: {
  record: AthleteAnamnesis;
  onClick: () => void;
}) {
  const dateLabel = (() => {
    try {
      return format(parseISO(record.conductedAt + 'T12:00:00'), 'd MMM yyyy');
    } catch {
      return record.conductedAt;
    }
  })();

  const preview = record.aiSummary
    ? record.aiSummary.slice(0, 120) + (record.aiSummary.length > 120 ? '…' : '')
    : record.notes.slice(0, 120) + (record.notes.length > 120 ? '…' : '');

  const totalFields = record.templateSnapshot.sections.reduce((s, sec) => s + sec.fields.length, 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex items-start gap-3"
    >
      <div className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
        <ClipboardList className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{dateLabel}</span>
          {record.templateSnapshot.name && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {record.templateSnapshot.name}
            </Badge>
          )}
          {record.aiSummary && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              AI Summary
            </Badge>
          )}
        </div>
        {preview && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{preview}</p>
        )}
        {!preview && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">
            {totalFields} fields · {record.customQuestions.length} custom question{record.customQuestions.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
    </button>
  );
}

// ── Main tab component ────────────────────────────────────────────────────────

export function AthleteAnamnesisTab({ athlete }: { athlete: Athlete }) {
  const { toast } = useToast();
  const { anamneses, loading, createAnamnesis, updateAnamnesis, deleteAnamnesis } =
    useAthleteAnamneses(athlete.id);

  const athleteName = [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || 'Athlete';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AthleteAnamnesis | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const openNew = () => {
    setSelectedRecord(null);
    setSheetOpen(true);
  };

  const openRecord = (record: AthleteAnamnesis) => {
    setSelectedRecord(record);
    setSheetOpen(true);
  };

  const handleSave = async (data: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'>) => {
    setIsSaving(true);
    try {
      if (selectedRecord) {
        const ok = await updateAnamnesis(selectedRecord.id, data);
        if (ok) {
          toast({ title: 'Anamnesis saved' });
          setSheetOpen(false);
        } else {
          toast({ title: 'Error', description: 'Could not save.', variant: 'destructive' });
        }
      } else {
        const created = await createAnamnesis(data);
        if (created) {
          toast({ title: 'Anamnesis created' });
          setSheetOpen(false);
        } else {
          toast({ title: 'Error', description: 'Could not create record.', variant: 'destructive' });
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    setIsDeleting(true);
    const ok = await deleteAnamnesis(selectedRecord.id);
    setIsDeleting(false);
    if (ok) {
      toast({ title: 'Deleted' });
      setSheetOpen(false);
    } else {
      toast({ title: 'Error', description: 'Could not delete.', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-2 shrink-0">
        <div>
          <p className="text-xs text-muted-foreground">
            {anamneses.length > 0
              ? `${anamneses.length} record${anamneses.length !== 1 ? 's' : ''}`
              : 'No records yet'}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 h-8" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          New Anamnesis
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && anamneses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium mb-1">No anamnesis records</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create the first record to document this athlete's intake assessment.
            </p>
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Anamnesis
            </Button>
          </div>
        )}

        {!loading && anamneses.map((record) => (
          <RecordCard key={record.id} record={record} onClick={() => openRecord(record)} />
        ))}
      </div>

      {/* Sheet for create / edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
        >
          <SheetHeader className="px-6 pt-6 pb-4 shrink-0">
            <SheetTitle>
              {selectedRecord
                ? `Anamnesis · ${(() => {
                    try { return format(parseISO(selectedRecord.conductedAt + 'T12:00:00'), 'd MMM yyyy'); }
                    catch { return selectedRecord.conductedAt; }
                  })()}`
                : 'New Anamnesis'}
            </SheetTitle>
          </SheetHeader>
          <RecordForm
            initial={selectedRecord
              ? {
                  athleteLocalId: athlete.id,
                  templateId: selectedRecord.templateId,
                  templateSnapshot: selectedRecord.templateSnapshot,
                  conductedAt: selectedRecord.conductedAt,
                  customQuestions: selectedRecord.customQuestions,
                  fieldValues: selectedRecord.fieldValues,
                  customFieldValues: selectedRecord.customFieldValues,
                  notes: selectedRecord.notes,
                  aiSummary: selectedRecord.aiSummary,
                }
              : null}
            athleteLocalId={athlete.id}
            athleteName={athleteName}
            onSave={handleSave}
            onDelete={selectedRecord ? handleDelete : undefined}
            isSaving={isSaving}
            isDeleting={isDeleting}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
