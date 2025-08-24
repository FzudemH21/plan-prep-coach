import React, { useState, useRef, useEffect } from 'react';
import { ExerciseEntry, FilterState, TableColumn } from '@/types/exercises';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronUp, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ColumnFilter } from './ColumnFilter';

interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
  column: TableColumn;
  onBlur?: () => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onChange, column, onBlur }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    onChange(localValue);
    setIsEditing(false);
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (column.type === 'multiline') {
      return (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="min-h-[80px] resize-none"
        />
      );
    }

    if (column.type === 'select' && column.options) {
      return (
        <Select value={localValue} onValueChange={(value) => { setLocalValue(value); onChange(value); setIsEditing(false); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {column.options.map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <div 
      onClick={handleEdit}
      className="min-h-[40px] p-2 cursor-pointer hover:bg-muted/50 transition-colors border-transparent border rounded"
    >
      {value || <span className="text-muted-foreground italic">Click to edit</span>}
    </div>
  );
};

interface EditableTableProps {
  exercises: ExerciseEntry[];
  onUpdateExercise: (id: string, updates: Partial<ExerciseEntry>) => void;
  onDeleteExercise: (id: string) => void;
  onAddExercise: () => void;
  filterState: FilterState;
  onFilterChange: (filterState: FilterState) => void;
}

const EditableTable: React.FC<EditableTableProps> = ({
  exercises,
  onUpdateExercise,
  onDeleteExercise,
  onAddExercise,
  filterState,
  onFilterChange
}) => {
  const columns: TableColumn[] = [
    { key: 'übungsname', label: 'Übungsname', type: 'text' },
    { key: 'akzentuierteKörperregion', label: 'Akzentuierte Körperregion', type: 'select', options: ['Unterkörper', 'Oberkörper', 'Ganzkörper', 'Rumpf', 'Schulter'] },
    { key: 'dominantesBewegungsmuster', label: 'Dominantes Bewegungsmuster', type: 'select', options: ['Hinge', 'Squat', 'Vertical Pull', 'Vertical Push', 'Horizontal Pull', 'Horizontal Push', '-', 'x'] },
    { key: 'forcesActingOnSpine', label: 'Forces Acting on Spine', type: 'select', options: ['Compression', 'Shear', 'Distraction', 'Rotation', 'Torque', 'Multi', 'Shear/Compression', 'Shear/Rotation', 'Shear/Distraction'] },
    { key: 'übungsausführung', label: 'Übungsausführung', type: 'select', options: ['isometrisch', 'dynamisch', 'ballistisch', 'quasi-isometrisch'] },
    { key: 'trunkTrainingFramework', label: 'Trunk Training Framework', type: 'text' },
    { key: 'mainMovementPlane', label: 'Main Movement Plane', type: 'select', options: ['Sagittal', 'Frontal', 'Transversal', 'Sagittal/Frontal', 'Sagittal/Transversal', 'Frontal/Transversal'] },
    { key: 'level', label: 'Level', type: 'text' },
    { key: 'artDesWiderstandes', label: 'Art des Widerstandes', type: 'select', options: ['Körpergewicht', 'Kurzhantel', 'Langhantel', 'Kettlebell', 'Kabelzug', 'Maschine', 'Medizinball', 'Sonstiges', 'Partner', 'Prowler', 'Safety Squat Bar', 'Trap Bar'] },
    { key: 'stand', label: 'Stand', type: 'select', options: ['bilateral', 'unilateral', 'x', 'sitting', 'liegend', 'kneeling', 'half-kneeling', 'staggered', 'prone', 'supine', 'gehend', 'quadruped', 'unimanual', 'bimanual'] },
    { key: 'variationen', label: 'Variationen', type: 'multiline' }
  ];

  const handleSort = (columnKey: keyof ExerciseEntry) => {
    const newDirection = filterState.sortColumn === columnKey && filterState.sortDirection === 'asc' ? 'desc' : 'asc';
    onFilterChange({
      ...filterState,
      sortColumn: columnKey,
      sortDirection: newDirection
    });
  };

  const handleColumnFilter = (columnKey: keyof ExerciseEntry, values: string[]) => {
    const newColumnFilters = { ...filterState.columnFilters };
    if (values.length === 0) {
      delete newColumnFilters[columnKey];
    } else {
      newColumnFilters[columnKey] = values;
    }
    onFilterChange({
      ...filterState,
      columnFilters: newColumnFilters,
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      ...filterState,
      search: '',
      columnFilters: {},
    });
  };

  const hasActiveFilters = filterState.search || Object.keys(filterState.columnFilters).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Globale Suche..."
            value={filterState.search}
            onChange={(e) => onFilterChange({ ...filterState, search: e.target.value })}
            className="h-8"
          />
        </div>
        
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Alle Filter zurücksetzen
          </Button>
        )}
        
        <Button onClick={onAddExercise} size="sm" className="ml-auto">
          <Plus className="h-4 w-4 mr-2" />
          Übung hinzufügen
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-2 text-left font-medium text-muted-foreground border-b border-border"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort(column.key)}
                      >
                        <span>{column.label}</span>
                        {filterState.sortColumn === column.key && (
                          filterState.sortDirection === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        )}
                      </div>
                      <ColumnFilter
                        column={column}
                        allData={exercises}
                        selectedValues={filterState.columnFilters[column.key] || []}
                        onSelectionChange={(values) => handleColumnFilter(column.key, values)}
                      />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-2 text-left font-medium text-muted-foreground border-b border-border w-16">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((exercise, index) => (
                <tr key={exercise.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/25 hover:bg-muted/40'}>
                  {columns.map(column => (
                    <td key={column.key} className="border-r border-border p-1 align-top min-w-[150px]">
                      <EditableCell
                        value={exercise[column.key]}
                        onChange={(value) => onUpdateExercise(exercise.id, { [column.key]: value } as Partial<ExerciseEntry>)}
                        column={column}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteExercise(exercise.id)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {exercises.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium mb-2">Keine Übungen gefunden</p>
          <p className="text-sm">Passen Sie Ihre Filter an oder fügen Sie eine neue Übung hinzu.</p>
        </div>
      )}
    </div>
  );
};

export default EditableTable;