/**
 * Files the athlete uploads in the anamnesis form link, below a question with "allowFiles"
 * (e.g. an MRI report under "What came out of it?").
 *
 * Stored in the documents bucket under anamnesis-form/<anamnesis id>/<form token>/<file>; the
 * list is the answer "<question id>__files" (migration 20261025_anamnesis_form_files: the form link
 * may only upload into its own, still open anamnesis). The coach sees "2 files" under the answer
 * and opens them in the document viewer; the Documents tab lists them read-only. The AI never gets
 * the files or their names — only how many there are.
 *
 * FormFileUpload — the upload in the form link · AnswerFiles — "2 files" + preview for the coach ·
 * AnamnesisFormFilesSection — the list in the athlete's Documents tab.
 */
import { useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineDocumentViewer } from '@/components/coach/InlineDocumentViewer';
import type { CoachDocument } from '@/hooks/useCoachDocuments';
import { useAthleteAnamneses } from '@/hooks/useAthleteAnamneses';
import type { AnamnesisFile } from '@/types/anamnesis';
import { answerFileGroups, parseAnswerFiles } from '@/utils/anamnesisAnswers';
import { cn } from '@/lib/utils';

const BUCKET = 'documents';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif';

/** MIME type from the name when the browser gives none (HEIC from iPhones often comes without) */
function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' } as Record<string, string>)[ext] ?? '';
}
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const isImage = (f: AnamnesisFile) => f.mimeType.startsWith('image/');

const T = {
  de: {
    upload: 'Datei hochladen (optional)', more: 'Weitere Datei hochladen', hint: 'PDF oder Foto, bis 10 MB — z. B. ein Arztbericht oder Befund.',
    uploading: 'Wird hochgeladen…', remove: 'Entfernen', tooBig: (n: string) => `„${n}“ ist größer als 10 MB.`,
    wrongType: (n: string) => `„${n}“ geht leider nicht — bitte als PDF oder Foto (JPG, PNG, HEIC).`,
    tooMany: `Höchstens ${MAX_FILES} Dateien.`, failed: 'Das Hochladen hat nicht geklappt. Bitte versuche es noch einmal — oder gib die Unterlagen deinem Trainer direkt.',
  },
  en: {
    upload: 'Upload a file (optional)', more: 'Upload another file', hint: 'PDF or photo, up to 10 MB — e.g. a doctor\'s report.',
    uploading: 'Uploading…', remove: 'Remove', tooBig: (n: string) => `"${n}" is larger than 10 MB.`,
    wrongType: (n: string) => `"${n}" can't be used — please upload a PDF or a photo (JPG, PNG, HEIC).`,
    tooMany: `At most ${MAX_FILES} files.`, failed: 'The upload didn\'t work. Please try again — or give the documents to your coach directly.',
  },
} as const;

function FileIcon({ file, className }: { file: AnamnesisFile; className?: string }) {
  return isImage(file) ? <ImageIcon className={className} /> : <FileText className={className} />;
}

// ── The form link ────────────────────────────────────────────────────────────

