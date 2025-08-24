import React, { useState } from "react";
import { PlyometricsEntry, PlyometricsFilterState, PlyometricsTableColumn } from "../../types/plyometrics";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, Edit2, Save, X, Trash2 } from "lucide-react";
import { PlyometricsColumnFilter } from "./PlyometricsColumnFilter";

interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  type: 'text' | 'multiline' | 'select';
  options?: string[];
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, type, options }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== 'multiline') {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        className="cursor-pointer hover:bg-muted/50 p-1 rounded min-h-[2rem] flex items-center group"
      >
        <span className="flex-1">{value || '-'}</span>
        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 ml-1" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {type === 'multiline' ? (
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[4rem] text-sm"
          autoFocus
        />
      ) : type === 'select' && options ? (
        <Select value={editValue} onValueChange={setEditValue}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm"
          autoFocus
        />
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleSave}
        className="h-8 w-8 p-0"
      >
        <Save className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCancel}
        className="h-8 w-8 p-0"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

interface EditablePlyometricsTableProps {
  exercises: PlyometricsEntry[];
  onUpdateExercise: (id: string, exercise: Partial<PlyometricsEntry>) => void;
  onDeleteExercise: (id: string) => void;
  filterState: PlyometricsFilterState;
  onFilterChange: (filters: Partial<PlyometricsFilterState>) => void;
}

const EditablePlyometricsTable: React.FC<EditablePlyometricsTableProps> = ({
  exercises,
  onUpdateExercise,
  onDeleteExercise,
  filterState,
  onFilterChange,
}) => {
  const columns: PlyometricsTableColumn[] = [
    { key: 'übung', label: 'Übung', type: 'text' },
    { 
      key: 'intensität', 
      label: 'Intensität', 
      type: 'select',
      options: ['Extensive', 'Intensive', 'Extensive/Intensive']
    },
    { 
      key: 'tier', 
      label: 'Tier', 
      type: 'select',
      options: ['Elastic', 'Deep', 'Reactive', 'Frog', 'Gazelle', 'Tiger', 'Deep/Reactive', 'Reactive/Gazelle']
    },
    { 
      key: 'dauerDVZ', 
      label: 'Dauer DVZ', 
      type: 'select',
      options: ['kurz', 'lang', 'kurz/lang']
    },
    { 
      key: 'fokusrichtung', 
      label: 'Fokusrichtung', 
      type: 'select',
      options: ['Horizontal', 'Vertikal', 'Lateral', 'Multidirektional', 'Horizontal/Vertikal']
    },
    { 
      key: 'bewegungsart', 
      label: 'Bewegungsart', 
      type: 'select',
      options: ['zyklisch', 'azyklisch']
    },
    { 
      key: 'modus', 
      label: 'Modus', 
      type: 'select',
      options: ['Alternating', 'Double Leg', 'Single Leg', 'Double Leg/Single Leg', 'Single Leg ']
    },
    { 
      key: 'emphasis', 
      label: 'Emphasis', 
      type: 'select',
      options: ['Achilles/Hip', 'Knee/Hip', 'Achilles/Knee/Hip', 'Hip', 'Achilles/Knee', 'Knee', 'Achilles']
    },
    { 
      key: 'übungsgruppe', 
      label: 'Übungsgruppe', 
      type: 'select',
      options: ['Bounding', 'Skipping', 'Landing', 'Sonstiges', 'Deep Bouncing', 'Hopping', 'Max Jump', 'Pogos', 'Bouncing']
    },
    { key: 'kommentar', label: 'Kommentar', type: 'multiline' },
  ];

  const handleSort = (column: keyof PlyometricsEntry) => {
    if (filterState.sortColumn === column) {
      onFilterChange({
        sortDirection: filterState.sortDirection === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onFilterChange({
        sortColumn: column,
        sortDirection: 'asc',
      });
    }
  };

  const getSortIcon = (column: keyof PlyometricsEntry) => {
    if (filterState.sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return filterState.sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <Input
          placeholder="Suche in allen Feldern..."
          value={filterState.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg overflow-x-auto overflow-y-auto" style={{scrollbarWidth: 'thin'}}>
        <div className="min-w-[1400px]">
          <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {columns.map((column) => (
                <TableHead 
                  key={column.key} 
                  className="font-medium bg-muted/50 min-w-[150px]"
                >
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort(column.key)}
                      className="justify-between h-auto p-1 font-medium hover:bg-muted"
                    >
                      {column.label}
                      {getSortIcon(column.key)}
                    </Button>
                    <PlyometricsColumnFilter
                      column={column}
                      allData={exercises}
                      selectedValues={filterState.columnFilters[column.key] || []}
                      onSelectionChange={(values) => onFilterChange({
                        columnFilters: {
                          ...filterState.columnFilters,
                          [column.key]: values
                        }
                      })}
                    />
                  </div>
                </TableHead>
              ))}
              <TableHead className="font-medium bg-muted/50 w-[60px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercises.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                  Keine Übungen gefunden
                </TableCell>
              </TableRow>
            ) : (
              exercises.map((exercise) => (
                <TableRow key={exercise.id} className="hover:bg-muted/50">
                  {columns.map((column) => (
                    <TableCell key={column.key} className="align-top">
                      <EditableCell
                        value={exercise[column.key]}
                        onSave={(value) => onUpdateExercise(exercise.id, { [column.key]: value })}
                        type={column.type}
                        options={column.options}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="align-top">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteExercise(exercise.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
};

export default EditablePlyometricsTable;