import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Search, Download, Upload, Trash2, Edit, Copy, ChevronUp, ChevronDown } from "lucide-react";
import { useToolboxData } from "@/hooks/useToolboxData";
import { ToolboxEntry } from "@/types/toolbox";
import { useToast } from "@/hooks/use-toast";
import { ParameterManagementDialog } from "@/components/toolbox/ParameterManagementDialog";
import { ToolboxColumnFilter } from "@/components/toolbox/ToolboxColumnFilter";

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
  const [selectedSubCategory, setSelectedSubCategory] = useState<{ category: string; subCategory: string } | null>(null);
  const [newEntry, setNewEntry] = useState({
    category: "",
    subCategory: "",
    parameter: "",
    parameterName: "",
    parameterType: "qualitative" as "qualitative" | "quantitative",
    options: [] as string[]
  });
  const [newOption, setNewOption] = useState("");

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
        item.parameters.some(p => p.parameter.toLowerCase().includes(term))
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

  // Handle add entry (creates a new sub-category)
  const handleAddEntry = () => {
    if (!newEntry.category.trim() || !newEntry.parameterName.trim()) {
      toast({
        title: "Validation Error",
        description: "Category and Parameter Name are required fields.",
        variant: "destructive"
      });
      return;
    }

    // Build the legacy parameter string for backward compatibility
    const legacyParameter = newEntry.options.length > 0 
      ? `${newEntry.parameterName} [${newEntry.options.join(', ')}]`
      : newEntry.parameterName;

    addEntry({
      category: newEntry.category.trim(),
      subCategory: newEntry.subCategory.trim(),
      parameter: legacyParameter,
      parameterName: newEntry.parameterName.trim(),
      parameterType: newEntry.parameterType,
      options: [...newEntry.options]
    });

    setNewEntry({
      category: "",
      subCategory: "",
      parameter: "",
      parameterName: "",
      parameterType: "qualitative",
      options: []
    });
    setNewOption("");
    setIsAddDialogOpen(false);
    
    toast({
      title: "Sub-Category Created",
      description: "New sub-category with parameter has been added successfully."
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Sub-Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Sub-Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Input
                    id="category"
                    value={newEntry.category}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g., Sprinting, Lower Body Resistance Training"
                  />
                </div>
                <div>
                  <Label htmlFor="subCategory">Sub-Category *</Label>
                  <Input
                    id="subCategory"
                    value={newEntry.subCategory}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, subCategory: e.target.value }))}
                    placeholder="e.g., Acceleration, Strength"
                  />
                </div>
                <div>
                  <Label htmlFor="parameterName">First Parameter Name *</Label>
                  <Input
                    id="parameterName"
                    value={newEntry.parameterName}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, parameterName: e.target.value }))}
                    placeholder="e.g., Frequency, Intensity, Organization"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Parameter Type</Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="parameterType"
                        checked={newEntry.parameterType === 'quantitative'}
                        onCheckedChange={(checked) => 
                          setNewEntry(prev => ({ 
                            ...prev, 
                            parameterType: checked ? 'quantitative' : 'qualitative' 
                          }))
                        }
                      />
                      <Label htmlFor="parameterType" className="text-sm">
                        {newEntry.parameterType === 'quantitative' ? 'Quantitative (with units)' : 'Qualitative (descriptive)'}
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    {newEntry.parameterType === 'quantitative' ? 'Units' : 'Options'}
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder={
                        newEntry.parameterType === 'quantitative' 
                          ? "e.g., m, km, s, %, kg" 
                          : "e.g., Regular Sets, Super Sets"
                      }
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newOption.trim()) {
                          setNewEntry(prev => ({ 
                            ...prev, 
                            options: [...prev.options, newOption.trim()] 
                          }));
                          setNewOption("");
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      onClick={() => {
                        if (newOption.trim()) {
                          setNewEntry(prev => ({ 
                            ...prev, 
                            options: [...prev.options, newOption.trim()] 
                          }));
                          setNewOption("");
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {newEntry.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newEntry.options.map((option, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center bg-secondary text-secondary-foreground px-2 py-1 text-xs rounded cursor-pointer"
                          onClick={() => {
                            setNewEntry(prev => ({
                              ...prev,
                              options: prev.options.filter((_, i) => i !== index)
                            }));
                          }}
                        >
                          {option} ×
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddEntry}
                    disabled={!newEntry.category.trim() || !newEntry.subCategory.trim() || !newEntry.parameterName.trim()}
                  >
                    Create Sub-Category
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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