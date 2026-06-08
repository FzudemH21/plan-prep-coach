import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookmarkPlus, X } from 'lucide-react';
import { useSessionLibrary } from '@/hooks/useSessionLibrary';
import type { SessionSection, ExerciseDistribution } from '@/types/microcycle-planning';

/** Synthetic keys used for all library-session exercises/sections */
export const LIBRARY_DAY = '__library__';
export const LIBRARY_SESS = 0;

interface SaveToLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionName: string;
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  /** Saved silently as method metadata — not shown to the user */
  defaultMethod?: string;
  onSaved?: () => void;
}

export function SaveToLibraryDialog({
  open,
  onOpenChange,
  sessionName,
  exercises,
  sections,
  defaultMethod,
  onSaved,
}: SaveToLibraryDialogProps) {
  const { t } = useTranslation();
  const { columns, addEntry } = useSessionLibrary();

  const [name, setName] = useState(sessionName);
  const [columnValues, setColumnValues] = useState<Record<string, string>>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(sessionName);
      setColumnValues({});
    }
  }, [open, sessionName]);

  const handleSave = () => {
    // Normalize exercises and sections to the standard library day/session keys
    // so WorkoutSessionSheet can open them correctly from the library page.
    const normalizedExercises: ExerciseDistribution[] = exercises.map(e => ({
      ...e,
      dayDate: LIBRARY_DAY,
      sessionIndex: LIBRARY_SESS,
    }));
    const normalizedSections: SessionSection[] = sections.map(s => ({
      ...s,
      dayDate: LIBRARY_DAY,
      sessionIndex: LIBRARY_SESS,
    }));

    addEntry({
      name: name.trim() || sessionName,
      method: defaultMethod || undefined,
      sections: normalizedSections,
      exercises: normalizedExercises,
      columnValues,
    });
    onOpenChange(false);
    onSaved?.();
  };

  const requiredFilled = columns
    .filter(c => c.required)
    .every(c => (columnValues[c.id] ?? '').trim().length > 0);

  const canSave = name.trim().length > 0 && requiredFilled;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* High-z overlay so it dims the WorkoutSessionSheet behind it */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[210] w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg rounded-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-4 w-4" />
              {t('sessionLibrary.saveDialog.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Session name */}
            <div className="space-y-1.5">
              <Label>{t('sessionLibrary.saveDialog.sessionName')}</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={sessionName}
                autoFocus
              />
            </div>

            {/* Custom columns */}
            {columns.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {t('sessionLibrary.saveDialog.libraryFields')}
                </p>
                {columns.map(col => (
                  <div key={col.id} className="space-y-1.5">
                    <Label>
                      {col.name}
                      {col.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    {col.type === 'select' && col.options?.length ? (
                      <Select
                        value={columnValues[col.id] ?? '__none__'}
                        onValueChange={v =>
                          setColumnValues(prev => ({
                            ...prev,
                            [col.id]: v === '__none__' ? '' : v,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {col.options.map(opt => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col.type === 'textarea' ? (
                      <Textarea
                        value={columnValues[col.id] ?? ''}
                        onChange={e =>
                          setColumnValues(prev => ({
                            ...prev,
                            [col.id]: e.target.value,
                          }))
                        }
                        className="min-h-[60px] resize-y"
                      />
                    ) : (
                      <Input
                        value={columnValues[col.id] ?? ''}
                        onChange={e =>
                          setColumnValues(prev => ({
                            ...prev,
                            [col.id]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              <BookmarkPlus className="h-4 w-4 mr-2" />
              {t('sessionLibrary.saveDialog.save')}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
