import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { programsToRestore, useTrainingPrograms, type TrainingProgramsData } from '@/hooks/useTrainingPrograms';
import { exportAllData, downloadJson } from '@/lib/dataExport';
import { getProgramVersion, listDeletedPrograms, type ProgramVersionSummary } from '@/lib/programVersions';
import { Download, Upload, Loader2, RotateCcw } from 'lucide-react';

/** A program list file: a recovered list, or the programs inside an "Export all data" file */
function programsFromFile(parsed: unknown): TrainingProgramsData | null {
  const asList = parsed as TrainingProgramsData;
  if (Array.isArray(asList?.programs)) return asList;
  const tables = (parsed as { tables?: {
    training_programs?: Array<{ data?: TrainingProgramsData }>;
    program_records?: Array<{ data?: TrainingProgramsData['programs'][number]; deleted_at?: string | null }>;
  } })?.tables;
  // Export files since 2026-11-08: one row per program
  const records = (tables?.program_records ?? []).filter(r => r.data?.id && !r.deleted_at).map(r => r.data!);
  if (records.length > 0) return { version: 1, programs: records };
  const fromExport = tables?.training_programs?.[0]?.data;
  return Array.isArray(fromExport?.programs) ? fromExport : null;
}

/**
 * Backup & restore: export all data as an own backup file, bring back deleted programs from their
 * version history, and restore programs from a file. Restoring never replaces a program by an
 * older version of it (see mergePrograms).
 */
export default function RestoreProgramsPage() {
  const { user } = useAuth();
  const { programs, deletedProgramIds, isLoading, restorePrograms, restoreProgramVersion } = useTrainingPrograms();
  const { toast } = useToast();
  const [recovered, setRecovered] = useState<TrainingProgramsData | null>(null);
  const [fileError, setFileError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<ProgramVersionSummary[] | null>(null);
  const [restoringDeleted, setRestoringDeleted] = useState<string | null>(null);

  const programIds = programs.map(p => p.id).join('|');
  useEffect(() => {
    if (!user || isLoading) return;
    listDeletedPrograms(user.id, new Set(programIds.split('|')))
      .then(setDeleted)
      .catch(() => setDeleted([]));
  }, [user, isLoading, programIds]);

  const handleExport = async () => {
    setExporting('…');
    try {
      const data = await exportAllData(table => setExporting(table));
      downloadJson(data, `plan-prep-coach-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`);
      const failed = Object.keys(data.errors);
      toast({
        title: 'Backup downloaded',
        description: failed.length ? `Not included (not readable): ${failed.join(', ')}` : 'Keep the file somewhere safe.',
      });
    } catch (err) {
      toast({ title: 'Export failed', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const readFile = async (file: File) => {
    setFileError('');
    setRecovered(null);
    try {
      const list = programsFromFile(JSON.parse(await file.text()));
      if (!list) throw new Error('No program list in this file');
      setRecovered(list);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'The file could not be read');
    }
  };

  const statusOf = (id: string, lastModifiedAt: string) => {
    if (deletedProgramIds.includes(id)) return 'Deleted on purpose — not restored (see Deleted programs)';
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

  const handleRestoreDeleted = async (version: ProgramVersionSummary) => {
    setRestoringDeleted(version.id);
    try {
      const restored = await restoreProgramVersion(await getProgramVersion(version.id));
      toast({ title: 'Program restored', description: `"${restored.name}" is back in the program library.` });
    } catch (err) {
      toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setRestoringDeleted(null);
    }
  };

  const changes = recovered ? programsToRestore(recovered, { version: 1, programs, deletedProgramIds }).length > 0 : false;

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <div>
        <h1 className="text-2xl font-bold">Backup & restore</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every program also keeps its earlier versions (program library → ⋯ → Version history).
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Export all data</h2>
        <p className="text-sm text-muted-foreground">
          Programs, athletes, libraries, toolbox, parameters, templates, assigned plans, logs and check-ins as one file — keep it as your own backup. Uploaded files are not included.
        </p>
        <Button variant="outline" onClick={() => void handleExport()} disabled={exporting !== null}>
          {exporting !== null ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          {exporting !== null ? `Exporting ${exporting}` : 'Download backup'}
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Deleted programs</h2>
        {deleted === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : deleted.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {deleted.map(version => (
              <div key={version.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{version.program_name ?? 'Untitled program'}</div>
                  <div className="text-xs text-muted-foreground">Last version {format(new Date(version.saved_at), 'd MMM yyyy, HH:mm')}</div>
                </div>
                <Button size="sm" variant="outline" disabled={restoringDeleted !== null} onClick={() => void handleRestoreDeleted(version)}>
                  {restoringDeleted === version.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Restore programs from a file</h2>
        <p className="text-sm text-muted-foreground">
          A backup file or a recovered program list. Missing programs are added; a program you have now is only replaced by a newer version.
        </p>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your programs…</p>
        ) : (
          <>
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
                <Button onClick={() => void handleRestore()} disabled={restoring || !changes}>
                  {restoring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {changes ? 'Restore' : 'Nothing to restore'}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
