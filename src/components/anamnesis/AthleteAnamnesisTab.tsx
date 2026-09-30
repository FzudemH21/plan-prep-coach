import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ChevronUp, ChevronDown, Pencil, Paperclip, FileText, FileImage, ExternalLink, Send, ShieldCheck, Printer,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import type { AnamnesisPdfLang } from '@/components/pdf/AnamnesisPDF';
import { AnamnesisNotesPanel, type NotesChange } from '@/components/anamnesis/AnamnesisNotesPanel';
import { AnamnesisChangeHistory } from '@/components/anamnesis/AnamnesisChangeHistory';
import { diffAnamnesis, logAnamnesisChange, type AnamnesisAnswersSnapshot } from '@/utils/anamnesisChangeLog';
import { useAthleteAnamneses } from '@/hooks/useAthleteAnamneses';
import { useAnamnesisTemplates } from '@/hooks/useAnamnesisTemplates';
import { TemplateEditorDialog } from '@/components/anamnesis/AnamnesisTemplateEditor';
import { FormLinkBox, PrivacyNoticeDialog, ProfileAnswersBanner, SendFormLinkDialog } from '@/components/anamnesis/AnamnesisFormLink';
import { useCoachPrivacyNotice, isPrivacyNoticeComplete } from '@/hooks/useCoachPrivacyNotice';
import { Checkbox } from '@/components/ui/checkbox';
import { sendMessage } from '@/utils/anthropicApi';
import { uploadAnamnesisFile, deleteFile, getSignedUrl } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { SEX_LABELS, type Athlete } from '@/types/athlete';
import {
  isAthleteSection,
  type AthleteAnamnesis, type AnamnesisField, type AnamnesisFieldType, type AnamnesisSection, type AnamnesisAttachment,
  type AnamnesisTemplateDraft, type AnamnesisConsent, type AnamnesisNote,
  noteEntriesOf, notesAsText,
} from '@/types/anamnesis';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trail = idx < lines.length - 1 ? '\n' : '';
    if (/^#{1,2} /.test(line)) {
      const content = line.replace(/^#{1,2} /, '');
      return <React.Fragment key={idx}><strong>{content}</strong>{trail}</React.Fragment>;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const inline = parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i}>{p.slice(2, -2)}</strong>
        : p
    );
    return <React.Fragment key={idx}>{inline}{trail}</React.Fragment>;
  });
}

function stripMarkdown(text: string): string {
  return text.replace(/^#{1,6} /gm, '').replace(/\*\*([^*]+)\*\*/g, '$1');
}

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

  const notes = noteEntriesOf(record);
  if (notes.length > 0) {
    parts.push('Notes from the appointment (dictated notes are speech-to-text and may contain recognition errors):');
    for (const n of notes) {
      parts.push(`- [${n.createdAt.slice(0, 16).replace('T', ' ')}${n.source === 'dictated' ? ', dictated' : ''}] ${n.text}`);
    }
  }

  return parts.join('\n');
}

// ── Record form (create / edit) ───────────────────────────────────────────────

