import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AvailableMethod {
  id: string; // Full key like "methodId::categoryName" or just "methodId"
  methodId: string;
  categoryName?: string;
}

interface MethodSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMethodSelected: (methodId: string, categoryName?: string) => void;
  availableMethods: AvailableMethod[];
  mesocycleId: string;
  microcycleIndex: number;
  sessionIndex: number;
  /** When true, renders an explicit overlay. Set to true when opening from inside another dialog. */
  needsExplicitOverlay?: boolean;
}

export function MethodSelectionDialog({
  isOpen,
  onClose,
  onMethodSelected,
  availableMethods,
  mesocycleId,
  microcycleIndex,
  sessionIndex,
  needsExplicitOverlay = false
}: MethodSelectionDialogProps) {
  const [selectedMethodKey, setSelectedMethodKey] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Prepare methods for display - the methodId is already the full descriptive name
  const enrichedMethods = useMemo(() => {
    return availableMethods.map(method => ({
      ...method,
      displayName: method.methodId,
      category: method.categoryName || 'Main Work'
    }));
  }, [availableMethods]);

  // Filter methods by search query
  const filteredMethods = useMemo(() => {
    if (!searchQuery.trim()) return enrichedMethods;
    
    const query = searchQuery.toLowerCase();
    return enrichedMethods.filter(method =>
      method.displayName.toLowerCase().includes(query) ||
      method.category.toLowerCase().includes(query)
    );
  }, [enrichedMethods, searchQuery]);

  // Group methods by training method (methodId) first, with categories as sub-items
  const groupedMethods = useMemo(() => {
    const groups: Record<string, typeof enrichedMethods> = {};
    filteredMethods.forEach(method => {
      const methodName = method.methodId; // Group by training method
      if (!groups[methodName]) groups[methodName] = [];
      groups[methodName].push(method);
    });
    return groups;
  }, [filteredMethods]);

  const handleConfirm = () => {
    if (!selectedMethodKey) return;
    
    const selected = enrichedMethods.find(m => m.id === selectedMethodKey);
    if (!selected) return;
    
    onMethodSelected(selected.methodId, selected.categoryName);
    setSelectedMethodKey('');
    setSearchQuery('');
  };

  const handleCancel = () => {
    setSelectedMethodKey('');
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogPortal>
        {needsExplicitOverlay && <DialogOverlay className="z-[150]" />}
        <DialogContent className={`max-w-2xl max-h-[80vh] flex flex-col ${needsExplicitOverlay ? 'z-[151]' : ''}`}>
        <DialogHeader>
          <DialogTitle>Select Training Method</DialogTitle>
          <DialogDescription>
            Choose a training method for the exercise(s). Parameters will be applied based on your Method Periodization settings.
          </DialogDescription>
        </DialogHeader>

        {availableMethods.length === 0 ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No training methods configured for this session. Please configure Method Periodization first.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search methods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Method List */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6">
                {filteredMethods.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No methods found matching "{searchQuery}"
                  </div>
                ) : (
                  <RadioGroup value={selectedMethodKey} onValueChange={setSelectedMethodKey}>
                    {Object.entries(groupedMethods).map(([trainingMethod, methods]) => (
                      <div key={trainingMethod} className="space-y-2">
                        <h3 className="font-semibold text-sm text-foreground uppercase tracking-wide">
                          {trainingMethod}
                        </h3>
                        <div className="space-y-2 ml-4">
                          {methods.map(method => (
                            <div
                              key={method.id}
                              className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                selectedMethodKey === method.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
                              }`}
                              onClick={() => setSelectedMethodKey(method.id)}
                            >
                              <RadioGroupItem value={method.id} id={method.id} className="mt-0.5" />
                              <div className="flex-1">
                                <Label htmlFor={method.id} className="font-medium cursor-pointer text-sm">
                                  {method.categoryName || 'All Exercises'}
                                </Label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            </ScrollArea>

            {/* Footer with count and actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {filteredMethods.length} {filteredMethods.length === 1 ? 'method' : 'methods'} available
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={!selectedMethodKey}>
                  Assign Method
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
