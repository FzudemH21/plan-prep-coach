import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { ArrowLeft, Plus, Search, Edit2, Trash2, Download, Upload } from 'lucide-react';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useToast } from '@/hooks/use-toast';
import { ParameterV2, ParameterInteraction, ParameterMethodV2, PARAMETER_CATEGORIES } from '@/types/parametersV2';
import { AddParameterDialogV2 } from '@/components/goals/AddParameterDialogV2';
import { EditParameterDialogV2 } from '@/components/goals/EditParameterDialogV2';

export default function AthleticismDatabaseV2() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    data,
    isLoading,
    updateParameter,
    deleteParameter,
    addInteraction,
    removeInteraction,
    getInteractionsForParameter,
    addParameterMethod,
    updateParameterMethod,
    removeParameterMethod,
    getMethodsForParameter,
    saveData,
  } = useParametersDataV2();
  const { data: toolboxData } = useToolboxData();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingParameter, setEditingParameter] = useState<ParameterV2 | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ParameterV2 | null>(null);

  // Filter parameters by search term
  const filteredParameters = useMemo(() => {
    if (!searchTerm) return data.parameters;
    const lower = searchTerm.toLowerCase();
    return data.parameters.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.category?.toLowerCase().includes(lower) ||
        p.unit?.toLowerCase().includes(lower)
    );
  }, [data.parameters, searchTerm]);

  // Get display info for a parameter
  const getParameterDisplayInfo = (parameter: ParameterV2) => {
    const interactions = getInteractionsForParameter(parameter.id);
    const methods = getMethodsForParameter(parameter.id);

    const interactingParameterNames = interactions
      .map((i) => {
        const p = data.parameters.find((x) => x.id === i.interactingParameterId);
        return p?.name || '';
      })
      .filter(Boolean);

    const methodNames = methods.map((m) => m.methodId);

    return { interactingParameterNames, methodNames };
  };

  const handleAddParameter = (parameterData: {
    name: string;
    unit?: string;
    category?: string;
    interactions: string[];
    methods: { methodId: string; rationale?: string }[];
  }) => {
    // Create all data atomically to avoid stale closure issues
    const newParameterId = Date.now().toString();
    const newParameter: ParameterV2 = {
      id: newParameterId,
      name: parameterData.name,
      unit: parameterData.unit,
      category: parameterData.category,
      createdAt: new Date().toISOString(),
    };

    const newInteractions: ParameterInteraction[] = parameterData.interactions.map((interactingParameterId, idx) => ({
      id: (Date.now() + idx + 1).toString(),
      parameterId: newParameterId,
      interactingParameterId,
    }));

    const newMethods: ParameterMethodV2[] = parameterData.methods.map((method, idx) => ({
      id: (Date.now() + parameterData.interactions.length + idx + 1).toString(),
      parameterId: newParameterId,
      methodId: method.methodId,
      rationale: method.rationale,
    }));

    // Single atomic save to prevent stale closure overwrites
    saveData({
      ...data,
      parameters: [...data.parameters, newParameter],
      interactions: [...data.interactions, ...newInteractions],
      parameterMethods: [...data.parameterMethods, ...newMethods],
    });

    toast({ title: 'Parameter added', description: `"${parameterData.name}" has been created.` });
  };

  const handleDeleteParameter = () => {
    if (deleteConfirm) {
      deleteParameter(deleteConfirm.id);
      toast({ title: 'Parameter deleted', description: `"${deleteConfirm.name}" has been removed.` });
      setDeleteConfirm(null);
    }
  };

  const handleExport = () => {
    const exportData = JSON.stringify(data, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parameters-database-v2.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export complete', description: 'Database exported as JSON.' });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          if (imported.parameters && imported.interactions && imported.parameterMethods) {
            localStorage.setItem('parameters-database-v2', text);
            window.location.reload();
          } else {
            throw new Error('Invalid format');
          }
        } catch {
          toast({ title: 'Import failed', description: 'Invalid file format.', variant: 'destructive' });
        }
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Athleticism Database (v2)</h1>
              <p className="text-sm text-muted-foreground">
                Unified parameters with interactions and training methods
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parameters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Parameter
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="container mx-auto px-4 pb-8">
        <div className="border rounded-lg bg-card">
          <ScrollArea className="h-[calc(100vh-250px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%]">Category</TableHead>
                  <TableHead className="w-[25%]">Parameter</TableHead>
                  <TableHead className="w-[25%]">Interacting Parameters</TableHead>
                  <TableHead className="w-[25%]">Associated Methods</TableHead>
                  <TableHead className="w-[10%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParameters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      {searchTerm
                        ? 'No parameters match your search.'
                        : 'No parameters yet. Click "Add Parameter" to create one.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParameters.map((parameter) => {
                    const { interactingParameterNames, methodNames } = getParameterDisplayInfo(parameter);
                    const categoryLabel = PARAMETER_CATEGORIES.find((c) => c.value === parameter.category)?.label || parameter.category;

                    return (
                      <TableRow key={parameter.id}>
                        <TableCell>
                          {categoryLabel ? (
                            <Badge variant="secondary" className="text-xs">
                              {categoryLabel}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {parameter.name}
                            {parameter.unit && (
                              <span className="font-normal text-muted-foreground ml-1">
                                ({parameter.unit})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {interactingParameterNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {interactingParameterNames.slice(0, 3).map((name, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {name}
                                </Badge>
                              ))}
                              {interactingParameterNames.length > 3 && (
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="inline-flex" aria-label="Show all interacting parameters">
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-pointer">
                                          +{interactingParameterNames.length - 3} more
                                        </Badge>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[300px] z-[100]">
                                      <div className="text-xs space-y-0.5">
                                        <div className="font-medium mb-1">All Interacting Parameters:</div>
                                        {interactingParameterNames.map((name, i) => (
                                          <div key={i}>• {name}</div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {methodNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {methodNames.slice(0, 2).map((name, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {name}
                                </Badge>
                              ))}
                              {methodNames.length > 2 && (
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="inline-flex" aria-label="Show all methods">
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 cursor-pointer">
                                          +{methodNames.length - 2} more
                                        </Badge>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[300px] z-[100]">
                                      <div className="text-xs space-y-0.5">
                                        <div className="font-medium mb-1">All Methods:</div>
                                        {methodNames.map((name, i) => (
                                          <div key={i}>• {name}</div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingParameter(parameter)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(parameter)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>

      {/* Add Dialog */}
      <AddParameterDialogV2
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        allParameters={data.parameters}
        toolboxEntries={toolboxData.entries}
        onAdd={handleAddParameter}
      />

      {/* Edit Dialog */}
      {editingParameter && (
        <EditParameterDialogV2
          open={!!editingParameter}
          onOpenChange={(open) => !open && setEditingParameter(null)}
          parameter={editingParameter}
          allParameters={data.parameters}
          allInteractions={data.interactions}
          allParameterMethods={data.parameterMethods}
          toolboxEntries={toolboxData.entries}
          onUpdateParameter={(updates) => updateParameter(editingParameter.id, updates)}
          onAddInteraction={(interactingParameterId) => addInteraction(editingParameter.id, interactingParameterId)}
          onRemoveInteraction={removeInteraction}
          onAddMethod={(methodId) => addParameterMethod(editingParameter.id, methodId)}
          onUpdateMethod={updateParameterMethod}
          onRemoveMethod={removeParameterMethod}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Parameter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This will also remove all
              associated interactions and methods. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteParameter} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
