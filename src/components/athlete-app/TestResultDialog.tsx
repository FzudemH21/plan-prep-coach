/**
 * TestResultDialog — athlete app: enter a test result (value, note, photos / videos).
 * Used by the Plan and Today tabs.
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, X } from 'lucide-react';
import type { AthleteCalendarEvent } from '@/hooks/useAthleteApp';
import { MAX_ATTACHMENT_BYTES, uploadTestAttachments } from '@/utils/athleteUploads';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface TestResultTarget {
  ev: AthleteCalendarEvent;
  /** yyyy-MM-dd the test is scheduled on */
  date: string;
}

export function TestResultDialog({
  target,
  connectionId,
  lastValueLabel,
  submitTestResult,
  onSaved,
  onClose,
}: {
  target: TestResultTarget | null;
  connectionId: string | undefined;
  lastValueLabel: string | null;
  submitTestResult: (parameterId: string, value: string, recordedAt: string, note?: string, attachments?: string[]) => Promise<void>;
  onSaved: (parameterId: string, date: string, value: string, recordedAt: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  // Date the test was done — the scheduled day by default, changeable if entered late / done another day
  const [date, setDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fresh form for every test opened
  useEffect(() => {
    setValue('');
    setNote('');
    setDate(target?.date ?? '');
    setFiles([]);
    setFileError(null);
    setSaved(false);
  }, [target?.ev.id, target?.date]);

  const ev = target?.ev;

  const handleSave = async () => {
    if (!target || !value.trim() || !target.ev.parameterId) return;
    const parameterId = target.ev.parameterId;
    const resultDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : target.date;
    setSaving(true);
    try {
      const recordedAt = new Date(`${resultDate}T12:00:00`).toISOString();
      // Photos / videos first; a failed upload doesn't block saving the result itself
      let attachments: string[] = [];
      let failed: string[] = [];
      if (files.length > 0 && connectionId) {
        ({ paths: attachments, failed } = await uploadTestAttachments(connectionId, parameterId, files));
      }
      try {
        await submitTestResult(parameterId, value.trim(), recordedAt, note.trim() || undefined, attachments);
      } catch (err) {
        if (attachments.length === 0) throw err;
        // Attachments not set up on the server yet — keep the result, without them
        await submitTestResult(parameterId, value.trim(), recordedAt, note.trim() || undefined);
        failed = files.map(f => f.name);
      }
      onSaved(parameterId, resultDate, value.trim(), recordedAt);
      setSaved(true);
      if (failed.length > 0) {
        setFileError(`Result saved, but ${failed.length === 1 ? 'this file' : 'these files'} couldn't be attached: ${failed.join(', ')}`);
      } else {
        setTimeout(onClose, 1200);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{ev?.title ?? 'Enter result'}</DialogTitle>
          {(ev?.targetValue || lastValueLabel) && (
            <DialogDescription className="space-y-0.5">
              {ev?.targetValue && (
                <span className="block">Goal: {ev.targetValue}{ev.unit ? ` ${ev.unit}` : ''}</span>
              )}
              {lastValueLabel && <span className="block">Last value: {lastValueLabel}</span>}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Result{ev?.unit ? ` (${ev.unit})` : ''}
            </label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Enter value…"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="text-base h-11"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="test-result-date" className="text-sm font-medium mb-1.5 block text-muted-foreground">
              Date of the test
            </label>
            <Input
              id="test-result-date"
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="text-base h-11"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
              Note <span className="font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Any context, conditions, remarks…"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Photos / videos of the attempt */}
          <div>
            <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
              Photos / videos <span className="font-normal">(optional, max 50 MB each)</span>
            </label>
            {files.length > 0 && (
              <ul className="space-y-1 mb-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm rounded-md border px-2 py-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="min-h-[44px] flex items-center justify-center gap-2 rounded-md border border-dashed text-sm font-medium cursor-pointer hover:bg-muted active:bg-muted/80">
              <Paperclip className="h-4 w-4" />
              Add photo or video
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={e => {
                  const picked = Array.from(e.target.files ?? []);
                  const tooBig = picked.filter(f => f.size > MAX_ATTACHMENT_BYTES);
                  setFileError(tooBig.length > 0 ? `Too large (max 50 MB): ${tooBig.map(f => f.name).join(', ')}` : null);
                  setFiles(prev => [...prev, ...picked.filter(f => f.size <= MAX_ATTACHMENT_BYTES)]);
                  e.target.value = '';
                }}
              />
            </label>
            {fileError && <p className="text-xs text-destructive mt-1.5">{fileError}</p>}
          </div>

          <Button
            className="w-full h-11"
            disabled={!value.trim() || saving || saved}
            onClick={handleSave}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save result'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
