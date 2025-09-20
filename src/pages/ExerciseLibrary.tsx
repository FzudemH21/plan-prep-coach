import React, { useState, useMemo } from 'react';
import { ArrowLeft, Download, Upload, FileText, Users, Activity, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useExerciseData } from '@/hooks/useExerciseData';
import { FilterState, ExerciseEntry } from '@/types/exercises';
import EnhancedEditableTable from '@/components/shared/EnhancedEditableTable';

const ExerciseLibrary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    data, 
    columns,
    addEntry, 
    updateEntry, 
    deleteEntry, 
    importData, 
    exportData, 
    resetToDefaults,
    addColumn,
    updateColumn,
    deleteColumn
  } = useExerciseData();
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    columnFilters: {},
    sortColumn: null,
    sortDirection: 'asc'
  });

  // Filter and sort exercises
  const filteredExercises = useMemo(() => {
    let filtered = data.exercises;

    // Apply search filter
    if (filterState.search) {
      const searchLower = filterState.search.toLowerCase();
      filtered = filtered.filter(exercise =>
        Object.values(exercise).some(value => 
          value.toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply column filters (AND logic between columns, OR logic within columns)
    filtered = filtered.filter(exercise => {
      return Object.entries(filterState.columnFilters).every(([key, values]) => {
        if (!values || values.length === 0) return true;
        const exerciseValue = exercise[key as keyof ExerciseEntry];
        return values.some(value => 
          exerciseValue.toLowerCase().includes(value.toLowerCase())
        );
      });
    });

    // Apply sorting
    if (filterState.sortColumn) {
      filtered.sort((a, b) => {
        const aValue = a[filterState.sortColumn!];
        const bValue = b[filterState.sortColumn!];
        
        if (filterState.sortDirection === 'asc') {
          return aValue.localeCompare(bValue, 'de');
        } else {
          return bValue.localeCompare(aValue, 'de');
        }
      });
    }

    return filtered;
  }, [data.exercises, filterState]);

  // Statistics
  const stats = useMemo(() => {
    const total = data.exercises.length;
    const bodyRegions = data.exercises.reduce((acc, exercise) => {
      const region = exercise.akzentuierteKörperregion;
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const equipment = data.exercises.reduce((acc, exercise) => {
      const equip = exercise.artDesWiderstandes;
      acc[equip] = (acc[equip] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, bodyRegions, equipment };
  }, [data.exercises]);

  const handleAddExercise = () => {
    addEntry({
      übungsname: 'New Exercise',
      akzentuierteKörperregion: 'Unterkörper',
      dominantesBewegungsmuster: '-',
      forcesActingOnSpine: 'Shear',
      übungsausführung: 'dynamisch',
      trunkTrainingFramework: '',
      mainMovementPlane: 'Sagittal',
      level: '1',
      artDesWiderstandes: 'Körpergewicht',
      stand: 'bilateral',
      variationen: ''
    });
    
    toast({
      title: "Exercise Added",
      description: "New exercise has been added to your library."
    });
  };

  const handleExport = () => {
    try {
      const tsvData = exportData();
      const blob = new Blob([tsvData], { type: 'text/tab-separated-values' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exercise-library-${new Date().toISOString().split('T')[0]}.tsv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Resistance training exercise library exported successfully."
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export resistance training exercise library.",
        variant: "destructive"
      });
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        importData(content, importMode);
        toast({
          title: "Import Successful",
          description: `Exercise data ${importMode === 'replace' ? 'replaced' : 'appended'} successfully.`
        });
      } catch (error) {
        toast({
          title: "Import Failed", 
          description: "Failed to import exercise data.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleReset = () => {
    resetToDefaults();
    toast({
      title: "Reset Complete",
      description: "Resistance training exercise library has been reset to defaults."
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Header */}
      <div className="border-b bg-card">
        <div className="w-full max-w-none px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Templates
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Resistance Training Exercise</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your resistance training exercise database
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Import Mode Toggle */}
              <div className="flex items-center gap-2 text-sm">
                <Label htmlFor="import-mode">Import:</Label>
                <Switch
                  id="import-mode"
                  checked={importMode === 'replace'}
                  onCheckedChange={(checked) => setImportMode(checked ? 'replace' : 'append')}
                />
                <span className="text-muted-foreground">
                  {importMode === 'replace' ? 'Replace' : 'Append'}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".tsv,.csv,.txt"
                  onChange={handleImport}
                  className="hidden"
                  id="import-file"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById('import-file')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Statistics Cards */}
      <div className="w-full max-w-none px-4 py-3">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Total Exercises</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredExercises.length} shown
            </p>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Body Regions</p>
                <p className="text-lg font-bold">{Object.keys(stats.bodyRegions).length}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Top: {Object.entries(stats.bodyRegions).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
            </p>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Equipment Types</p>
                <p className="text-lg font-bold">{Object.keys(stats.equipment).length}</p>
              </div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Most: {Object.entries(stats.equipment).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
            </p>
          </Card>
        </div>

        {/* Table Container with Controlled Height */}
        <div className="max-h-[60vh] overflow-auto border rounded-lg bg-card">
          <EnhancedEditableTable
            data={filteredExercises}
            columns={columns}
            onUpdateEntry={updateEntry}
            onDeleteEntry={deleteEntry}
            onAddEntry={handleAddExercise}
            filterState={filterState}
            onFilterChange={setFilterState}
            columnManagement={{
              columns,
              onAddColumn: addColumn,
              onUpdateColumn: updateColumn,
              onDeleteColumn: deleteColumn
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ExerciseLibrary;