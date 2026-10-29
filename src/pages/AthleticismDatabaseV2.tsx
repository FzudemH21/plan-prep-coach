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
import { Plus, Search, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Loader2 } from 'lucide-react';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { isDatabaseAction, useDatabaseAIActions } from '@/hooks/useDatabaseAIActions';
import { hasCustomMeasures, measureSummary, parameterMeasures } from '@/utils/parameterMeasures';
import { useToast } from '@/hooks/use-toast';
import { ParameterV2, ParameterInteraction, ParameterMethodV2, PARAMETER_CATEGORIES, InteractionDirection, InteractionStrength, type ParameterMeasure } from '@/types/parametersV2';
import { AddParameterDialogV2 } from '@/components/goals/AddParameterDialogV2';
import { EditParameterDialogV2 } from '@/components/goals/EditParameterDialogV2';
import { LsiCleanupDialog } from '@/components/goals/LsiCleanupDialog';

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
    isLoading: parametersLoading,
  } = useParametersDataV2();
  const { data: toolboxData } = useToolboxData();

  // ── AI Assistant ───────────────────────────────────────────────────────────
  const globalAIContext = useGlobalAIContext();
  const { coachMemoryContext } = useCoachMemory();
  const { retrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');

  // Build context string from current parameter database state
  // The AI's view of the database and its changes — shared with the wizard and the toolbox
  const { parameterContext, applyDatabaseActions } = useDatabaseAIActions();

  useEffect(() => {
    const paramNames = (data?.parameters ?? []).map((p) => p.name).join(', ');
    const query = paramNames || 'sports performance parameters training methods';
    retrieve(query).then(setRagContext);
  }, [retrieve, data?.parameters]);

  // ── AI apply handler ───────────────────────────────────────────────────────
  // Same logic as in the wizard and the toolbox (useDatabaseAIActions): all actions in one pass, one save
  const handleAIApply = useCallback(async (action: import('@/components/wizard/WizardAIAssistant').ApplySuggestion) => {
    if (isDatabaseAction(action)) await applyDatabaseActions([action]);
  }, [applyDatabaseActions]);

  const handleAIApplyAll = useCallback(async (actions: import('@/components/wizard/WizardAIAssistant').ApplySuggestion[]) => {
    const dbActions = actions.filter(isDatabaseAction);
    if (dbActions.length > 0) await applyDatabaseActions(dbActions);
  }, [applyDatabaseActions]);

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
  // Temporary: LSI parameters → parameters recorded per side
  const [showLsiCleanup, setShowLsiCleanup] = useState(false);

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
    isBiometric?: boolean;
    measures?: ParameterMeasure[];
    perSide?: boolean;
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
      isBiometric: parameterData.isBiometric,
      measures: parameterData.measures,
      perSide: parameterData.perSide,
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
            <Button size="sm" variant="outline" onClick={() => setShowLsiCleanup(true)}>
              LSI clean-up
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
                      {parametersLoading
                        ? <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        : parameterSearch || selectedCategories.length > 0
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
                            {parameter.isBiometric && (
                              <Badge variant="outline" className="ml-2 text-xs font-normal border-teal-300 text-teal-700 bg-teal-50">
                                Biometric
                              </Badge>
                            )}
                            {parameter.perSide && (
                              <Badge variant="outline" className="ml-2 text-xs font-normal" title="Recorded per side (left / right) — LSI for number measures">
                                L / R
                              </Badge>
                            )}
                          </div>
                          {/* Measures: shown once there is more than the main measure */}
                          {hasCustomMeasures(parameter) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {parameterMeasures(parameter).map((m) => (
                                <span key={m.id} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground" title={measureSummary(m)}>
                                  {m.name}
                                </span>
                              ))}
                            </div>
                          )}
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

      {/* Temporary: LSI clean-up */}
      <LsiCleanupDialog open={showLsiCleanup} onOpenChange={setShowLsiCleanup} parameters={data.parameters} />

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
        onApplyAll={handleAIApplyAll}
        assistantRole="Answer sports science questions and help the coach define and structure their parameter database. This is a general template database — it is NOT tied to any specific athlete, training phase, or mesocycle. Parameters already in the database are examples or templates, not athlete-specific data. Do NOT ask about the coach's athlete, training phase, season context, or testing infrastructure unless the coach explicitly brings it up. When suggesting or filling parameters, use general scientific specifications (e.g. 'Ground contact time at maximum velocity, 30–60m phase') without assuming any particular athlete context. Suggest relevant parameters, categories, units, and evidence-based rationale. When asked, suggest interactions between parameters or links to training methods. Do not make unsolicited judgments about parameters the coach has already added.

Training Toolbox awareness (critical): The global context contains the coach's full Training Toolbox — every method with its parameters and, where the coach has written one, a Description field explaining what the method means in their context. Before suggesting any parameter-method link, read ALL method descriptions in the Training Toolbox section of the global context. Use the descriptions to reason about which parameters each method actually develops, at what intensities and volumes, and through which physiological pathways. A method description might reveal a specific focus (e.g. 'high-velocity maximal strength') that makes some parameter links strong (peak power, RFD, velocity at 1RM) and others weak (aerobic capacity, flexibility). Always reference the description when writing the rationale for a link — quote it briefly if relevant. If a method has no description yet, fall back to the method name and its configured parameters to infer the link. Never suggest a parameter-method link without first checking whether the method description provides direct evidence for or against it."
      />
    </div>
  );
}
