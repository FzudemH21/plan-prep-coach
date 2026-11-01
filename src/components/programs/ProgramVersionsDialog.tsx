import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTrainingPrograms, type TrainingProgram } from '@/hooks/useTrainingPrograms';
import { useWizardData } from '@/contexts/WizardDataContext';
import { getProgramVersion, listProgramVersions, type ProgramVersionSummary } from '@/lib/programVersions';

const REASON_LABEL: Record<string, string> = {
  edit: 'Saved',
  deleted: 'Before deleting',
  'before-restore': 'Before a restore',
};

interface Props {
  /** The program whose versions are shown (id + name; it may no longer be in the library) */
  program: Pick<TrainingProgram, 'id' | 'name'> | null;
  onOpenChange: (open: boolean) => void;
}

/** Earlier versions of one program — any of them can be restored (the current state is kept first) */
export function ProgramVersionsDialog({ program, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { restoreProgramVersion, loadProgramIntoSession } = useTrainingPrograms();
  const { loadWizardSession } = useWizardData();
  const [versions, setVersions] = useState<ProgramVersionSummary[] | null>(null);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!program || !user) return;
    setVersions(null);
    setError('');
    listProgramVersions(user.id, program.id)
      .then(setVersions)
      .catch(() => setError('The version history is not available yet.'));
  }, [program, user]);

  const restore = async (version: ProgramVersionSummary) => {
    setRestoringId(version.id);
    try {
      const data = await getProgramVersion(version.id);
      const restored = await restoreProgramVersion(data);
      // Open in the planner: the planner gets the restored version too, or its next auto-save
      // would store the plan it still had
      if (localStorage.getItem('activeProgramId') === restored.id) {
        loadProgramIntoSession(restored.id, restored);
        loadWizardSession();
      }
      toast({ title: 'Version restored', description: `"${restored.name}" is back to ${format(new Date(version.saved_at), 'd MMM yyyy, HH:mm')}.` });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={!!program} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>{program?.name}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : versions === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No earlier versions yet — they are kept from now on (at most one per hour while you work).</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y rounded-md border">
            {versions.map(version => (
              <div key={version.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{format(new Date(version.saved_at), 'EEE d MMM yyyy, HH:mm')}</div>
                  <div className="text-xs text-muted-foreground truncate">{REASON_LABEL[version.reason] ?? 'Saved'}</div>
                </div>
                <Button size="sm" variant="outline" disabled={restoringId !== null} onClick={() => void restore(version)}>
                  {restoringId === version.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
