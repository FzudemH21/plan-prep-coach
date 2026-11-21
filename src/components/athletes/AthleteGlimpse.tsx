/**
 * A glimpse into the plan's athlete from the wizard: a button in the planner header opens the full
 * athlete profile (monitoring, performance, anamnesis, calendar, documents, chat …) in a large window
 * over the wizard — closing it returns to exactly where the coach was, nothing is navigated.
 *
 * A dialog (not a side sheet): sheets sit above dialogs, so an anamnesis or session opened from the
 * profile would end up behind the sheet's backdrop; on the dialog layer they open on top of it.
 *
 * The profile works as on the athlete page (the athlete's own rights apply, not the program's): while
 * it is open, a read-only planner's guard (PlannerGate) stands aside (body[data-athlete-glimpse]).
 * Deleting the athlete is left to the athlete page.
 */
import { useCallback, useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AthleteProfileView } from '@/components/athletes/AthleteProfileView';
import { useAthletes } from '@/hooks/useAthletes';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useOrgCoaches } from '@/hooks/useOrgCoaches';
import { useToast } from '@/hooks/use-toast';
import { profileDataPatch } from '@/utils/athleteProfileSync';
import { getAthleteDisplayName, type Athlete } from '@/types/athlete';

export function AthleteGlimpseButton({ athleteId }: { athleteId: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const athleteData = useAthletes();
  const athlete = athleteId ? athleteData.athletes.find((a) => a.id === athleteId) : undefined;
  if (!athlete) return null;
  return (
    <>
      <Button data-open variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}
        title={`Open ${getAthleteDisplayName(athlete)}'s profile without leaving the plan`}>
        <UserRound className="h-4 w-4" />
        {getAthleteDisplayName(athlete)}
      </Button>
      {open && <AthleteGlimpseSheet athlete={athlete} athleteData={athleteData} onClose={() => setOpen(false)} />}
    </>
  );
}

function AthleteGlimpseSheet({ athlete, athleteData, onClose }: {
  athlete: Athlete;
  athleteData: ReturnType<typeof useAthletes>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { coaches, enabled: coachesEnabled } = useOrgCoaches();
  const { getConnectionForAthlete, syncProfileToConnection } = useAthleteConnections();

  // As on the athlete page: profile fields also go into the athlete-app copy (only what changed)
  const updateAthlete = useCallback(async (updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>) => {
    await athleteData.updateAthlete(athlete.id, updates);
    const connection = getConnectionForAthlete(athlete.id);
    if (connection) {
      const patch = profileDataPatch(athlete, updates);
      if (Object.keys(patch).length > 0) syncProfileToConnection(connection.id, patch).catch(console.error);
    }
  }, [athleteData, athlete, getConnectionForAthlete, syncProfileToConnection]);

  // A read-only planner's guard stands aside while the profile is open (see PlannerGate)
  useEffect(() => {
    document.body.setAttribute('data-athlete-glimpse', '');
    return () => document.body.removeAttribute('data-athlete-glimpse');
  }, []);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent data-app-chrome
        className="flex flex-col gap-0 p-0 max-w-none sm:max-w-none w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] sm:rounded-lg overflow-hidden">
        <div className="shrink-0 border-b px-5 py-3 pr-12">
          <DialogTitle className="text-base">{getAthleteDisplayName(athlete)}</DialogTitle>
          <DialogDescription className="text-xs">Athlete profile — close to go back to the plan</DialogDescription>
        </div>
        <div className="flex-1 min-h-0 p-3">
          <AthleteProfileView
            athlete={athlete}
            onUpdateAthlete={updateAthlete}
            onDeleteAthlete={() => toast({ title: 'Delete athletes on the Athletes page', description: 'Not from inside a plan.' })}
            groups={athleteData.groups}
            coaches={coachesEnabled ? coaches : undefined}
            athleteData={athleteData}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
