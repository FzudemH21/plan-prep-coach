import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { mergePrograms, useTrainingPrograms, type TrainingProgramsData } from '@/hooks/useTrainingPrograms';
import { Upload, Loader2 } from 'lucide-react';

/**
 * Restore training programs from a recovered program list (JSON, e.g. a browser copy read out
 * after programs were lost). Missing programs are added; of a program that exists in both, the
 * newer version (lastModifiedAt) wins — nothing newer is ever replaced by something older.
 */
export default function RestoreProgramsPage() {
  const { programs, isLoading, restorePrograms } = useTrainingPrograms();
  const { toast } = useToast();
  const [recovered, setRecovered] = useState<TrainingProgramsData | null>(null);
  const [fileError, setFileError] = useState('');
  const [restoring, setRestoring] = useState(false);

  const readFile = async (file: File) => {
    setFileError('');
    setRecovered(null);
    try {
      const parsed = JSON.parse(await file.text()) as TrainingProgramsData;
      if (!Array.isArray(parsed?.programs)) throw new Error('No program list in this file');
      setRecovered(parsed);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'The file could not be read');
    }
  };

  const statusOf = (id: string, lastModifiedAt: string) => {
    const stored = programs.find(p => p.id === id);
    if (!stored) return 'Missing — will be added';
    return (lastModifiedAt ?? '') > (stored.lastModifiedAt ?? '')
      ? 'Stored version is older — will be replaced by this one'
      : 'Stored version is the same or newer — kept';
  };

  const handleRestore = async () => {
    if (!recovered) return;
    setRestoring(true);
    try {
      const count = await restorePrograms(recovered);
      toast({ title: count > 0 ? `${count} program${count === 1 ? '' : 's'} restored` : 'Nothing to restore', description: 'Check the program library.' });
      setRecovered(null);
    } catch (err) {
      toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  const changes = recovered ? mergePrograms(recovered, { version: 1, programs }) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Restore programs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a recovered program file. Missing programs are added; a program you have now is only replaced by a newer version.
        </p>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your programs…</p>
      ) : (
        <>
          <p className="text-sm">Programs stored now: <strong>{programs.length}</strong></p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> Choose file
            <input type="file" accept="application/json,.json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} />
          </label>
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}

          {recovered && (
            <div className="space-y-3">
              <div className="rounded-md border divide-y">
                {recovered.programs.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">Last changed {p.lastModifiedAt?.slice(0, 16).replace('T', ' ')}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{statusOf(p.id, p.lastModifiedAt)}</div>
                  </div>
                ))}
              </div>
              <Button onClick={handleRestore} disabled={restoring || !changes}>
                {restoring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {changes ? 'Restore' : 'Nothing to restore'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
