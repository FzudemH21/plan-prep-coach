import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, RotateCcw, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "../hooks/use-toast";
import { usePlyometricsData } from "../hooks/usePlyometricsData";
import { PlyometricsFilterState } from "../types/plyometrics";
import EnhancedEditableTable from "../components/shared/EnhancedEditableTable";

export default function PlyometricsLibrary() {
  const navigate = useNavigate();
  const { 
    data, 
    isLoading, 
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
  } = usePlyometricsData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  const [filterState, setFilterState] = useState<PlyometricsFilterState>({
    search: '',
    columnFilters: {},
    sortColumn: null,
    sortDirection: 'asc'
  });

  const filteredExercises = useMemo(() => {
    let filtered = [...data.exercises];

    // Global search
    if (filterState.search) {
      const searchLower = filterState.search.toLowerCase();
      filtered = filtered.filter(exercise =>
        Object.values(exercise).some(value =>
          value.toLowerCase().includes(searchLower)
        )
      );
    }

    // Column filters
    Object.entries(filterState.columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(exercise =>
          values.some(value => exercise[column as keyof typeof exercise].toLowerCase().includes(value.toLowerCase()))
        );
      }
    });

    // Sorting
    if (filterState.sortColumn) {
      filtered.sort((a, b) => {
        const aValue = a[filterState.sortColumn!];
        const bValue = b[filterState.sortColumn!];
        
        // Handle undefined/null values and convert to strings for comparison
        const aStr = (aValue ?? '').toString();
        const bStr = (bValue ?? '').toString();
        
        const comparison = aStr.localeCompare(bStr);
        return filterState.sortDirection === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default alphabetical sorting when no specific sort is applied
      filtered.sort((a, b) => a.übung.localeCompare(b.übung));
    }

    return filtered;
  }, [data.exercises, filterState]);

  const stats = useMemo(() => {
    const totalExercises = data.exercises.length;
    
    const intensityGroups = data.exercises.reduce((acc, exercise) => {
      acc[exercise.intensität] = (acc[exercise.intensität] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tierGroups = data.exercises.reduce((acc, exercise) => {
      acc[exercise.tier] = (acc[exercise.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExercises,
      intensityGroups,
      tierGroups
    };
  }, [data.exercises]);

  const handleAddExercise = () => {
    addEntry({
      übung: "Neue Übung",
      intensität: "Extensive",
      tier: "Elastic",
      dauerDVZ: "kurz",
      fokusrichtung: "Horizontal",
      bewegungsart: "zyklisch",
      modus: "Alternating",
      emphasis: "Knee/Hip",
      übungsgruppe: "Bounding",
      kommentar: ""
    });
    toast({
      title: "Übung hinzugefügt",
      description: "Eine neue Übung wurde zur Bibliothek hinzugefügt.",
    });
  };

  const handleExport = () => {
    const tsvContent = exportData();
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plyometrics-library-${new Date().toISOString().split('T')[0]}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export erfolgreich",
      description: "Die Plyometrics-Bibliothek wurde als TSV-Datei exportiert.",
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = importData(content, importMode);

      if (result.success) {
        toast({
          title: "Import erfolgreich",
          description: `${result.count} Übungen wurden ${importMode === 'replace' ? 'ersetzt' : 'hinzugefügt'}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Import-Fehler",
          description: result.error || "Unbekannter Fehler beim Import.",
        });
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (window.confirm("Sind Sie sicher, dass Sie die Plyometrics-Bibliothek auf die Standardwerte zurücksetzen möchten? Alle Änderungen gehen verloren.")) {
      resetToDefaults();
      toast({
        title: "Zurückgesetzt",
        description: "Die Plyometrics-Bibliothek wurde auf die Standardwerte zurückgesetzt.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div>Lädt...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none py-8 space-y-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/templates")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Templates
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Plyometrics Library</h1>
            <p className="text-muted-foreground">
              Verwalten und bearbeiten Sie Ihre Plyometrics-Übungen
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={importMode} onValueChange={(value: 'append' | 'replace') => setImportMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="append">Anhängen</SelectItem>
              <SelectItem value="replace">Ersetzen</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          
          <Button
            onClick={handleAddExercise}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neue Übung
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".tsv,.txt"
        onChange={handleImport}
        className="hidden"
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Gesamt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExercises}</div>
            <p className="text-sm text-muted-foreground">Übungen</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Intensität</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(stats.intensityGroups).map(([intensity, count]) => (
                <div key={intensity} className="flex justify-between text-sm">
                  <span>{intensity}</span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(stats.tierGroups).slice(0, 4).map(([tier, count]) => (
                <div key={tier} className="flex justify-between text-sm">
                  <span>{tier}</span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </div>
              ))}
              {Object.keys(stats.tierGroups).length > 4 && (
                <div className="text-xs text-muted-foreground">
                  +{Object.keys(stats.tierGroups).length - 4} weitere
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Gefiltert</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredExercises.length}</div>
            <p className="text-sm text-muted-foreground">
              von {stats.totalExercises} angezeigt
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Plyometrics-Übungen</CardTitle>
          <CardDescription>
            Klicken Sie auf eine Zelle, um sie zu bearbeiten. Verwenden Sie die Filter, um bestimmte Übungen zu finden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedEditableTable
            data={filteredExercises}
            columns={columns}
            onUpdateEntry={updateEntry}
            onDeleteEntry={deleteEntry}
            onAddEntry={handleAddExercise}
            filterState={filterState}
            onFilterChange={(changes) => setFilterState(prev => ({ ...prev, ...changes }))}
            columnManagement={{
              columns,
              onAddColumn: addColumn,
              onUpdateColumn: updateColumn,
              onDeleteColumn: deleteColumn
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}