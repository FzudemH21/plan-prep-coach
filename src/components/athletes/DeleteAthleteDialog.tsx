import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { type Athlete, getAthleteDisplayName } from '@/types/athlete';

interface DeleteAthleteDialogProps {
  /** The athlete to delete; the dialog is open while this is non-null. */
  athlete: Athlete | null;
  onCancel: () => void;
  onConfirm: (athleteId: string) => void;
  /** Offered as a softer alternative for athletes that aren't archived yet. */
  onArchive?: (athleteId: string) => void;
}

export function DeleteAthleteDialog({ athlete, onCancel, onConfirm, onArchive }: DeleteAthleteDialogProps) {
  const name = athlete ? getAthleteDisplayName(athlete) : '';
  const canArchive = !!onArchive && !!athlete && !athlete.isArchived;

  return (
    <AlertDialog open={athlete !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                This permanently deletes the athlete's profile, body metrics, performance parameters,
                calendar assignments, tests & events, and their athlete-app connection (schedule, session logs,
                check-ins and chat). <strong className="text-foreground">This cannot be undone.</strong>
              </p>
              {canArchive && (
                <p>If you just want them out of your active list, archive them instead — nothing is lost and you can restore them any time.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {canArchive && (
            <Button variant="outline" onClick={() => onArchive(athlete.id)}>
              Archive instead
            </Button>
          )}
          <AlertDialogAction
            onClick={() => athlete && onConfirm(athlete.id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