interface RecordFormProps {
  initial: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'> | null;
  athleteLocalId: string;
  athleteName: string;
  /** For the printed PDF: the athlete's details, and consent / language of a form-link record */
  athlete?: Athlete;
  consent?: AnamnesisConsent | null;
  formLanguage?: string | null;
  coachUserId: string;
  /** Saves the record; resolves with its id (null = not saved) */
  onSave: (data: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  /** Id of a saved record — notes and the AI summary are saved right away, changes are logged */
  recordId?: string;
  onPatch?: (updates: Partial<Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'athleteLocalId' | 'createdAt'>>) => Promise<boolean>;
  /** Unsaved changes in edit mode (the dialog asks before closing) */
  onDirtyChange?: (dirty: boolean) => void;
  onDelete?: () => Promise<void>;
  isSaving: boolean;
  isDeleting: boolean;
}

function RecordForm({
  initial,
  athleteLocalId,
  athleteName,
  athlete,
  consent,
  formLanguage,
  coachUserId,
  onSave,
  recordId,
  onPatch,
  onDirtyChange,
  onDelete,
  isSaving,
  isDeleting,
}: RecordFormProps) {
  const { templates, createTemplate, updateTemplate, deleteTemplate } = useAnamnesisTemplates();
  const { profile: coachProfile } = useCoachProfile();
  const { user } = useAuth();
  const changedByName = coachProfile?.name || user?.email || '';
  const [printing, setPrinting] = useState(false);
  // Saved records open read-only; "Edit" switches to the form (no accidental changes)
  const [mode, setMode] = useState<'view' | 'edit'>(initial ? 'view' : 'edit');

  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [savingNewTemplate, setSavingNewTemplate] = useState(false);
  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [savingEditTemplate, setSavingEditTemplate] = useState(false);
  const [savingEditAsNew, setSavingEditAsNew] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

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
  const [noteEntries, setNoteEntries] = useState<AnamnesisNote[]>(() => (initial ? noteEntriesOf(initial) : []));
  const [aiSummary, setAiSummary] = useState<string | null>(initial?.aiSummary ?? null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [attachments, setAttachments] = useState<AnamnesisAttachment[]>(initial?.attachments ?? []);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Last saved answers — for "Cancel" in edit mode and the change history
  const [savedAnswers, setSavedAnswers] = useState<(AnamnesisAnswersSnapshot & { templateId: string | null }) | null>(() => (initial
    ? {
        conductedAt: initial.conductedAt,
        templateId: initial.templateId,
        templateSnapshot: initial.templateSnapshot,
        customQuestions: initial.customQuestions,
        fieldValues: initial.fieldValues,
        customFieldValues: initial.customFieldValues,
        attachments: initial.attachments ?? [],
      }
    : null));
  // Saved attachments removed in edit mode: their files are deleted only when the edit is saved
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const currentAnswers = (): AnamnesisAnswersSnapshot & { templateId: string | null } => ({
    conductedAt, templateId, templateSnapshot, customQuestions, fieldValues, customFieldValues, attachments,
  });
  const dirty = mode === 'edit' && (savedAnswers
    ? JSON.stringify(currentAnswers()) !== JSON.stringify(savedAnswers)
    : templateId !== null || customQuestions.length > 0 || attachments.length > 0 || noteEntries.length > 0
      || Object.values(fieldValues).some((v) => v?.trim()));
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const discardEdits = () => {
    if (!savedAnswers) return;
    const savedPaths = new Set(savedAnswers.attachments.map((a) => a.path));
    // Files uploaded during this edit are not needed any more
    attachments.filter((a) => !savedPaths.has(a.path)).forEach((a) => { deleteFile(a.path).catch(() => {}); });
    setConductedAt(savedAnswers.conductedAt);
    setTemplateId(savedAnswers.templateId);
    setTemplateSnapshot(savedAnswers.templateSnapshot);
    setCustomQuestions(savedAnswers.customQuestions);
    setFieldValues(savedAnswers.fieldValues);
    setCustomFieldValues(savedAnswers.customFieldValues);
    setAttachments(savedAnswers.attachments);
    setRemovedPaths([]);
    setMode('view');
  };

  /** Notes are additions: saved right away for a saved record (and logged), with the record otherwise */
  const handleNotesChange = async (next: AnamnesisNote[], change: NotesChange): Promise<boolean> => {
    if (!onPatch || !recordId) { setNoteEntries(next); return true; }
    const ok = await onPatch({ noteEntries: next, notes: notesAsText(next) });
    if (!ok) {
      toast({ title: 'Note not saved', description: 'Please try again.', variant: 'destructive' });
      return false;
    }
    setNoteEntries(next);
    void logAnamnesisChange(recordId, changedByName, change.summary, change.changes);
    return true;
  };

  // Load signed URLs for any attachment that doesn't have one yet
  useEffect(() => {
    const missing = attachments.filter((a) => !signedUrls[a.path]);
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        missing.map(async (a) => {
          try { updates[a.path] = await getSignedUrl(a.path, 3600); } catch { /* ignore */ }
        }),
      );
      if (Object.keys(updates).length > 0) setSignedUrls((prev) => ({ ...prev, ...updates }));
    })();
  }, [attachments]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    const oversized = files.filter((f) => f.size > 20 * 1024 * 1024);
    if (oversized.length > 0) {
      toast({ title: 'File too large', description: 'Each file must be under 20 MB.', variant: 'destructive' });
      return;
    }
    setUploadingFile(true);
    try {
      const uploaded = await Promise.all(
        files.map((f) => uploadAnamnesisFile(coachUserId, athleteLocalId, f)),
      );
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error('[AnamnesisTab] upload error', err);
      toast({ title: 'Upload failed', description: 'Could not upload file.', variant: 'destructive' });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = async (path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
    setSignedUrls((prev) => { const next = { ...prev }; delete next[path]; return next; });
    // A saved attachment stays until the edit is saved (Cancel brings it back)
    if (savedAnswers?.attachments.some((a) => a.path === path)) setRemovedPaths((prev) => [...prev, path]);
    else deleteFile(path).catch(() => {});
  };

  const handleTemplateChange = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setTemplateSnapshot({ name: t.name, sections: t.sections, ...(t.introText ? { introText: t.introText } : {}) });
    setFieldValues({});
    setCustomFieldValues({});
    setAiSummary(null);
  };

