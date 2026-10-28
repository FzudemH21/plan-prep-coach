/**
 * Report (Befundbericht) after the appointment — separate from the worksheet PDF. Before exporting,
 * the coach picks who it is for, the content (sections, notes, AI summary, list of attachments — data
 * minimisation, e.g. leave out nutrition for a doctor) and the language. For a third party (e.g. a
 * doctor) the coach confirms that the athlete agreed to sharing it (release from confidentiality),
 * writes the reason for referral and can have a short report (Kurzbefund) written by the AI — compact,
 * only what is stated, editable before export; the questionnaire answers are then an optional
 * appendix (off by default). The export is recorded in the change history. If the AI summary is
 * missing or older than the latest answers / notes (from the change history), the dialog offers to
 * create it first.
 */
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, FileText, Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAnamnesisChangeLog, logAnamnesisChange } from '@/utils/anamnesisChangeLog';
import { answerFileGroups, contextFor, conditionState, isAnswered } from '@/utils/anamnesisAnswers';
import type { AnamnesisPdfLang, AnamnesisPdfProps } from '@/components/pdf/AnamnesisPDF';
import type { AnamnesisAttachment, AnamnesisNote } from '@/types/anamnesis';
import { cn } from '@/lib/utils';

export interface ReportSource extends Omit<AnamnesisPdfProps, 'lang'> {
  notes: AnamnesisNote[];
  aiSummary: string | null;
  attachments: AnamnesisAttachment[];
  /** When the athlete submitted the form link (their answers count as a change) */
  formSubmittedAt?: string | null;
  contactEmail?: string;
}

/** The summary is outdated when answers or notes changed after it (change history) */
function summaryState(aiSummary: string | null, entries: Array<{ changedAt: string; summary: string }>, submittedAt?: string | null) {
  if (!aiSummary?.trim()) return 'missing' as const;
  const isSummary = (s: string) => s.startsWith('AI summary');
  const isReport = (s: string) => s.startsWith('Report created');
  const lastSummary = entries.find((e) => isSummary(e.summary))?.changedAt;
  const lastChange = [submittedAt ?? '', ...entries.filter((e) => !isSummary(e.summary) && !isReport(e.summary)).map((e) => e.changedAt)]
    .filter(Boolean).sort().pop();
  if (!lastSummary) return 'unknown' as const;
  return lastChange && lastChange > lastSummary ? 'outdated' as const : 'current' as const;
}

