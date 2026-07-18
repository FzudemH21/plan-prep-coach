import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Search, Download, Upload, Trash2, Edit, Copy, ChevronUp, ChevronDown, AlertCircle, LayoutTemplate } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToolboxData } from "@/hooks/useToolboxData";
import { ToolboxEntry } from "@/types/toolbox";
import { useToast } from "@/hooks/use-toast";
import { ParameterManagementDialog } from "@/components/toolbox/ParameterManagementDialog";
import { ToolboxColumnFilter } from "@/components/toolbox/ToolboxColumnFilter";
import { MethodTemplatesPanel } from "@/components/toolbox/MethodTemplatesPanel";
import { WizardAIAssistant } from "@/components/wizard/WizardAIAssistant";
import { useGlobalAIContext } from "@/hooks/useGlobalAIContext";
import { useCoachMemory } from "@/hooks/useCoachMemory";
import { useRAGRetrieval } from "@/hooks/useRAGRetrieval";

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
  const { data, isLoading, addEntries, deleteEntry, deleteSubCategory, copyEntry, renameSubCategory, renameMethodCategory, reorderParameters, importData, exportData } = useToolboxData();
  const globalAIContext = useGlobalAIContext(true);
  const { coachMemoryContext } = useCoachMemory();
  const { retrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');
  
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
  const [pendingDeleteItem, setPendingDeleteItem] = useState<SubCategoryData | null>(null);

  const resetAddDialog = () => {
    setNewEntry({ category: "", subCategory: "" });
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

  // Handle add entry: create method with default Frequency param, then open Manage Parameters
  const handleAddEntry = () => {
    if (!newEntry.category.trim() || !newEntry.subCategory.trim()) return;

    const category = newEntry.category.trim();
    const subCategory = newEntry.subCategory.trim();

    void addEntries([
      {
        category,
        subCategory,
        parameterName: "Frequency",
        parameterType: "quantitative",
        options: [],
        isFrequencyParameter: true,
        isSetParameter: false,
        isRestParameter: false,
        showInGridByDefault: false,
      },
      {
        category,
        subCategory,
        parameterName: "Sets",
        parameterType: "quantitative",
        options: ["#"],
        isFrequencyParameter: false,
        isSetParameter: true,
        isRestParameter: false,
        showInGridByDefault: true,
      },
      {
        category,
        subCategory,
        parameterName: "Rest",
        parameterType: "quantitative",
        options: ["s"],
        isFrequencyParameter: false,
        isSetParameter: false,
        isRestParameter: true,
        showInGridByDefault: false,
      },
    ]);

    resetAddDialog();
    setIsAddDialogOpen(false);

    // Open Manage Parameters immediately for the new method
    setSelectedSubCategory({ category, subCategory });
    setIsParameterDialogOpen(true);
  };

  // Handle copy sub-category
  const handleCopySubCategory = (key: string) => {
    copyEntry(key);
    toast({
      title: "Sub-Category Copied",
      description: "Sub-category and all its parameters have been copied successfully."
    });
  };

  // Handle delete sub-category — opens confirmation dialog
  const handleDeleteSubCategory = (item: SubCategoryData) => {
    setPendingDeleteItem(item);
  };

  const confirmDeleteSubCategory = () => {
    if (!pendingDeleteItem) return;
    void deleteSubCategory(pendingDeleteItem.key);
    toast({
      title: "Method Deleted",
      description: `"${pendingDeleteItem.subCategory}" and all its parameters have been deleted.`
    });
    setPendingDeleteItem(null);
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

  const toolboxContext = useMemo(() => {
    const grouped = new Map<string, Map<string, ToolboxEntry[]>>();
    data.entries.forEach(e => {
      if (!grouped.has(e.category)) grouped.set(e.category, new Map());
      const methods = grouped.get(e.category)!;
      if (!methods.has(e.subCategory)) methods.set(e.subCategory, []);
      methods.get(e.subCategory)!.push(e);
    });

    const lines: string[] = ['## Training Toolbox\n'];
    grouped.forEach((methods, category) => {
      lines.push(`### Category: ${category}`);
      methods.forEach((params, method) => {
        lines.push(`  Method: ${method}`);
        params.forEach(p => {
          const flags = [
            p.isFrequencyParameter && 'frequency',
            p.isSetParameter && 'sets',
            p.isRestParameter && 'rest',
            p.isCalculated && `calculated: ${p.formula}`,
          ].filter(Boolean).join(', ');
          const unit = p.options?.length ? ` [${p.options.join('/')}]` : '';
          const opts = !p.isCalculated && p.parameterType === 'qualitative' && p.options?.length
            ? ` options: ${p.options.join(', ')}` : '';
          lines.push(`    - ${p.parameterName} (${p.parameterType}${unit}${opts}${flags ? ' | ' + flags : ''})`);
        });
        const cats = params[0]?.exerciseCategories;
        if (cats?.length) lines.push(`    Exercise categories: ${cats.join(', ')}`);
      });
    });
    return lines.join('\n');
  }, [data.entries]);

  useEffect(() => {
    const query = data.entries.length
      ? [...new Set(data.entries.map(e => e.subCategory || e.category))].slice(0, 20).join(', ')
      : 'training methods programming periodization';
    retrieve(query).then(setRagContext);
  }, [retrieve, data.entries]);

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
            <CardTitle className="text-sm font-medium">Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(data.entries.map(e => `${e.category}|||${e.subCategory}`)).size}</div>
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
                <DialogTitle>Add New Training Method</DialogTitle>
              </DialogHeader>
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
                <p className="text-xs text-muted-foreground">
                  A default "Frequency" parameter will be added. You can configure all parameters in the next step.
                </p>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleAddEntry}
                    disabled={!newEntry.category.trim() || !newEntry.subCategory.trim()}
                  >
                    Create & Configure Parameters
                  </Button>
                </div>
              </div>
            </DialogContent>
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
          onSubCategoryChange={(newName) => {
            const key = `${selectedSubCategory.category}|||${selectedSubCategory.subCategory}`;
            void renameSubCategory(key, newName);
            setSelectedSubCategory({ ...selectedSubCategory, subCategory: newName });
          }}
          onCategoryChange={(newCategory) => {
            const key = `${selectedSubCategory.category}|||${selectedSubCategory.subCategory}`;
            void renameMethodCategory(key, newCategory);
            setSelectedSubCategory({ ...selectedSubCategory, category: newCategory });
          }}
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

      <AlertDialog open={!!pendingDeleteItem} onOpenChange={open => { if (!open) setPendingDeleteItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{pendingDeleteItem?.subCategory}</strong>? This will permanently remove the method and all its parameters. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSubCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WizardAIAssistant
        stepLabel="Training Toolbox"
        wizardContext={toolboxContext}
        coachMemoryContext={coachMemoryContext}
        ragContext={ragContext}
        globalContext={globalAIContext}
        assistantRole={`You are an expert sports scientist and strength & conditioning consultant helping a coach review and think through their Training Toolbox — the database of training methods, categories, and parameters used for programming.

You have full read access to the toolbox (all categories, methods, and parameters) as well as the coach's profile and any relevant uploaded documents. You can discuss, analyse, and advise on method structure, parameter choices, exercise categories, periodization logic, and sports science rationale.

IMPORTANT rules:
- This is a DISCUSSION-ONLY assistant. You cannot make changes to the toolbox.
- Be honest about the limits of your knowledge. If you are unsure about something or don't know the answer, say so explicitly. Never make things up or present uncertain information as fact.
- When referencing methods or parameters, use the exact names shown in the context.
- If the coach asks about something not in the toolbox, say you don't see it in the current data.`}
      />
    </div>
  );
}