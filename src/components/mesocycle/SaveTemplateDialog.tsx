/**
 * SaveTemplateDialog — "Save as template" from the periodization table: name + scope (whole plan or
 * one mesocycle). The typed name lives in this component's own state: kept in the Mesocycle page,
 * every keystroke re-rendered the whole page (periodization table included) and typing lagged.
 */
import { useEffect, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ALL = '__all__';

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methodName: string;
  defaultName: string;
  /** Mesocycle names (as the save function matches them) with their microcycle count */
  mesocycles: Array<{ name: string; microcycles: number }>;
  totalMicrocycles: number;
  /** mesocycleName undefined = whole plan */
  onSave: (name: string, mesocycleName?: string) => void;
}

export function SaveTemplateDialog({
  open, onOpenChange, methodName, defaultName, mesocycles, totalMicrocycles, onSave,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState(defaultName);
  const [scope, setScope] = useState(ALL);

  // Fresh values each time the dialog opens
  useEffect(() => {
    if (open) { setName(defaultName); setScope(ALL); }
  }, [open, defaultName]);

  const save = () => {
    if (!name.trim()) return;
    onSave(name.trim(), scope === ALL ? undefined : scope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookmarkPlus className="h-4 w-4" />Save as template</DialogTitle>
          <DialogDescription>
            Saves the current values of <span className="font-medium text-foreground">{methodName}</span> from the periodization table as a programming template for this method. You can load it in other plans with "Load template".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">Template name</Label>
            <Input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
          </div>
          {mesocycles.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">Microcycles</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Whole plan ({totalMicrocycles} microcycles)</SelectItem>
                  {mesocycles.map(m => (
                    <SelectItem key={m.name} value={m.name}>{m.name} ({m.microcycles} microcycles)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={save}>Save template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
