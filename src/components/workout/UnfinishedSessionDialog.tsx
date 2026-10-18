/**
 * The coach closes an athlete's unfinished session (started in the app, never finished):
 * see what was logged so far, then either mark it as done — with the logged sets, optionally
 * counting the unticked sets as done with their planned values — or reset it (planned again).
 * Used in the athlete calendar (desktop) and the coach mobile session view.
 */
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getBorgLabel, isBorgLevel } from '@/utils/intensityScale';
import { countDoneSets } from '@/utils/workoutProgress';
import { buildSetsLoggedPayload, EMPTY_WORKOUT_LOG_STATE, getSetCount } from '@/utils/workoutLog';
import {
  closeUnfinishedSession, fetchUnfinishedLogDetails, isStaleUnfinished, resetUnfinishedSession,
  type UnfinishedLogDetails,
} from '@/utils/unfinishedSession';
import { SessionExercises, type SetLogEntry } from '@/components/athletes/CompletedSessionSheet';

const NO_RPE = 'none';

export function UnfinishedSessionDialog({ open, onClose, logId, connectionId, onChanged }: {
  open: boolean;
  onClose: () => void;
  logId: string | null;
  connectionId: string | null;
  /** After the session was closed or reset */
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [details, setDetails] = useState<UnfinishedLogDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [countUntickedAsDone, setCountUntickedAsDone] = useState(false);
  const [rpe, setRpe] = useState<string>(NO_RPE);
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!open || !logId || !connectionId) return;
    let cancelled = false;
    setLoading(true);
    setDetails(null);
    setCountUntickedAsDone(false);
    setRpe(NO_RPE);
    setMinutes('');
    void fetchUnfinishedLogDetails(logId, connectionId).then(d => {
      if (cancelled) return;
      setDetails(d);
      setLoading(false);
      const elapsed = d?.progress?.elapsedSeconds ?? 0;
      if (elapsed >= 60) setMinutes(String(Math.round(elapsed / 60)));
    });
    return () => { cancelled = true; };
  }, [open, logId, connectionId]);

  const exercises = useMemo(() => details?.session?.exercises ?? [], [details]);
  const payload = useMemo(
    () => buildSetsLoggedPayload(exercises, details?.progress ?? EMPTY_WORKOUT_LOG_STATE, { countUntickedAsDone }),
    [exercises, details, countUntickedAsDone],
  );
  const totalSets = exercises.reduce((n, ex) => n + (details?.progress?.setCountOverrides[ex.id] ?? getSetCount(ex)), 0);
  const tickedSets = countDoneSets(details?.progress ?? null);
  const stale = isStaleUnfinished(details?.startedAt, details?.pausedAt);
  const mayStillTrain = !!details && !stale && !details.pausedAt;

  const markAsDone = async () => {
    if (!details) return;
    setSaving(true);
    const mins = Number(minutes);
    const error = await closeUnfinishedSession(details.id, {
      setsLogged: payload,
      borgRating: rpe === NO_RPE ? null : Number(rpe),
      durationSeconds: minutes.trim() && Number.isFinite(mins) && mins > 0 ? Math.round(mins * 60) : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Session not closed', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Session marked as done' });
    onChanged();
    onClose();
  };

  const reset = async () => {
    if (!details) return;
    setConfirmReset(false);
    setSaving(true);
    const error = await resetUnfinishedSession(details.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Session not reset', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Session reset', description: 'It is planned again — the athlete can start it from the app.' });
    onChanged();
    onClose();
  };

  const startedLabel = details ? format(parseISO(details.startedAt), "EEE d MMM 'at' HH:mm") : '';

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Unfinished session</DialogTitle>
            <DialogDescription>
              {details
                ? <>{details.sessionName ?? details.session?.name ?? 'Session'} · started {startedLabel}{details.pausedAt ? ' · paused' : ''}{details.startedBy === 'coach' ? ' · logged by you' : ''}</>
                : 'Loading…'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !details ? (
            <p className="text-sm text-muted-foreground py-4">
              This session isn't unfinished any more — it was finished or reset in the meantime.
            </p>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              {mayStillTrain && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 flex gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Started less than 4 hours ago — the athlete may still be in the middle of it.</span>
                </div>
              )}

              <p className="text-sm">
                {details.progress
                  ? <>Ticked in the app: <span className="font-medium">{tickedSets} of {totalSets} sets / rounds</span>.</>
                  : <>No logged sets were saved from the athlete's phone.</>}
                {!details.session && <> The session is no longer on the schedule, so it's closed without set data.</>}
              </p>

              {details.session && (
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={countUntickedAsDone}
                    onCheckedChange={v => setCountUntickedAsDone(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    Count the unticked sets as done (with their planned values)
                    <span className="block text-xs text-muted-foreground">For when the athlete did the whole session but didn't tick everything in the app.</span>
                  </span>
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">RPE (Borg CR10)</Label>
                  <Select value={rpe} onValueChange={setRpe}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[400]">
                      <SelectItem value={NO_RPE}>Not rated</SelectItem>
                      {Array.from({ length: 11 }, (_, v) => {
                        const lvl = String(v);
                        return <SelectItem key={v} value={lvl}>{isBorgLevel(lvl) ? `${v} – ${getBorgLabel(lvl)}` : lvl}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Duration (min)</Label>
                  <Input
                    type="number" inputMode="numeric" min={0} className="h-9"
                    placeholder="Unknown" value={minutes} onChange={e => setMinutes(e.target.value)}
                  />
                </div>
              </div>

              {payload.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Saved as</p>
                  <SessionExercises entries={payload as SetLogEntry[]} />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={!details || saving}
              onClick={() => setConfirmReset(true)}
            >
              Reset session
            </Button>
            <Button disabled={!details || saving} onClick={markAsDone}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Mark as done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The session is planned again and the athlete can start it from scratch. What was logged
              in this attempt — sets and exercise comments — is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
