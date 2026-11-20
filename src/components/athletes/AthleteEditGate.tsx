/**
 * Starting to edit an athlete: takes the athlete's edit lock first (lib/athleteLock). When another
 * coach is editing, a dialog says who — owners can take over. Also the message for the coach whose
 * editing was taken over.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { lockAthlete, type AthleteLockResult } from '@/lib/athleteLock';
import { toast } from '@/hooks/use-toast';

/**
 * begin(go): takes the lock, then runs `go` (enter edit mode). `dialog` must be rendered. `busy`
 * while the lock is being checked.
 */
export function useBeginAthleteEdit(athleteId: string | undefined, athleteName: string): {
  begin: (go: () => void | Promise<void>) => Promise<void>;
  busy: boolean;
  dialog: ReactNode;
} {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<(AthleteLockResult & { go: () => void | Promise<void> }) | null>(null);
  // Who was editing, kept while the dialog fades out
  const [shown, setShown] = useState<AthleteLockResult | null>(null);
  const [taking, setTaking] = useState(false);

  const begin = useCallback(async (go: () => void | Promise<void>) => {
    if (!athleteId) { await go(); return; }
    setBusy(true);
    try {
      const r = await lockAthlete(athleteId);
      if (r.acquired) await go();
      else { setBlocked({ ...r, go }); setShown(r); }
    } finally {
      setBusy(false);
    }
  }, [athleteId]);

  const takeOver = async () => {
    if (!athleteId || !blocked) return;
    setTaking(true);
    const r = await lockAthlete(athleteId, true);
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
          <AlertDialogTitle>{shown?.holderName} is editing {athleteName}</AlertDialogTitle>
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

/** The coach whose editing was taken over: what happened to their changes */
export function notifyEditTakenOver(holderName: string) {
  toast({
    title: `${holderName} took over editing`,
    description: 'Your unsaved changes were not saved. Editing is possible again once they are done.',
    variant: 'destructive',
    duration: 15000,
  });
}
