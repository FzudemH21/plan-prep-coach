import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, ChevronDown, ChevronRight, AlertCircle, Settings2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolboxDatabase, ToolboxEntry } from '@/types/toolbox';
import { ParameterVisibilityOverrides } from './ParameterVisibilityPopover';
import { cn } from '@/lib/utils';

interface AdHocMethodSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMethodSelected: (
    methodId: string,
    categoryName: string | undefined,
    parameterVisibility: ParameterVisibilityOverrides,
    initialParameters: Record<string, string | number>
  ) => void;
  toolboxData: ToolboxDatabase;
  /** When true, renders an explicit overlay. Set to true when opening from inside another dialog. */
  needsExplicitOverlay?: boolean;
}

interface MethodInfo {
  id: string; // "Category - SubCategory" or just "Category"
  category: string;
  subCategory: string;
  parameters: ToolboxEntry[];
}

export function AdHocMethodSelectionDialog({
  isOpen,
  onClose,
  onMethodSelected,
  toolboxData,
  needsExplicitOverlay = false
}: AdHocMethodSelectionDialogProps) {
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [paramVisibility, setParamVisibility] = useState<Record<string, boolean>>({});

  // Build methods map from toolbox data
  const allMethods = useMemo((): MethodInfo[] => {
    const methodMap = new Map<string, MethodInfo>();
    
    toolboxData.entries.forEach(entry => {
      const methodId = entry.subCategory 
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      
      if (!methodMap.has(methodId)) {
        methodMap.set(methodId, {
          id: methodId,
          category: entry.category,
          subCategory: entry.subCategory || '',
          parameters: []
        });
      }
      methodMap.get(methodId)!.parameters.push(entry);
    });
    
    return Array.from(methodMap.values());
  }, [toolboxData]);

  // Group methods by category for display
  const methodsByCategory = useMemo(() => {
    const groups: Record<string, MethodInfo[]> = {};
    
    allMethods.forEach(method => {
      if (!groups[method.category]) {
        groups[method.category] = [];
      }
      groups[method.category].push(method);
    });
    
    return groups;
  }, [allMethods]);

  // Filter methods by search query
  const filteredMethodsByCategory = useMemo(() => {
    if (!searchQuery.trim()) return methodsByCategory;
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<string, MethodInfo[]> = {};
    
    Object.entries(methodsByCategory).forEach(([category, methods]) => {
      const matchingMethods = methods.filter(method =>
        method.id.toLowerCase().includes(query) ||
        method.category.toLowerCase().includes(query) ||
        method.subCategory.toLowerCase().includes(query)
      );
      
      if (matchingMethods.length > 0) {
        filtered[category] = matchingMethods;
      }
    });
    
    return filtered;
  }, [methodsByCategory, searchQuery]);

  // Get parameters for selected method
  const selectedMethodParams = useMemo(() => {
    if (!selectedMethodId) return [];
    
    const method = allMethods.find(m => m.id === selectedMethodId);
    if (!method) return [];
    
    return method.parameters.map(entry => ({
      id: entry.id,
      name: entry.parameterName,
      type: entry.parameterType,
      options: entry.options,
      isSetParameter: entry.isSetParameter || false,
      isFrequencyParameter: entry.isFrequencyParameter || false,
      showInGridByDefault: entry.showInGridByDefault ?? true,
      unit: entry.parameterType === 'quantitative' && entry.options.length > 0 
        ? entry.options[0] 
        : undefined
    }));
  }, [selectedMethodId, allMethods]);

  // Initialize parameter visibility when method changes
  useEffect(() => {
    if (selectedMethodParams.length > 0) {
      const initial: Record<string, boolean> = {};
      selectedMethodParams.forEach(p => {
        // Set parameter is ALWAYS visible
        if (p.isSetParameter) {
          initial[p.name] = true;
        } else if (!p.isFrequencyParameter) {
          // Non-frequency params use their default visibility
          initial[p.name] = p.showInGridByDefault;
        }
        // Frequency parameters are excluded entirely
      });
      setParamVisibility(initial);
    }
  }, [selectedMethodParams]);

  // Auto-expand categories on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const toExpand: Record<string, boolean> = {};
      Object.keys(filteredMethodsByCategory).forEach(cat => {
        toExpand[cat] = true;
      });
      setExpandedCategories(toExpand);
    }
  }, [searchQuery, filteredMethodsByCategory]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleParamVisibility = (paramName: string) => {
    setParamVisibility(prev => ({
      ...prev,
      [paramName]: !prev[paramName]
    }));
  };

  const generateInitialParameters = (): Record<string, string | number> => {
    const params: Record<string, string | number> = {};
    
    selectedMethodParams.forEach(p => {
      if (p.isFrequencyParameter) return; // Skip frequency
      
      if (p.isSetParameter) {
        params[p.name] = 3; // Default 3 sets
      } else {
        params[p.name] = ''; // Empty value for user to fill
      }
    });
    
    return params;
  };

  const handleConfirm = () => {
    if (!selectedMethodId) return;
    
    const method = allMethods.find(m => m.id === selectedMethodId);
    if (!method) return;
    
    // Build visibility overrides - only include non-default values
    const visibilityOverrides: ParameterVisibilityOverrides = {};
    selectedMethodParams.forEach(p => {
      if (p.isFrequencyParameter) return;
      
      const currentVisibility = paramVisibility[p.name] ?? p.showInGridByDefault;
      // Only store if different from default
      if (currentVisibility !== p.showInGridByDefault) {
        visibilityOverrides[p.name] = currentVisibility;
      }
    });
    
    const initialParams = generateInitialParameters();
    
    onMethodSelected(
      method.id,
      method.subCategory || undefined,
      visibilityOverrides,
      initialParams
    );
    
    // Reset state
    setSelectedMethodId('');
    setSearchQuery('');
    setParamVisibility({});
  };

  const handleCancel = () => {
    setSelectedMethodId('');
    setSearchQuery('');
    setParamVisibility({});
    onClose();
  };

  const visibleParamCount = Object.values(paramVisibility).filter(Boolean).length;
  const totalNonFrequencyParams = selectedMethodParams.filter(p => !p.isFrequencyParameter).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogPortal>
        {needsExplicitOverlay && <DialogOverlay className="z-[150]" />}
        <DialogContent className={cn(
          "max-w-3xl max-h-[85vh] flex flex-col",
          needsExplicitOverlay ? 'z-[151]' : ''
        )}>
          <DialogHeader>
            <DialogTitle>Select Training Method</DialogTitle>
            <DialogDescription>
              Choose a training method from your Training Toolbox and configure which parameters to display.
            </DialogDescription>
          </DialogHeader>

          {allMethods.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No training methods found. Please add methods to your Training Toolbox first.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
              {/* Left Panel: Method Selection */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search methods..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Method List */}
                <ScrollArea className="flex-1 border rounded-md">
                  <div className="p-2 space-y-1">
                    {Object.keys(filteredMethodsByCategory).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No methods found matching "{searchQuery}"
                      </div>
                    ) : (
                      Object.entries(filteredMethodsByCategory).map(([category, methods]) => (
                        <Collapsible
                          key={category}
                          open={expandedCategories[category]}
                          onOpenChange={() => toggleCategory(category)}
                        >
                          <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 text-sm font-medium hover:bg-accent rounded-md transition-colors">
                            {expandedCategories[category] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span>{category}</span>
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {methods.length}
                            </Badge>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-6 space-y-1 mt-1">
                              {methods.map(method => (
                                <button
                                  key={method.id}
                                  onClick={() => setSelectedMethodId(method.id)}
                                  className={cn(
                                    "w-full text-left p-2 rounded-md text-sm transition-colors",
                                    selectedMethodId === method.id
                                      ? "bg-primary text-primary-foreground"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  {method.subCategory || 'General'}
                                </button>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Right Panel: Parameter Configuration */}
              <div className="flex-1 flex flex-col min-h-0 border rounded-md">
                <div className="p-3 border-b bg-muted/50 flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Configure Parameters</span>
                  {selectedMethodId && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {visibleParamCount}/{totalNonFrequencyParams} shown
                    </Badge>
                  )}
                </div>
                
                <ScrollArea className="flex-1 p-3">
                  {!selectedMethodId ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                      <p>Select a method to configure parameters</p>
                    </div>
                  ) : selectedMethodParams.filter(p => !p.isFrequencyParameter).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                      <p>This method has no configurable parameters</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedMethodParams
                        .filter(p => !p.isFrequencyParameter)
                        .map(param => (
                          <div
                            key={param.id}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-md border",
                              param.isSetParameter 
                                ? "bg-primary/5 border-primary/20" 
                                : "hover:bg-accent/50"
                            )}
                          >
                            <Checkbox
                              id={`param-${param.id}`}
                              checked={paramVisibility[param.name] ?? param.showInGridByDefault}
                              onCheckedChange={() => toggleParamVisibility(param.name)}
                              disabled={param.isSetParameter}
                            />
                            <Label 
                              htmlFor={`param-${param.id}`} 
                              className={cn(
                                "flex-1 cursor-pointer text-sm",
                                param.isSetParameter && "font-medium"
                              )}
                            >
                              {param.name}
                              {param.unit && (
                                <span className="text-muted-foreground ml-1">[{param.unit}]</span>
                              )}
                            </Label>
                            {param.isSetParameter && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedMethodId ? (
                <span className="font-medium text-foreground">{selectedMethodId}</span>
              ) : (
                <span>No method selected</span>
              )}
            </div>
            <DialogFooter className="sm:space-x-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedMethodId}>
                Add Exercise
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
