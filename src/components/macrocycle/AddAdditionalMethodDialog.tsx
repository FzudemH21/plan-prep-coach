/**
 * Step 3 of the macrocycle: add training methods that aren't linked to a goal — several at once.
 * A searchable list with ticks; each ticked method gets an optional one-line rationale ("why").
 * (Evidence and its quality are no longer asked here — older methods keep what they have.)
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToolboxData } from "@/hooks/useToolboxData";

export type EvidenceQuality = "strong" | "moderate" | "preliminary" | "expert_opinion";

/** Labels for evidence ratings stored on older methods (and in the parameter database) */
export const EVIDENCE_QUALITY_OPTIONS: { value: EvidenceQuality; label: string; description: string }[] = [
  { value: "strong",         label: "Strong",         description: "Systematic review / meta-analysis with consistent results" },
  { value: "moderate",       label: "Moderate",       description: "Single or multiple RCTs / well-controlled studies" },
  { value: "preliminary",    label: "Preliminary",    description: "Observational, cohort, or cross-sectional evidence" },
  { value: "expert_opinion", label: "Expert Opinion", description: "Case reports, coaching practice, or expert consensus" },
];

export interface NewManualMethod { methodId: string; rationale: string }

interface AddAdditionalMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ticked methods, in the order they were ticked */
  onAdd: (methods: NewManualMethod[]) => void;
  excludedMethods: Set<string>;
}

export function AddAdditionalMethodDialog({
  open,
  onOpenChange,
  onAdd,
  excludedMethods,
}: AddAdditionalMethodDialogProps) {
  const { data: toolboxData } = useToolboxData();
  // Ticked methods (in order) and their rationale
  const [picked, setPicked] = useState<string[]>([]);
  const [rationales, setRationales] = useState<Record<string, string>>({});

  // Methods of the toolbox not in the plan yet, by category
  const methodsByCategory = useMemo(() => {
    const grouped: Record<string, Array<{ methodId: string; subCategory: string }>> = {};
    const seen = new Set<string>();
    toolboxData.entries.forEach(entry => {
      const methodId = `${entry.category} - ${entry.subCategory}`;
      if (excludedMethods.has(methodId) || seen.has(methodId)) return;
      seen.add(methodId);
      (grouped[entry.category] ??= []).push({ methodId, subCategory: entry.subCategory });
    });
    Object.values(grouped).forEach(list => list.sort((a, b) => a.subCategory.localeCompare(b.subCategory)));
    return grouped;
  }, [toolboxData.entries, excludedMethods]);
  const sortedCategories = useMemo(() => Object.keys(methodsByCategory).sort(), [methodsByCategory]);

  const toggle = (methodId: string) =>
    setPicked(prev => (prev.includes(methodId) ? prev.filter(m => m !== methodId) : [...prev, methodId]));

  const reset = () => { setPicked([]); setRationales({}); };

  const handleAdd = () => {
    if (picked.length === 0) return;
    onAdd(picked.map(methodId => ({ methodId, rationale: (rationales[methodId] ?? "").trim() })));
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add training methods</DialogTitle>
          <DialogDescription>Methods that aren't linked to a goal — tick one or more.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <Command className="rounded-md border h-auto">
            <CommandInput placeholder="Search methods..." />
            <CommandList className="max-h-[260px]">
              <CommandEmpty>No methods found.</CommandEmpty>
              {sortedCategories.map(category => (
                <CommandGroup key={category} heading={category}>
                  {methodsByCategory[category].map(method => {
                    const on = picked.includes(method.methodId);
                    return (
                      <CommandItem key={method.methodId} value={method.methodId} onSelect={() => toggle(method.methodId)}>
                        <span className={cn('mr-2 h-4 w-4 shrink-0 rounded border flex items-center justify-center',
                          on ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        {method.subCategory}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>

          {/* The ticked methods, each with an optional rationale */}
          {picked.length > 0 && (
            <div className="min-h-0 overflow-y-auto space-y-2 pr-1">
              <p className="text-xs font-medium text-muted-foreground">Selected ({picked.length}) — why each one? (optional)</p>
              {picked.map(methodId => (
                <div key={methodId} className="rounded-md border px-2.5 py-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm font-medium break-words">{methodId}</span>
                    <button type="button" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remove from selection"
                      onClick={() => toggle(methodId)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    value={rationales[methodId] ?? ""}
                    onChange={(e) => setRationales(prev => ({ ...prev, [methodId]: e.target.value }))}
                    placeholder="Why is this method in the plan?"
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleAdd} disabled={picked.length === 0}>
            {picked.length > 1 ? `Add ${picked.length} methods` : 'Add method'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
