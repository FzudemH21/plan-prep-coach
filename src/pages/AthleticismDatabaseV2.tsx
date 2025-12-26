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
import { ArrowLeft, Plus, Search, Edit2, Trash2, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useToast } from '@/hooks/use-toast';
import { ParameterV2, ParameterInteraction, ParameterMethodV2, PARAMETER_CATEGORIES, InteractionDirection, InteractionStrength } from '@/types/parametersV2';
import { AddParameterDialogV2 } from '@/components/goals/AddParameterDialogV2';
import { EditParameterDialogV2 } from '@/components/goals/EditParameterDialogV2';

type SortColumn = 'category' | 'parameter';
type SortDirection = 'asc' | 'desc';

export default function AthleticismDatabaseV2() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    data,
    isLoading,
    updateParameter,
    deleteParameter,
    addInteraction,
    updateInteraction,
    removeInteraction,
    getInteractionsForParameter,
    getContributesToParameters,
    getImprovedByParameters,
    addParameterMethod,
    updateParameterMethod,
    removeParameterMethod,
    getMethodsForParameter,
    saveData,
  } = useParametersDataV2();
  const { data: toolboxData } = useToolboxData();

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
    interactions: { targetParameterId: string; direction: InteractionDirection; strength: InteractionStrength }[];
    methods: { methodId: string; rationale?: string }[];
  }) => {
    const newParameterId = Date.now().toString();
    const newParameter: ParameterV2 = {
      id: newParameterId,
      name: parameterData.name,
      unit: parameterData.unit,
      category: parameterData.category,
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
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-end">
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
                  
                  <TableHead className="w-[30%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParameters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
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
    </div>
  );
}
