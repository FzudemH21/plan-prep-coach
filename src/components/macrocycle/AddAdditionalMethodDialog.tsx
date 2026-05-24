import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToolboxData } from "@/hooks/useToolboxData";

interface AddAdditionalMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (method: { methodId: string; rationale: string; evidence?: string }) => void;
  excludedMethods: Set<string>;
}

export function AddAdditionalMethodDialog({
  open,
  onOpenChange,
  onAdd,
  excludedMethods,
}: AddAdditionalMethodDialogProps) {
  const { data: toolboxData } = useToolboxData();
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [evidence, setEvidence] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get all unique methods from toolbox, grouped by category
  const availableMethods = useMemo(() => {
    const methodSet = new Map<string, { category: string; subCategory: string }>();
    
    toolboxData.entries.forEach(entry => {
      const methodId = `${entry.category} - ${entry.subCategory}`;
      if (!excludedMethods.has(methodId) && !methodSet.has(methodId)) {
        methodSet.set(methodId, {
          category: entry.category,
          subCategory: entry.subCategory
        });
      }
    });
    
    return Array.from(methodSet.entries()).map(([methodId, info]) => ({
      methodId,
      ...info
    }));
  }, [toolboxData.entries, excludedMethods]);

  // Group methods by category
  const methodsByCategory = useMemo(() => {
    const grouped: Record<string, typeof availableMethods> = {};
    availableMethods.forEach(method => {
      if (!grouped[method.category]) {
        grouped[method.category] = [];
      }
      grouped[method.category].push(method);
    });
    // Sort categories and methods within each category
    Object.keys(grouped).forEach(cat => {
      grouped[cat].sort((a, b) => a.subCategory.localeCompare(b.subCategory));
    });
    return grouped;
  }, [availableMethods]);

  const sortedCategories = useMemo(() => 
    Object.keys(methodsByCategory).sort(), 
    [methodsByCategory]
  );

  const handleAdd = () => {
    if (!selectedMethod) return;
    onAdd({ methodId: selectedMethod, rationale: rationale.trim(), evidence: evidence.trim() || undefined });
    // Reset form
    setSelectedMethod("");
    setRationale("");
    setEvidence("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedMethod("");
    setRationale("");
    setEvidence("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Additional Training Method</DialogTitle>
          <DialogDescription>
            Select a training method that isn't linked to any goal. Providing a rationale helps explain why this method is included in your plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Method Selection */}
          <div className="space-y-2">
            <Label>Training Method</Label>
            <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={dropdownOpen}
                  className="w-full justify-between"
                >
                  {selectedMethod || "Select a method..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0 bg-popover z-50" align="start">
                <Command>
                  <CommandInput placeholder="Search methods..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No methods found.</CommandEmpty>
                    {sortedCategories.map(category => (
                      <CommandGroup key={category} heading={category}>
                        {methodsByCategory[category].map(method => (
                          <CommandItem
                            key={method.methodId}
                            value={method.methodId}
                            onSelect={() => {
                              setSelectedMethod(method.methodId);
                              setDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMethod === method.methodId ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {method.subCategory}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Rationale Input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Rationale
              <span className="text-muted-foreground text-xs font-normal">(recommended)</span>
            </Label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why are you including this method in your training plan?"
              className="min-h-[80px]"
            />
            {!rationale.trim() && selectedMethod && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                Methods without rationale will show a warning
              </p>
            )}
          </div>

          {/* Evidence Input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Evidence
              <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Research citations or supporting evidence..."
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedMethod}>
            Add Method
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
