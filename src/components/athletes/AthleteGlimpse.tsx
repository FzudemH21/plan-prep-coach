/**
 * A glimpse into the plan's athlete from the wizard: a button in the planner header opens the full
 * athlete profile (monitoring, performance, anamnesis, calendar, documents, chat …) in a large side
 * panel over the wizard — closing it returns to exactly where the coach was, nothing is navigated.
 *
 * The profile works as on the athlete page (the athlete's own rights apply, not the program's): the
 * panel is marked as app chrome, so a read-only planner (PlannerGate) doesn't block it. Deleting the
 * athlete is left to the athlete page.
 */
import { useCallback, useState } from 'react';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
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

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" data-app-chrome className="w-[96vw] sm:max-w-[1280px] p-0 flex flex-col gap-0">
        <div className="shrink-0 border-b px-5 py-3 pr-12">
          <SheetTitle className="text-base">{getAthleteDisplayName(athlete)}</SheetTitle>
          <SheetDescription className="text-xs">Athlete profile — close to go back to the plan</SheetDescription>
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
      </SheetContent>
    </Sheet>
  );
}
