import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Search, Download, Upload, Trash2, Edit, Copy, ChevronUp, ChevronDown, AlertCircle, LayoutTemplate, Calculator } from "lucide-react";
import { validateFormula, extractParameterNames } from "@/utils/formulaEvaluator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToolboxData } from "@/hooks/useToolboxData";
import { ToolboxEntry } from "@/types/toolbox";
import { useToast } from "@/hooks/use-toast";
import { ParameterManagementDialog } from "@/components/toolbox/ParameterManagementDialog";
import { ToolboxColumnFilter } from "@/components/toolbox/ToolboxColumnFilter";
import { MethodTemplatesPanel } from "@/components/toolbox/MethodTemplatesPanel";

type SortOrder = 'asc' | 'desc';
type SortColumn = 'category' | 'subCategory';

interface ColumnSort {
  column: SortColumn;
  order: SortOrder;
}

interface SubCategoryData {
  category: string;
  subCategory: string;
  parameters: ToolboxEntry[];
  key: string;
}

export default function ToolboxDatabase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading, addEntry, deleteEntry, copyEntry, reorderParameters, importData, exportData } = useToolboxData();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [columnSorts, setColumnSorts] = useState<Record<SortColumn, ColumnSort | null>>({
    category: null,
    subCategory: null
  });
  const [filterState, setFilterState] = useState<{
    columnFilters: {
      category: string[];
      subCategory: string[];
    };
  }>({
    columnFilters: {
      category: [],
      subCategory: []
    }
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isParameterDialogOpen, setIsParameterDialogOpen] = useState(false);
  const [expandedTemplatesKey, setExpandedTemplatesKey] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<{ category: string; subCategory: string } | null>(null);
  const [newEntry, setNewEntry] = useState({ category: "", subCategory: "" });
  const [newMethodParameters, setNewMethodParameters] = useState<ToolboxEntry[]>([]);
  const [showAddParamSubDialog, setShowAddParamSubDialog] = useState(false);
  const [addingParam, setAddingParam] = useState({
    parameterName: "",
    parameterType: "qualitative" as "qualitative" | "quantitative",
    options: [] as string[],
    isFrequencyParameter: false,
    isSetParameter: false,
    showInGridByDefault: true,
    isCalculated: false,
    formula: "",
    sourceParameterIds: [] as string[],
  });
  const [addingParamOption, setAddingParamOption] = useState("");
  const [dialogStep, setDialogStep] = useState<1 | 2>(1);

  const resetAddDialog = () => {
    setDialogStep(1);
    setNewEntry({ category: "", subCategory: "" });
    setNewMethodParameters([]);
    setShowAddParamSubDialog(false);
    setAddingParam({ parameterName: "", parameterType: "qualitative", options: [], isFrequencyParameter: false, isSetParameter: false, showInGridByDefault: true, isCalculated: false, formula: "", sourceParameterIds: [] });
    setAddingParamOption("");
  };

  // Handle column sorting
  const handleColumnSort = (column: SortColumn) => {
    setColumnSorts(prev => {
      const currentSort = prev[column];
      const newOrder = currentSort?.order === 'asc' ? 'desc' : 'asc';
      
      return {
        ...prev,
        [column]: { column, order: newOrder }
      };
    });
  };

  // Handle column filtering
  const handleColumnFilter = (columnKey: 'category' | 'subCategory', values: string[]) => {
    setFilterState(prev => ({
      ...prev,
      columnFilters: {
        ...prev.columnFilters,
        [columnKey]: values
      }
    }));
  };

  // Handle column sort from filter
  const handleColumnSortFromFilter = (columnKey: 'category' | 'subCategory', direction: 'asc' | 'desc') => {
    setColumnSorts(prev => ({
      ...prev,
      [columnKey]: { column: columnKey, order: direction }
    }));
  };

  // Group entries by category + sub-category combination
  const subCategoryData = useMemo(() => {
    // Create unique combinations of category + sub-category
    const combinations = new Map<string, { 
      category: string; 
      subCategory: string; 
      parameters: ToolboxEntry[];
      key: string;
    }>();

    data.entries.forEach(entry => {
      const key = `${entry.category}|||${entry.subCategory}`;
      if (!combinations.has(key)) {
        combinations.set(key, {
          category: entry.category,
          subCategory: entry.subCategory,
          parameters: [],
          key
        });
      }
      combinations.get(key)!.parameters.push(entry);
    });

    // Convert to array and apply filtering and sorting
    let result = Array.from(combinations.values());

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.category.toLowerCase().includes(term) ||
        item.subCategory.toLowerCase().includes(term) ||
        item.parameters.some(p => p.parameterName.toLowerCase().includes(term))
      );
    }

    // Apply column filters
    const { columnFilters } = filterState;
    
    if (columnFilters.category.length > 0) {
      result = result.filter(item => columnFilters.category.includes(item.category));
    }
    
    if (columnFilters.subCategory.length > 0) {
      result = result.filter(item => columnFilters.subCategory.includes(item.subCategory));
    }

    // Apply sorting based on column sorts
    const categorySorter = columnSorts.category;
    const subCategorySorter = columnSorts.subCategory;
    
    if (categorySorter || subCategorySorter) {
      result.sort((a, b) => {
        // Apply category sorting if it exists
        if (categorySorter) {
          const categoryCompare = a.category.localeCompare(b.category);
          if (categoryCompare !== 0) {
            return categorySorter.order === 'asc' ? categoryCompare : -categoryCompare;
          }
        }
        
        // Apply sub-category sorting if it exists
        if (subCategorySorter) {
          const subCategoryCompare = a.subCategory.localeCompare(b.subCategory);
          if (subCategoryCompare !== 0) {
            return subCategorySorter.order === 'asc' ? subCategoryCompare : -subCategoryCompare;
          }
        }
        
        // Default fallback - maintain consistent ordering
        const fallbackCategoryCompare = a.category.localeCompare(b.category);
        if (fallbackCategoryCompare !== 0) return fallbackCategoryCompare;
        
        return a.subCategory.localeCompare(b.subCategory);
      });
    }

    return result;
  }, [data.entries, searchTerm, columnSorts, filterState]);

  // Generate unique categories list for dropdown
  const existingCategories = useMemo(() => {
    const categories = new Set(data.entries.map(e => e.category));
    return Array.from(categories).sort();
  }, [data.entries]);

  // Check if a method (sub-category) has a frequency parameter marked
  const hasFrequencyParameter = useMemo(() => {
    const frequencyMap = new Map<string, boolean>();
    
    subCategoryData.forEach(item => {
      const hasFreqParam = item.parameters.some(param => param.isFrequencyParameter === true);
      frequencyMap.set(item.key, hasFreqParam);
    });
    
    return frequencyMap;
  }, [subCategoryData]);

  // Check if a method (sub-category) has a set parameter marked
  const hasSetParameter = useMemo(() => {
    const setMap = new Map<string, boolean>();
    
    subCategoryData.forEach(item => {
      const hasSetParam = item.parameters.some(param => param.isSetParameter === true);
      setMap.set(item.key, hasSetParam);
    });
    
    return setMap;
  }, [subCategoryData]);

  // Computed: quantitative non-calculated params already added to the new method (for formula builder)
  const addingParamSourceParams = newMethodParameters.filter(
    p => p.parameterType === 'quantitative' && !p.isCalculated
  );

  const existingNewFrequencyParam = newMethodParameters.find(p => p.isFrequencyParameter);
  const existingNewSetParam = newMethodParameters.find(p => p.isSetParameter);

  const addingParamFormulaValidation = useMemo(() => {
    if (!addingParam.isCalculated || !addingParam.formula) return { valid: true };
    return validateFormula(addingParam.formula, addingParamSourceParams.map(p => p.parameterName));
  }, [addingParam.isCalculated, addingParam.formula, addingParamSourceParams]);

  const handleConfirmAddParam = () => {
    if (!addingParam.parameterName.trim()) return;
    const param: ToolboxEntry = {
      id: Date.now().toString(),
      category: newEntry.category.trim(),
      subCategory: newEntry.subCategory.trim(),
      parameterName: addingParam.parameterName.trim(),
      parameterType: addingParam.parameterType,
      options: addingParam.isCalculated ? [] : [...addingParam.options],
      isFrequencyParameter: addingParam.isCalculated ? false : addingParam.isFrequencyParameter,
      isSetParameter: addingParam.isCalculated ? false : addingParam.isSetParameter,
      showInGridByDefault: addingParam.showInGridByDefault,
      isCalculated: addingParam.isCalculated,
      formula: addingParam.isCalculated ? addingParam.formula : undefined,
      sourceParameterIds: addingParam.isCalculated ? addingParam.sourceParameterIds : undefined,
    };
    setNewMethodParameters(prev => [...prev, param]);
    setAddingParam({ parameterName: "", parameterType: "qualitative", options: [], isFrequencyParameter: false, isSetParameter: false, showInGridByDefault: true, isCalculated: false, formula: "", sourceParameterIds: [] });
    setAddingParamOption("");
    setShowAddParamSubDialog(false);
  };

  // Handle add entry (creates a new training method with all its parameters)
  const handleAddEntry = () => {
    if (!newEntry.category.trim() || !newEntry.subCategory.trim() || newMethodParameters.length === 0) return;

    newMethodParameters.forEach(param => {
      addEntry({
        category: newEntry.category.trim(),
        subCategory: newEntry.subCategory.trim(),
        parameterName: param.parameterName,
        parameterType: param.parameterType,
        options: param.options,
        isFrequencyParameter: param.isFrequencyParameter,
        isSetParameter: param.isSetParameter,
        showInGridByDefault: param.showInGridByDefault,
        isCalculated: param.isCalculated,
        formula: param.formula,
        sourceParameterIds: param.sourceParameterIds,
      });
    });

    resetAddDialog();
    setIsAddDialogOpen(false);

    toast({
      title: "Training Method Created",
      description: "New training method with parameter has been added successfully."
    });
  };

  // Handle copy sub-category
  const handleCopySubCategory = (key: string) => {
    copyEntry(key);
    toast({
      title: "Sub-Category Copied",
      description: "Sub-category and all its parameters have been copied successfully."
    });
  };

  // Handle delete sub-category (delete all parameters in it)
  const handleDeleteSubCategory = (item: SubCategoryData) => {
    // Delete all parameters in this sub-category using the deleteEntry function from the hook
    item.parameters.forEach(parameter => {
      deleteEntry(parameter.id);
    });
    
    toast({
      title: "Sub-Category Deleted",
      description: `Sub-category "${item.subCategory}" and all its parameters have been deleted.`
    });
  };

  // Handle parameter management
  const handleOpenParameterDialog = (category: string, subCategory: string) => {
    setSelectedSubCategory({ category, subCategory });
    setIsParameterDialogOpen(true);
  };

  const handleUpdateParameters = (parameters: ToolboxEntry[]) => {
    if (!selectedSubCategory) return;
    
    const key = `${selectedSubCategory.category}|||${selectedSubCategory.subCategory}`;
    reorderParameters(key, parameters);
  };

  // Handle file import
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedCount = importData(text);
        toast({
          title: "Import Successful",
          description: `Successfully imported ${importedCount} entries.`
        });
      } catch (error) {
        toast({
          title: "Import Failed",
          description: error instanceof Error ? error.message : "Failed to import data",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Handle export
  const handleExport = () => {
    const tsvContent = exportData();
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toolbox-database-${new Date().toISOString().split('T')[0]}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Successful",
      description: "Toolbox database has been exported successfully."
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading toolbox database...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/templates")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Templates</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Training Toolbox Database</h1>
            <p className="text-muted-foreground">Comprehensive database of training method parameters</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".tsv,.txt,.csv"
            onChange={handleImport}
            className="hidden"
            id="import-file"
          />
          <Button variant="outline" onClick={() => document.getElementById('import-file')?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.entries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sub-Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subCategoryData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(data.entries.map(e => e.category)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {new Date(data.lastUpdated).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning Alert Box */}
      {(() => {
        const methodsMissingFrequency = subCategoryData.filter(item => !hasFrequencyParameter.get(item.key));
        const methodsMissingSet = subCategoryData.filter(item => !hasSetParameter.get(item.key));
        const hasWarnings = methodsMissingFrequency.length > 0 || methodsMissingSet.length > 0;
        
        if (!hasWarnings) return null;
        
        return (
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <div>
              <AlertTitle className="text-amber-900 dark:text-amber-200">Warning</AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                <div className="space-y-2">
                  {methodsMissingFrequency.length > 0 && (
                    <p>
                      • {methodsMissingFrequency.length} {methodsMissingFrequency.length === 1 ? 'method has' : 'methods have'} no parameter marked as the Training Frequency parameter. The system needs this to determine how many sessions per microcycle this method requires.
                    </p>
                  )}
                  {methodsMissingSet.length > 0 && (
                    <p>
                      • {methodsMissingSet.length} {methodsMissingSet.length === 1 ? 'method has' : 'methods have'} no parameter marked as the Set parameter. Without this, the exercise detail view will display a flat grid instead of a set-based table.
                    </p>
                  )}
                </div>
              </AlertDescription>
            </div>
          </Alert>
        );
      })()}

      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories, sub-categories, or parameters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetAddDialog();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Training Method
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {dialogStep === 1 ? "Add New Training Method – Step 1 of 2" : "Add New Training Method – Step 2 of 2"}
                </DialogTitle>
              </DialogHeader>

              {dialogStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <SearchableDropdown
                      value={newEntry.category}
                      onValueChange={(value) => setNewEntry(prev => ({ ...prev, category: value as string }))}
                      options={existingCategories}
                      placeholder="Select existing or type new category"
                      allowCustomInput={true}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subCategory">Method Name *</Label>
                    <Input
                      id="subCategory"
                      value={newEntry.subCategory}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, subCategory: e.target.value }))}
                      placeholder="e.g., Acceleration, Strength Endurance"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => setDialogStep(2)}
                      disabled={!newEntry.category.trim() || !newEntry.subCategory.trim()}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {dialogStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{newEntry.category} → {newEntry.subCategory}</p>

                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">Parameters ({newMethodParameters.length})</span>
                    <Button size="sm" onClick={() => setShowAddParamSubDialog(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Parameter
                    </Button>
                  </div>

                  {newMethodParameters.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
                      No parameters yet. Add at least one to create the method.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {newMethodParameters.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{p.parameterName}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{p.parameterType}</Badge>
                            {p.isFrequencyParameter && <Badge variant="secondary" className="text-xs">Frequency</Badge>}
                            {p.isSetParameter && <Badge variant="secondary" className="text-xs">Sets</Badge>}
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setNewMethodParameters(prev => prev.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setDialogStep(1)}>Back</Button>
                    <div className="flex space-x-2">
                      <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetAddDialog(); }}>Cancel</Button>
                      <Button onClick={handleAddEntry} disabled={newMethodParameters.length === 0}>
                        Create Training Method
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Add Parameter sub-dialog (portal so it sits above the main dialog) */}
          <Dialog open={showAddParamSubDialog} onOpenChange={(open) => {
            setShowAddParamSubDialog(open);
            if (!open) {
              setAddingParam({ parameterName: "", parameterType: "qualitative", options: [], isFrequencyParameter: false, isSetParameter: false, showInGridByDefault: true, isCalculated: false, formula: "", sourceParameterIds: [] });
              setAddingParamOption("");
            }
          }}>
            <DialogPortal>
              <DialogOverlay className="z-[150]" />
              <DialogContent className="z-[160] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Parameter</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Parameter Name *</Label>
                    <Input
                      value={addingParam.parameterName}
                      onChange={(e) => setAddingParam(prev => ({ ...prev, parameterName: e.target.value }))}
                      placeholder="e.g., Frequency, Sets, Intensity"
                    />
                  </div>

                  <div>
                    <Label>Parameter Type</Label>
                    <Select
                      value={addingParam.parameterType}
                      onValueChange={(value) => setAddingParam(prev => ({
                        ...prev,
                        parameterType: value as "qualitative" | "quantitative",
                        isFrequencyParameter: value === "quantitative" ? prev.isFrequencyParameter : false,
                        isSetParameter: value === "quantitative" ? prev.isSetParameter : false,
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qualitative">Qualitative</SelectItem>
                        <SelectItem value="quantitative">Quantitative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!addingParam.isCalculated && (
                    addingParam.parameterType === "quantitative" ? (
                      <div className="space-y-2">
                        <Label>Units</Label>
                        <div className="flex gap-2">
                          <Input
                            value={addingParamOption}
                            onChange={(e) => setAddingParamOption(e.target.value)}
                            placeholder="e.g., kg, %, RPE"
                            onKeyPress={(e) => {
                              if (e.key === "Enter" && addingParamOption.trim()) {
                                setAddingParam(prev => ({ ...prev, options: [...prev.options, addingParamOption.trim()] }));
                                setAddingParamOption("");
                              }
                            }}
                          />
                          <Button type="button" onClick={() => {
                            if (addingParamOption.trim()) {
                              setAddingParam(prev => ({ ...prev, options: [...prev.options, addingParamOption.trim()] }));
                              setAddingParamOption("");
                            }
                          }}>Add</Button>
                        </div>
                        {addingParam.options.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {addingParam.options.map((o, i) => (
                              <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setAddingParam(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))}>
                                {o} ×
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Options</Label>
                        <div className="flex gap-2">
                          <Input
                            value={addingParamOption}
                            onChange={(e) => setAddingParamOption(e.target.value)}
                            placeholder="e.g., Regular Sets, Super Sets"
                            onKeyPress={(e) => {
                              if (e.key === "Enter" && addingParamOption.trim()) {
                                setAddingParam(prev => ({ ...prev, options: [...prev.options, addingParamOption.trim()] }));
                                setAddingParamOption("");
                              }
                            }}
                          />
                          <Button type="button" onClick={() => {
                            if (addingParamOption.trim()) {
                              setAddingParam(prev => ({ ...prev, options: [...prev.options, addingParamOption.trim()] }));
                              setAddingParamOption("");
                            }
                          }}>Add</Button>
                        </div>
                        {addingParam.options.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {addingParam.options.map((o, i) => (
                              <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setAddingParam(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))}>
                                {o} ×
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {addingParam.parameterType === "quantitative" && (
                    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="apIsCalculated"
                          checked={addingParam.isCalculated}
                          disabled={addingParam.isFrequencyParameter || addingParam.isSetParameter}
                          onChange={(e) => setAddingParam(prev => ({ ...prev, isCalculated: e.target.checked, isFrequencyParameter: e.target.checked ? false : prev.isFrequencyParameter, isSetParameter: e.target.checked ? false : prev.isSetParameter }))}
                          className="h-4 w-4 disabled:opacity-50"
                        />
                        <Label htmlFor="apIsCalculated" className="text-sm flex items-center gap-1">
                          <Calculator className="h-3 w-3" /> Calculated parameter
                        </Label>
                      </div>
                      {addingParam.isCalculated && (
                        <div className="space-y-3 pt-1">
                          {addingParamSourceParams.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Click to insert into formula</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {addingParamSourceParams.map(p => (
                                  <Badge key={p.id} variant="outline" className="cursor-pointer text-xs" onClick={() => setAddingParam(prev => ({ ...prev, formula: prev.formula ? `${prev.formula} ${p.parameterName}` : p.parameterName, sourceParameterIds: [...new Set([...prev.sourceParameterIds, p.id])] }))}>
                                    {p.parameterName}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <Label>Formula</Label>
                            <Input
                              value={addingParam.formula}
                              onChange={(e) => {
                                const formula = e.target.value;
                                const names = addingParamSourceParams.map(p => p.parameterName);
                                const ids = addingParamSourceParams.filter(p => extractParameterNames(formula, names).includes(p.parameterName)).map(p => p.id);
                                setAddingParam(prev => ({ ...prev, formula, sourceParameterIds: ids }));
                              }}
                              placeholder="e.g., Sets * Reps"
                              className="font-mono"
                            />
                            {!addingParamFormulaValidation.valid && addingParam.formula && (
                              <div className="flex items-center gap-1 mt-1 text-destructive text-xs">
                                <AlertCircle className="h-3 w-3" />{addingParamFormulaValidation.error}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="apIsFreq" checked={addingParam.isFrequencyParameter}
                        disabled={addingParam.parameterType !== "quantitative" || addingParam.isSetParameter || addingParam.isCalculated || !!existingNewFrequencyParam}
                        onChange={(e) => setAddingParam(prev => ({ ...prev, isFrequencyParameter: e.target.checked, showInGridByDefault: e.target.checked ? false : prev.showInGridByDefault }))}
                        className="h-4 w-4 disabled:opacity-50" />
                      <Label htmlFor="apIsFreq" className="text-sm">Training Frequency Parameter</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="apIsSet" checked={addingParam.isSetParameter}
                        disabled={addingParam.parameterType !== "quantitative" || addingParam.isFrequencyParameter || addingParam.isCalculated || !!existingNewSetParam}
                        onChange={(e) => setAddingParam(prev => ({ ...prev, isSetParameter: e.target.checked }))}
                        className="h-4 w-4 disabled:opacity-50" />
                      <Label htmlFor="apIsSet" className="text-sm">Set Parameter</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="apShowInGrid" checked={addingParam.showInGridByDefault}
                        disabled={addingParam.isFrequencyParameter || addingParam.isSetParameter}
                        onChange={(e) => setAddingParam(prev => ({ ...prev, showInGridByDefault: e.target.checked }))}
                        className="h-4 w-4 disabled:opacity-50" />
                      <Label htmlFor="apShowInGrid" className="text-sm">Show in parameter grid by default</Label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowAddParamSubDialog(false)}>Cancel</Button>
                    <Button onClick={handleConfirmAddParam} disabled={!addingParam.parameterName.trim()}>
                      Add Parameter
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </DialogPortal>
          </Dialog>
        </div>
      </div>

      {/* Sub-Categories Table */}
      <Card>
        <CardContent className="p-0">
          <TooltipProvider>
            <Table containerClassName="border rounded-lg max-h-[70vh]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
                  <div className="flex items-center justify-between">
                    <Button 
                      variant="ghost" 
                      className="flex items-center gap-1 p-0 h-auto font-semibold justify-start"
                      onClick={() => handleColumnSort('category')}
                    >
                      Category
                      {columnSorts.category?.order === 'asc' && <ChevronUp className="h-4 w-4" />}
                      {columnSorts.category?.order === 'desc' && <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <ToolboxColumnFilter
                      columnKey="category"
                      columnLabel="Category"
                      allData={subCategoryData}
                      selectedValues={filterState.columnFilters.category}
                      onSelectionChange={(values) => handleColumnFilter('category', values)}
                      onSortChange={handleColumnSortFromFilter}
                    />
                  </div>
                </TableHead>
                <TableHead className="w-1/4 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
                  <div className="flex items-center justify-between">
                    <Button 
                      variant="ghost" 
                      className="flex items-center gap-1 p-0 h-auto font-semibold justify-start"
                      onClick={() => handleColumnSort('subCategory')}
                    >
                      Sub-Category
                      {columnSorts.subCategory?.order === 'asc' && <ChevronUp className="h-4 w-4" />}
                      {columnSorts.subCategory?.order === 'desc' && <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <ToolboxColumnFilter
                      columnKey="subCategory"
                      columnLabel="Sub-Category"
                      allData={subCategoryData}
                      selectedValues={filterState.columnFilters.subCategory}
                      onSelectionChange={(values) => handleColumnFilter('subCategory', values)}
                      onSortChange={handleColumnSortFromFilter}
                    />
                  </div>
                </TableHead>
                <TableHead className="w-1/6 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">Parameters</TableHead>
                <TableHead className="w-1/6 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">Exercise Categories</TableHead>
                <TableHead className="w-1/6 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subCategoryData.map((item) => (
                <>
                  <TableRow key={item.key} className="border-b">
                    <TableCell className="font-medium">{item.category}</TableCell>
                    <TableCell className="font-medium">{item.subCategory || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.parameters.length} parameter{item.parameters.length !== 1 ? 's' : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(item.parameters[0]?.exerciseCategories || []).length} categor{(item.parameters[0]?.exerciseCategories || []).length !== 1 ? 'ies' : 'y'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {(!hasFrequencyParameter.get(item.key) || !hasSetParameter.get(item.key)) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Missing Parameter Configuration</p>
                              <div className="text-xs space-y-1">
                                {!hasFrequencyParameter.get(item.key) && (
                                  <p>• No frequency parameter marked for method periodization table</p>
                                )}
                                {!hasSetParameter.get(item.key) && (
                                  <p>• No set parameter marked for exercise detail view</p>
                                )}
                                <p className="mt-2 text-muted-foreground">
                                  Click Edit to open parameter management and configure these parameters.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenParameterDialog(item.category, item.subCategory)}
                          title="Edit Parameters"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopySubCategory(item.key)}
                          title="Copy Sub-Category"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSubCategory(item)}
                          title="Delete Sub-Category"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Templates"
                          onClick={() => setExpandedTemplatesKey(
                            expandedTemplatesKey === item.key ? null : item.key
                          )}
                        >
                          <LayoutTemplate className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedTemplatesKey === item.key && (
                    <TableRow key={`${item.key}-templates`}>
                      <TableCell colSpan={5} className="p-0">
                        <MethodTemplatesPanel
                          methodId={item.key}
                          methodName={item.subCategory}
                          parameters={item.parameters}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Parameter Management Dialog */}
      {selectedSubCategory && (
        <ParameterManagementDialog
          open={isParameterDialogOpen}
          onOpenChange={setIsParameterDialogOpen}
          category={selectedSubCategory.category}
          subCategory={selectedSubCategory.subCategory}
          parameters={data.entries.filter(e => 
            e.category === selectedSubCategory.category && 
            e.subCategory === selectedSubCategory.subCategory
          )}
          onUpdateParameters={handleUpdateParameters}
        />
      )}

      {/* No results message */}
      {subCategoryData.length === 0 && searchTerm && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No sub-categories found matching "{searchTerm}"</p>
        </div>
      )}
      
      {subCategoryData.length === 0 && !searchTerm && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No sub-categories yet. Click "Add Sub-Category" to get started.</p>
        </div>
      )}

    </div>
  );
}