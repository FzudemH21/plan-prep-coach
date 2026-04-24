import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, LayoutTemplate, Columns } from 'lucide-react';
import { format } from 'date-fns';
import { useTemplates, type ProgramTemplate } from '@/hooks/useTemplates';
import { TemplateEditorDialog } from '@/components/toolbox/TemplateEditorDialog';
import { ToolboxEntry } from '@/types/toolbox';

interface MethodTemplatesPanelProps {
  methodId: string;
  methodName: string;
  parameters: ToolboxEntry[];
}

export function MethodTemplatesPanel({
  methodId,
  methodName,
  parameters,
}: MethodTemplatesPanelProps) {
  const { getTemplatesForMethod, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const templates = getTemplatesForMethod(methodId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProgramTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramTemplate | null>(null);

  const openNew = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const openEdit = (tpl: ProgramTemplate) => {
    setEditingTemplate(tpl);
    setEditorOpen(true);
  };

  const handleSave = (data: Omit<ProgramTemplate, 'id' | 'createdAt'>) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, data);
    } else {
      addTemplate(data);
    }
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteTemplate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const totalCells = (tpl: ProgramTemplate) =>
    tpl.columns.reduce((acc, c) => acc + (c.isSplit ? 2 : 1), 0);

  return (
    <div className="p-4 bg-muted/20 border-t space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Templates</span>
          {templates.length > 0 && (
            <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openNew}>
          <Plus className="h-3 w-3 mr-1" />
          New Template
        </Button>
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No templates yet. Click "New Template" to create one.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {templates.map(tpl => {
            const splitCount = tpl.columns.filter(c => c.isSplit).length;
            return (
              <div
                key={tpl.id}
                className="group flex items-start justify-between gap-2 rounded-md border bg-card px-3 py-2 hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium truncate" title={tpl.name}>{tpl.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{tpl.columns.length} col{tpl.columns.length !== 1 ? 's' : ''}</span>
                    {splitCount > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Columns className="h-2.5 w-2.5" />
                        {splitCount} split
                      </span>
                    )}
                    <span>{totalCells(tpl)} cells</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(tpl.createdAt), 'dd.MM.yyyy')}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 w-6 p-0"
                    title="Edit template"
                    onClick={() => openEdit(tpl)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    title="Delete template"
                    onClick={() => setDeleteTarget(tpl)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor dialog */}
      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialTemplate={editingTemplate ?? undefined}
        methodId={methodId}
        methodName={methodName}
        parameters={parameters}
        onSave={handleSave}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
