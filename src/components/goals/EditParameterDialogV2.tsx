import { useState, useEffect, useMemo } from 'react';
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
import { ParameterV2, ParameterInteraction, ParameterMethodV2, PARAMETER_CATEGORIES } from '@/types/parametersV2';
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

interface EditParameterDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameter: ParameterV2;
  allParameters: ParameterV2[];
  allInteractions: ParameterInteraction[];
  allParameterMethods: ParameterMethodV2[];
  toolboxEntries: ToolboxEntry[];
  onUpdateParameter: (updates: Partial<ParameterV2>) => void;
  onAddInteraction: (interactingParameterId: string) => void;
  onRemoveInteraction: (id: string) => void;
  onAddMethod: (methodId: string) => void;
  onUpdateMethod: (id: string, updates: Partial<ParameterMethodV2>) => void;
  onRemoveMethod: (id: string) => void;
}

const COMMON_UNITS = [
  'kg', 'lbs', 's', 'min', 'm', 'cm', 'km', 'mph', 'm/s', '%', 'reps', 'sets',
  'kg/bw', '%1RM', 'W', 'W/kg', 'bpm', 'kcal', 'RPE', 'RiR'
];

export function EditParameterDialogV2({
  open,
  onOpenChange,
  parameter,
  allParameters,
  allInteractions,
  allParameterMethods,
  toolboxEntries,
  onUpdateParameter,
  onAddInteraction,
  onRemoveInteraction,
  onAddMethod,
  onUpdateMethod,
  onRemoveMethod,
}: EditParameterDialogV2Props) {
  const [name, setName] = useState(parameter.name);
  const [unit, setUnit] = useState(parameter.unit || '');
  const [category, setCategory] = useState(parameter.category || '');
  const [parameterSearchOpen, setParameterSearchOpen] = useState(false);
  const [methodSearchOpen, setMethodSearchOpen] = useState(false);
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  
  // State for editing method rationale
  const [editingRationale, setEditingRationale] = useState<string | null>(null);
  const [rationaleValue, setRationaleValue] = useState('');

  // Filter interactions and methods for this parameter
  const interactions = useMemo(() => 
    allInteractions.filter((i) => i.parameterId === parameter.id),
    [allInteractions, parameter.id]
  );
  const parameterMethods = useMemo(() => 
    allParameterMethods.filter((m) => m.parameterId === parameter.id),
    [allParameterMethods, parameter.id]
  );

  useEffect(() => {
    setName(parameter.name);
    setUnit(parameter.unit || '');
    setCategory(parameter.category || '');
  }, [parameter]);

  // Get available parameters for interaction (exclude self and already linked)
  const interactingParameterIds = interactions.map((i) => i.interactingParameterId);
  const availableParameters = allParameters.filter(
    (p) => p.id !== parameter.id && !interactingParameterIds.includes(p.id)
  );

  // Get unique methods from toolbox with structured data
  const availableMethods = useMemo(() => {
    const methodMap = new Map<string, { category: string; subCategory: string }>();
    toolboxEntries.forEach((entry) => {
      const methodId = entry.subCategory 
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      if (!methodMap.has(methodId)) {
        methodMap.set(methodId, { 
          category: entry.category, 
          subCategory: entry.subCategory || '' 
        });
      }
    });
    return methodMap;
  }, [toolboxEntries]);

  // Filter out already added methods
  const addedMethodIds = parameterMethods.map((m) => m.methodId);
  const selectableMethods = useMemo(() => 
    Array.from(availableMethods.keys()).filter((m) => !addedMethodIds.includes(m)),
    [availableMethods, addedMethodIds]
  );

  // Group methods by category for hierarchical display
  const groupedMethods = useMemo(() => {
    const groups = new Map<string, { methodId: string; subCategory: string }[]>();
    
    selectableMethods.forEach((methodId) => {
      const methodInfo = availableMethods.get(methodId);
      if (methodInfo) {
        const { category, subCategory } = methodInfo;
        if (!groups.has(category)) {
          groups.set(category, []);
        }
        groups.get(category)!.push({ methodId, subCategory });
      }
    });
    
    // Sort groups alphabetically and sort items within each group
    const sortedGroups = new Map<string, { methodId: string; subCategory: string }[]>();
    Array.from(groups.keys()).sort().forEach((category) => {
      const items = groups.get(category)!;
      items.sort((a, b) => a.subCategory.localeCompare(b.subCategory));
      sortedGroups.set(category, items);
    });
    
    return sortedGroups;
  }, [selectableMethods, availableMethods]);

  const handleSave = () => {
    onUpdateParameter({
      name: name.trim(),
      unit: unit || undefined,
      category: category || undefined,
    });
  };

  const handleStartEditRationale = (methodId: string, currentRationale: string) => {
    setEditingRationale(methodId);
    setRationaleValue(currentRationale || '');
  };

  const handleSaveRationale = (methodDbId: string) => {
    onUpdateMethod(methodDbId, { rationale: rationaleValue });
    setEditingRationale(null);
    setRationaleValue('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col mx-4 sm:mx-auto">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit Parameter</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4">
          <div className="space-y-6 pb-6 px-1">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Basic Info
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Parameter Name</Label>
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSave}
                  />
                </div>

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
                                onClick={() => {
                                  setUnitSearchOpen(false);
                                  setTimeout(handleSave, 0);
                                }}
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
                                    setTimeout(handleSave, 0);
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
                                onClick={() => {
                                  setCategorySearchOpen(false);
                                  setTimeout(handleSave, 0);
                                }}
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
                                    setTimeout(handleSave, 0);
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
                    <Button variant="outline" size="sm" disabled={availableParameters.length === 0}>
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
                              onSelect={() => {
                                onAddInteraction(p.id);
                                setParameterSearchOpen(false);
                              }}
                            >
                              {p.name}
                              {p.unit && (
                                <span className="text-muted-foreground ml-1">({p.unit})</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {interactions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {interactions.map((interaction) => {
                    const linkedParameter = allParameters.find((p) => p.id === interaction.interactingParameterId);
                    if (!linkedParameter) return null;
                    return (
                      <Badge
                        key={interaction.id}
                        variant="secondary"
                        className="flex items-center gap-1 py-1"
                      >
                        {linkedParameter.name}
                        <button
                          onClick={() => onRemoveInteraction(interaction.id)}
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
                  No interacting parameters added yet.
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
                    <Button variant="outline" size="sm" disabled={selectableMethods.length === 0}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Method
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search methods..." />
                      <CommandList className="max-h-64">
                        <CommandEmpty>No methods found.</CommandEmpty>
                        {Array.from(groupedMethods.entries()).map(([cat, methods]) => {
                          const isSingleMethod = methods.length === 1 && methods[0].subCategory === '';
                          
                          if (isSingleMethod) {
                            return (
                              <CommandItem
                                key={cat}
                                onSelect={() => {
                                  onAddMethod(methods[0].methodId);
                                  setMethodSearchOpen(false);
                                }}
                                className="font-semibold text-sm px-2 py-1.5"
                              >
                                {cat}
                              </CommandItem>
                            );
                          }
                          
                          return (
                            <CommandGroup 
                              key={cat} 
                              heading={cat}
                              className="[&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:px-2"
                            >
                              {methods.map(({ methodId, subCategory }) => (
                                <CommandItem
                                  key={methodId}
                                  onSelect={() => {
                                    onAddMethod(methodId);
                                    setMethodSearchOpen(false);
                                  }}
                                  className="pl-6 text-muted-foreground"
                                >
                                  {subCategory}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {parameterMethods.length > 0 ? (
                <div className="space-y-2">
                  {parameterMethods.map((method) => (
                    <div
                      key={method.id}
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
                          onClick={() => onRemoveMethod(method.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Rationale section */}
                      {editingRationale === method.id ? (
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
                              onClick={() => handleSaveRationale(method.id)}
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
                              onClick={() => handleStartEditRationale(method.id, method.rationale || '')}
                            >
                              {method.rationale}
                            </p>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleStartEditRationale(method.id, '')}
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
                  No methods associated yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
