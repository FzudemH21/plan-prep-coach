import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Search, Download, Upload, Trash2, Edit, X } from "lucide-react";
import { useToolboxData } from "@/hooks/useToolboxData";
import { ToolboxEntry } from "@/types/toolbox";
import { useToast } from "@/hooks/use-toast";

export default function ToolboxDatabase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading, addEntry, updateEntry, deleteEntry, importData, exportData } = useToolboxData();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ToolboxEntry | null>(null);
  const [newEntry, setNewEntry] = useState({
    category: "",
    subCategory: "",
    parameter: "",
    parameterName: "",
    parameterType: "qualitative" as "qualitative" | "quantitative",
    options: [] as string[]
  });
  const [newOption, setNewOption] = useState("");

  // Filter entries based on search term
  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return data.entries;
    
    const term = searchTerm.toLowerCase();
    return data.entries.filter(entry =>
      entry.category.toLowerCase().includes(term) ||
      entry.subCategory.toLowerCase().includes(term) ||
      entry.parameter.toLowerCase().includes(term)
    );
  }, [data.entries, searchTerm]);

  // Group entries hierarchically for table display with rowspan
  const hierarchicalData = useMemo(() => {
    // Sort entries by category and sub-category only, preserve original parameter order
    const sortedEntries = [...filteredEntries].sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.subCategory !== b.subCategory) return a.subCategory.localeCompare(b.subCategory);
      return 0; // Keep original parameter order
    });

    // Group by category and sub-category
    const grouped: Array<{
      category: string;
      categoryRowspan: number;
      subCategories: Array<{
        subCategory: string;
        subCategoryRowspan: number;
        parameters: ToolboxEntry[];
      }>;
    }> = [];

    sortedEntries.forEach(entry => {
      let categoryGroup = grouped.find(g => g.category === entry.category);
      if (!categoryGroup) {
        categoryGroup = {
          category: entry.category,
          categoryRowspan: 0,
          subCategories: []
        };
        grouped.push(categoryGroup);
      }

      let subCategoryGroup = categoryGroup.subCategories.find(s => s.subCategory === entry.subCategory);
      if (!subCategoryGroup) {
        subCategoryGroup = {
          subCategory: entry.subCategory,
          subCategoryRowspan: 0,
          parameters: []
        };
        categoryGroup.subCategories.push(subCategoryGroup);
      }

      subCategoryGroup.parameters.push(entry);
    });

    // Calculate rowspans
    grouped.forEach(categoryGroup => {
      let totalCategoryRows = 0;
      categoryGroup.subCategories.forEach(subCategoryGroup => {
        subCategoryGroup.subCategoryRowspan = subCategoryGroup.parameters.length;
        totalCategoryRows += subCategoryGroup.parameters.length;
      });
      categoryGroup.categoryRowspan = totalCategoryRows;
    });

    return grouped;
  }, [filteredEntries]);

  // Handle add entry
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
      title: "Entry Added",
      description: "New toolbox entry has been added successfully."
    });
  };

  // Handle edit entry
  const handleEditEntry = () => {
    if (!editingEntry || !editingEntry.category.trim() || !editingEntry.parameterName?.trim()) {
      toast({
        title: "Validation Error",
        description: "Category and Parameter Name are required fields.",
        variant: "destructive"
      });
      return;
    }

    // Build the legacy parameter string for backward compatibility
    const legacyParameter = editingEntry.options && editingEntry.options.length > 0 
      ? `${editingEntry.parameterName} [${editingEntry.options.join(', ')}]`
      : editingEntry.parameterName || editingEntry.parameter;

    updateEntry(editingEntry.id, {
      category: editingEntry.category.trim(),
      subCategory: editingEntry.subCategory.trim(),
      parameter: legacyParameter,
      parameterName: editingEntry.parameterName,
      parameterType: editingEntry.parameterType,
      options: editingEntry.options ? [...editingEntry.options] : []
    });
    
    setIsEditDialogOpen(false);
    setEditingEntry(null);
    
    toast({
      title: "Entry Updated",
      description: "Toolbox entry has been updated successfully."
    });
  };

  // Handle delete entry
  const handleDeleteEntry = (id: string) => {
    deleteEntry(id);
    toast({
      title: "Entry Deleted",
      description: "Toolbox entry has been deleted successfully."
    });
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

  // Open edit dialog
  const openEditDialog = (entry: ToolboxEntry) => {
    const editEntry = { 
      ...entry,
      // Ensure we have the new structure fields
      parameterName: entry.parameterName || entry.parameter.split(' [')[0].trim(),
      parameterType: entry.parameterType || 'qualitative',
      options: entry.options || []
    };
    setEditingEntry(editEntry);
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading toolbox database...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories, sub-categories, or parameters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Parameter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Parameter</DialogTitle>
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
                <Label htmlFor="subCategory">Sub-Category</Label>
                <Input
                  id="subCategory"
                  value={newEntry.subCategory}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, subCategory: e.target.value }))}
                  placeholder="e.g., Acceleration, Strength (optional)"
                />
              </div>
              <div>
                <Label htmlFor="parameterName">Parameter Name *</Label>
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
                        className="inline-flex items-center bg-secondary text-secondary-foreground px-2 py-1 text-xs rounded"
                      >
                        {option}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-1 h-4 w-4 p-0"
                          onClick={() => {
                            setNewEntry(prev => ({
                              ...prev,
                              options: prev.options.filter((_, i) => i !== index)
                            }));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddEntry}>
                  Add Parameter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Parameters Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">Category</TableHead>
                <TableHead className="w-1/5">Sub-Category</TableHead>
                <TableHead className="w-2/5">Parameter</TableHead>
                <TableHead className="w-1/10">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hierarchicalData.map((categoryGroup, categoryIndex) => 
                categoryGroup.subCategories.map((subCategoryGroup, subCategoryIndex) =>
                  subCategoryGroup.parameters.map((entry, parameterIndex) => (
                    <TableRow key={entry.id} className="border-b">
                      {/* Category cell with rowspan */}
                      {subCategoryIndex === 0 && parameterIndex === 0 && (
                        <TableCell 
                          rowSpan={categoryGroup.categoryRowspan}
                          className="font-bold text-primary border-r-2 border-border bg-muted/30 align-top"
                        >
                          {entry.category}
                        </TableCell>
                      )}
                      
                      {/* Sub-category cell with rowspan */}
                      {parameterIndex === 0 && (
                        <TableCell 
                          rowSpan={subCategoryGroup.subCategoryRowspan}
                          className="font-medium text-muted-foreground border-r border-border bg-muted/10 align-top"
                        >
                          {entry.subCategory || "-"}
                        </TableCell>
                      )}
                      
                       {/* Parameter cell */}
                       <TableCell className="border-r border-border">
                         <div className="max-w-md">
                           {entry.parameterName || entry.parameter ? (
                             <div>
                               <span className="font-bold">
                                 {entry.parameterName || entry.parameter.split('[')[0].trim()}
                               </span>
                               {entry.parameterType && (
                                 <span className={`text-xs ml-2 px-2 py-1 rounded ${
                                   entry.parameterType === 'quantitative' 
                                     ? 'bg-blue-100 text-blue-800' 
                                     : 'bg-green-100 text-green-800'
                                 }`}>
                                   {entry.parameterType}
                                 </span>
                               )}
                               {entry.options && entry.options.length > 0 && (
                                 <div className="text-xs text-muted-foreground mt-1">
                                   Options: {entry.options.join(', ')}
                                 </div>
                               )}
                             </div>
                           ) : (
                             <span className="font-bold">{entry.parameter}</span>
                           )}
                         </div>
                       </TableCell>
                      
                      {/* Actions cell */}
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(entry)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Parameter</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-category">Category *</Label>
                <Input
                  id="edit-category"
                  value={editingEntry.category}
                  onChange={(e) => setEditingEntry(prev => prev ? { ...prev, category: e.target.value } : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-subCategory">Sub-Category</Label>
                <Input
                  id="edit-subCategory"
                  value={editingEntry.subCategory}
                  onChange={(e) => setEditingEntry(prev => prev ? { ...prev, subCategory: e.target.value } : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-parameterName">Parameter Name *</Label>
                <Input
                  id="edit-parameterName"
                  value={editingEntry.parameterName || ''}
                  onChange={(e) => setEditingEntry(prev => prev ? { ...prev, parameterName: e.target.value } : null)}
                  placeholder="e.g., Frequency, Intensity, Organization"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Parameter Type</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-parameterType"
                      checked={editingEntry.parameterType === 'quantitative'}
                      onCheckedChange={(checked) => 
                        setEditingEntry(prev => prev ? ({ 
                          ...prev, 
                          parameterType: checked ? 'quantitative' : 'qualitative' 
                        }) : null)
                      }
                    />
                    <Label htmlFor="edit-parameterType" className="text-sm">
                      {editingEntry.parameterType === 'quantitative' ? 'Quantitative (with units)' : 'Qualitative (descriptive)'}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {editingEntry.parameterType === 'quantitative' ? 'Units' : 'Options'}
                </Label>
                <div className="flex space-x-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder={
                      editingEntry.parameterType === 'quantitative' 
                        ? "e.g., m, km, s, %, kg" 
                        : "e.g., Regular Sets, Super Sets"
                    }
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newOption.trim()) {
                        setEditingEntry(prev => prev ? ({ 
                          ...prev, 
                          options: [...(prev.options || []), newOption.trim()] 
                        }) : null);
                        setNewOption("");
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    onClick={() => {
                      if (newOption.trim()) {
                        setEditingEntry(prev => prev ? ({ 
                          ...prev, 
                          options: [...(prev.options || []), newOption.trim()] 
                        }) : null);
                        setNewOption("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {editingEntry.options && editingEntry.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editingEntry.options.map((option, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center bg-secondary text-secondary-foreground px-2 py-1 text-xs rounded"
                      >
                        {option}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-1 h-4 w-4 p-0"
                          onClick={() => {
                            setEditingEntry(prev => prev ? ({
                              ...prev,
                              options: (prev.options || []).filter((_, i) => i !== index)
                            }) : null);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditEntry}>
                  Update Parameter
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* No results message */}
      {hierarchicalData.length === 0 && searchTerm && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No parameters found matching "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}