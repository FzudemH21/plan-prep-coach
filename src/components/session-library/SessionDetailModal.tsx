import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SessionLibraryEntry, SessionLibraryColumn } from '@/types/sessionLibrary';

interface SessionDetailModalProps {
  entry: SessionLibraryEntry | null;
  columns: SessionLibraryColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionDetailModal({
  entry,
  columns,
  open,
  onOpenChange,
}: SessionDetailModalProps) {
  const { t } = useTranslation();

  if (!entry) return null;

  // Group exercises by sectionId, then by unsectioned
  const sectionedMap: Record<string, typeof entry.exercises> = {};
  const unsectioned: typeof entry.exercises = [];

  for (const ex of entry.exercises) {
    if (ex.sectionId) {
      (sectionedMap[ex.sectionId] ??= []).push(ex);
    } else {
      unsectioned.push(ex);
    }
  }

  // Ordered sections from entry.sections
  const orderedSections = [...entry.sections].sort((a, b) => a.order - b.order);

  const exerciseCount = entry.exercises.length;

  const renderParams = (ex: (typeof entry.exercises)[0]) => {
    // Collect the meaningful params from adhocPlannedParams or parameterOverrides
    const params = ex.adhocPlannedParams ?? ex.parameterOverrides ?? {};
    const pairs = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined);
    if (pairs.length === 0) return null;
    return (
      <span className="text-xs text-muted-foreground">
        {pairs.map(([k, v]) => `${k}: ${v}`).join('  ·  ')}
      </span>
    );
  };

  const renderExerciseList = (exList: typeof entry.exercises) => (
    <div className="space-y-1">
      {exList
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((ex, i) => (
          <div key={ex.id} className="flex items-start gap-2 py-1">
            <span className="text-xs text-muted-foreground w-5 shrink-0 pt-0.5">
              {i + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{ex.exerciseName}</p>
              {renderParams(ex)}
            </div>
            {ex.methodId && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {ex.categoryName || ex.methodId.split('::')[0]}
              </Badge>
            )}
          </div>
        ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 pb-1">
          {entry.method && (
            <Badge variant="secondary" className="text-xs">
              {entry.method.split('::')[0]}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {t('sessionLibrary.exercises', { count: exerciseCount })}
          </Badge>
          {/* Custom column values */}
          {columns
            .filter(c => entry.columnValues[c.id])
            .map(c => (
              <Badge key={c.id} variant="outline" className="text-xs">
                <span className="text-muted-foreground mr-1">{c.name}:</span>
                {entry.columnValues[c.id]}
              </Badge>
            ))}
        </div>

        <Separator />

        <ScrollArea className="max-h-[60vh] pr-3">
          {exerciseCount === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('sessionLibrary.detail.noExercises')}
            </p>
          ) : (
            <div className="space-y-4 py-1">
              {/* Sectioned exercises */}
              {orderedSections.map(section => {
                const exList = sectionedMap[section.id] ?? [];
                if (exList.length === 0) return null;
                return (
                  <div key={section.id}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      {section.name}
                    </p>
                    {renderExerciseList(exList)}
                  </div>
                );
              })}

              {/* Unsectioned exercises */}
              {unsectioned.length > 0 && (
                <div>
                  {orderedSections.length > 0 && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      {t('sessionLibrary.detail.unsectioned')}
                    </p>
                  )}
                  {renderExerciseList(unsectioned)}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
