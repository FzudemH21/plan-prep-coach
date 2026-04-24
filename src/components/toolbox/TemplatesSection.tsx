import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, Columns, LayoutTemplate } from 'lucide-react';
import { format } from 'date-fns';
import { useTemplates, type ProgramTemplate } from '@/hooks/useTemplates';
import { TemplateEditorDialog } from '@/components/toolbox/TemplateEditorDialog';
import { ToolboxEntry } from '@/types/toolbox';

interface Method {
  key: string;          // "category|||subCategory"
  category: string;
  subCategory: string;
  parameters: ToolboxEntry[];
}

interface TemplatesSectionProps {
  methods: Method[];
}

export function TemplatesSection({ methods }: TemplatesSectionProps) {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();

  // ── Local state ──────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('__all__');

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProgramTemplate | null>(null);
  const [editorMethodKey, setEditorMethodKey] = useState<string>('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ProgramTemplate | null>(null);

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...templates];

    if (methodFilter !== '__all__') {
      list = list.filter(t => t.methodId === methodFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(term) ||
          t.methodName.toLowerCase().includes(term),
      );
    }

    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [templates, methodFilter, searchTerm]);

  // ── Editor helpers ────────────────────────────────────────────
  const openNewEditor = (methodKey?: string) => {
    setEditingTemplate(null);
    setEditorMethodKey(methodKey ?? (methods[0]?.key ?? ''));
    setEditorOpen(true);
  };

  const openEditEditor = (template: ProgramTemplate) => {
    setEditingTemplate(template);
    setEditorMethodKey(template.methodId);
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

  // ── Editor method ─────────────────────────────────────────────
  const editorMethod = methods.find(m => m.key === editorMethodKey);

  // ── Column count helper ───────────────────────────────────────
  const totalCells = (tpl: ProgramTemplate) =>
    tpl.columns.reduce((acc, c) => acc + (c.isSplit ? 2 : 1), 0);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutTemplate className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Programming Templates</h2>
          <Badge variant="secondary">{templates.length}</Badge>
        </div>
        <Button onClick={() => openNewEditor(methodFilter !== '__all__' ? methodFilter : undefined)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All methods</SelectItem>
            {methods.map(m => (
              <SelectItem key={m.key} value={m.key}>
                {m.subCategory} <span className="text-muted-foreground text-xs ml-1">({m.category})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <LayoutTemplate className="h-10 w-10 mx-auto opacity-20" />
            <p className="text-sm">
              {templates.length === 0
                ? 'No templates yet. Click "New Template" to create your first programming template.'
                : 'No templates match your filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tpl => {
            const method = methods.find(m => m.key === tpl.methodId);
            const splitCount = tpl.columns.filter(c => c.isSplit).length;

            return (
              <Card key={tpl.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{tpl.name}</CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Edit template"
                        onClick={() => openEditEditor(tpl)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="Delete template"
                        onClick={() => setDeleteTarget(tpl)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {tpl.methodName || method?.subCategory || 'Unknown method'}
                    </Badge>
                    {method && (
                      <Badge variant="secondary" className="text-xs text-muted-foreground">
                        {method.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{tpl.columns.length} column{tpl.columns.length !== 1 ? 's' : ''}</span>
                    {splitCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Columns className="h-3 w-3" />
                        {splitCount} split
                      </span>
                    )}
                    <span>{totalCells(tpl)} cell{totalCells(tpl) !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(tpl.createdAt), 'dd.MM.yyyy')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-1 text-xs h-8"
                    onClick={() => openEditEditor(tpl)}
                  >
                    <Pencil className="h-3 w-3 mr-1.5" />
                    Open Editor
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Template Editor Dialog */}
      {editorMethod && (
        <TemplateEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initialTemplate={editingTemplate ?? undefined}
          methodId={editorMethodKey}
          methodName={editorMethod.subCategory}
          parameters={editorMethod.parameters}
          onSave={handleSave}
        />
      )}

      {/* If no method matched (e.g. method was deleted), show fallback */}
      {!editorMethod && editorOpen && (
        <TemplateEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initialTemplate={editingTemplate ?? undefined}
          methodId={editorMethodKey}
          methodName={editingTemplate?.methodName ?? ''}
          parameters={[]}
          onSave={handleSave}
        />
      )}

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
