import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, FileText, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage } from "@/utils/anthropicApi";
import { useCoachProfile, type CoachProfile } from "@/hooks/useCoachProfile";
import { useCoachDocuments } from "@/hooks/useCoachDocuments";

// ─── Prompts ──────────────────────────────────────────────────────────────────

const PLAN_EXTRACTION_SYSTEM = `Du bist ein Coach-Berater der eine Beschreibung eines Trainingsplans analysiert.
Extrahiere daraus strukturierte Informationen über den Coaching-Ansatz und gib sie als valides JSON zurück.
Das JSON muss exakt diese Struktur haben:
{
  "philosophy": "Erkennbare Coaching-Philosophie aus dem Plan (1-2 Sätze) – leer lassen wenn nicht erkennbar",
  "methods": "Verwendete Trainingsmethoden und Periodisierungsansatz (1-2 Sätze) – leer lassen wenn nicht erkennbar",
  "targetGroup": "Zielgruppe/Athleten des Plans (1 Satz) – leer lassen wenn nicht erkennbar",
  "experience": "Rückschlüsse auf den Erfahrungshintergrund des Coaches (1 Satz) – leer lassen wenn nicht erkennbar",
  "summary": "Zusammenfassung was dieser Plan über den Coaching-Stil verrät (2-3 Sätze)"
}
Antworte NUR mit dem JSON, ohne Markdown-Code-Fences oder zusätzlichen Text.`;

const MERGE_SUMMARY_SYSTEM = `Du bist ein Coach-Berater.
Kombiniere die zwei folgenden Coach-Zusammenfassungen zu einem einzigen, kohärenten Fließtext (3-6 Sätze).
Vermeide Wiederholungen. Integriere neue Informationen natürlich in den bestehenden Text.
Antworte nur mit dem kombinierten Text, ohne Einleitung oder Erklärung. Antworte auf Deutsch.`;

async function mergeSummaries(existing: string, incoming: string): Promise<string> {
  if (!existing) return incoming;
  if (!incoming) return existing;
  try {
    return await sendMessage(
      [{ role: "user", content: `Bestehende Zusammenfassung:\n${existing}\n\nNeue Informationen:\n${incoming}` }],
      MERGE_SUMMARY_SYSTEM
    );
  } catch {
    return `${existing}\n\n${incoming}`;
  }
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
        "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <Upload className={cn("h-6 w-6", isDragging ? "text-primary" : "text-muted-foreground")} />
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

// ─── Main component ───────────────────────────────────────────────────────────

const TRAINING_PLANS_FOLDER = "Training Plans";
const DOCS_INDEX_KEY = "coachDocuments";

/**
 * Finds the "Training Plans" root folder in the current state.
 * If not found, calls addFolder (which writes to localStorage synchronously)
 * and reads the new ID back from localStorage immediately.
 */
function resolveTrainingPlansFolder(
  folders: { id: string; name: string; parentId: string | null }[],
  addFolder: (name: string, parentId: null) => void
): string | null {
  const existing = folders.find(
    (f) => f.name === TRAINING_PLANS_FOLDER && f.parentId === null
  );
  if (existing) return existing.id;

  addFolder(TRAINING_PLANS_FOLDER, null);

  // addFolder calls persistIndex synchronously → read fresh data from localStorage
  try {
    const stored = JSON.parse(localStorage.getItem(DOCS_INDEX_KEY) ?? "{}") as {
      folders?: { id: string; name: string; parentId: string | null }[];
    };
    const created = (stored.folders ?? []).find(
      (f) => f.name === TRAINING_PLANS_FOLDER && f.parentId === null
    );
    return created?.id ?? null;
  } catch {
    return null;
  }
}

export function TrainingPlanEnricher() {
  const { profile, saveProfile } = useCoachProfile();
  const { addDocument, addFolder, folders } = useCoachDocuments();

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [analyzedPlans, setAnalyzedPlans] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!pendingFile || !description.trim()) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      // Find or create "Training Plans" folder, then upload there
      const folderId = resolveTrainingPlansFolder(folders, addFolder);
      await addDocument(pendingFile, folderId);

      // AI extraction from filename + description
      const content = `Dateiname: ${pendingFile.name}\nBeschreibung des Coaches: ${description}`;
      const raw = await sendMessage(
        [{ role: "user", content: `Hier sind Infos zu einem Trainingsplan:\n\n${content}\n\nBitte extrahiere strukturierte Informationen als JSON.` }],
        PLAN_EXTRACTION_SYSTEM,
        "claude-sonnet-4-5"
      );

      let parsed: {
        philosophy: string; methods: string;
        targetGroup: string; experience: string; summary: string;
      };
      try {
        parsed = JSON.parse(raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()) as typeof parsed;
      } catch {
        throw new Error("Could not parse AI response. Please try again.");
      }

      // Merge into existing profile
      const base = profile;
      const merged: CoachProfile = {
        name:    base?.name    ?? "",
        sports:  base?.sports  ?? [],
        structured: {
          philosophy:  parsed.philosophy?.trim()   || base?.structured?.philosophy   || "",
          methods:     parsed.methods?.trim()       || base?.structured?.methods       || "",
          targetGroup: parsed.targetGroup?.trim()   || base?.structured?.targetGroup   || "",
          experience:  parsed.experience?.trim()    || base?.structured?.experience    || "",
        },
        summary:     await mergeSummaries(base?.summary ?? "", parsed.summary ?? ""),
        completedAt: new Date().toISOString(),
      };
      await saveProfile(merged);

      setAnalyzedPlans((prev) => [...prev, pendingFile.name]);
      setPendingFile(null);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload an existing training plan. The AI reads the filename and your description to extract
        coaching patterns and enrich your profile.
      </p>

      {/* Analyzed plans list */}
      {analyzedPlans.length > 0 && (
        <div className="space-y-1.5">
          {analyzedPlans.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-foreground/80">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
              <span className="truncate">{name}</span>
              <span className="text-xs text-muted-foreground ml-auto">Profile enriched ✓</span>
            </div>
          ))}
        </div>
      )}

      {/* Pending plan form or drop zone */}
      {pendingFile ? (
        <div className="space-y-3 border rounded-xl p-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="truncate">{pendingFile.name}</span>
            <button
              className="ml-auto text-muted-foreground hover:text-destructive flex-shrink-0"
              onClick={() => { setPendingFile(null); setDescription(""); setError(null); }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Describe this plan</Label>
            <Textarea
              placeholder="e.g. 12-week sprint preparation for advanced athletes, heavy speed-strength emphasis in mesocycle 2…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isAnalyzing}
              className="text-sm resize-none"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={handleAnalyze}
            disabled={!description.trim() || isAnalyzing}
          >
            {isAnalyzing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing…</>
            ) : (
              "Analyze & enrich profile"
            )}
          </Button>
        </div>
      ) : (
        <DropZone onFile={setPendingFile} disabled={isAnalyzing} />
      )}
    </div>
  );
}
