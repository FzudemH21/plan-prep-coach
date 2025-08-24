import React, { useState, useRef, useEffect } from 'react';
import { ExerciseEntry, FilterState, TableColumn } from '@/types/exercises';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronUp, ChevronDown, Plus, Trash2, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';

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
  const [showFilters, setShowFilters] = useState(false);

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

  const handleColumnFilter = (columnKey: string, value: string) => {
    onFilterChange({
      ...filterState,
      columnFilters: {
        ...filterState.columnFilters,
        [columnKey]: value
      }
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      search: '',
      columnFilters: {},
      sortColumn: null,
      sortDirection: 'asc'
    });
  };

  return (
    <div className="space-y-4">
      {/* Global Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={filterState.search}
            onChange={(e) => onFilterChange({ ...filterState, search: e.target.value })}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
          >
            Clear All
          </Button>
          <Button onClick={onAddExercise} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </div>
      </div>

      {/* Column Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {columns.slice(0, 8).map(column => (
              <div key={column.key} className="space-y-2">
                <label className="text-sm font-medium">{column.label}</label>
                <Input
                  placeholder={`Filter ${column.label.toLowerCase()}`}
                  value={filterState.columnFilters[column.key] || ''}
                  onChange={(e) => handleColumnFilter(column.key, e.target.value)}
                  className="h-8"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                {columns.map(column => (
                  <th 
                    key={column.key}
                    className="border-r p-3 text-left font-medium cursor-pointer hover:bg-muted transition-colors min-w-[150px]"
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{column.label}</span>
                      <div className="ml-2">
                        {filterState.sortColumn === column.key && (
                          filterState.sortDirection === 'asc' ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </th>
                ))}
                <th className="p-3 w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((exercise, index) => (
                <tr key={exercise.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/25'}>
                  {columns.map(column => (
                    <td key={column.key} className="border-r p-1 align-top">
                    <EditableCell
                      value={exercise[column.key]}
                      onChange={(value) => onUpdateExercise(exercise.id, { [column.key]: value } as Partial<ExerciseEntry>)}
                      column={column}
                    />
                    </td>
                  ))}
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteExercise(exercise.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
          No exercises found. Try adjusting your filters or add a new exercise.
        </div>
      )}
    </div>
  );
};

export default EditableTable;