/**
 * The day, start time and duration of a logged session: one quiet line at the end of a workout
 * (filled in automatically, tap to correct — e.g. when logging it afterwards), and the same fields
 * for correcting a session that is already logged.
 */
import { useEffect, useState } from 'react';
import { Clock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  earliestTimingDate, initialFinishTiming, initialLoggedTiming, saveLoggedTiming, timingError, timingSummary, todayLocal,
  type LogTimingChange, type SessionTimingValue,
} from '@/utils/sessionTiming';

function TimingFields({ value, onChange, error }: {
  value: SessionTimingValue;
  onChange: (next: SessionTimingValue) => void;
  error: string | null;
}) {
  const row = 'grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2 text-sm';
  // The box sets the size: iPhones give date and time inputs their own height and width, which the
  // box contains — so all three fields look the same
  const box = 'flex h-11 w-full min-w-0 items-center overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2';
  const field = 'block h-full w-full min-w-0 appearance-none [-webkit-appearance:none] border-0 bg-transparent px-3 text-left text-base leading-none text-foreground outline-none placeholder:text-muted-foreground md:text-sm [&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:text-left';
  return (
    <div className="space-y-2">
      <label className={row}>
        <span className="text-muted-foreground">Date</span>
        <span className={box}>
          <input type="date" className={field} value={value.date} min={earliestTimingDate()} max={todayLocal()}
            onChange={e => onChange({ ...value, date: e.target.value })} />
        </span>
      </label>
      <label className={row}>
        <span className="text-muted-foreground">Started</span>
        <span className={box}>
          <input type="time" className={field} value={value.time}
            onChange={e => onChange({ ...value, time: e.target.value })} />
        </span>
      </label>
      <label className={row}>
        <span className="text-muted-foreground">Duration</span>
        <span className={box}>
          <input type="text" inputMode="numeric" className={field} value={value.minutes} placeholder="0"
            onChange={e => onChange({ ...value, minutes: e.target.value })} />
          <span className="pr-3 text-muted-foreground shrink-0">min</span>
        </span>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** State of the line on the "Session complete" sheet — filled in anew each time the sheet opens */
export function useFinishTiming(open: boolean, date: string, durationSeconds: number) {
  const [initial, setInitial] = useState<SessionTimingValue>(() => initialFinishTiming(date, durationSeconds));
  const [value, setValue] = useState<SessionTimingValue>(initial);
  useEffect(() => {
    if (!open) return;
    const next = initialFinishTiming(date, durationSeconds);
    setInitial(next);
    setValue(next);
    // Only when the sheet opens — it must not overwrite what is being typed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return { initial, value, setValue, error: timingError(initial, value) };
}

export function FinishTimingRow({ value, onChange, error }: {
  value: SessionTimingValue;
  onChange: (next: SessionTimingValue) => void;
  error: string | null;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setEditing(e => !e)}
        aria-expanded={editing}
        aria-label={`${timingSummary(value)} — change date, start time or duration`}
        className="flex w-full min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm text-left active:bg-muted/60"
      >
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 min-w-0 truncate">{timingSummary(value)}</span>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
      {editing && <div className="mt-2"><TimingFields value={value} onChange={onChange} error={error} /></div>}
    </div>
  );
}

/** Pencil next to a logged session's time */
export function EditTimingButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Change date, start time or duration"
      className="-my-2 -mr-2 h-11 w-11 shrink-0 flex items-center justify-center rounded-full opacity-70 hover:opacity-100 active:bg-black/5"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
}

/** Correcting a session that is already logged */
export function EditLoggedTiming({ connectionId, log, onCancel, onSaved }: {
  connectionId: string;
  log: { id: string; date: string; sessionId: string | null; startedAt: string | null; completedAt: string | null; durationSeconds: number | null };
  onCancel: () => void;
  onSaved: (result: { moved: boolean; change: LogTimingChange }) => void;
}) {
  const { toast } = useToast();
  const [initial] = useState(() => initialLoggedTiming(log.date, log.startedAt, log.completedAt, log.durationSeconds));
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const error = timingError(initial, value);
  const unchanged = value.date === initial.date && value.time === initial.time && value.minutes === initial.minutes;

  async function save() {
    setSaving(true);
    const result = await saveLoggedTiming({ connectionId, logId: log.id, sessionId: log.sessionId, initial, value, durationSeconds: log.durationSeconds });
    setSaving(false);
    if (result.error) {
      toast({ title: 'Not saved', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: result.moved ? `Moved to ${timingSummary({ ...value, time: '', minutes: '' })}` : 'Saved' });
    onSaved({ moved: result.moved, change: result.change });
  }

  return (
    <div className="rounded-xl border p-3 space-y-3">
      <TimingFields value={value} onChange={setValue} error={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" disabled={saving} onClick={onCancel}>Cancel</Button>
        <Button type="button" className="h-11" disabled={saving || unchanged || !!error} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
