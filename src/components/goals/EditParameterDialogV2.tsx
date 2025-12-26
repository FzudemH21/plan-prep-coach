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
import { Plus, X, ArrowUp, ArrowRight, ChevronDown } from 'lucide-react';
import { ParameterV2, ParameterInteraction, ParameterMethodV2, PARAMETER_CATEGORIES, INTERACTION_STRENGTHS, InteractionDirection, InteractionStrength } from '@/types/parametersV2';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EditParameterDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameter: ParameterV2;
  allParameters: ParameterV2[];
  allInteractions: ParameterInteraction[];
  allParameterMethods: ParameterMethodV2[];
  toolboxEntries: ToolboxEntry[];
  onUpdateParameter: (updates: Partial<ParameterV2>) => void;
  onAddInteraction: (sourceId: string, targetId: string, direction: InteractionDirection, strength: InteractionStrength) => void;
  onUpdateInteraction: (id: string, updates: Partial<ParameterInteraction>) => void;
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
  onUpdateInteraction,
  onRemoveInteraction,
  onAddMethod,
  onUpdateMethod,
  onRemoveMethod,
}: EditParameterDialogV2Props) {
  const [name, setName] = useState(parameter.name);
  const [unit, setUnit] = useState(parameter.unit || '');
  const [category, setCategory] = useState(parameter.category || '');
  
  // Popover states
  const [contributesToSearchOpen, setContributesToSearchOpen] = useState(false);
  const [improvedBySearchOpen, setImprovedBySearchOpen] = useState(false);
  const [methodSearchOpen, setMethodSearchOpen] = useState(false);
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  
  // Strength selection for new interactions
  const [newContributesToStrength, setNewContributesToStrength] = useState<InteractionStrength>('moderate');
  const [newImprovedByStrength, setNewImprovedByStrength] = useState<InteractionStrength>('moderate');
  
  // State for editing method rationale
  const [editingRationale, setEditingRationale] = useState<string | null>(null);
  const [rationaleValue, setRationaleValue] = useState('');

  // Get interactions where this parameter is the SOURCE (contributes to others)
  const contributesToInteractions = useMemo(() => 
    allInteractions.filter((i) => i.sourceParameterId === parameter.id && i.direction === 'contributes_to'),
    [allInteractions, parameter.id]
  );
  
  // Get interactions where this parameter is the TARGET (improved by others)
  const improvedByInteractions = useMemo(() => 
    allInteractions.filter((i) => i.targetParameterId === parameter.id && i.direction === 'contributes_to'),
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

  // Get available parameters for "Contributes To" (exclude self and already linked as target)
  const contributesToTargetIds = contributesToInteractions.map((i) => i.targetParameterId);
  const availableContributesToParameters = allParameters.filter(
    (p) => p.id !== parameter.id && !contributesToTargetIds.includes(p.id)
  );
  
  // Get available parameters for "Improved By" (exclude self and already linked as source)
  const improvedBySourceIds = improvedByInteractions.map((i) => i.sourceParameterId);
  const availableImprovedByParameters = allParameters.filter(
    (p) => p.id !== parameter.id && !improvedBySourceIds.includes(p.id)
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

  const handleAddContributesTo = (targetParameterId: string) => {
    onAddInteraction(parameter.id, targetParameterId, 'contributes_to', newContributesToStrength);
    setContributesToSearchOpen(false);
    setNewContributesToStrength('moderate');
  };

  const handleAddImprovedBy = (sourceParameterId: string) => {
    onAddInteraction(sourceParameterId, parameter.id, 'contributes_to', newImprovedByStrength);
    setImprovedBySearchOpen(false);
    setNewImprovedByStrength('moderate');
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

  const getStrengthIcon = (strength?: InteractionStrength) => {
    const strengthInfo = INTERACTION_STRENGTHS.find((s) => s.value === strength);
    if (!strengthInfo) return <ArrowUp className="h-3 w-3" />;
    
    switch (strength) {
      case 'strong':
        return <span className="text-xs font-bold">↑↑</span>;
      case 'moderate':
        return <ArrowUp className="h-3 w-3" />;
      case 'weak':
        return <ArrowRight className="h-3 w-3" />;
      default:
        return <ArrowUp className="h-3 w-3" />;
    }
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
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-0 bg-popover" align="start">
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
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-0 bg-popover" align="start">
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

            {/* Contributes To Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Contributes To
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This parameter helps improve these parameters
                  </p>
                </div>
                <Popover open={contributesToSearchOpen} onOpenChange={setContributesToSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" disabled={availableContributesToParameters.length === 0}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 bg-popover" align="end">
                    <div className="p-3 border-b">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Strength:</Label>
                        <Select
                          value={newContributesToStrength}
                          onValueChange={(v) => setNewContributesToStrength(v as InteractionStrength)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INTERACTION_STRENGTHS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.icon} {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Command>
                      <CommandInput placeholder="Search parameters..." />
                      <CommandList>
                        <CommandEmpty>No parameters found.</CommandEmpty>
                        <CommandGroup>
                          {availableContributesToParameters.map((p) => (
                            <CommandItem
                              key={p.id}
                              onSelect={() => handleAddContributesTo(p.id)}
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

              {contributesToInteractions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {contributesToInteractions.map((interaction) => {
                    const targetParameter = allParameters.find((p) => p.id === interaction.targetParameterId);
                    if (!targetParameter) return null;
                    return (
                      <Badge
                        key={interaction.id}
                        variant="secondary"
                        className="flex items-center gap-1 py-1 pr-1"
                      >
                        <span className="mr-1">{getStrengthIcon(interaction.strength)}</span>
                        {targetParameter.name}
                        <Select
                          value={interaction.strength || 'moderate'}
                          onValueChange={(v) => onUpdateInteraction(interaction.id, { strength: v as InteractionStrength })}
                        >
                          <SelectTrigger className="h-5 w-5 border-0 bg-transparent p-0 [&>svg]:hidden">
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </SelectTrigger>
                          <SelectContent>
                            {INTERACTION_STRENGTHS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.icon} {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  No parameters linked yet.
                </p>
              )}
            </div>

            <Separator />

            {/* Improved By Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Improved By
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    These parameters help improve this one (potential sub-goals)
                  </p>
                </div>
                <Popover open={improvedBySearchOpen} onOpenChange={setImprovedBySearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" disabled={availableImprovedByParameters.length === 0}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 bg-popover" align="end">
                    <div className="p-3 border-b">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Strength:</Label>
                        <Select
                          value={newImprovedByStrength}
                          onValueChange={(v) => setNewImprovedByStrength(v as InteractionStrength)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INTERACTION_STRENGTHS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.icon} {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Command>
                      <CommandInput placeholder="Search parameters..." />
                      <CommandList>
                        <CommandEmpty>No parameters found.</CommandEmpty>
                        <CommandGroup>
                          {availableImprovedByParameters.map((p) => (
                            <CommandItem
                              key={p.id}
                              onSelect={() => handleAddImprovedBy(p.id)}
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

              {improvedByInteractions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {improvedByInteractions.map((interaction) => {
                    const sourceParameter = allParameters.find((p) => p.id === interaction.sourceParameterId);
                    if (!sourceParameter) return null;
                    return (
                      <Badge
                        key={interaction.id}
                        variant="outline"
                        className="flex items-center gap-1 py-1 pr-1 bg-primary/5"
                      >
                        <span className="mr-1">{getStrengthIcon(interaction.strength)}</span>
                        {sourceParameter.name}
                        <Select
                          value={interaction.strength || 'moderate'}
                          onValueChange={(v) => onUpdateInteraction(interaction.id, { strength: v as InteractionStrength })}
                        >
                          <SelectTrigger className="h-5 w-5 border-0 bg-transparent p-0 [&>svg]:hidden">
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </SelectTrigger>
                          <SelectContent>
                            {INTERACTION_STRENGTHS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.icon} {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  No parameters linked yet.
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
                  <PopoverContent className="w-80 p-0 bg-popover" align="end">
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
