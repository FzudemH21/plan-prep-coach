import { useState, useMemo, useEffect, useCallback } from 'react';
import { WizardAIAssistant } from '@/components/wizard/WizardAIAssistant';
import { useRAGRetrieval } from '@/hooks/useRAGRetrieval';
import { useGlobalAIContext } from '@/hooks/useGlobalAIContext';
import { useCoachMemory } from '@/hooks/useCoachMemory';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Search, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useToast } from '@/hooks/use-toast';
import { ParameterV2, ParameterInteraction, ParameterMethodV2, PARAMETER_CATEGORIES, InteractionDirection, InteractionStrength } from '@/types/parametersV2';
import { AddParameterDialogV2 } from '@/components/goals/AddParameterDialogV2';
import { EditParameterDialogV2 } from '@/components/goals/EditParameterDialogV2';

type SortColumn = 'category' | 'parameter';
type SortDirection = 'asc' | 'desc';

export default function AthleticismDatabaseV2() {
  const { toast } = useToast();
  const {
    data,
    isLoading,
    addParameter,
    addParametersBulk,
    updateParameter,
    deleteParameter,
    addInteraction,
    addInteractionsBulk,
    updateInteraction,
    removeInteraction,
    getInteractionsForParameter,
    getContributesToParameters,
    getImprovedByParameters,
    addParameterMethod,
    addParameterMethodsBulk,
    updateParameterMethod,
    removeParameterMethod,
    getMethodsForParameter,
    saveData,
  } = useParametersDataV2();
  const { data: toolboxData } = useToolboxData();

  // ── AI Assistant ───────────────────────────────────────────────────────────
  const globalAIContext = useGlobalAIContext();
  const { coachMemoryContext } = useCoachMemory();
  const { retrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');

  // Build context string from current parameter database state
  const parameterContext = useMemo(() => {
    // IMPORTANT: show name and metadata separately so the AI doesn't confuse
    // "(category)" as part of the parameter name when generating apply actions.
    const paramList = data?.parameters?.length
      ? data.parameters.map((p) =>
          `- name: "${p.name}"` +
          (p.category ? ` | category: ${p.category}` : '') +
          (p.unit ? ` | unit: ${p.unit}` : '') +
          (p.applicableSports?.length ? ` | sports: ${p.applicableSports.join(', ')}` : '')
        ).join('\n')
      : 'No parameters defined yet.';

    // Extract unique training methods from toolbox entries.
    // methodId convention (matches EditParameterDialogV2):
    //   subCategory present → "<category> - <subCategory>"
    //   subCategory absent  → "<category>"
    const uniqueMethods: { label: string; methodId: string }[] = [];
    const seen = new Set<string>();
    for (const entry of toolboxData?.entries ?? []) {
      const methodId = entry.subCategory
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      if (!seen.has(methodId)) {
        seen.add(methodId);
        uniqueMethods.push({ label: entry.subCategory || entry.category, methodId });
      }
    }
    const methodList = uniqueMethods.length
      ? uniqueMethods.map((m) => `- "${m.label}" → methodId: "${m.methodId}"`).join('\n')
      : 'No training methods found in your toolbox. Add methods in the Training Methods Toolbox first.';

    return [
      `Parameters (${data?.parameters?.length ?? 0} total):\n${paramList}`,
      `Interactions defined: ${data?.interactions?.length ?? 0}`,
      `Method links defined: ${data?.parameterMethods?.length ?? 0}`,
      `Available training methods — use the exact methodId string shown when applying:\n${methodList}`,
    ].join('\n\n');
  }, [data, toolboxData]);

  useEffect(() => {
    const paramNames = (data?.parameters ?? []).map((p) => p.name).join(', ');
    const query = paramNames || 'sports performance parameters training methods';
    retrieve(query).then(setRagContext);
  }, [retrieve, data?.parameters]);

  // ── AI apply handler ───────────────────────────────────────────────────────

  // Fuzzy parameter lookup — tries increasingly lenient matches so minor AI
  // inconsistencies (trailing category suffix, different capitalisation) don't
  // cause silent failures.
  //   1. Exact match
  //   2. Case-insensitive + trimmed
  //   3. Strip trailing parenthetical suffix the AI may have appended
  //      e.g. "100m sprint time (speed)" → try "100m sprint time"
  const findParam = useCallback((name: string) => {
    const params = data?.parameters ?? [];
    const needle = name.trim();
    const needleLower = needle.toLowerCase();

    return (
      params.find((p) => p.name === needle) ??
      params.find((p) => p.name.trim().toLowerCase() === needleLower) ??
      params.find((p) => {
        // Strip one trailing (...) block from the AI-provided name and retry
        const stripped = needle.replace(/\s*\([^)]*\)\s*$/, '').trim();
        return stripped.length > 0 && p.name.trim().toLowerCase() === stripped.toLowerCase();
      }) ??
      params.find((p) => {
        // Strip one trailing (...) block from the STORED name and compare
        const stripped = p.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
        return stripped.length > 0 && stripped.toLowerCase() === needleLower;
      })
    );
  }, [data?.parameters]);

  const handleAIApply = useCallback(async (action: import('@/components/wizard/WizardAIAssistant').ApplySuggestion) => {
    if (action.type === 'add_parameter') {
      await addParameter({ name: action.name, category: action.category, unit: action.unit, applicableSports: action.applicableSports });
      toast({ title: `Parameter "${action.name}" added` });

    } else if (action.type === 'add_parameters_bulk') {
      await addParametersBulk(action.parameters.map((p) => ({ name: p.name, category: p.category, unit: p.unit, applicableSports: p.applicableSports })));
      toast({ title: `${action.parameters.length} parameter${action.parameters.length !== 1 ? 's' : ''} added` });

    } else if (action.type === 'add_interaction') {
      const source = findParam(action.sourceParameterName);
      const target = findParam(action.targetParameterName);
      if (!source || !target) {
        toast({ title: 'Could not find parameter', description: 'Make sure both parameters exist first.', variant: 'destructive' });
        return;
      }
      await addInteraction(source.id, target.id, action.direction, action.strength ?? 'moderate');
      toast({ title: `Interaction added: ${action.sourceParameterName} → ${action.targetParameterName}` });

    } else if (action.type === 'add_interactions_bulk') {
      const failed: string[] = [];
      const resolved: Array<{ sourceParameterId: string; targetParameterId: string; direction: 'contributes_to' | 'improved_by'; strength: 'strong' | 'moderate' | 'weak' }> = [];
      for (const i of action.interactions) {
        const source = findParam(i.sourceParameterName);
        const target = findParam(i.targetParameterName);
        if (!source || !target) { failed.push(`${i.sourceParameterName} → ${i.targetParameterName}`); continue; }
        resolved.push({ sourceParameterId: source.id, targetParameterId: target.id, direction: i.direction, strength: i.strength ?? 'moderate' });
      }
      if (resolved.length > 0) await addInteractionsBulk(resolved);
      if (resolved.length > 0) toast({ title: `${resolved.length} interaction${resolved.length !== 1 ? 's' : ''} added` });
      if (failed.length > 0) {
        toast({
          title: `${failed.length} interaction${failed.length !== 1 ? 's' : ''} skipped — parameter not found`,
          description: failed.slice(0, 3).join(' | ') + (failed.length > 3 ? ` + ${failed.length - 3} more` : ''),
          variant: 'destructive',
        });
      }

    } else if (action.type === 'add_parameter_method') {
      const param = findParam(action.parameterName);
      if (!param) {
        toast({ title: 'Parameter not found', description: `"${action.parameterName}" does not exist yet.`, variant: 'destructive' });
        return;
      }
      await addParameterMethod(param.id, action.methodId, action.rationale, action.evidence);
      toast({ title: `Method linked to "${action.parameterName}"` });

    } else if (action.type === 'add_parameter_methods_bulk') {
      const failed: string[] = [];
      const resolved: Array<{ parameterId: string; methodId: string; rationale?: string; evidence?: string }> = [];
      for (const link of action.links) {
        const param = findParam(link.parameterName);
        if (!param) { failed.push(link.parameterName); continue; }
        resolved.push({ parameterId: param.id, methodId: link.methodId, rationale: link.rationale, evidence: link.evidence });
      }
      if (resolved.length > 0) await addParameterMethodsBulk(resolved);
      if (resolved.length > 0) toast({ title: `${resolved.length} method link${resolved.length !== 1 ? 's' : ''} added` });
      if (failed.length > 0) {
        toast({
          title: `${failed.length} link${failed.length !== 1 ? 's' : ''} skipped — parameter not found`,
          description: failed.slice(0, 3).join(', ') + (failed.length > 3 ? ` + ${failed.length - 3} more` : ''),
          variant: 'destructive',
        });
      }
    }
  }, [addParameter, addParametersBulk, addInteraction, addInteractionsBulk, addParameterMethod, addParameterMethodsBulk, findParam, toast]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>('parameter');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Filtering state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [parameterSearch, setParameterSearch] = useState('');
  const [showParameterSearch, setShowParameterSearch] = useState(false);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  
  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingParameter, setEditingParameter] = useState<ParameterV2 | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ParameterV2 | null>(null);

  // Get unique categories from parameters
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    data.parameters.forEach((p) => {
      if (p.category) {
        categories.add(p.category);
      }
    });
    return Array.from(categories).sort();
  }, [data.parameters]);

  // Filter and sort parameters
  const filteredParameters = useMemo(() => {
    let result = [...data.parameters];
    
    // Filter by search term
    if (parameterSearch) {
      const lower = parameterSearch.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(lower));
    }
    
    // Filter by selected categories
    if (selectedCategories.length > 0) {
      result = result.filter((p) => p.category && selectedCategories.includes(p.category));
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      
      if (sortColumn === 'category') {
        const catA = a.category || '';
        const catB = b.category || '';
        comparison = catA.localeCompare(catB);
      } else {
        comparison = a.name.localeCompare(b.name);
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [data.parameters, parameterSearch, selectedCategories, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleCategoryFilter = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const clearCategoryFilters = () => {
    setSelectedCategories([]);
    setCategoryFilterOpen(false);
  };

  const handleAddParameter = (parameterData: {
    name: string;
    unit?: string;
    category?: string;
    applicableSports?: string[];
    interactions: { targetParameterId: string; direction: InteractionDirection; strength: InteractionStrength }[];
    methods: { methodId: string; rationale?: string }[];
  }) => {
    const newParameterId = Date.now().toString();
    const newParameter: ParameterV2 = {
      id: newParameterId,
      name: parameterData.name,
      unit: parameterData.unit,
      category: parameterData.category,
      applicableSports: parameterData.applicableSports,
      createdAt: new Date().toISOString(),
    };

    const newInteractions: ParameterInteraction[] = parameterData.interactions.map((interaction, idx) => ({
      id: (Date.now() + idx + 1).toString(),
      sourceParameterId: interaction.direction === 'contributes_to' ? newParameterId : interaction.targetParameterId,
      targetParameterId: interaction.direction === 'contributes_to' ? interaction.targetParameterId : newParameterId,
      direction: 'contributes_to' as InteractionDirection,
      strength: interaction.strength,
    }));

    const newMethods: ParameterMethodV2[] = parameterData.methods.map((method, idx) => ({
      id: (Date.now() + parameterData.interactions.length + idx + 1).toString(),
      parameterId: newParameterId,
      methodId: method.methodId,
      rationale: method.rationale,
    }));

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

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
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
            <div>
              <h1 className="text-xl font-semibold">Parameter Database</h1>
              <p className="text-sm text-muted-foreground">
                Parameters with interactions and training methods
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-end">
          <div className="flex gap-2">
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
                  {/* Category Column Header */}
                  <TableHead className="w-[20%]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSort('category')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Category
                        {getSortIcon('category')}
                      </button>
                      <Popover open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 ${selectedCategories.length > 0 ? 'text-primary' : 'text-muted-foreground'}`}
                          >
                            <Filter className="h-3.5 w-3.5" />
                            {selectedCategories.length > 0 && (
                              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                                {selectedCategories.length}
                              </span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3 bg-popover" align="start">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">Filter by Category</p>
                              {selectedCategories.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={clearCategoryFilters}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {uniqueCategories.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No categories found</p>
                              ) : (
                                uniqueCategories.map((category) => {
                                  const label = PARAMETER_CATEGORIES.find((c) => c.value === category)?.label || category;
                                  return (
                                    <div key={category} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`cat-${category}`}
                                        checked={selectedCategories.includes(category)}
                                        onCheckedChange={() => toggleCategoryFilter(category)}
                                      />
                                      <label
                                        htmlFor={`cat-${category}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {label}
                                      </label>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>
                  
                  {/* Parameter Column Header */}
                  <TableHead className="w-[50%]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSort('parameter')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Parameter
                        {getSortIcon('parameter')}
                      </button>
                      {showParameterSearch ? (
                        <div className="flex items-center gap-1 ml-2">
                          <Input
                            placeholder="Search..."
                            value={parameterSearch}
                            onChange={(e) => setParameterSearch(e.target.value)}
                            className="h-7 w-40 text-sm"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setShowParameterSearch(false);
                              setParameterSearch('');
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 ${parameterSearch ? 'text-primary' : 'text-muted-foreground'}`}
                          onClick={() => setShowParameterSearch(true)}
                        >
                          <Search className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableHead>
                  
                  <TableHead className="w-[22%]">Applicable Sports</TableHead>
                  <TableHead className="w-[18%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParameters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      {parameterSearch || selectedCategories.length > 0
                        ? 'No parameters match your filters.'
                        : 'No parameters yet. Click "Add Parameter" to create one.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParameters.map((parameter) => {
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
                          {parameter.applicableSports?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {parameter.applicableSports.map((sport) => (
                                <Badge key={sport} variant="outline" className="text-xs">
                                  {sport}
                                </Badge>
                              ))}
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
          onAddInteraction={addInteraction}
          onUpdateInteraction={updateInteraction}
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

      {/* AI Assistant */}
      <WizardAIAssistant
        stepLabel="Parameter Database"
        wizardContext={parameterContext}
        coachMemoryContext={coachMemoryContext}
        ragContext={ragContext}
        globalContext={globalAIContext}
        onApplySuggestion={handleAIApply}
        assistantRole="Answer sports science questions and help the coach define and structure their parameter database. This is a general template database — it is NOT tied to any specific athlete, training phase, or mesocycle. Parameters already in the database are examples or templates, not athlete-specific data. Do NOT ask about the coach's athlete, training phase, season context, or testing infrastructure unless the coach explicitly brings it up. When suggesting or filling parameters, use general scientific specifications (e.g. 'Ground contact time at maximum velocity, 30–60m phase') without assuming any particular athlete context. Suggest relevant parameters, categories, units, and evidence-based rationale. When asked, suggest interactions between parameters or links to training methods. Do not make unsolicited judgments about parameters the coach has already added."
      />
    </div>
  );
}
