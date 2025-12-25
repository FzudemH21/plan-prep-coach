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
import { ArrowLeft, Plus, Search, Edit2, Trash2, Download, Upload } from 'lucide-react';
import { useGoalsDataV2 } from '@/hooks/useGoalsDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useToast } from '@/hooks/use-toast';
import { GoalV2, GOAL_CATEGORIES } from '@/types/goalsV2';
import { AddGoalDialogV2 } from '@/components/goals/AddGoalDialogV2';
import { EditGoalDialogV2 } from '@/components/goals/EditGoalDialogV2';

export default function AthleticismDatabaseV2() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    data,
    isLoading,
    addGoal,
    updateGoal,
    deleteGoal,
    addInteraction,
    removeInteraction,
    getInteractionsForGoal,
    addGoalMethod,
    updateGoalMethod,
    removeGoalMethod,
    getMethodsForGoal,
  } = useGoalsDataV2();
  const { data: toolboxData } = useToolboxData();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalV2 | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<GoalV2 | null>(null);

  // Filter goals by search term
  const filteredGoals = useMemo(() => {
    if (!searchTerm) return data.goals;
    const lower = searchTerm.toLowerCase();
    return data.goals.filter(
      (g) =>
        g.name.toLowerCase().includes(lower) ||
        g.category?.toLowerCase().includes(lower) ||
        g.unit?.toLowerCase().includes(lower)
    );
  }, [data.goals, searchTerm]);

  // Get display info for a goal
  const getGoalDisplayInfo = (goal: GoalV2) => {
    const interactions = getInteractionsForGoal(goal.id);
    const methods = getMethodsForGoal(goal.id);

    const interactingGoalNames = interactions
      .map((i) => {
        const g = data.goals.find((x) => x.id === i.interactingGoalId);
        return g?.name || '';
      })
      .filter(Boolean);

    const methodNames = methods.map((m) => m.methodId);

    return { interactingGoalNames, methodNames };
  };

  const handleAddGoal = (goalData: { name: string; unit?: string; category?: any }) => {
    addGoal(goalData);
    toast({ title: 'Goal added', description: `"${goalData.name}" has been created.` });
  };

  const handleDeleteGoal = () => {
    if (deleteConfirm) {
      deleteGoal(deleteConfirm.id);
      toast({ title: 'Goal deleted', description: `"${deleteConfirm.name}" has been removed.` });
      setDeleteConfirm(null);
    }
  };

  const handleExport = () => {
    const exportData = JSON.stringify(data, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'athleticism-database-v2.json';
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
          if (imported.goals && imported.interactions && imported.goalMethods) {
            localStorage.setItem('goals-database-v2', text);
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
                Unified goals with interactions and training methods
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search goals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
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
              Add Goal
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
                  <TableHead className="w-[30%]">Goal / Parameter</TableHead>
                  <TableHead className="w-[30%]">Interacting Goals</TableHead>
                  <TableHead className="w-[30%]">Associated Methods</TableHead>
                  <TableHead className="w-[10%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGoals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      {searchTerm
                        ? 'No goals match your search.'
                        : 'No goals yet. Click "Add Goal" to create one.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGoals.map((goal) => {
                    const { interactingGoalNames, methodNames } = getGoalDisplayInfo(goal);
                    const categoryLabel = GOAL_CATEGORIES.find((c) => c.value === goal.category)?.label;

                    return (
                      <TableRow key={goal.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{goal.name}</div>
                            <div className="flex gap-1 flex-wrap">
                              {goal.unit && (
                                <Badge variant="outline" className="text-xs">
                                  {goal.unit}
                                </Badge>
                              )}
                              {categoryLabel && (
                                <Badge variant="secondary" className="text-xs">
                                  {categoryLabel}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {interactingGoalNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {interactingGoalNames.slice(0, 3).map((name, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                              {interactingGoalNames.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{interactingGoalNames.length - 3} more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {methodNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {methodNames.slice(0, 2).map((name, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                              {methodNames.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{methodNames.length - 2} more
                                </Badge>
                              )}
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
                              onClick={() => setEditingGoal(goal)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(goal)}
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
      <AddGoalDialogV2
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddGoal}
      />

      {/* Edit Dialog */}
      {editingGoal && (
        <EditGoalDialogV2
          open={!!editingGoal}
          onOpenChange={(open) => !open && setEditingGoal(null)}
          goal={editingGoal}
          allGoals={data.goals}
          interactions={getInteractionsForGoal(editingGoal.id)}
          goalMethods={getMethodsForGoal(editingGoal.id)}
          toolboxEntries={toolboxData.entries}
          onUpdateGoal={(updates) => updateGoal(editingGoal.id, updates)}
          onAddInteraction={(interactingGoalId) => addInteraction(editingGoal.id, interactingGoalId)}
          onRemoveInteraction={removeInteraction}
          onAddMethod={(methodId) => addGoalMethod(editingGoal.id, methodId)}
          onUpdateMethod={updateGoalMethod}
          onRemoveMethod={removeGoalMethod}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This will also remove all
              associated interactions and methods. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGoal} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