export function FormFileUpload({ recordId, token, value, onChange, lang }: {
  recordId: string;
  token: string;
  value: string;
  onChange: (v: string) => void;
  lang: 'de' | 'en';
}) {
  const t = T[lang];
  const files = parseAnswerFiles(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The newest list across uploads finishing one after another
  const listRef = useRef<AnamnesisFile[]>(files);
  listRef.current = files;
  const write = (next: AnamnesisFile[]) => { listRef.current = next; onChange(next.length ? JSON.stringify(next) : ''); };

  const pick = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setError(null);
    const chosen = Array.from(picked);
    if (listRef.current.length + chosen.length > MAX_FILES) { setError(t.tooMany); return; }
    setBusy(true);
    for (const file of chosen) {
      const mimeType = mimeOf(file);
      if (!ALLOWED.has(mimeType)) { setError(t.wrongType(file.name)); continue; }
      if (file.size > MAX_BYTES) { setError(t.tooBig(file.name)); continue; }
      const safe = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file';
      const path = `anamnesis-form/${recordId}/${token}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mimeType, upsert: false });
      if (upErr) { console.error('[form upload]', upErr.message); setError(t.failed); continue; }
      write([...listRef.current, { path, name: file.name, size: file.size, mimeType }]);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = async (f: AnamnesisFile) => {
    write(listRef.current.filter(x => x.path !== f.path));
    await supabase.storage.from(BUCKET).remove([f.path]).catch(() => undefined);
  };

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map(f => (
            <li key={f.path} className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5">
              <FileIcon file={f} className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-base">{f.name}</span>
                <span className="block text-xs text-muted-foreground">{sizeLabel(f.size)}</span>
              </span>
              <button type="button" onClick={() => void remove(f)} aria-label={`${t.remove}: ${f.name}`}
                className="h-11 w-11 shrink-0 rounded-md flex items-center justify-center text-muted-foreground [@media(hover:hover)]:hover:text-destructive active:bg-muted">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={e => void pick(e.target.files)} />
      <Button type="button" variant="outline" className="w-full h-12 text-base gap-2" disabled={busy}
        onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? t.uploading : files.length > 0 ? t.more : t.upload}
      </Button>
      <p className={cn('text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>{error ?? t.hint}</p>
    </div>
  );
}

// ── Coach: "2 files" + preview ───────────────────────────────────────────────

/** Opens a file of the form link in the document viewer (signed link, valid 1 h) */
function useFileViewer() {
  const [viewer, setViewer] = useState<{ doc: CoachDocument; url: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const open = async (f: AnamnesisFile) => {
    setOpening(f.path);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 3600);
    setOpening(null);
    if (error || !data?.signedUrl) { console.error('[anamnesis files] open failed', error?.message); return; }
    setViewer({
      doc: { id: f.path, name: f.name, type: f.mimeType, size: f.size, folderId: null, uploadedAt: '', storagePath: f.path },
      url: data.signedUrl,
    });
  };
  const element = (
    <InlineDocumentViewer open={viewer !== null} doc={viewer?.doc ?? null} url={viewer?.url ?? null} onClose={() => setViewer(null)} />
  );
  return { open, opening, element };
}

function FileList({ files, onOpen, opening }: { files: AnamnesisFile[]; onOpen: (f: AnamnesisFile) => void; opening: string | null }) {
  return (
    <ul className="space-y-1">
      {files.map(f => (
        <li key={f.path}>
          <button type="button" onClick={() => onOpen(f)}
            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
            {opening === f.path ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FileIcon file={f} className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="flex-1 min-w-0 truncate">{f.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{sizeLabel(f.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Under an answer in the record: "2 files uploaded" — click for the list and the preview */
export function AnswerFiles({ value }: { value: string | undefined }) {
  const files = parseAnswerFiles(value);
  const [listOpen, setListOpen] = useState(false);
  const viewer = useFileViewer();
  if (files.length === 0) return null;
  const openFile = (f: AnamnesisFile) => {
    if (files.length === 1) { void viewer.open(f); return; }
    setListOpen(false);
    void viewer.open(f);
  };
  return (
    <>
      <button type="button"
        onClick={() => (files.length === 1 ? void viewer.open(files[0]) : setListOpen(true))}
        className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium hover:bg-muted">
        {viewer.opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        {files.length === 1 ? files[0].name : `${files.length} files uploaded`}
      </button>
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Uploaded files</DialogTitle></DialogHeader>
          <FileList files={files} onOpen={openFile} opening={viewer.opening} />
        </DialogContent>
      </Dialog>
      {viewer.element}
    </>
  );
}

// ── Documents tab: "From the anamnesis" ──────────────────────────────────────

export function AnamnesisFormFilesSection({ athleteId }: { athleteId: string }) {
  const { anamneses } = useAthleteAnamneses(athleteId);
  const viewer = useFileViewer();
  const groups = useMemo(() => anamneses.flatMap(record => {
    // Also the files under a body map's questions per spot ("… (1. Left knee)")
    const fields = record.templateSnapshot.sections.flatMap(s => s.fields);
    return answerFileGroups(fields, record.fieldValues, 'en').map(g => ({
      key: `${record.id}-${g.key}`,
      date: record.formSubmittedAt ?? record.conductedAt,
      question: g.label,
      files: g.files,
    }));
  }), [anamneses]);
  if (groups.length === 0) return null;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium flex items-center gap-1.5"><Paperclip className="h-4 w-4" />From the anamnesis</p>
        <p className="text-xs text-muted-foreground">Uploaded by the athlete in the anamnesis form — only visible to you, not in the athlete app. Stored with the anamnesis (deleting it deletes them).</p>
      </div>
      {groups.map(g => (
        <div key={g.key} className="space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {g.date ? `${format(parseISO(g.date), 'd MMM yyyy')} · ` : ''}{g.question}
          </p>
          <FileList files={g.files} onOpen={f => void viewer.open(f)} opening={viewer.opening} />
        </div>
      ))}
      {viewer.element}
    </div>
  );
}
