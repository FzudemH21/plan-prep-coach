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
import { AthleticismEntry } from '@/types/athleticism';
import { 
  ArrowLeft, 
  Plus, 
  Download, 
  Upload, 
  Edit, 
  Trash2, 
  Search,
  Copy,
  X
} from "lucide-react";

// Interface for hierarchical display
interface HierarchicalRow {
  id: string;
  overarchingGoal: string;
  subGoal: string;
  quality: string;
  method: string;
  loadingRecommendations: Record<string, any>;
  originalEntry: AthleticismEntry;
  goalRowspan?: number;
  subGoalRowspan?: number;
  qualityRowspan?: number;
  isFirstInGoal?: boolean;
  isFirstInSubGoal?: boolean;
  isFirstInQuality?: boolean;
}

export default function AthleticismDatabase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, addEntry, updateEntry, deleteEntry, importData, exportData } = useAthleticismData();
  const { data: toolboxData } = useToolboxData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEntry, setEditingEntry] = useState<AthleticismEntry | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEntry, setNewEntry] = useState<Omit<AthleticismEntry, 'id'>>({
    overarchingGoal: '',
    subGoal: '',
    quality: '',
    mappedMethods: [],
    loadingRecommendations: {}
  });

  const filteredEntries = data.entries.filter(entry => 
    entry.overarchingGoal.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.subGoal.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.quality.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.mappedMethods.some(method => method.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Transform entries into hierarchical structure with each method as separate row
  const hierarchicalData = useMemo(() => {
    const expandedRows: HierarchicalRow[] = [];
    
    // First, expand each entry to create separate rows for each method
    filteredEntries.forEach(entry => {
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

    // Sort by hierarchy levels
    expandedRows.sort((a, b) => {
      if (a.overarchingGoal !== b.overarchingGoal) return a.overarchingGoal.localeCompare(b.overarchingGoal);
      if (a.subGoal !== b.subGoal) return a.subGoal.localeCompare(b.subGoal);
      if (a.quality !== b.quality) return a.quality.localeCompare(b.quality);
      return a.method.localeCompare(b.method);
    });

    // Calculate rowspan values and mark first occurrences
    const goalCounts = new Map<string, number>();
    const subGoalCounts = new Map<string, number>();
    const qualityCounts = new Map<string, number>();

    // Count occurrences
    expandedRows.forEach(row => {
      const goalKey = row.overarchingGoal;
      const subGoalKey = `${row.overarchingGoal}|${row.subGoal}`;
      const qualityKey = `${row.overarchingGoal}|${row.subGoal}|${row.quality}`;
      
      goalCounts.set(goalKey, (goalCounts.get(goalKey) || 0) + 1);
      subGoalCounts.set(subGoalKey, (subGoalCounts.get(subGoalKey) || 0) + 1);
      qualityCounts.set(qualityKey, (qualityCounts.get(qualityKey) || 0) + 1);
    });

    // Mark first occurrences and set rowspan
    const seenGoals = new Set<string>();
    const seenSubGoals = new Set<string>();
    const seenQualities = new Set<string>();

    expandedRows.forEach(row => {
      const goalKey = row.overarchingGoal;
      const subGoalKey = `${row.overarchingGoal}|${row.subGoal}`;
      const qualityKey = `${row.overarchingGoal}|${row.subGoal}|${row.quality}`;

      if (!seenGoals.has(goalKey)) {
        row.isFirstInGoal = true;
        row.goalRowspan = goalCounts.get(goalKey);
        seenGoals.add(goalKey);
      }

      if (!seenSubGoals.has(subGoalKey)) {
        row.isFirstInSubGoal = true;
        row.subGoalRowspan = subGoalCounts.get(subGoalKey);
        seenSubGoals.add(subGoalKey);
      }

      if (!seenQualities.has(qualityKey)) {
        row.isFirstInQuality = true;
        row.qualityRowspan = qualityCounts.get(qualityKey);
        seenQualities.add(qualityKey);
      }
    });

    return expandedRows;
  }, [filteredEntries]);

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
          <Badge variant="secondary">{hierarchicalData.length} method entries</Badge>
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                      <Label htmlFor="loading">Loading Recommendations (JSON)</Label>
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
          <div className="border rounded-lg overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="min-w-[200px]">Overarching Goal</TableHead>
                  <TableHead className="min-w-[200px]">Sub-goal</TableHead>
                  <TableHead className="min-w-[200px]">Quality</TableHead>
                  <TableHead className="min-w-[250px]">Method</TableHead>
                  <TableHead className="min-w-[400px]">Loading Recommendations</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarchicalData.map((row) => (
                  <TableRow key={row.id}>
                    {/* Overarching Goal - with rowspan */}
                    {row.isFirstInGoal && (
                      <TableCell 
                        rowSpan={row.goalRowspan} 
                        className="font-bold text-primary border-r-2 border-border bg-muted/30 align-top"
                      >
                        <div className="max-w-[180px] break-words">
                          {row.overarchingGoal}
                        </div>
                      </TableCell>
                    )}
                    
                    {/* Sub-goal - with rowspan */}
                    {row.isFirstInSubGoal && (
                      <TableCell 
                        rowSpan={row.subGoalRowspan}
                        className="font-medium text-muted-foreground border-r border-border bg-muted/10 align-top"
                      >
                        <div className="max-w-[180px] break-words">
                          {row.subGoal}
                        </div>
                      </TableCell>
                    )}
                    
                    {/* Quality - with rowspan */}
                    {row.isFirstInQuality && (
                      <TableCell 
                        rowSpan={row.qualityRowspan}
                        className="text-foreground border-r border-border bg-muted/5 align-top"
                      >
                        <div className="max-w-[180px] break-words">
                          {row.quality}
                        </div>
                      </TableCell>
                    )}
                    
                    {/* Method - individual for each row */}
                    <TableCell className="border-r border-border">
                      <div className="max-w-[230px]">
                        <span className="font-bold text-foreground">
                          {row.method}
                        </span>
                      </div>
                    </TableCell>
                    
                    {/* Loading Recommendations - formatted as readable list */}
                    <TableCell className="border-r border-border">
                      <div className="max-w-[380px]">
                        {formatLoadingRecommendations(row.loadingRecommendations)}
                      </div>
                    </TableCell>
                    
                    {/* Actions - edit original entry */}
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
          </div>
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
                        
                        if (parameters.length === 0) {
                          return (
                            <TableRow key={method}>
                              <TableCell className="font-medium">{method}</TableCell>
                              <TableCell colSpan={2} className="text-muted-foreground text-sm">
                                No parameters specified
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return parameters.map(([paramKey, paramValue], paramIndex) => (
                          <TableRow key={`${method}-${paramKey}`}>
                            {paramIndex === 0 && (
                              <TableCell rowSpan={parameters.length} className="font-medium align-top border-r">
                                {method}
                              </TableCell>
                            )}
                            <TableCell className="font-medium text-sm">
                              {paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
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
                        ));
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Add Method Section */}
                <div className="mt-4 space-y-4">
                  <div className="p-4 border rounded-lg bg-primary/5">
                    <Label className="text-sm font-medium">Add Method</Label>
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      <select 
                        className="px-3 py-2 border rounded-md text-sm bg-background"
                        onChange={(e) => {
                          const selectedEntry = toolboxData.entries.find(entry => entry.id === e.target.value);
                          if (selectedEntry) {
                            const methodName = selectedEntry.subCategory && selectedEntry.subCategory.trim() !== '' 
                              ? `${selectedEntry.category} - ${selectedEntry.subCategory}`
                              : selectedEntry.category;
                            
                            if (!editingEntry.mappedMethods.includes(methodName)) {
                              const newMethods = [...editingEntry.mappedMethods, methodName];
                              const newRecommendations = { ...editingEntry.loadingRecommendations };
                              // Initialize with empty recommendations for the new method
                              newRecommendations[methodName] = {};
                              setEditingEntry({
                                ...editingEntry, 
                                mappedMethods: newMethods,
                                loadingRecommendations: newRecommendations
                              });
                            }
                            e.target.value = ''; // Reset selection
                          }
                        }}
                      >
                        <option value="">Select method to add...</option>
                        {toolboxData.entries
                          .filter(entry => {
                            const methodName = entry.subCategory && entry.subCategory.trim() !== '' 
                              ? `${entry.category} - ${entry.subCategory}`
                              : entry.category;
                            return !editingEntry.mappedMethods.includes(methodName);
                          })
                          .sort((a, b) => {
                            if (a.category !== b.category) return a.category.localeCompare(b.category);
                            if (a.subCategory !== b.subCategory) return a.subCategory.localeCompare(b.subCategory);
                            return a.parameter.localeCompare(b.parameter);
                          })
                          .map(entry => {
                            const methodName = entry.subCategory && entry.subCategory.trim() !== '' 
                              ? `${entry.category} - ${entry.subCategory}`
                              : entry.category;
                            return (
                              <option key={entry.id} value={entry.id}>
                                {methodName}
                              </option>
                            );
                          })
                        }
                      </select>
                      <span className="text-xs text-muted-foreground">
                        Select training methods from your toolbox to add to this entry
                      </span>
                    </div>
                  </div>

                  {/* Add Parameter to Existing Method */}
                  {editingEntry.mappedMethods.length > 0 && (
                    <div className="p-4 border rounded-lg bg-muted/20">
                      <Label className="text-sm font-medium">Add Parameter to Method</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <select 
                          className="px-3 py-2 border rounded-md text-sm bg-background"
                          id="method-select"
                        >
                          <option value="">Select method...</option>
                          {editingEntry.mappedMethods.map(method => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                        <select 
                          className="px-3 py-2 border rounded-md text-sm bg-background"
                          onChange={(e) => {
                            const selectedParameter = e.target.value;
                            const methodSelect = document.getElementById('method-select') as HTMLSelectElement;
                            const selectedMethod = methodSelect.value;
                            
                            if (selectedMethod && selectedParameter) {
                              const newRecommendations = { ...editingEntry.loadingRecommendations };
                              if (!newRecommendations[selectedMethod]) {
                                newRecommendations[selectedMethod] = {};
                              }
                              if (!newRecommendations[selectedMethod][selectedParameter]) {
                                newRecommendations[selectedMethod][selectedParameter] = '';
                                setEditingEntry({...editingEntry, loadingRecommendations: newRecommendations});
                              }
                              e.target.value = '';
                              methodSelect.value = '';
                            }
                          }}
                        >
                          <option value="">Select parameter...</option>
                          {(() => {
                            const methodSelect = document.getElementById('method-select') as HTMLSelectElement;
                            const selectedMethod = methodSelect?.value;
                            if (!selectedMethod) return [];
                            
                            // Find all toolbox entries that match this method
                            const matchingEntries = toolboxData.entries.filter(entry => {
                              const methodName = entry.subCategory && entry.subCategory.trim() !== '' 
                                ? `${entry.category} - ${entry.subCategory}`
                                : entry.category;
                              return methodName === selectedMethod;
                            });
                            
                            // Get all unique parameters from matching entries
                            const availableParams = [...new Set(matchingEntries.map(entry => entry.parameter))];
                            
                            // Filter out parameters that are already added
                            const existingParams = Object.keys(editingEntry.loadingRecommendations[selectedMethod] || {});
                            const filteredParams = availableParams.filter(param => !existingParams.includes(param));
                            
                            return filteredParams.map(param => (
                              <option key={param} value={param}>{param}</option>
                            ));
                          })()}
                        </select>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        Select a method first, then choose from its available parameters
                      </span>
                    </div>
                  )}
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