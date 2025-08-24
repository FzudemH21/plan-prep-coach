import React, { useState, useMemo } from 'react';
import { ArrowLeft, Download, Upload, FileText, Users, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useExerciseData } from '@/hooks/useExerciseData';
import { FilterState } from '@/types/exercises';
import EditableTable from '@/components/exercises/EditableTable';

const ExerciseLibrary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, addEntry, updateEntry, deleteEntry, importData, exportData } = useExerciseData();
  
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

    // Apply column filters
    Object.entries(filterState.columnFilters).forEach(([column, value]) => {
      if (value) {
        const filterLower = value.toLowerCase();
        filtered = filtered.filter(exercise =>
          exercise[column as keyof typeof exercise].toLowerCase().includes(filterLower)
        );
      }
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
        description: "Exercise library exported successfully."
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export exercise library.",
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
        importData(content);
        toast({
          title: "Import Successful",
          description: "Exercise data imported successfully."
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/templates')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Templates
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Exercise Library</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your resistance training exercise database
                </p>
              </div>
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
                onClick={() => document.getElementById('import-file')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Exercises</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {filteredExercises.length} shown after filtering
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Body Regions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.bodyRegions).length}</div>
              <p className="text-xs text-muted-foreground">
                Most common: {Object.entries(stats.bodyRegions).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipment Types</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.equipment).length}</div>
              <p className="text-xs text-muted-foreground">
                Most used: {Object.entries(stats.equipment).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Editable Table */}
        <EditableTable
          exercises={filteredExercises}
          onUpdateExercise={updateEntry}
          onDeleteExercise={deleteEntry}
          onAddExercise={handleAddExercise}
          filterState={filterState}
          onFilterChange={setFilterState}
        />
      </div>
    </div>
  );
};

export default ExerciseLibrary;