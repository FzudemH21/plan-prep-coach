import { useState } from 'react';
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
import { AthleticismEntry } from '@/types/athleticism';
import { 
  ArrowLeft, 
  Plus, 
  Download, 
  Upload, 
  Edit, 
  Trash2, 
  Search,
  Copy
} from "lucide-react";

export default function AthleticismDatabase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, addEntry, updateEntry, deleteEntry, importData, exportData } = useAthleticismData();
  
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
          <Badge variant="secondary">{data.entries.length} entries</Badge>
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
                  <TableHead className="min-w-[300px]">Mapped Methods</TableHead>
                  <TableHead className="min-w-[400px]">Loading Recommendations</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.overarchingGoal}</TableCell>
                    <TableCell>{entry.subGoal}</TableCell>
                    <TableCell>{entry.quality}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {entry.mappedMethods.map((method, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {method}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[400px] overflow-auto">
                        <pre className="text-xs bg-muted p-2 rounded">
                          {JSON.stringify(entry.loadingRecommendations, null, 2)}
                        </pre>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEntry(entry)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteEntry(entry.id)}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Entry</DialogTitle>
              <DialogDescription>
                Modify the training method entry.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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
              <div>
                <Label htmlFor="edit-methods">Mapped Methods (JSON array)</Label>
                <Textarea
                  id="edit-methods"
                  value={JSON.stringify(editingEntry.mappedMethods)}
                  onChange={(e) => {
                    try {
                      setEditingEntry({...editingEntry, mappedMethods: JSON.parse(e.target.value)});
                    } catch {}
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-loading">Loading Recommendations (JSON)</Label>
                <Textarea
                  id="edit-loading"
                  value={JSON.stringify(editingEntry.loadingRecommendations, null, 2)}
                  onChange={(e) => {
                    try {
                      setEditingEntry({...editingEntry, loadingRecommendations: JSON.parse(e.target.value)});
                    } catch {}
                  }}
                  rows={8}
                />
              </div>
              <div className="flex justify-end space-x-2">
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