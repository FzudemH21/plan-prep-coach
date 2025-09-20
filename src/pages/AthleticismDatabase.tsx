import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { useToolboxData } from '@/hooks/useToolboxData';
import { AthleticismEntry, AthleticismFilterState, FlatAthleticismRow } from '@/types/athleticism';
import { AthleticismColumnFilter } from '@/components/athleticism/AthleticismColumnFilter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  ArrowLeft, 
  Plus, 
  Download, 
  Upload, 
  Edit, 
  Trash2, 
  Search,
  Copy,
  X,
  ChevronUp,
  ChevronDown
} from "lucide-react";

export default function AthleticismDatabase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, addEntry, updateEntry, deleteEntry, importData, exportData } = useAthleticismData();
  const { data: toolboxData } = useToolboxData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEntry, setEditingEntry] = useState<AthleticismEntry | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterState, setFilterState] = useState<AthleticismFilterState>({
    search: '',
    columnFilters: {},
    sortColumn: null,
    sortDirection: 'asc'
  });
  const [newEntry, setNewEntry] = useState<Omit<AthleticismEntry, 'id'>>({
    overarchingGoal: '',
    subGoal: '',
    quality: '',
    mappedMethods: [],
    loadingRecommendations: {}
  });

  const [pendingParam, setPendingParam] = useState<Record<string, string>>({});

  // Helper function to normalize method keys for consistent matching
  const normalizeMethodKey = (methodName: string): string => {
    return methodName.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Parse method label into category and subCategory
  const parseMethodLabel = (methodLabel: string): { category: string; subCategory: string } => {
    const parts = methodLabel.split(' - ');
    return {
      category: parts[0]?.trim() || '',
      subCategory: parts[1]?.trim() || ''
    };
  };

  // Build method maps from toolbox data for efficient lookups
  const methodMaps = useMemo(() => {
    const parameterMap = new Map<string, string[]>();
    const canonicalNameMap = new Map<string, string>();
    const availableMethodsSet = new Set<string>();

    toolboxData.entries.forEach(entry => {
      const canonicalName = entry.subCategory && entry.subCategory.trim() !== '' 
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      const normalizedKey = normalizeMethodKey(canonicalName);
      
      // Track all available methods
      availableMethodsSet.add(canonicalName);
      
      // Map normalized key to canonical name
      canonicalNameMap.set(normalizedKey, canonicalName);
      
      // Build parameters map
      if (!parameterMap.has(normalizedKey)) {
        parameterMap.set(normalizedKey, []);
      }
      
      if (entry.parameter && entry.parameter.trim() !== '') {
        const currentParams = parameterMap.get(normalizedKey) || [];
        if (!currentParams.includes(entry.parameter)) {
          currentParams.push(entry.parameter);
          parameterMap.set(normalizedKey, currentParams);
        }
      }
    });

    return {
      parameterMap,
      canonicalNameMap,
      availableMethods: Array.from(availableMethodsSet).sort()
    };
  }, [toolboxData.entries]);

  const filteredEntries = data.entries.filter(entry => 
    entry.overarchingGoal.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.subGoal.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.quality.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.mappedMethods.some(method => method.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Transform entries into flat rows - each method gets its own row
  const flatData = useMemo(() => {
    const expandedRows: FlatAthleticismRow[] = [];
    
    // First, create flat rows for each method
    data.entries.forEach(entry => {
      if (entry.mappedMethods.length === 0) {
        // Handle entries with no methods
        expandedRows.push({
          id: `${entry.id}-no-method`,
          overarchingGoal: entry.overarchingGoal,
          subGoal: entry.subGoal,
          quality: entry.quality,
          method: 'No methods specified',
          loadingRecommendations: {},
          originalEntry: entry
        });
      } else {
        entry.mappedMethods.forEach((method, methodIndex) => {
          const methodRecommendations = entry.loadingRecommendations[method] || {};
          expandedRows.push({
            id: `${entry.id}-${methodIndex}`,
            overarchingGoal: entry.overarchingGoal,
            subGoal: entry.subGoal,
            quality: entry.quality,
            method: method,
            loadingRecommendations: methodRecommendations,
            originalEntry: entry
          });
        });
      }
    });

    return expandedRows;
  }, [data.entries]);

  // Apply filters to flat data
  const filteredData = useMemo(() => {
    let filtered = flatData;

    // Apply global search
    if (filterState.search) {
      filtered = filtered.filter(row => 
        row.overarchingGoal.toLowerCase().includes(filterState.search.toLowerCase()) ||
        row.subGoal.toLowerCase().includes(filterState.search.toLowerCase()) ||
        row.quality.toLowerCase().includes(filterState.search.toLowerCase()) ||
        row.method.toLowerCase().includes(filterState.search.toLowerCase())
      );
    }

    // Apply column filters
    Object.entries(filterState.columnFilters).forEach(([columnKey, selectedValues]) => {
      if (selectedValues.length > 0) {
        filtered = filtered.filter(row => {
          const key = columnKey as keyof FlatAthleticismRow;
          if (key === 'loadingRecommendations') {
            const value = row[key];
            if (typeof value === 'object' && value !== null) {
              const params = Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
              return selectedValues.includes(params || 'No recommendations');
            }
            return selectedValues.includes('No recommendations');
          }
          return selectedValues.includes(String(row[key] || ''));
        });
      }
    });

    // Apply sorting
    if (filterState.sortColumn) {
      filtered.sort((a, b) => {
        const aValue = String(a[filterState.sortColumn!] || '');
        const bValue = String(b[filterState.sortColumn!] || '');
        
        if (filterState.sortColumn === 'loadingRecommendations') {
          // Special handling for loading recommendations
          const aRecommendations = typeof a.loadingRecommendations === 'object' && a.loadingRecommendations !== null
            ? Object.entries(a.loadingRecommendations).map(([k, v]) => `${k}: ${v}`).join(', ')
            : '';
          const bRecommendations = typeof b.loadingRecommendations === 'object' && b.loadingRecommendations !== null
            ? Object.entries(b.loadingRecommendations).map(([k, v]) => `${k}: ${v}`).join(', ')
            : '';
          
          const result = aRecommendations.localeCompare(bRecommendations);
          return filterState.sortDirection === 'asc' ? result : -result;
        }
        
        const result = aValue.localeCompare(bValue);
        return filterState.sortDirection === 'asc' ? result : -result;
      });
    } else {
      // Default sorting when no specific sort is applied
      filtered.sort((a, b) => {
        if (a.overarchingGoal !== b.overarchingGoal) return a.overarchingGoal.localeCompare(b.overarchingGoal);
        if (a.subGoal !== b.subGoal) return a.subGoal.localeCompare(b.subGoal);
        if (a.quality !== b.quality) return a.quality.localeCompare(b.quality);
        return a.method.localeCompare(b.method);
      });
    }

    return filtered;
  }, [flatData, filterState]);

  const handleColumnFilter = (columnKey: keyof FlatAthleticismRow, selectedValues: string[]) => {
    setFilterState(prev => ({
      ...prev,
      columnFilters: {
        ...prev.columnFilters,
        [columnKey]: selectedValues
      }
    }));
  };

  const handleSort = (columnKey: keyof FlatAthleticismRow) => {
    setFilterState(prev => ({
      ...prev,
      sortColumn: columnKey,
      sortDirection: prev.sortColumn === columnKey && prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (columnKey: keyof FlatAthleticismRow) => {
    if (filterState.sortColumn === columnKey) {
      return filterState.sortDirection === 'asc' ? 
        <ChevronUp className="h-4 w-4 text-primary" /> : 
        <ChevronDown className="h-4 w-4 text-primary" />;
    }
    
    // Show inactive sort indicator when column is not sorted
    return (
      <div className="flex flex-col opacity-50">
        <ChevronUp className="h-2 w-2 -mb-1" />
        <ChevronDown className="h-2 w-2" />
      </div>
    );
  };

  // Format loading recommendations as readable parameters
  const formatLoadingRecommendations = (recommendations: Record<string, any>) => {
    if (!recommendations || Object.keys(recommendations).length === 0) {
      return <span className="text-muted-foreground text-sm">No recommendations specified</span>;
    }

    const formatValue = (value: any): string => {
      if (value === null || value === undefined) {
        return 'Not specified';
      }
      if (typeof value === 'object') {
        // Handle nested objects by flattening them
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        // For objects, try to extract meaningful values
        const objEntries = Object.entries(value);
        if (objEntries.length === 0) {
          return 'Not specified';
        }
        return objEntries.map(([k, v]) => `${k}: ${v}`).join(', ');
      }
      return String(value);
    };

    const formatKey = (key: string): string => {
      return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
    };

    return (
      <div className="space-y-1">
        {Object.entries(recommendations).map(([key, value]) => (
          <div key={key} className="text-sm">
            <span className="font-medium text-foreground">
              {formatKey(key)}:
            </span>{' '}
            <span className="text-muted-foreground">
              {formatValue(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const handleExport = () => {
    const exportedData = exportData();
    const blob = new Blob([exportedData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'athleticism-database.tsv';
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export Successful",
      description: "Database exported as TSV file."
    });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const success = importData(text);
    
    if (success) {
      toast({
        title: "Import Successful",
        description: "Database updated with imported data."
      });
    } else {
      toast({
        title: "Import Failed",
        description: "Please check the file format and try again.",
        variant: "destructive"
      });
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const exportedData = exportData();
      await navigator.clipboard.writeText(exportedData);
      toast({
        title: "Copied to Clipboard",
        description: "Database data copied as tab-separated values."
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard.",
        variant: "destructive"
      });
    }
  };

  const handleAddEntry = () => {
    addEntry(newEntry);
    setNewEntry({
      overarchingGoal: '',
      subGoal: '',
      quality: '',
      mappedMethods: [],
      loadingRecommendations: {}
    });
    setShowAddDialog(false);
    toast({
      title: "Entry Added",
      description: "New entry has been added to the database."
    });
  };

  const handleEditEntry = (entry: AthleticismEntry) => {
    setEditingEntry(entry);
  };

  const handleUpdateEntry = () => {
    if (!editingEntry) return;
    updateEntry(editingEntry.id, editingEntry);
    setEditingEntry(null);
    toast({
      title: "Entry Updated",
      description: "Entry has been successfully updated."
    });
  };

  const handleDeleteEntry = (id: string) => {
    deleteEntry(id);
    toast({
      title: "Entry Deleted",
      description: "Entry has been removed from the database."
    });
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
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
            <h1 className="text-3xl font-bold">Athleticism Database</h1>
            <p className="text-muted-foreground">Reverse-engineered training methods and loading recommendations</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">{filteredData.length} method entries</Badge>
          <Badge variant="outline">{data.entries.length} base entries</Badge>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by goal, quality, or method..."
                  value={filterState.search}
                  onChange={(e) => setFilterState(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Entry</DialogTitle>
                    <DialogDescription>
                      Add a new training method entry to the database.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="goal">Overarching Goal</Label>
                      <Input
                        id="goal"
                        value={newEntry.overarchingGoal}
                        onChange={(e) => setNewEntry({...newEntry, overarchingGoal: e.target.value})}
                        placeholder="e.g., Improving sprint ability"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subgoal">Sub-goal</Label>
                      <Input
                        id="subgoal"
                        value={newEntry.subGoal}
                        onChange={(e) => setNewEntry({...newEntry, subGoal: e.target.value})}
                        placeholder="e.g., Acceleration 0-10m"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quality">Quality</Label>
                      <Input
                        id="quality"
                        value={newEntry.quality}
                        onChange={(e) => setNewEntry({...newEntry, quality: e.target.value})}
                        placeholder="e.g., Hip extensor strength"
                      />
                    </div>
                    <div>
                      <Label htmlFor="methods">Mapped Methods (JSON array)</Label>
                      <Textarea
                        id="methods"
                        value={JSON.stringify(newEntry.mappedMethods)}
                        onChange={(e) => {
                          try {
                            setNewEntry({...newEntry, mappedMethods: JSON.parse(e.target.value)});
                          } catch {}
                        }}
                        placeholder='["Method 1", "Method 2"]'
                      />
                    </div>
                    <div>
                      <Label htmlFor="loading">Loading Recommendations</Label>
                      <Textarea
                        id="loading"
                        value={JSON.stringify(newEntry.loadingRecommendations, null, 2)}
                        onChange={(e) => {
                          try {
                            setNewEntry({...newEntry, loadingRecommendations: JSON.parse(e.target.value)});
                          } catch {}
                        }}
                        placeholder='{}'
                        rows={6}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddEntry}>
                        Add Entry
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={handleCopyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy All
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <div>
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
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Database Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table containerClassName="border rounded-lg max-h-[70vh]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px] sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleSort('overarchingGoal')}
                        className="flex items-center space-x-1 font-medium hover:text-primary transition-colors"
                      >
                        <span>Overarching Goal</span>
                        {getSortIcon('overarchingGoal')}
                      </button>
                      <AthleticismColumnFilter
                        columnKey="overarchingGoal"
                        columnLabel="Overarching Goal"
                        allData={flatData}
                        selectedValues={filterState.columnFilters.overarchingGoal || []}
                        onSelectionChange={(values) => handleColumnFilter('overarchingGoal', values)}
                        onSortChange={handleSort}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[200px] sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleSort('subGoal')}
                        className="flex items-center space-x-1 font-medium hover:text-primary transition-colors"
                      >
                        <span>Sub-goal</span>
                        {getSortIcon('subGoal')}
                      </button>
                      <AthleticismColumnFilter
                        columnKey="subGoal"
                        columnLabel="Sub-goal"
                        allData={flatData}
                        selectedValues={filterState.columnFilters.subGoal || []}
                        onSelectionChange={(values) => handleColumnFilter('subGoal', values)}
                        onSortChange={handleSort}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[200px] sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleSort('quality')}
                        className="flex items-center space-x-1 font-medium hover:text-primary transition-colors"
                      >
                        <span>Quality</span>
                        {getSortIcon('quality')}
                      </button>
                      <AthleticismColumnFilter
                        columnKey="quality"
                        columnLabel="Quality"
                        allData={flatData}
                        selectedValues={filterState.columnFilters.quality || []}
                        onSelectionChange={(values) => handleColumnFilter('quality', values)}
                        onSortChange={handleSort}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[250px] sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleSort('method')}
                        className="flex items-center space-x-1 font-medium hover:text-primary transition-colors"
                      >
                        <span>Method</span>
                        {getSortIcon('method')}
                      </button>
                      <AthleticismColumnFilter
                        columnKey="method"
                        columnLabel="Method"
                        allData={flatData}
                        selectedValues={filterState.columnFilters.method || []}
                        onSelectionChange={(values) => handleColumnFilter('method', values)}
                        onSortChange={handleSort}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[400px] sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleSort('loadingRecommendations')}
                        className="flex items-center space-x-1 font-medium hover:text-primary transition-colors"
                      >
                        <span>Loading Recommendations</span>
                        {getSortIcon('loadingRecommendations')}
                      </button>
                      <AthleticismColumnFilter
                        columnKey="loadingRecommendations"
                        columnLabel="Loading Recommendations"
                        allData={flatData}
                        selectedValues={filterState.columnFilters.loadingRecommendations || []}
                        onSelectionChange={(values) => handleColumnFilter('loadingRecommendations', values)}
                        onSortChange={handleSort}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px] sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-[180px] break-words">
                        {row.overarchingGoal}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-muted-foreground">
                      <div className="max-w-[180px] break-words">
                        {row.subGoal}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="max-w-[180px] break-words">
                        {row.quality}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="max-w-[230px]">
                        <span className="font-bold text-foreground">
                          {row.method}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="max-w-[380px]">
                        {formatLoadingRecommendations(row.loadingRecommendations)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEntry(row.originalEntry)}
                          title="Edit entry"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteEntry(row.originalEntry.id)}
                          title="Delete entry"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingEntry && (
        <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Entry</DialogTitle>
              <DialogDescription>
                Modify the training method entry and its loading recommendations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Basic Entry Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-goal">Overarching Goal</Label>
                  <Input
                    id="edit-goal"
                    value={editingEntry.overarchingGoal}
                    onChange={(e) => setEditingEntry({...editingEntry, overarchingGoal: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-subgoal">Sub-goal</Label>
                  <Input
                    id="edit-subgoal"
                    value={editingEntry.subGoal}
                    onChange={(e) => setEditingEntry({...editingEntry, subGoal: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-quality">Quality</Label>
                  <Input
                    id="edit-quality"
                    value={editingEntry.quality}
                    onChange={(e) => setEditingEntry({...editingEntry, quality: e.target.value})}
                  />
                </div>
              </div>

              {/* Methods */}
              <div>
                <Label className="text-base font-semibold">Mapped Methods</Label>
                <div className="mt-2 space-y-2">
                  {editingEntry.mappedMethods.length === 0 ? (
                    <div className="text-muted-foreground text-sm p-4 border border-dashed rounded-lg text-center">
                      No methods added yet. Use the "Add Method" section below to add training methods.
                    </div>
                  ) : (
                    <div className="border rounded-lg">
                      {editingEntry.mappedMethods.map((method, index) => (
                        <div key={method} className={`flex items-center justify-between p-3 ${index !== editingEntry.mappedMethods.length - 1 ? 'border-b' : ''}`}>
                          <span className="font-medium text-sm">{method}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newMethods = editingEntry.mappedMethods.filter(m => m !== method);
                              const newRecommendations = { ...editingEntry.loadingRecommendations };
                              delete newRecommendations[method];
                              setEditingEntry({
                                ...editingEntry,
                                mappedMethods: newMethods,
                                loadingRecommendations: newRecommendations
                              });
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Method Section - Moved here */}
              <div className="p-4 border rounded-lg bg-primary/5">
                <Label className="text-sm font-medium">Add Method</Label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  <select 
                    className="px-3 py-2 border rounded-md text-sm bg-background"
                    onChange={(e) => {
                      const selectedMethodName = e.target.value;
                      if (selectedMethodName && !editingEntry.mappedMethods.includes(selectedMethodName)) {
                        const newMethods = [...editingEntry.mappedMethods, selectedMethodName];
                        const newRecommendations = { ...editingEntry.loadingRecommendations };
                        // Initialize with empty recommendations for the new method
                        newRecommendations[selectedMethodName] = {};
                        setEditingEntry({
                          ...editingEntry, 
                          mappedMethods: newMethods,
                          loadingRecommendations: newRecommendations
                        });
                      }
                      e.target.value = ''; // Reset selection
                    }}
                  >
                    <option value="">Select method to add...</option>
                    {methodMaps.availableMethods
                      .filter(methodName => !editingEntry.mappedMethods.includes(methodName))
                      .map(methodName => (
                        <option key={methodName} value={methodName}>
                          {methodName}
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-muted-foreground">
                    Select training methods from your toolbox to add to this entry
                  </span>
                </div>
              </div>

              {/* Loading Recommendations Table */}
              <div>
                <Label className="text-base font-semibold">Loading Recommendations</Label>
                <div className="mt-3 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Method</TableHead>
                        <TableHead className="w-[150px]">Parameter</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editingEntry.mappedMethods.map((method) => {
                        const methodRecommendations = editingEntry.loadingRecommendations[method] || {};
                        const parameters = Object.entries(methodRecommendations);
                        
                        // Get available parameters for this method using normalized matching
                        const normalizedMethodKey = normalizeMethodKey(method);
                        const allParametersForMethod = methodMaps.parameterMap.get(normalizedMethodKey) || [];
                        const uniqueAvailableParams = allParametersForMethod.filter(param => 
                          !Object.keys(methodRecommendations).includes(param)
                        );
                        
                        if (parameters.length === 0 && uniqueAvailableParams.length === 0) {
                          return (
                            <TableRow key={method}>
                              <TableCell className="font-medium">{method}</TableCell>
                              <TableCell colSpan={2} className="text-muted-foreground text-sm">
                                No parameters available for this method
                              </TableCell>
                            </TableRow>
                          );
                        }

                        const rowsToRender = [];
                        
                        // Add existing parameter rows
                        parameters.forEach(([paramKey, paramValue], paramIndex) => {
                          rowsToRender.push(
                            <TableRow key={`${method}-${paramKey}`}>
                              {paramIndex === 0 && (
                                <TableCell rowSpan={parameters.length + (uniqueAvailableParams.length > 0 ? 1 : 0)} className="font-medium align-top border-r">
                                  {method}
                                </TableCell>
                              )}
                              <TableCell className="font-medium text-sm">
                                <div className="flex items-center justify-between">
                                  <span>{paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newRecommendations = { ...editingEntry.loadingRecommendations };
                                      delete newRecommendations[method][paramKey];
                                      setEditingEntry({...editingEntry, loadingRecommendations: newRecommendations});
                                    }}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    ×
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={typeof paramValue === 'object' ? JSON.stringify(paramValue) : String(paramValue)}
                                  onChange={(e) => {
                                    const newRecommendations = { ...editingEntry.loadingRecommendations };
                                    if (!newRecommendations[method]) {
                                      newRecommendations[method] = {};
                                    }
                                    
                                    let newValue: any = e.target.value;
                                    // Try to parse as JSON if it looks like an object/array
                                    if (newValue.startsWith('{') || newValue.startsWith('[')) {
                                      try {
                                        newValue = JSON.parse(newValue);
                                      } catch {
                                        // Keep as string if JSON parsing fails
                                      }
                                    }
                                    
                                    newRecommendations[method][paramKey] = newValue;
                                    setEditingEntry({...editingEntry, loadingRecommendations: newRecommendations});
                                  }}
                                  className="text-sm"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        });

                        // Always render the parameter addition row (disable if none available)
                        {
                          rowsToRender.push(
                            <TableRow key={`${method}-add-param`}>
                              {parameters.length === 0 && (
                                <TableCell className="font-medium align-top border-r">
                                  {method}
                                </TableCell>
                              )}
                              <TableCell colSpan={2}>
                                <div className="flex items-center justify-end">
                                   <DropdownMenu>
                                     <DropdownMenuTrigger asChild>
                                       <Button
                                         variant="outline"
                                         size="icon"
                                         className="h-8 w-8 rounded-full relative z-10"
                                         aria-label={`Add parameter to ${method}`}
                                       >
                                         <Plus className="h-4 w-4" />
                                       </Button>
                                     </DropdownMenuTrigger>
                                     <DropdownMenuContent 
                                       className="z-[100] bg-popover border border-border shadow-md min-w-[200px]"
                                       align="end"
                                       sideOffset={4}
                                     >
                                       {uniqueAvailableParams.length === 0 ? (
                                         <DropdownMenuItem disabled className="text-muted-foreground">
                                           No more parameters available
                                         </DropdownMenuItem>
                                       ) : (
                                         uniqueAvailableParams.map(param => (
                                           <DropdownMenuItem
                                             key={param}
                                             onClick={() => {
                                               const newRecommendations = { ...editingEntry.loadingRecommendations };
                                               if (!newRecommendations[method]) {
                                                 newRecommendations[method] = {};
                                               }
                                               newRecommendations[method][param] = '';
                                               setEditingEntry({ ...editingEntry, loadingRecommendations: newRecommendations });
                                             }}
                                             className="cursor-pointer hover:bg-accent"
                                           >
                                             {param}
                                           </DropdownMenuItem>
                                         ))
                                       )}
                                     </DropdownMenuContent>
                                   </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return rowsToRender;
                      }).flat()}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setEditingEntry(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateEntry}>
                  Update Entry
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}