/**
 * TrainingPlanEnricher — "Past Plans as AI Context"
 *
 * Coaches upload existing training plans and fill in a short structured form.
 * The data is saved to `plan_memory` so the AI can use it as situational context
 * in the wizard — without touching the stable Coach Profile.
 *
 * Coach Profile = who you are as a coach (stable)
 * Plan Memory   = how you've coached in specific situations (contextual)
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, FileText, X, CheckCircle2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoachDocuments } from "@/hooks/useCoachDocuments";
import { useAuth } from "@/hooks/useAuth";
import { saveUploadedPlanMemory } from "@/lib/planMemory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <Upload className={cn("h-5 w-5", isDragging ? "text-primary" : "text-muted-foreground")} />
      <p className="text-sm font-medium">Drop plan file here</p>
      <p className="text-xs text-muted-foreground">or click to select — all file types</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRAINING_PLANS_FOLDER = "Training Plans";
const DOCS_INDEX_KEY = "coachDocuments";

function resolveTrainingPlansFolder(
  folders: { id: string; name: string; parentId: string | null }[],
  addFolder: (name: string, parentId: null) => void
): string | null {
  const existing = folders.find(
    (f) => f.name === TRAINING_PLANS_FOLDER && f.parentId === null
  );
  if (existing) return existing.id;

  addFolder(TRAINING_PLANS_FOLDER, null);

  try {
    const stored = JSON.parse(localStorage.getItem(DOCS_INDEX_KEY) ?? "{}") as {
      folders?: { id: string; name: string; parentId: string | null }[];
    };
    return stored.folders?.find(
      (f) => f.name === TRAINING_PLANS_FOLDER && f.parentId === null
    )?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface PlanForm {
  planName: string;
  outcomeAndNotes: string;
}

const EMPTY_FORM: PlanForm = {
  planName: "",
  outcomeAndNotes: "",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function TrainingPlanEnricher() {
  const { user } = useAuth();
  const { addDocument, addFolder, folders, getDocuments, deleteDocument } = useCoachDocuments();

  // Persistent list from the "Training Plans" folder
  const trainingPlansFolder = folders.find(
    (f) => f.name === TRAINING_PLANS_FOLDER && f.parentId === null
  );
  const uploadedPlans = trainingPlansFolder ? getDocuments(trainingPlansFolder.id) : [];

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [form, setForm]               = useState<PlanForm>(EMPTY_FORM);
  const [isSaving, setIsSaving]       = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const setField = (key: keyof PlanForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleFileSelected = (file: File) => {
    setPendingFile(file);
    setForm((prev) => ({ ...prev, planName: file.name.replace(/\.[^/.]+$/, "") }));
    setError(null);
  };

  const handleSave = async () => {
    if (!pendingFile) return;
    setIsSaving(true);
    setError(null);

    try {
      // 1. Upload file to "Training Plans" folder — storage upload is best-effort;
      //    if Supabase storage is unavailable the plan is still registered locally
      //    and in plan_memory so the AI can reference it.
      const folderId = resolveTrainingPlansFolder(folders, addFolder);
      let docId = `manual_${Date.now()}`;
      try {
        await addDocument(pendingFile, folderId);
        const stored = JSON.parse(localStorage.getItem(DOCS_INDEX_KEY) ?? "{}") as {
          documents?: Array<{ id: string; folderId: string | null; uploadedAt: string }>;
        };
        const newestInFolder = (stored.documents ?? [])
          .filter((d) => d.folderId === folderId)
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
        if (newestInFolder) docId = newestInFolder.id;
      } catch {
        // Storage upload failed — continue without cloud file (plan_memory still saved)
      }

      // 2. Save to plan_memory so the AI can reference this plan
      if (user?.id) {
        await saveUploadedPlanMemory(
          {
            docId,
            planName: form.planName.trim() || pendingFile.name,
            sportAndAthlete: "",
            goalAndContext: "",
            methodsAndStructure: "",
            outcomeAndNotes: form.outcomeAndNotes.trim(),
          },
          user.id
        );
      }

      setPendingFile(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = !!pendingFile;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Upload past training plans to give the AI situational context — how you've coached
          specific athletes in specific situations. This does <strong>not</strong> change your
          coaching philosophy; it's background knowledge the AI uses when making suggestions.
        </p>
      </div>

      {/* Uploaded plans list */}
      {uploadedPlans.length > 0 && (
        <div className="space-y-1.5">
          {uploadedPlans.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-muted/20"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-sm">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(doc.size)} · Saved as AI context ✓</p>
              </div>
              <button
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="Remove"
                onClick={() => deleteDocument(doc.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form or drop zone */}
      {pendingFile ? (
        <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
          {/* File header */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate flex-1">{pendingFile.name}</span>
            <button
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => { setPendingFile(null); setForm(EMPTY_FORM); setError(null); }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Plan name</Label>
              <Input
                value={form.planName}
                onChange={setField("planName")}
                placeholder="e.g. Sprint Prep Block – Summer 2024"
                className="text-sm h-8"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Outcome & notes (optional)</Label>
              <p className="text-xs text-muted-foreground -mt-0.5">
                What worked, what you'd change, athlete response to load
              </p>
              <Textarea
                value={form.outcomeAndNotes}
                onChange={setField("outcomeAndNotes")}
                placeholder="e.g. PB at nationals, athlete handled volume well — reduce taper block from 2 to 1.5 weeks next time"
                rows={3}
                disabled={isSaving}
                className="text-sm resize-none"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            {isSaving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
            ) : (
              "Save as AI context"
            )}
          </Button>
        </div>
      ) : (
        <DropZone onFile={handleFileSelected} disabled={isSaving} />
      )}
    </div>
  );
}
