import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Edit, Loader2, ClipboardList, X,
} from 'lucide-react';
import { useAnamnesisTemplates } from '@/hooks/useAnamnesisTemplates';
import { DEFAULT_ANAMNESIS_TEMPLATE } from '@/types/anamnesis';
import type { AnamnesisTemplate, AnamnesisSection, AnamnesisField, AnamnesisFieldType } from '@/types/anamnesis';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankField(): AnamnesisField {
  return { id: uid(), label: '', fieldType: 'text' };
}

function blankSection(): AnamnesisSection {
  return { id: uid(), title: '', fields: [blankField()] };
}

const FIELD_TYPE_LABELS: Record<AnamnesisFieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  select: 'Dropdown',
  boolean: 'Yes / No',
};

// ── Field row editor ──────────────────────────────────────────────────────────

function FieldRow({
  field,
  isFirst,
  isLast,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  field: AnamnesisField;
  isFirst: boolean;
  isLast: boolean;
  onChange: (updated: AnamnesisField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [optionsInput, setOptionsInput] = useState((field.options ?? []).join(', '));

  const handleOptionsBlur = () => {
    const parsed = optionsInput
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    onChange({ ...field, options: parsed });
  };

  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-md border bg-background">
      <div className="flex gap-2 items-start">
        <div className="flex-1 flex gap-2">
          <Input
            className="flex-1 h-8 text-sm"
            placeholder="Field label"
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
          />
          <Select
            value={field.fieldType}
            onValueChange={(v) => onChange({ ...field, fieldType: v as AnamnesisFieldType, options: v === 'select' ? (field.options ?? ['Option 1', 'Option 2']) : undefined })}
          >
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(FIELD_TYPE_LABELS) as [AnamnesisFieldType, string][]).map(([val, label]) => (
                <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {field.fieldType === 'select' && (
        <div className="pl-0.5">
          <Label className="text-xs text-muted-foreground mb-1 block">Options (comma-separated)</Label>
          <Input
            className="h-7 text-xs"
            placeholder="Option 1, Option 2, Option 3"
            value={optionsInput}
            onChange={(e) => setOptionsInput(e.target.value)}
            onBlur={handleOptionsBlur}
          />
        </div>
      )}
    </div>
  );
}

// ── Section editor ────────────────────────────────────────────────────────────

function SectionEditor({
  section,
  isFirst,
  isLast,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  section: AnamnesisSection;
  isFirst: boolean;
  isLast: boolean;
  onChange: (updated: AnamnesisSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const updateField = (idx: number, updated: AnamnesisField) => {
    const fields = section.fields.map((f, i) => (i === idx ? updated : f));
    onChange({ ...section, fields });
  };

  const deleteField = (idx: number) => {
    onChange({ ...section, fields: section.fields.filter((_, i) => i !== idx) });
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const fields = [...section.fields];
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    [fields[idx], fields[target]] = [fields[target], fields[idx]];
    onChange({ ...section, fields });
  };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex gap-2 items-center">
        <Input
          className="flex-1 h-8 text-sm font-medium"
          placeholder="Section title"
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
        />
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 pl-1">
        {section.fields.map((field, idx) => (
          <FieldRow
            key={field.id}
            field={field}
            isFirst={idx === 0}
            isLast={idx === section.fields.length - 1}
            onChange={(u) => updateField(idx, u)}
            onDelete={() => deleteField(idx)}
            onMoveUp={() => moveField(idx, -1)}
            onMoveDown={() => moveField(idx, 1)}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground w-full justify-start gap-1.5"
          onClick={() => onChange({ ...section, fields: [...section.fields, blankField()] })}
        >
          <Plus className="h-3 w-3" />
          Add field
        </Button>
      </div>
    </div>
  );
}

// ── Template editor dialog ────────────────────────────────────────────────────

function TemplateEditorDialog({
  initial,
  open,
  onClose,
  onSave,
  isSaving,
}: {
  initial: { name: string; sections: AnamnesisSection[] };
  open: boolean;
  onClose: () => void;
  onSave: (name: string, sections: AnamnesisSection[]) => Promise<void>;
  isSaving: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [sections, setSections] = useState<AnamnesisSection[]>(initial.sections);

  // Reset local state when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
  };

  const updateSection = (idx: number, updated: AnamnesisSection) => {
    setSections(sections.map((s, i) => (i === idx ? updated : s)));
  };

  const deleteSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2 shrink-0">
          <Label className="text-sm mb-1 block">Template Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. General Anamnesis, Rehab Assessment"
            className="h-9"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 px-6">
          <div className="space-y-2 pb-4">
            {sections.map((section, idx) => (
              <SectionEditor
                key={section.id}
                section={section}
                isFirst={idx === 0}
                isLast={idx === sections.length - 1}
                onChange={(u) => updateSection(idx, u)}
                onDelete={() => deleteSection(idx)}
                onMoveUp={() => moveSection(idx, -1)}
                onMoveDown={() => moveSection(idx, 1)}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setSections([...sections, blankSection()])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Section
            </Button>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button
            onClick={() => onSave(name, sections)}
            disabled={!name.trim() || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AnamnesisTemplateEditor() {
  const { toast } = useToast();
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useAnamnesisTemplates();

  const [editingTemplate, setEditingTemplate] = useState<AnamnesisTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newFromDefault, setNewFromDefault] = useState(false);

  const handleEdit = (t: AnamnesisTemplate) => {
    setEditingTemplate(t);
    setIsCreating(false);
  };

  const handleNew = (fromDefault = false) => {
    setNewFromDefault(fromDefault);
    setEditingTemplate(null);
    setIsCreating(true);
  };

  const handleSaveNew = async (name: string, sections: AnamnesisSection[]) => {
    setIsSaving(true);
    const created = await createTemplate(name, sections);
    setIsSaving(false);
    if (created) {
      toast({ title: 'Template created', description: `"${name}" is ready to use.` });
      setIsCreating(false);
    } else {
      toast({ title: 'Error', description: 'Failed to create template.', variant: 'destructive' });
    }
  };

  const handleSaveEdit = async (name: string, sections: AnamnesisSection[]) => {
    if (!editingTemplate) return;
    setIsSaving(true);
    const ok = await updateTemplate(editingTemplate.id, { name, sections });
    setIsSaving(false);
    if (ok) {
      toast({ title: 'Template saved' });
      setEditingTemplate(null);
    } else {
      toast({ title: 'Error', description: 'Failed to save template.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await deleteTemplate(id);
    if (ok) {
      toast({ title: 'Template deleted', description: `"${name}" has been removed.` });
    } else {
      toast({ title: 'Error', description: 'Failed to delete template.', variant: 'destructive' });
    }
  };

  const totalFields = (t: AnamnesisTemplate) =>
    t.sections.reduce((sum, s) => sum + s.fields.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Define reusable intake templates. Coaches fill these out during athlete onboarding sessions.
          </p>
        </div>
        <Button size="sm" onClick={() => handleNew(false)} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          New Template
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div className="text-center py-10 border rounded-lg bg-muted/20">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium mb-1">No templates yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Start with the default template based on a full sports-science protocol.
          </p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={() => handleNew(true)}>
              Load Default Template
            </Button>
            <Button size="sm" onClick={() => handleNew(false)}>
              Start Blank
            </Button>
          </div>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.sections.length} section{t.sections.length !== 1 ? 's' : ''} · {totalFields(t)} field{totalFields(t) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleEdit(t)}>
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete template?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{t.name}" will be removed. Existing athlete anamnesis records that used this template will be unaffected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(t.id, t.name)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New template dialog */}
      {isCreating && (
        <TemplateEditorDialog
          key="new"
          initial={newFromDefault
            ? { name: DEFAULT_ANAMNESIS_TEMPLATE.name, sections: DEFAULT_ANAMNESIS_TEMPLATE.sections }
            : { name: '', sections: [blankSection()] }
          }
          open
          onClose={() => setIsCreating(false)}
          onSave={handleSaveNew}
          isSaving={isSaving}
        />
      )}

      {/* Edit existing template dialog */}
      {editingTemplate && (
        <TemplateEditorDialog
          key={editingTemplate.id}
          initial={{ name: editingTemplate.name, sections: editingTemplate.sections }}
          open
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveEdit}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
