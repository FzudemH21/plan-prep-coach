/**
 * AnamnesisNotesPanel — the notes of an anamnesis: typed or dictated, each with its time.
 *
 * Notes are additions, not changes to the answers, so they work in the read-only view as well
 * (no need to switch to edit mode). Dictation: record → Mistral Voxtral turns it into text → the
 * coach checks / corrects the text → saved as a note. The audio is not kept.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Loader2, Mic, Pencil, Plus, Square, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { transcribeDictation } from '@/utils/transcribe';
import type { AnamnesisChange, AnamnesisNote } from '@/types/anamnesis';
import { cn } from '@/lib/utils';

export interface NotesChange {
  summary: string;
  changes: AnamnesisChange[];
}

interface AnamnesisNotesPanelProps {
  entries: AnamnesisNote[];
  /** Saves the new list (right away for a saved anamnesis); false = not saved */
  onChange: (next: AnamnesisNote[], change: NotesChange) => Promise<boolean>;
  coachUserId: string;
  athleteLocalId: string;
}

function noteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function stamp(iso: string): string {
  try { return format(parseISO(iso), 'd MMM yyyy, HH:mm'); } catch { return iso; }
}

function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function AnamnesisNotesPanel({ entries, onChange, coachUserId, athleteLocalId }: AnamnesisNotesPanelProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AnamnesisNote | null>(null);

  const recorder = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);

  const addNote = async (text: string, source: AnamnesisNote['source']) => {
    const clean = text.trim();
    if (!clean) return false;
    setBusy(true);
    const note: AnamnesisNote = { id: noteId(), text: clean, createdAt: new Date().toISOString(), source };
    const ok = await onChange([...entries, note], {
      summary: source === 'dictated' ? 'Dictated note added' : 'Note added',
      changes: [{ what: 'Note', from: '—', to: clean }],
    });
    setBusy(false);
    return ok;
  };

  const saveEdit = async (note: AnamnesisNote) => {
    const clean = editText.trim();
    if (!clean || clean === note.text) { setEditingId(null); return; }
    setBusy(true);
    const ok = await onChange(
      entries.map(n => (n.id === note.id ? { ...n, text: clean, updatedAt: new Date().toISOString() } : n)),
      { summary: 'Note edited', changes: [{ what: `Note of ${stamp(note.createdAt)}`, from: note.text, to: clean }] },
    );
    setBusy(false);
    if (ok) setEditingId(null);
  };

  const confirmDelete = async () => {
    const note = deleteTarget;
    setDeleteTarget(null);
    if (!note) return;
    setBusy(true);
    await onChange(entries.filter(n => n.id !== note.id), {
      summary: 'Note deleted',
      changes: [{ what: `Note of ${stamp(note.createdAt)}`, from: note.text, to: '—' }],
    });
    setBusy(false);
  };

  const finishRecording = async () => {
    const audio = await recorder.stop();
    if (!audio || audio.size === 0) return;
    setTranscribing(true);
    setDictationError(null);
    try {
      const text = await transcribeDictation(audio, { coachUserId, athleteLocalId });
      setTranscript(text);
      if (!text) setDictationError('No speech was recognised. Try again a bit closer to the microphone.');
    } catch (err) {
      console.error('[AnamnesisNotes] transcription failed', err);
      setDictationError('The dictation could not be turned into text. Please try again.');
    } finally {
      setTranscribing(false);
    }
  };

  const recording = recorder.state === 'recording';
  const dictating = recording || transcribing || transcript !== null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notes</h3>
        {!dictating && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => { setDictationError(null); void recorder.start(); }}
            disabled={busy}
            title="Record a note — it is turned into text, the audio is not kept"
          >
            <Mic className="h-3 w-3" />
            Dictate
          </Button>
        )}
      </div>

      {entries.length === 0 && !dictating && (
        <p className="text-xs text-muted-foreground">
          Notes from the appointment — typed or dictated. They are saved with the time and don't change the answers.
        </p>
      )}

      {entries.map(note => (
        <div key={note.id} className="rounded-md border bg-background p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {stamp(note.createdAt)}
              {note.source === 'dictated' && <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">Dictated</Badge>}
              {note.updatedAt && <span>· edited {stamp(note.updatedAt)}</span>}
            </p>
            {editingId !== note.id && (
              <div className="flex gap-0.5 shrink-0">
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={busy}
                  onClick={() => { setEditingId(note.id); setEditText(note.text); }} title="Edit note">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" disabled={busy}
                  onClick={() => setDeleteTarget(note)} title="Delete note">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {editingId === note.id ? (
            <div className="space-y-1.5">
              <Textarea className="min-h-[80px] text-sm resize-y" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
              <div className="flex justify-end gap-1.5">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)} disabled={busy}>Cancel</Button>
                <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={() => saveEdit(note)} disabled={busy || !editText.trim()}>
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{note.text}</p>
          )}
        </div>
      ))}

      {/* Dictation */}
      {dictating && (
        <div className={cn('rounded-md border p-2.5 space-y-2', recording ? 'border-red-300 bg-red-50/50' : 'bg-muted/30')}>
          {recording && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                Recording · {mmss(recorder.seconds)}
              </p>
              <div className="flex gap-1.5">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={recorder.cancel}>
                  <X className="h-3 w-3 mr-1" />Discard
                </Button>
                <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={finishRecording}>
                  <Square className="h-3 w-3" />Stop
                </Button>
              </div>
            </div>
          )}
          {transcribing && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Turning the dictation into text…
            </p>
          )}
          {transcript !== null && !transcribing && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Check the text and correct it if needed — it is saved as a note. The recording itself is not kept.</p>
              <Textarea className="min-h-[120px] text-sm resize-y" value={transcript} onChange={e => setTranscript(e.target.value)} />
              <div className="flex justify-end gap-1.5">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTranscript(null)} disabled={busy}>Discard</Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={busy || !transcript.trim()}
                  onClick={async () => { if (await addNote(transcript, 'dictated')) setTranscript(null); }}
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Save as note
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {(recorder.error || dictationError) && (
        <p className="text-xs text-destructive">{recorder.error || dictationError}</p>
      )}

      {/* Typed note */}
      <div className="space-y-1.5">
        <Textarea
          className="min-h-[64px] resize-y text-sm"
          placeholder="Add a note…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={busy || !draft.trim()}
            onClick={async () => { if (await addNote(draft, 'typed')) setDraft(''); }}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add note
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              The note is removed from the anamnesis. Its text stays in the change history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
