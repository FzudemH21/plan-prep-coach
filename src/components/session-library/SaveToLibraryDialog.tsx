import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
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
import { BookmarkPlus } from 'lucide-react';
import { useSessionLibrary } from '@/hooks/useSessionLibrary';
import { useToolboxData } from '@/hooks/useToolboxData';
import type { SessionSection, ExerciseDistribution } from '@/types/microcycle-planning';

interface SaveToLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionName: string;
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  /** Pre-fill method from the session's primary method */
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
  const { data: toolboxData } = useToolboxData();

  const [name, setName] = useState(sessionName);
  const [method, setMethod] = useState(defaultMethod ?? '');
  const [columnValues, setColumnValues] = useState<Record<string, string>>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(sessionName);
      setMethod(defaultMethod ?? '');
      setColumnValues({});
    }
  }, [open, sessionName, defaultMethod]);

  // Flat list of all toolbox methods: "Category - SubCategory"
  const allMethods = Array.from(
    new Set(
      toolboxData.entries.map(
        e => `${e.category}${e.subCategory ? ` - ${e.subCategory}` : ''}`
      )
    )
  ).sort();

  const handleSave = () => {
    addEntry({
      name: name.trim() || sessionName,
      method: method || undefined,
      sections,
      exercises,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
            />
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <Label>{t('sessionLibrary.saveDialog.method')}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder={t('sessionLibrary.noMethod')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('sessionLibrary.noMethod')}</SelectItem>
                {allMethods.map(m => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      value={columnValues[col.id] ?? ''}
                      onValueChange={v =>
                        setColumnValues(prev => ({ ...prev, [col.id]: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
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
      </DialogContent>
    </Dialog>
  );
}
