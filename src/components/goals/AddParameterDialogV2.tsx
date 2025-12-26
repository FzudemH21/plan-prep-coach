import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, X } from 'lucide-react';
import { ParameterV2, PARAMETER_CATEGORIES } from '@/types/parametersV2';
import { ToolboxEntry } from '@/types/toolbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface PendingMethod {
  methodId: string;
  rationale?: string;
}

interface AddParameterDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allParameters: ParameterV2[];
  toolboxEntries: ToolboxEntry[];
  onAdd: (parameter: {
    name: string;
    unit?: string;
    category?: string;
    interactions: string[];
    methods: PendingMethod[];
  }) => void;
}

export function AddParameterDialogV2({
  open,
  onOpenChange,
  allParameters,
  toolboxEntries,
  onAdd,
}: AddParameterDialogV2Props) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [pendingInteractions, setPendingInteractions] = useState<string[]>([]);
  const [pendingMethods, setPendingMethods] = useState<PendingMethod[]>([]);
  const [parameterSearchOpen, setParameterSearchOpen] = useState(false);
  const [methodSearchOpen, setMethodSearchOpen] = useState(false);
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  
  // State for editing method rationale
  const [editingRationale, setEditingRationale] = useState<string | null>(null);
  const [rationaleValue, setRationaleValue] = useState('');

  const COMMON_UNITS = [
    'kg', 'lbs', 's', 'min', 'm', 'cm', 'km', 'mph', 'm/s', '%', 'reps', 'sets',
    'kg/bw', '%1RM', 'W', 'W/kg', 'bpm', 'kcal', 'RPE', 'RiR'
  ];

  // Get available parameters (exclude already selected)
  const availableParameters = allParameters.filter(
    (p) => !pendingInteractions.includes(p.id)
  );

  // Get unique methods from toolbox
  const availableMethods = useMemo(() => {
    const methodMap = new Map<string, string>();
    toolboxEntries.forEach((entry) => {
      const methodId = entry.subCategory 
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      if (!methodMap.has(methodId)) {
        methodMap.set(methodId, methodId);
      }
    });
    return Array.from(methodMap.keys()).sort();
  }, [toolboxEntries]);

  // Filter out already added methods
  const addedMethodIds = pendingMethods.map((m) => m.methodId);
  const selectableMethods = availableMethods.filter(
    (m) => !addedMethodIds.includes(m)
  );

  const handleAddInteraction = (parameterId: string) => {
    setPendingInteractions([...pendingInteractions, parameterId]);
    setParameterSearchOpen(false);
  };

  const handleRemoveInteraction = (parameterId: string) => {
    setPendingInteractions(pendingInteractions.filter((id) => id !== parameterId));
  };

  const handleAddMethod = (methodId: string) => {
    setPendingMethods([
      ...pendingMethods,
      { methodId, rationale: '' },
    ]);
    setMethodSearchOpen(false);
  };

  const handleRemoveMethod = (methodId: string) => {
    setPendingMethods(pendingMethods.filter((m) => m.methodId !== methodId));
  };

  const handleStartEditRationale = (methodId: string, currentRationale: string) => {
    setEditingRationale(methodId);
    setRationaleValue(currentRationale || '');
  };

  const handleSaveRationale = (methodId: string) => {
    setPendingMethods(
      pendingMethods.map((m) =>
        m.methodId === methodId
          ? { ...m, rationale: rationaleValue }
          : m
      )
    );
    setEditingRationale(null);
    setRationaleValue('');
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      unit: unit || undefined,
      category: category || undefined,
      interactions: pendingInteractions,
      methods: pendingMethods,
    });

    // Reset form
    setName('');
    setUnit('');
    setCategory('');
    setPendingInteractions([]);
    setPendingMethods([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    setName('');
    setUnit('');
    setCategory('');
    setPendingInteractions([]);
    setPendingMethods([]);
    setEditingRationale(null);
    setRationaleValue('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col mx-4 sm:mx-auto">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add New Parameter</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4">
          <div className="space-y-6 pb-6 px-1">
            {/* Parameter Name */}
            <div className="space-y-2">
              <Label htmlFor="parameter-name">Parameter Name *</Label>
              <Input
                id="parameter-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 1RM Front Squat, 100m Sprint Time"
                autoFocus
              />
            </div>

            {/* Unit & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Popover open={unitSearchOpen} onOpenChange={setUnitSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={unitSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {unit || "Select unit..."}
                      <span className="ml-2 h-4 w-4 shrink-0 opacity-50">▼</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search or type..." 
                        onValueChange={(search) => {
                          if (search && !COMMON_UNITS.includes(search)) {
                            setUnit(search);
                          }
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <button
                            className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                            onClick={() => setUnitSearchOpen(false)}
                          >
                            Use "{unit}" as custom unit
                          </button>
                        </CommandEmpty>
                        <CommandGroup>
                          {COMMON_UNITS.map((u) => (
                            <CommandItem
                              key={u}
                              onSelect={() => {
                                setUnit(u);
                                setUnitSearchOpen(false);
                              }}
                            >
                              {u}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Popover open={categorySearchOpen} onOpenChange={setCategorySearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categorySearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {PARAMETER_CATEGORIES.find((c) => c.value === category)?.label || category || "Select category..."}
                      <span className="ml-2 h-4 w-4 shrink-0 opacity-50">▼</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search or type..." 
                        onValueChange={(search) => {
                          const predefined = PARAMETER_CATEGORIES.find((c) => 
                            c.label.toLowerCase() === search.toLowerCase() || 
                            c.value === search.toLowerCase()
                          );
                          if (!predefined && search) {
                            setCategory(search);
                          }
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <button
                            className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                            onClick={() => setCategorySearchOpen(false)}
                          >
                            Use "{category}" as custom category
                          </button>
                        </CommandEmpty>
                        <CommandGroup>
                          {PARAMETER_CATEGORIES.map((cat) => (
                            <CommandItem
                              key={cat.value}
                              onSelect={() => {
                                setCategory(cat.value);
                                setCategorySearchOpen(false);
                              }}
                            >
                              {cat.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            {/* Interacting Parameters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Interacting Parameters
                </h3>
                <Popover open={parameterSearchOpen} onOpenChange={setParameterSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={availableParameters.length === 0}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search parameters..." />
                      <CommandList>
                        <CommandEmpty>No parameters found.</CommandEmpty>
                        <CommandGroup>
                          {availableParameters.map((p) => (
                            <CommandItem
                              key={p.id}
                              onSelect={() => handleAddInteraction(p.id)}
                            >
                              {p.name}
                              {p.unit && (
                                <span className="text-muted-foreground ml-1">
                                  ({p.unit})
                                </span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {pendingInteractions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pendingInteractions.map((parameterId) => {
                    const parameter = allParameters.find((p) => p.id === parameterId);
                    if (!parameter) return null;
                    return (
                      <Badge
                        key={parameterId}
                        variant="secondary"
                        className="flex items-center gap-1 py-1"
                      >
                        {parameter.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveInteraction(parameterId)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No interacting parameters selected. Add parameters that influence or are
                  influenced by this parameter.
                </p>
              )}
            </div>

            <Separator />

            {/* Associated Methods */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Associated Methods
                </h3>
                <Popover open={methodSearchOpen} onOpenChange={setMethodSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectableMethods.length === 0}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Method
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search methods..." />
                      <CommandList>
                        <CommandEmpty>No methods found.</CommandEmpty>
                        <CommandGroup>
                          {selectableMethods.map((methodId) => (
                            <CommandItem
                              key={methodId}
                              onSelect={() => handleAddMethod(methodId)}
                            >
                              {methodId}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {pendingMethods.length > 0 ? (
                <div className="space-y-2">
                  {pendingMethods.map((method) => (
                    <div
                      key={method.methodId}
                      className="border rounded-lg p-3 bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate flex-1 min-w-0">
                          {method.methodId}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive ml-2"
                          onClick={() => handleRemoveMethod(method.methodId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Rationale section */}
                      {editingRationale === method.methodId ? (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={rationaleValue}
                            onChange={(e) => setRationaleValue(e.target.value)}
                            placeholder="Why does this method improve this parameter?"
                            className="text-sm min-h-[60px]"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveRationale(method.methodId)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingRationale(null);
                                setRationaleValue('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          {method.rationale ? (
                            <p 
                              className="text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                              onClick={() => handleStartEditRationale(method.methodId, method.rationale || '')}
                            >
                              {method.rationale}
                            </p>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleStartEditRationale(method.methodId, '')}
                            >
                              + Add rationale
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No methods associated. Add training methods that can improve this parameter.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Add Parameter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
