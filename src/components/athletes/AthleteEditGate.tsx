/**
 * Starting to edit something of an athlete (the profile, one anamnesis): takes its edit lock first
 * (lib/athleteLock). When another coach is editing it, a dialog says who — owners can take over.
 * Also the message for the coach whose editing was taken over.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Lock } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { lockAthlete, useAthleteEditSession, type AthleteLockItem, type AthleteLockResult } from '@/lib/athleteLock';
import { toast } from '@/hooks/use-toast';

type Go = () => void | Promise<void>;

/**
 * begin(item, what, go): takes the item's lock, then runs `go` (enter edit mode). `what` names the
 * item in the dialog ("the profile of Max Muster"). `dialog` must be rendered; `busy` while the lock
 * is being checked.
 */
export function useBeginAthleteEdit(athleteId: string | undefined): {
  begin: (item: AthleteLockItem, what: string, go: Go) => Promise<void>;
  busy: boolean;
  dialog: ReactNode;
} {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<{ item: AthleteLockItem; go: Go } | null>(null);
  // Who was editing what, kept while the dialog fades out
  const [shown, setShown] = useState<(AthleteLockResult & { what: string }) | null>(null);
  const [taking, setTaking] = useState(false);

  const begin = useCallback(async (item: AthleteLockItem, what: string, go: Go) => {
    if (!athleteId) { await go(); return; }
    setBusy(true);
    try {
      const r = await lockAthlete(athleteId, item);
      if (r.acquired) await go();
      else { setBlocked({ item, go }); setShown({ ...r, what }); }
    } finally {
      setBusy(false);
    }
  }, [athleteId]);

  const takeOver = async () => {
    if (!athleteId || !blocked) return;
    setTaking(true);
    const r = await lockAthlete(athleteId, blocked.item, true);
    setTaking(false);
    if (!r.acquired) {
      toast({ title: 'Could not take over', description: 'Please try again in a moment.', variant: 'destructive' });
      return;
    }
    const go = blocked.go;
    setBlocked(null);
    await go();
  };

  const dialog = (
    <AlertDialog open={!!blocked} onOpenChange={(open) => { if (!open) setBlocked(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown?.holderName} is editing {shown?.what}</AlertDialogTitle>
          <AlertDialogDescription>
            {shown?.canTakeOver
              ? 'You can edit once they are done — or take over now. Their unsaved changes would not be saved.'
              : 'You can edit once they are done (or 2 minutes after they close the app). Viewing and the chat work as usual.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>OK</AlertDialogCancel>
          {shown?.canTakeOver && (
            <Button variant="destructive" onClick={() => void takeOver()} disabled={taking}>
              {taking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Take over editing
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { begin, busy, dialog };
}

/** A change refused because another coach is editing the athlete's calendar (the dialog said so) */
export class CalendarBusyError extends Error {
  constructor() { super('Another coach is editing this calendar'); this.name = 'CalendarBusyError'; }
}
export const isCalendarBusy = (e: unknown): boolean => e instanceof CalendarBusyError;

const CALENDAR_HOLD_MS = 30_000;

/**
 * Changes written straight into the athlete's calendar (coach mobile app): each takes the calendar's
 * edit lock first — the same lock the desktop calendar holds while a coach changes it. `allowWrite()`
 * is true when the change may go ahead (the lock is then held 30 s after the last change, so the
 * desktop shows who is changing the calendar); false while another coach edits it — a dialog says
 * who, owners can take over, and the change is not made (made again after taking over).
 */
export function useCalendarWriteGate(athleteId: string | undefined): {
  allowWrite: () => Promise<boolean>;
  dialog: ReactNode;
} {
  const [holdTick, setHoldTick] = useState(0);
  const [blocked, setBlocked] = useState<AthleteLockResult | null>(null);
  const [shown, setShown] = useState<AthleteLockResult | null>(null);
  const [taking, setTaking] = useState(false);
  const { lostTo } = useAthleteEditSession(athleteId, 'calendar', holdTick > 0);

  useEffect(() => {
    if (holdTick === 0) return;
    const t = setTimeout(() => setHoldTick(0), CALENDAR_HOLD_MS);
    return () => clearTimeout(t);
  }, [holdTick]);
  // Taken over by another coach: stop holding (the next change asks again)
  useEffect(() => { if (lostTo) setHoldTick(0); }, [lostTo]);

  const allowWrite = useCallback(async (): Promise<boolean> => {
    if (!athleteId) return true;
    const r = await lockAthlete(athleteId, 'calendar');
    if (r.acquired) { setHoldTick(t => t + 1); return true; }
    setBlocked(r);
    setShown(r);
    return false;
  }, [athleteId]);

  const takeOver = async () => {
    if (!athleteId) return;
    setTaking(true);
    const r = await lockAthlete(athleteId, 'calendar', true);
    setTaking(false);
    if (!r.acquired) {
      toast({ title: 'Could not take over', description: 'Please try again in a moment.', variant: 'destructive' });
      return;
    }
    setHoldTick(t => t + 1);
    setBlocked(null);
    toast({ title: 'You are editing the calendar now', description: 'Please make your change again.' });
  };

  const dialog = (
    <AlertDialog open={!!blocked} onOpenChange={(open) => { if (!open) setBlocked(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown?.holderName} is editing this calendar</AlertDialogTitle>
          <AlertDialogDescription>
            {shown?.canTakeOver
              ? 'Your change was not made. You can change the calendar once they are done — or take over now. Their unsaved changes would not be saved.'
              : 'Your change was not made. You can change the calendar once they are done (or 2 minutes after they close the app).'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>OK</AlertDialogCancel>
          {shown?.canTakeOver && (
            <Button variant="destructive" onClick={() => void takeOver()} disabled={taking}>
              {taking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Take over editing
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { allowWrite, dialog };
}

/** Next to an Edit button: someone else is editing this athlete right now */
export function EditingByChip({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <Lock className="h-3 w-3" />
      {name} is editing
    </span>
  );
}

/** The coach whose editing was taken over: what happened to their changes */
export function notifyEditTakenOver(holderName: string) {
  toast({
    title: `${holderName} took over editing`,
    description: 'Your unsaved changes were not saved. Editing is possible again once they are done.',
    variant: 'destructive',
    duration: 15000,
  });
}