export function AnamnesisReportDialog({ open, onClose, recordId, source, defaultLang, changedByName, onGenerateSummary, generatingSummary, onGenerateBrief }: {
  open: boolean;
  onClose: () => void;
  recordId: string;
  source: ReportSource;
  defaultLang: AnamnesisPdfLang;
  changedByName: string;
  /** Creates (or updates) the AI summary of the record */
  onGenerateSummary: () => Promise<void>;
  generatingSummary: boolean;
  /** Writes the short report for an external recipient (not saved with the record) */
  onGenerateBrief?: (reason: string, lang: AnamnesisPdfLang) => Promise<string>;
}) {
  const { toast } = useToast();
  const { entries } = useAnamnesisChangeLog(open ? recordId : null);
  const ctx = useMemo(() => contextFor(source.sections, source.fieldValues, source.athlete.sex), [source]);
  // Sections with at least one answer (the report leaves out the rest anyway)
  const answeredSections = useMemo(() => source.sections.filter((sec) => conditionState(sec.condition, ctx) !== 'notMet'
    && sec.fields.some((f) => f.fieldType !== 'info' && isAnswered(f, source.fieldValues[f.id]))), [source, ctx]);
  const hasCustom = source.customQuestions.some((f) => f.label.trim() && isAnswered(f, source.customFieldValues[f.id]));
  // The coach's attachments + the files the athlete uploaded in the form link
  const attachmentCount = source.attachments.length
    + answerFileGroups(source.sections.flatMap((s) => s.fields), source.fieldValues).reduce((n, g) => n + g.files.length, 0);

  const [lang, setLang] = useState<AnamnesisPdfLang>(defaultLang);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [custom, setCustom] = useState(true);
  const [notes, setNotes] = useState(true);
  const [summary, setSummary] = useState(true);
  const [attachments, setAttachments] = useState(true);
  const [hideNegatives, setHideNegatives] = useState(true);
  const [audience, setAudience] = useState<'internal' | 'third'>('internal');
  const [recipient, setRecipient] = useState('');
  const [consented, setConsented] = useState(false);
  const [creating, setCreating] = useState(false);
  // For someone else: reason for referral (the coach's words) and the AI short report (editable)
  const [reason, setReason] = useState('');
  const [brief, setBrief] = useState('');
  const [briefLang, setBriefLang] = useState<AnamnesisPdfLang | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);

  /** Content defaults: everything internally; for someone else the short report, the answers only as an optional appendix */
  const applyAudience = (a: 'internal' | 'third') => {
    setAudience(a);
    const internal = a === 'internal';
    setSectionIds(internal ? answeredSections.map((s) => s.id) : []);
    setCustom(internal); setNotes(internal); setSummary(internal); setAttachments(true);
  };

  useEffect(() => {
    if (!open) return;
    setLang(defaultLang);
    applyAudience('internal');
    setHideNegatives(true);
    setRecipient(''); setConsented(false);
    setReason(''); setBrief(''); setBriefLang(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sumState = summaryState(source.aiSummary, entries, source.formSubmittedAt);
  const third = audience === 'third';
  const hasBrief = third && !!brief.trim();
  const canCreate = !creating && !generatingBrief && (!third || (recipient.trim().length > 1 && consented))
    && (hasBrief || (third && !!reason.trim()) || sectionIds.length > 0 || (notes && source.notes.length > 0) || (summary && !!source.aiSummary));

  const createBrief = async () => {
    if (!onGenerateBrief) return;
    setGeneratingBrief(true);
    try {
      setBrief((await onGenerateBrief(reason, lang)).trim());
      setBriefLang(lang);
    } catch (err) {
      console.error('[AnamnesisReportDialog] short report error', err);
      toast({ title: 'Short report failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setGeneratingBrief(false);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const [{ pdf }, { AnamnesisReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/AnamnesisPDF'),
      ]);
      const include = { sectionIds, customQuestions: custom, notes, summary, attachments, hideNegatives };
      const blob = await pdf(
        <AnamnesisReportPDF {...source} lang={lang} include={include} recipient={third ? recipient.trim() : undefined}
          brief={third && (reason.trim() || brief.trim()) ? { reason, text: brief } : undefined} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${lang === 'de' ? 'Befundbericht' : 'Assessment_report'}_${source.athlete.name.replace(/[^\p{L}\p{N}]+/gu, '_')}_${source.conductedAt}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Who got which content — in the change history (for a third party with the confirmed consent)
      const sectionNames = source.sections.filter((s) => sectionIds.includes(s.id)).map((s) => s.title);
      const contentText = [
        ...(third && reason.trim() ? ['Reason for referral'] : []),
        ...(hasBrief ? ['Short report'] : []),
        ...sectionNames.map((n) => (hasBrief ? `Appendix: ${n}` : n)),
        ...(custom && hasCustom ? ['Custom questions'] : []),
        ...(notes && source.notes.length ? ['Notes'] : []),
        ...(summary && source.aiSummary ? ['AI summary'] : []),
        ...(attachments && source.attachments.length ? ['Attachment list'] : []),
      ].join(', ');
      void logAnamnesisChange(recordId, changedByName,
        third ? `Report created for ${recipient.trim()} — athlete's consent confirmed` : 'Report created (internal / for the athlete)',
        [
          { what: 'Recipient', from: '—', to: third ? `${recipient.trim()} (consent to sharing confirmed)` : 'Internal / the athlete' },
          { what: 'Content', from: '—', to: contentText || '—' },
          { what: 'Language', from: '—', to: lang === 'de' ? 'German' : 'English' },
          // What exactly was sent (the short report is not kept anywhere else)
          ...(third && reason.trim() ? [{ what: 'Reason for referral', from: '—', to: reason.trim() }] : []),
          ...(hasBrief ? [{ what: 'Short report', from: '—', to: brief.trim() }] : []),
        ]);
      toast({ title: 'Report created' });
      onClose();
    } catch (err) {
      console.error('[AnamnesisReportDialog] PDF error', err);
      const message = err instanceof Error ? err.message : String(err);
      const stale = /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(message);
      toast({
        title: 'Report failed',
        description: stale ? 'The app was updated in the meantime — reload the page and try again.' : message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const toggle = (id: string, on: boolean) => setSectionIds((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  const Check = ({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean }) => (
    <label className={cn('flex items-center gap-2 text-sm cursor-pointer', disabled && 'opacity-50 cursor-default')}>
      <Checkbox checked={checked && !disabled} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
      <span>{children}</span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto z-[130]" overlayClassName="z-[120] bg-black/85">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Report (Befundbericht)</DialogTitle>
          <DialogDescription>
            A compact report after the appointment. For someone else (e.g. a physio or doctor): your reason for referral and a one-page short report; the answers only as an optional appendix.
          </DialogDescription>
        </DialogHeader>

        {/* Summary check */}
        {sumState !== 'current' && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 space-y-2">
            <p className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {sumState === 'missing' && 'There is no AI summary yet. Create the summary now?'}
              {sumState === 'outdated' && 'Answers or notes changed after the AI summary was created. Update the summary now?'}
              {sumState === 'unknown' && 'It isn\'t recorded when the AI summary was created — it may not include the latest answers or notes. Update it now?'}
            </p>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 bg-background" disabled={generatingSummary} onClick={() => { void onGenerateSummary(); }}>
              {generatingSummary ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {sumState === 'missing' ? 'Create summary' : 'Update summary'}
            </Button>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Who is it for?</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={!third} onChange={() => applyAudience('internal')} className="accent-primary" />
                Internal / for the athlete
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={third} onChange={() => applyAudience('third')} className="accent-primary" />
                Someone else (e.g. a doctor)
              </label>
            </div>
            {third && (
              <div className="rounded-md border p-2.5 space-y-2 bg-muted/30">
                <Input className="h-8 text-sm" placeholder="Recipient, e.g. Dr. Müller (Orthopädie)" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <Checkbox className="mt-0.5" checked={consented} onCheckedChange={(v) => setConsented(v === true)} />
                  <span>
                    The athlete has agreed that we share this report with this person (release from confidentiality).
                    {' '}This is recorded in the change history.
                  </span>
                </label>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Language of the report</Label>
            <div className="flex rounded-md border overflow-hidden w-fit text-sm">
              {(['de', 'en'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)}
                  className={cn('px-3 py-1.5', lang === l ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')}>
                  {l === 'de' ? 'Deutsch' : 'English'}
                </button>
              ))}
            </div>
          </div>

          {/* Someone else: reason for referral + short report */}
          {third && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason for referral / question (your words — printed as written)</Label>
              <Textarea className="min-h-[64px] text-sm" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={lang === 'de'
                  ? 'z. B. Bitte um ärztliche Abklärung der Schmerzen im unteren Rücken vor dem Wiedereinstieg ins Sprinttraining.'
                  : 'e.g. Please assess the lower back pain before the athlete returns to sprint training.'} />
              <div className="flex items-center justify-between gap-2 pt-1">
                <Label className="text-xs text-muted-foreground">Short report (Kurzbefund)</Label>
                {onGenerateBrief && (
                  <Button size="sm" variant="outline" className="h-7 gap-1.5" disabled={generatingBrief} onClick={() => { void createBrief(); }}>
                    {generatingBrief ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {brief ? 'Write again' : 'Write with AI'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                One page in referral style: current complaints, history, findings from the appointment, diagnostics &amp; treatment,
                medication. Only what is stated — no conclusions of its own. Check and edit before exporting.
              </p>
              {(brief || generatingBrief) && (
                <Textarea className="min-h-[220px] text-sm font-mono" value={brief} onChange={(e) => setBrief(e.target.value)} disabled={generatingBrief} />
              )}
              {brief && briefLang && briefLang !== lang && (
                <p className="text-xs text-amber-700">Written in {briefLang === 'de' ? 'German' : 'English'} — write again for {lang === 'de' ? 'German' : 'English'}.</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{third ? 'Also include (the answers come as an appendix)' : 'Content'}</Label>
            <div className="rounded-md border p-2.5 space-y-1.5">
              {answeredSections.length === 0 && <p className="text-xs text-muted-foreground">No answered questions.</p>}
              {answeredSections.map((sec) => (
                <Check key={sec.id} checked={sectionIds.includes(sec.id)} onChange={(v) => toggle(sec.id, v)}>{sec.title}</Check>
              ))}
              {hasCustom && <Check checked={custom} onChange={setCustom}>Custom questions</Check>}
              <div className="border-t my-1.5" />
              <Check checked={notes} onChange={setNotes} disabled={source.notes.length === 0}>Notes from the appointment ({source.notes.length})</Check>
              <Check checked={summary} onChange={setSummary} disabled={!source.aiSummary}>AI summary{third ? ' (internal one)' : ''}</Check>
              <Check checked={attachments} onChange={setAttachments} disabled={attachmentCount === 0}>List of attachments ({attachmentCount})</Check>
              <div className="border-t my-1.5" />
              <Check checked={hideNegatives} onChange={setHideNegatives}>
                Leave out "no / none" answers
                <span className="block text-xs text-muted-foreground">Only selected answers (e.g. "Nein", "Keine", checklist items answered "Nein") — text answers always stay.</span>
              </Check>
            </div>
          </div>

          {entries.length > 0 && entries[0] && (
            <p className="text-[11px] text-muted-foreground">Last change: {format(parseISO(entries[0].changedAt), 'd MMM yyyy, HH:mm')} — {entries[0].summary}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button onClick={create} disabled={!canCreate} className="gap-1.5">
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Create report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
