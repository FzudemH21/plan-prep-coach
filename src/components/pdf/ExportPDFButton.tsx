/**
 * ExportPDFButton.tsx
 *
 * Button + dialog that:
 *  1. Lets the coach choose which mesocycles to include and at what depth
 *  2. Triggers AI narrative generation (with loading state)
 *  3. Renders the PDF document
 *  4. Downloads it to the user's browser
 */

import React, { useState, useMemo } from "react";
// @react-pdf/renderer is loaded dynamically inside handleExport to avoid
// breaking Vite's initial bundle (the library uses browser APIs incompatible
// with pre-bundling). Do NOT add a top-level import for it here.
import { FileText, Loader2, Download, Sparkles, Layers, Calendar, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrainingProgram } from "@/hooks/useTrainingPrograms";
import { useCoachProfile } from "@/hooks/useCoachProfile";
import type { PlanNarrative, NarrativeOptions } from "@/lib/generatePlanNarrative";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "idle" | "generating" | "rendering" | "done" | "error";

/** How deep the PDF should go */
export type DetailLevel = "overview" | "microcycles" | "full-week";

interface RawMeso {
  id?: string;
  name?: string;
  weeks?: number;
}

interface ExportPDFButtonProps {
  program: TrainingProgram;
  /** Rendered inside a dropdown or standalone */
  variant?: "ghost" | "outline" | "default" | "secondary";
  /** Show icon only (for tight spaces like dropdown items) */
  iconOnly?: boolean;
  className?: string;
  /** Controlled mode — omit the trigger button, drive open state externally */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// ─── Small option card ────────────────────────────────────────────────────────

function OptionCard({
  selected,
  onClick,
  icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
      }`}
      onClick={onClick}
    >
      <div className={`mt-0.5 ${selected ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportPDFButton({
  program,
  variant = "outline",
  iconOnly = false,
  className,
  open: controlledOpen,
  onOpenChange,
}: ExportPDFButtonProps) {
  const { profile } = useCoachProfile();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };

  // ── Export config state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("idle");
  const [narrative, setNarrative] = useState<PlanNarrative | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [withAI, setWithAI] = useState(true);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("overview");

  // Mesocycles from the program
  const allMesos = useMemo<RawMeso[]>(() => {
    return (
      (program.mesocycleData as { mesocycles?: unknown[] } | null)?.mesocycles ?? []
    ) as RawMeso[];
  }, [program.mesocycleData]);

  // Which mesocycles are selected for export (default: all)
  const [selectedMesoIds, setSelectedMesoIds] = useState<Set<string>>(() => {
    const ids = (
      (program.mesocycleData as { mesocycles?: unknown[] } | null)?.mesocycles ?? []
    ) as RawMeso[];
    return new Set(ids.map((m, i) => m.id ?? `meso_${i}`));
  });

  const coachName = profile?.name ?? undefined;
  const branding = profile?.branding ?? undefined;

  // ── Dialog open / reset ─────────────────────────────────────────────────────
  const handleOpen = () => {
    setStep("idle");
    setNarrative(null);
    setErrorMsg("");
    // Reset selection to all
    setSelectedMesoIds(new Set(allMesos.map((m, i) => m.id ?? `meso_${i}`)));
    setOpen(true);
  };

  // ── Mesocycle toggle helpers ────────────────────────────────────────────────
  const toggleMeso = (id: string) => {
    setSelectedMesoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // always keep ≥1
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected = selectedMesoIds.size === allMesos.length;
  const toggleAll = () => {
    if (allSelected) {
      // Keep only the first one
      const firstId = allMesos[0] ? (allMesos[0].id ?? "meso_0") : "";
      setSelectedMesoIds(new Set([firstId]));
    } else {
      setSelectedMesoIds(new Set(allMesos.map((m, i) => m.id ?? `meso_${i}`)));
    }
  };

  // ── Export handler ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const selectedIds = Array.from(selectedMesoIds);
      const narrativeOpts: NarrativeOptions = {
        selectedMesoIds: selectedIds,
        includeMicrocycles: detailLevel !== "overview",
      };

      let planNarrative: PlanNarrative;
      if (withAI) {
        setStep("generating");
        const { generatePlanNarrative } = await import("@/lib/generatePlanNarrative");
        planNarrative = await generatePlanNarrative(program, narrativeOpts);
      } else {
        planNarrative = { intro: "", mesocycles: [], closing: "" };
      }
      setNarrative(planNarrative);

      // Render PDF — both the renderer and the document are loaded on demand
      setStep("rendering");
      const [{ pdf }, { TrainingPlanPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./TrainingPlanPDF"),
      ]);
      const doc = (
        <TrainingPlanPDF
          program={program}
          narrative={planNarrative}
          coachName={coachName}
          branding={branding}
          selectedMesoIds={selectedIds}
          detailLevel={detailLevel}
        />
      );
      const blob = await pdf(doc).toBlob();

      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = `${(program.name ?? "Training Plan").replace(/[^a-z0-9]/gi, "_")}_${
        program.athleteName ? `${program.athleteName.replace(/[^a-z0-9]/gi, "_")}_` : ""
      }Plan.pdf`;
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStep("done");
      setTimeout(() => setOpen(false), 1200);
    } catch (err) {
      console.error("[ExportPDF]", err);
      setErrorMsg(err instanceof Error ? err.message : "Export failed");
      setStep("error");
    }
  };

  const stepLabel: Record<Step, string> = {
    idle: "Export PDF",
    generating: "Generating AI summaries…",
    rendering: "Building PDF…",
    done: "Downloaded!",
    error: "Export failed",
  };

  const isWorking = step === "generating" || step === "rendering";

  return (
    <>
      {!isControlled && (
        <Button
          variant={variant}
          size={iconOnly ? "icon" : "default"}
          onClick={handleOpen}
          className={className}
          title="Export as PDF"
        >
          <FileText className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-2"} />
          {!iconOnly && "Export PDF"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!isWorking) setOpen(v); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Export Training Plan
            </DialogTitle>
            <DialogDescription>
              Generate an athlete-facing PDF of{" "}
              <span className="font-medium">{program.name ?? "this plan"}</span>
              {program.athleteName ? ` for ${program.athleteName}` : ""}.
            </DialogDescription>
          </DialogHeader>

          {/* ── Idle: configuration options ──────────────────────────────── */}
          {step === "idle" && (
            <div className="space-y-5 py-1">

              {/* Mesocycle selector — only shown if plan has multiple phases */}
              {allMesos.length > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Phases to include</p>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      onClick={toggleAll}
                    >
                      {allSelected ? (
                        <><CheckSquare className="h-3.5 w-3.5" /> Deselect all</>
                      ) : (
                        <><Square className="h-3.5 w-3.5" /> Select all</>
                      )}
                    </button>
                  </div>
                  <div className="rounded-lg border divide-y">
                    {allMesos.map((m, i) => {
                      const id = m.id ?? `meso_${i}`;
                      const checked = selectedMesoIds.has(id);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleMeso(id)}
                            id={`meso-${id}`}
                          />
                          <Label htmlFor={`meso-${id}`} className="cursor-pointer flex-1 text-sm">
                            {m.name ?? `Phase ${i + 1}`}
                          </Label>
                          {m.weeks != null && (
                            <span className="text-xs text-muted-foreground">{m.weeks}w</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Separator />

              {/* Detail level */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Level of detail</p>
                <div className="space-y-2">
                  <OptionCard
                    selected={detailLevel === "overview"}
                    onClick={() => setDetailLevel("overview")}
                    icon={<Layers className="h-4 w-4" />}
                    label="Phase overview"
                    description="One summary per phase — what it focuses on and why."
                  />
                  <OptionCard
                    selected={detailLevel === "microcycles"}
                    onClick={() => setDetailLevel("microcycles")}
                    icon={<Sparkles className="h-4 w-4" />}
                    label="+ Microcycle breakdown"
                    description="Adds a week-by-week intensity progression and AI rationale for each week within the phase."
                  />
                  <OptionCard
                    selected={detailLevel === "full-week"}
                    onClick={() => setDetailLevel("full-week")}
                    icon={<Calendar className="h-4 w-4" />}
                    label="+ Representative training week"
                    description="Includes a sample weekly schedule showing training days, intensity, and methods for each phase."
                  />
                </div>
              </div>

              <Separator />

              {/* AI summaries */}
              <div className="space-y-2">
                <p className="text-sm font-medium">AI summaries</p>
                <div className="space-y-2">
                  <OptionCard
                    selected={withAI}
                    onClick={() => setWithAI(true)}
                    icon={<Sparkles className="h-4 w-4" />}
                    label="With AI summaries"
                    description={`Claude writes personalised text for every section${detailLevel !== "overview" ? ", including per-week rationale" : ""}. Adds ~5–10 seconds.`}
                  />
                  <OptionCard
                    selected={!withAI}
                    onClick={() => setWithAI(false)}
                    icon={<FileText className="h-4 w-4" />}
                    label="Structure only"
                    description="Plan data only — no AI narrative. Instant."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {isWorking && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{stepLabel[step]}</p>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-2 py-6">
              <Download className="h-8 w-8 text-green-600" />
              <p className="text-sm font-medium text-green-700">PDF downloaded!</p>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="py-4">
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setStep("idle")}
              >
                Try again
              </Button>
            </div>
          )}

          <DialogFooter>
            {(step === "idle" || step === "error") && (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isWorking}>
                  Cancel
                </Button>
                <Button onClick={handleExport} disabled={isWorking || selectedMesoIds.size === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  {stepLabel[step]}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