  const handleSaveNewTemplate = async ({ name, sections, introText }: AnamnesisTemplateDraft) => {
    setSavingNewTemplate(true);
    const created = await createTemplate(name, sections, introText);
    setSavingNewTemplate(false);
    if (created) {
      setShowNewTemplate(false);
      handleTemplateChange(created.id);
    }
  };

  const handleSaveEditTemplate = async ({ name, sections, introText }: AnamnesisTemplateDraft) => {
    if (!templateId) return;
    setSavingEditTemplate(true);
    const ok = await updateTemplate(templateId, { name, sections, introText });
    setSavingEditTemplate(false);
    if (ok) {
      setShowEditTemplate(false);
      setTemplateSnapshot({ name, sections, ...(introText.trim() ? { introText: introText.trim() } : {}) });
    }
  };

  const handleSaveEditAsNewTemplate = async ({ name, sections, introText }: AnamnesisTemplateDraft) => {
    setSavingEditAsNew(true);
    const created = await createTemplate(name, sections, introText);
    setSavingEditAsNew(false);
    if (created) {
      setShowEditTemplate(false);
      handleTemplateChange(created.id);
    }
  };

  const handleDeleteEditTemplate = async () => {
    if (!templateId) return;
    setDeletingTemplate(true);
    const ok = await deleteTemplate(templateId);
    setDeletingTemplate(false);
    if (ok) {
      setShowEditTemplate(false);
      setTemplateId(null);
      setTemplateSnapshot({ name: '', sections: [] });
      setFieldValues({});
      setCustomFieldValues({});
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
      const dataSnapshot: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'> = {
        athleteLocalId,
        templateId,
        templateSnapshot,
        conductedAt,
        customQuestions,
        fieldValues,
        customFieldValues,
        notes: '',
        noteEntries,
        aiSummary: null,
        attachments,
      };
      const prompt = buildSummaryPrompt(dataSnapshot, athleteName);
      const summary = await sendMessage(
        [{ role: 'user', content: prompt }],
        `You are an experienced sports scientist and physiotherapist documenting an athlete's intake assessment (anamnesis).
You receive the intake answers (partly filled in by the athlete through an online form) and the coach's notes from the appointment. Dictated notes are speech-to-text and may contain recognition errors — interpret them sensibly, never invent content.

Write a structured summary with exactly these five headings, each as a Markdown "## " heading, with short "- " bullet points below:
English: Main findings / Relevant history / Training implications / Contraindications & precautions / Open questions
German: Hauptbefunde / Relevante Vorgeschichte / Konsequenzen für das Training / Kontraindikationen & Vorsichtsmaßnahmen / Offene Fragen
Write in the language most of the answers and notes are in (German or English), headings included.
Only use the information given. Where a heading has nothing, write "- None noted" (German: "- Keine Angaben"). Use precise, clinical language suitable for professional documentation.`,
        'claude-sonnet-4-5',
        1500,
      );
      const previous = aiSummary;
      setAiSummary(summary);
      // A saved record keeps the summary right away (no need to switch to edit mode)
      if (onPatch && recordId) {
        const ok = await onPatch({ aiSummary: summary });
        if (ok) {
          void logAnamnesisChange(recordId, changedByName, previous ? 'AI summary updated' : 'AI summary created',
            [{ what: 'AI summary', from: previous ?? '—', to: summary }]);
        }
      }
    } catch (err) {
      console.error('[AnamnesisTab] AI summary error', err);
      toast({ title: 'Summary failed', description: 'Could not generate summary.', variant: 'destructive' });
    } finally {
      setGeneratingSummary(false);
    }
  };

  /** PDF of what is in the form right now (also unsaved changes) — for the first appointment */
  const handlePrint = async (lang: AnamnesisPdfLang) => {
    setPrinting(true);
    try {
      const [{ pdf }, { AnamnesisPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/AnamnesisPDF'),
      ]);
      const blob = await pdf(
        <AnamnesisPDF
          lang={lang}
          templateName={templateSnapshot.name}
          sections={templateSnapshot.sections}
          customQuestions={customQuestions}
          fieldValues={fieldValues}
          customFieldValues={customFieldValues}
          conductedAt={conductedAt}
          consent={consent}
          athlete={{
            name: athleteName,
            birthday: athlete?.birthday,
            sex: athlete?.sex,
            sports: athlete?.sports?.length ? athlete.sports : athlete?.sport ? [athlete.sport] : [],
            occupation: athlete?.occupation,
          }}
          branding={coachProfile?.branding}
          coachName={coachProfile?.name}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${lang === 'de' ? 'Anamnese' : 'Anamnesis'}_${athleteName.replace(/[^\p{L}\p{N}]+/gu, '_')}_${conductedAt}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[AnamnesisTab] PDF error', err);
      toast({ title: 'PDF failed', description: 'Could not create the PDF.', variant: 'destructive' });
    } finally {
      setPrinting(false);
    }
  };
  const printLangs: AnamnesisPdfLang[] = formLanguage === 'en' ? ['en', 'de'] : ['de', 'en'];

  const handleSave = async () => {
    const answers = currentAnswers();
    const id = await onSave({
      athleteLocalId,
      templateId,
      templateSnapshot,
      conductedAt,
      customQuestions,
      fieldValues,
      customFieldValues,
      notes: notesAsText(noteEntries),
      noteEntries,
      aiSummary,
      attachments,
    });
    if (!id) return;
    removedPaths.forEach((p) => { deleteFile(p).catch(() => {}); });
    setRemovedPaths([]);
    if (savedAnswers) {
      const changes = diffAnamnesis(savedAnswers, answers);
      if (changes.length > 0) {
        void logAnamnesisChange(id, changedByName, `Answers edited (${changes.length} change${changes.length === 1 ? '' : 's'})`, changes);
      }
    } else {
      void logAnamnesisChange(id, changedByName, 'Anamnesis created');
    }
    setSavedAnswers(answers);
    setMode('view');
  };

  const conductedLabel = (() => {
    try { return format(parseISO(`${conductedAt}T12:00:00`), 'd MMM yyyy'); } catch { return conductedAt; }
  })();
  const readOnly = mode === 'view';
  const customWithLabels = customQuestions.filter((f) => f.label.trim());

  const allSections: (AnamnesisSection & { isCustom?: boolean })[] = templateSnapshot.sections;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sticky meta row */}
      <div className="shrink-0 px-6 pb-4 border-b space-y-3">
        {readOnly ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span><span className="text-xs text-muted-foreground mr-1.5">Date of session</span>{conductedLabel}</span>
            <span><span className="text-xs text-muted-foreground mr-1.5">Template</span>{templateSnapshot.name || '—'}</span>
            <span className="text-xs text-muted-foreground ml-auto">Read-only — click "Edit" to change answers</span>
          </div>
        ) : (
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
              {templateId && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setShowEditTemplate(true)}
                  title="Edit selected template"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
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
          {showEditTemplate && templateId && (() => {
            const t = templates.find((x) => x.id === templateId);
            return t ? (
              <TemplateEditorDialog
                key={`edit-${templateId}`}
                initial={{ name: t.name, sections: t.sections, introText: t.introText }}
                open
                onClose={() => setShowEditTemplate(false)}
                onSave={handleSaveEditTemplate}
                isSaving={savingEditTemplate}
                onSaveAsNew={handleSaveEditAsNewTemplate}
                isSavingAsNew={savingEditAsNew}
                onDelete={handleDeleteEditTemplate}
                isDeleting={deletingTemplate}
              />
            ) : null;
          })()}
        </div>
        )}
      </div>

      {/* Scrollable form body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-4 space-y-6">
          {allSections.length === 0 && !initial && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Select a template above to load the form fields.
            </p>
          )}

          {/* Template sections */}
          {allSections.map((section) => (
            <div key={section.id} className="space-y-3">
              <div className="flex items-end justify-between gap-3 border-b pb-1">
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                {/* Whether the athlete fills in this section through the form link — for this anamnesis */}
                {readOnly ? (
                  isAthleteSection(section) && <span className="text-xs text-muted-foreground shrink-0">Filled in by athlete</span>
                ) : (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
                  <Checkbox
                    checked={isAthleteSection(section)}
                    onCheckedChange={(v) => setTemplateSnapshot((prev) => ({
                      ...prev,
                      sections: prev.sections.map((s) => (s.id === section.id ? { ...s, athleteFills: v === true } : s)),
                    }))}
                    className="h-3.5 w-3.5"
                  />
                  Filled in by athlete
                </label>
                )}
              </div>
              <div className="space-y-3">
                {section.fields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <AnamnesisFieldInput
                      field={field}
                      value={fieldValues[field.id] ?? ''}
                      onChange={(v) => setFieldValue(field.id, v)}
                      readOnly={readOnly}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Custom questions */}
          {readOnly ? (
            customWithLabels.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold border-b pb-1">Custom Questions</h3>
                {customWithLabels.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <AnamnesisFieldInput field={field} value={customFieldValues[field.id] ?? ''} onChange={() => {}} readOnly />
                  </div>
                ))}
              </div>
            )
          ) : (
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

          )}

          {/* Notes — typed or dictated; work in the read-only view too */}
          <AnamnesisNotesPanel
            entries={noteEntries}
            onChange={handleNotesChange}
            coachUserId={coachUserId}
            athleteLocalId={athleteLocalId}
          />

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Attachments</Label>
              {!readOnly && <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
              >
                {uploadingFile
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Paperclip className="h-3 w-3" />}
                {uploadingFile ? 'Uploading…' : 'Add file'}
              </Button>}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                multiple
                onChange={handleFileSelect}
              />
            </div>
            {attachments.length === 0 && !uploadingFile && (
              <p className="text-xs text-muted-foreground">
                {readOnly ? 'No attachments.' : 'Attach images or documents (max 20 MB each).'}
              </p>
            )}
            <div className="space-y-1.5">
              {attachments.map((att) => (
                <div
                  key={att.path}
                  className="flex items-center gap-2 p-2 rounded border bg-background"
                >
                  {att.type === 'image' && signedUrls[att.path] ? (
                    <img
                      src={signedUrls[att.path]}
                      alt={att.name}
                      className="h-10 w-10 rounded object-cover shrink-0 cursor-pointer"
                      onClick={() => window.open(signedUrls[att.path], '_blank')}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                      {att.type === 'image'
                        ? <FileImage className="h-5 w-5 text-muted-foreground" />
                        : <FileText className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{att.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {att.size >= 1024 * 1024
                        ? `${(att.size / 1024 / 1024).toFixed(1)} MB`
                        : `${Math.round(att.size / 1024)} KB`}
                    </p>
                  </div>
                  {signedUrls[att.path] && (
                    <a
                      href={signedUrls[att.path]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemoveAttachment(att.path)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
                {renderMarkdown(aiSummary)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Click "Generate" for a structured summary of the answers and your notes (main findings, history, training implications, contraindications, open questions).
              </p>
            )}
          </div>

          {recordId && <AnamnesisChangeHistory anamnesisId={recordId} />}
        </div>
      </div>

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
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={printing || templateSnapshot.sections.length === 0}
                title="Worksheet for the appointment: answers given so far, space to write for everything else"
              >
                {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                Print PDF
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[100]">
              {printLangs.map((l) => (
                <DropdownMenuItem key={l} onClick={() => handlePrint(l)}>
                  {l === 'de' ? 'German labels (Deutsch)' : 'English labels'}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {readOnly ? (
            <Button size="sm" className="gap-1.5" onClick={() => setMode('edit')}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <>
              {savedAnswers && (
                <Button variant="ghost" size="sm" onClick={discardEdits} disabled={isSaving}>
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </>
          )}
        </div>
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
    ? (() => { const s = stripMarkdown(record.aiSummary!); return s.slice(0, 120) + (s.length > 120 ? '…' : ''); })()
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
          {(record.attachments?.length ?? 0) > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1">
              <Paperclip className="h-2.5 w-2.5" />
              {record.attachments.length}
            </Badge>
          )}
          {record.formStatus === 'sent' && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-300 text-amber-800 bg-amber-50">
              {record.formExpiresAt && new Date(record.formExpiresAt) < new Date() ? 'Form link expired' : 'Waiting for athlete'}
            </Badge>
          )}
          {record.formStatus === 'submitted' && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 border-blue-300 text-blue-800 bg-blue-50">
              Filled in by athlete
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

interface AthleteAnamnesisTabProps {
  athlete: Athlete;
  /** Open the "New Anamnesis" dialog immediately (hand-off from the Add Athlete dialog). */
  autoOpenNew?: boolean;
  onAutoOpenHandled?: () => void;
  /** Saves profile changes the athlete made in the anamnesis form ("About you") */
  onUpdateAthlete?: (updates: Partial<Athlete>) => Promise<void>;
}

export function AthleteAnamnesisTab({ athlete, autoOpenNew = false, onAutoOpenHandled, onUpdateAthlete }: AthleteAnamnesisTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    anamneses, loading, createAnamnesis, updateAnamnesis, deleteAnamnesis,
    sendFormLink, updateFormLink, markProfileApplied,
  } = useAthleteAnamneses(athlete.id);
  const privacy = useCoachPrivacyNotice();
  const [sendOpen, setSendOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const athleteName = [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || 'Athlete';

  // Basic profile info shown above the form so the coach has context without re-entering it
  const athleteInfoLine = useMemo(() => {
    const age = athlete.birthday
      ? Math.floor((Date.now() - new Date(athlete.birthday + 'T12:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;
    const sports = athlete.sports?.length ? athlete.sports : athlete.sport ? [athlete.sport] : [];
    return [
      athleteName,
      age !== null ? `${age} years` : null,
      athlete.sex ? SEX_LABELS[athlete.sex] : null,
      sports.length ? sports.join(', ') : null,
      athlete.occupation,
    ].filter(Boolean).join(' · ');
  }, [athlete, athleteName]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AthleteAnamnesis | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Unsaved changes in edit mode → ask before the dialog closes
  const [formDirty, setFormDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const handleDialogOpenChange = (open: boolean) => {
    if (!open && formDirty) { setConfirmDiscardOpen(true); return; }
    setSheetOpen(open);
    if (!open) setFormDirty(false);
  };

  const openNew = () => {
    setSelectedRecord(null);
    setSheetOpen(true);
  };

  useEffect(() => {
    if (autoOpenNew) {
      openNew();
      onAutoOpenHandled?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNew]);

  const openRecord = (record: AthleteAnamnesis) => {
    setSelectedRecord(record);
    setSheetOpen(true);
  };

  /** Resolves with the record's id when saved. An edited record stays open (back in the read-only view). */
  const handleSave = async (data: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    setIsSaving(true);
    try {
      if (selectedRecord) {
        const ok = await updateAnamnesis(selectedRecord.id, data);
        if (ok) {
          toast({ title: 'Anamnesis saved' });
          return selectedRecord.id;
        }
        toast({ title: 'Error', description: 'Could not save.', variant: 'destructive' });
        return null;
      }
      const created = await createAnamnesis(data);
      if (created) {
        toast({ title: 'Anamnesis created' });
        setFormDirty(false);
        setSheetOpen(false);
        return created.id;
      }
      toast({ title: 'Error', description: 'Could not create record.', variant: 'destructive' });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    // Fire-and-forget cleanup of stored files
    (selectedRecord.attachments ?? []).forEach((att) => {
      deleteFile(att.path).catch(() => {});
    });
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
            {loading
              ? 'Loading…'
              : anamneses.length > 0
                ? `${anamneses.length} record${anamneses.length !== 1 ? 's' : ''}`
                : 'No records yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setPrivacyOpen(true)} title="Privacy notice shown in the form link">
            <ShieldCheck className="h-3.5 w-3.5" />
            Privacy notice
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setSendOpen(true)}>
            <Send className="h-3.5 w-3.5" />
            Send form link
          </Button>
          <Button size="sm" className="gap-1.5 h-8" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            New Anamnesis
          </Button>
        </div>
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

        {!loading && onUpdateAthlete && anamneses.map((record) => (
          <ProfileAnswersBanner
            key={`profile-${record.id}`}
            athlete={athlete}
            record={record}
            onApply={async (patch) => {
              await onUpdateAthlete(patch);
              await markProfileApplied(record.id);
              toast({ title: 'Profile updated' });
            }}
            onDismiss={() => markProfileApplied(record.id)}
          />
        ))}

        {!loading && anamneses.map((record) => (
          <RecordCard key={record.id} record={record} onClick={() => openRecord(record)} />
        ))}
      </div>

      {/* Dialog for create / edit */}
      <Dialog open={sheetOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-[720px] w-full max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle>
              {selectedRecord
                ? `Anamnesis · ${(() => {
                    try { return format(parseISO(selectedRecord.conductedAt + 'T12:00:00'), 'd MMM yyyy'); }
                    catch { return selectedRecord.conductedAt; }
                  })()}`
                : 'New Anamnesis'}
            </DialogTitle>
            <DialogDescription>{athleteInfoLine}</DialogDescription>
          </DialogHeader>
          {selectedRecord && (() => {
            const live = anamneses.find(a => a.id === selectedRecord.id) ?? selectedRecord;
            const consent = live.consent;
            if (live.formStatus !== 'sent' && !consent) {
              const noticeReady = isPrivacyNoticeComplete(privacy);
              return (
                <div className="px-6 pb-3 shrink-0 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={!noticeReady}
                    onClick={async () => {
                      const ok = await updateFormLink(live.id, 'renew');
                      toast(ok
                        ? { title: 'Form link created', description: 'Copy it from the box above the form.' }
                        : { title: 'Could not create the link', variant: 'destructive' });
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send form link for this anamnesis
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {noticeReady
                      ? 'The athlete fills in the sections ticked "Filled in by athlete". Save your changes first.'
                      : 'Add your privacy notice first (button above the list), plus business name and contact email in your Coach Profile.'}
                  </span>
                </div>
              );
            }
            return (
              <div className="px-6 pb-3 space-y-2 shrink-0">
                <FormLinkBox
                  record={live}
                  athleteName={athleteName}
                  onRenew={() => updateFormLink(live.id, 'renew')}
                  onWithdraw={() => updateFormLink(live.id, 'withdraw')}
                />
                {live.formStatus === 'sent' && (
                  <p className="text-xs text-muted-foreground">
                    Saving here while the athlete is still filling in the form can overwrite their latest answers.
                  </p>
                )}
                {consent && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    Filled in by the athlete on {format(parseISO(consent.consentedAt), 'd MMM yyyy, HH:mm')} · consent given
                    {consent.guardianName ? ` by parent/guardian ${consent.guardianName}` : ''}
                    {consent.noticeVersion ? ` · privacy notice v${consent.noticeVersion}` : ''}
                    {consent.language ? ` · ${consent.language.toUpperCase()}` : ''}
                  </p>
                )}
              </div>
            );
          })()}
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
                  noteEntries: selectedRecord.noteEntries,
                  aiSummary: selectedRecord.aiSummary,
                  attachments: selectedRecord.attachments ?? [],
                }
              : null}
            athleteLocalId={athlete.id}
            athleteName={athleteName}
            athlete={athlete}
            consent={selectedRecord ? (anamneses.find(a => a.id === selectedRecord.id) ?? selectedRecord).consent : null}
            formLanguage={selectedRecord?.formLanguage}
            coachUserId={user?.id ?? ''}
            onSave={handleSave}
            recordId={selectedRecord?.id}
            onPatch={selectedRecord ? (updates) => updateAnamnesis(selectedRecord.id, updates) : undefined}
            onDirtyChange={setFormDirty}
            onDelete={selectedRecord ? handleDelete : undefined}
            isSaving={isSaving}
            isDeleting={isDeleting}
          />
        </DialogContent>
      </Dialog>

      <SendFormLinkDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        athleteName={athleteName}
        privacy={privacy}
        onCreate={(templateId, snapshot) => sendFormLink(templateId, snapshot)}
        onRenew={(id) => updateFormLink(id, 'renew')}
        onWithdraw={(id) => updateFormLink(id, 'withdraw')}
      />
      <PrivacyNoticeDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} privacy={privacy} />

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You changed answers in edit mode without saving. Notes and the AI summary are already saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmDiscardOpen(false); setFormDirty(false); setSheetOpen(false); }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
