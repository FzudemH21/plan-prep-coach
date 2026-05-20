/**
 * DocumentAnalysisDialog
 *
 * Lets the coach trigger AI analysis on any document already in the library.
 *
 * PDFs  → downloaded, base64-encoded, sent as a "document" block so Claude
 *          reads the actual content.
 * Images → same, but sent as an "image" block.
 * Other  → text-only prompt using filename + coach description.
 *
 * Extracted coaching info is shown for review and can be merged into the
 * coach profile with one click.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { sendMessage, sendMessageWithFile, type FileAttachment } from "@/utils/anthropicApi";
import { useCoachProfile, type CoachProfile } from "@/hooks/useCoachProfile";
import type { CoachDocument } from "@/hooks/useCoachDocuments";

// ─── Prompts ──────────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are a sports science advisor analyzing a document to extract coaching information.
Extract structured information about the coaching approach and return it as valid JSON.
The JSON must have exactly this structure:
{
  "philosophy": "Core coaching philosophy visible in the document (1-2 sentences) — empty string if not apparent",
  "methods": "Training methods and periodization approach used (1-2 sentences) — empty string if not apparent",
  "targetGroup": "Target athlete group described or implied (1 sentence) — empty string if not apparent",
  "experience": "Coach background or expertise conclusions (1 sentence) — empty string if not apparent",
  "summary": "What this document reveals about the coaching style (2-3 sentences)"
}
Reply ONLY with the JSON. No Markdown code fences, no additional text.`;

const MERGE_SUMMARY_SYSTEM = `You are a coach advisor.
Combine the two following coach summaries into a single, coherent prose text (3-6 sentences).
Avoid repetition. Integrate new information naturally into the existing text.
Reply only with the combined text, without introduction or explanation. Reply in English.`;

const MERGE_STRUCTURED_SYSTEM = `You are enriching a coach profile with information extracted from a newly analyzed document.
CRITICAL RULE: The original profile entries must be fully preserved. New information must supplement and enrich the originals — never replace, contradict, or override them.
For each field: if only the original has content, keep it unchanged. If only new has content, use it. If both have content, integrate the new information into the original in 1-2 concise sentences.
Return valid JSON with exactly these keys:
{
  "philosophy": "...",
  "methods": "...",
  "targetGroup": "...",
  "experience": "..."
}
Reply ONLY with the JSON. No Markdown, no explanation.`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedInfo {
  philosophy: string;
  methods: string;
  targetGroup: string;
  experience: string;
  summary: string;
}

export interface DocumentAnalysisDialogProps {
  open: boolean;
  doc: CoachDocument | null;
  /** Provide a signed URL for the given document id */
  getDocumentUrl: (id: string) => Promise<string | null>;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch a file from a signed URL and convert to base64 without stack overflow. */
async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function mergeSummaries(existing: string, incoming: string): Promise<string> {
  if (!existing) return incoming;
  if (!incoming) return existing;
  try {
    return await sendMessage(
      [{ role: "user", content: `Existing summary:\n${existing}\n\nNew information:\n${incoming}` }],
      MERGE_SUMMARY_SYSTEM,
      "claude-haiku-4-5"
    );
  } catch {
    return `${existing}\n\n${incoming}`;
  }
}

interface StructuredFields {
  philosophy: string;
  methods: string;
  targetGroup: string;
  experience: string;
}

/**
 * Merges existing structured profile fields with newly extracted ones.
 * Uses a single AI call when both sides have content so neither is lost.
 * Falls back to simple concatenation if the API call fails.
 */
async function mergeStructuredFields(
  existing: StructuredFields,
  extracted: StructuredFields
): Promise<StructuredFields> {
  const anyConflict = (["philosophy", "methods", "targetGroup", "experience"] as const).some(
    (k) => existing[k].trim() && extracted[k].trim()
  );

  // No conflicts — simple fill-in-blanks, no API call needed
  if (!anyConflict) {
    return {
      philosophy:  extracted.philosophy.trim()  || existing.philosophy,
      methods:     extracted.methods.trim()      || existing.methods,
      targetGroup: extracted.targetGroup.trim()  || existing.targetGroup,
      experience:  extracted.experience.trim()   || existing.experience,
    };
  }

  const prompt = `Original profile:
${JSON.stringify(existing, null, 2)}

New information extracted from document:
${JSON.stringify(extracted, null, 2)}

Enrich the original profile with the new information. Preserve all original content.`;

  try {
    const raw = await sendMessage(
      [{ role: "user", content: prompt }],
      MERGE_STRUCTURED_SYSTEM,
      "claude-haiku-4-5"
    );
    const parsed = JSON.parse(
      raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
    ) as StructuredFields;
    return {
      philosophy:  parsed.philosophy  ?? existing.philosophy,
      methods:     parsed.methods      ?? existing.methods,
      targetGroup: parsed.targetGroup  ?? existing.targetGroup,
      experience:  parsed.experience   ?? existing.experience,
    };
  } catch {
    // Fallback: keep existing, append new where non-empty
    return {
      philosophy:  existing.philosophy  || extracted.philosophy,
      methods:     existing.methods      || extracted.methods,
      targetGroup: existing.targetGroup  || extracted.targetGroup,
      experience:  existing.experience   || extracted.experience,
    };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

type Status = "idle" | "downloading" | "analyzing" | "done" | "error";

const RESULT_FIELDS: { key: keyof ExtractedInfo; label: string }[] = [
  { key: "philosophy",  label: "Philosophy"   },
  { key: "methods",     label: "Methods"      },
  { key: "targetGroup", label: "Target group" },
  { key: "experience",  label: "Experience"   },
  { key: "summary",     label: "Summary"      },
];

export function DocumentAnalysisDialog({
  open,
  doc,
  getDocumentUrl,
  onClose,
}: DocumentAnalysisDialogProps) {
  const { profile, saveProfile } = useCoachProfile();

  const [context, setContext]     = useState("");
  const [status, setStatus]       = useState<Status>("idle");
  const [error, setError]         = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInfo | null>(null);
  const [applying, setApplying]   = useState(false);

  const isPdf        = doc?.type === "application/pdf";
  const isImage      = doc?.type.startsWith("image/") ?? false;
  const canReadFile  = isPdf || isImage;

  // ── Analyze ──────────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!doc) return;
    setStatus("downloading");
    setError(null);
    setExtracted(null);

    try {
      let attachment: FileAttachment | null = null;

      if (canReadFile) {
        const url = await getDocumentUrl(doc.id);
        if (!url) throw new Error("Could not retrieve a download URL for this document.");
        const base64Data = await fetchAsBase64(url);
        attachment = {
          blockType: isPdf ? "document" : "image",
          mediaType: doc.type,
          base64Data,
        };
      }

      setStatus("analyzing");

      const textPrompt = canReadFile
        ? `File: ${doc.name}${context.trim() ? `\n\nAdditional context from coach: ${context.trim()}` : ""}\n\nPlease analyze this document and extract structured coaching information as JSON.`
        : `File: ${doc.name}\nFile type: ${doc.type}\n\nCoach description: ${context.trim() || "(no description provided)"}\n\nPlease extract structured coaching information as JSON based on the filename and description.`;

      const raw = await sendMessageWithFile(
        textPrompt,
        attachment,
        EXTRACTION_SYSTEM,
        "claude-sonnet-4-5"
      );

      let parsed: ExtractedInfo;
      try {
        parsed = JSON.parse(
          raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
        ) as ExtractedInfo;
      } catch {
        throw new Error("Could not parse the AI response. Please try again.");
      }

      setExtracted(parsed);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStatus("error");
    }
  };

  // ── Apply to profile ─────────────────────────────────────────────────────────

  const handleApply = async () => {
    if (!extracted) return;
    setApplying(true);
    try {
      const base = profile;
      const existingStructured: StructuredFields = {
        philosophy:  base?.structured?.philosophy  ?? "",
        methods:     base?.structured?.methods      ?? "",
        targetGroup: base?.structured?.targetGroup  ?? "",
        experience:  base?.structured?.experience   ?? "",
      };
      const extractedStructured: StructuredFields = {
        philosophy:  extracted.philosophy.trim(),
        methods:     extracted.methods.trim(),
        targetGroup: extracted.targetGroup.trim(),
        experience:  extracted.experience.trim(),
      };
      const mergedStructured = await mergeStructuredFields(existingStructured, extractedStructured);
      const merged: CoachProfile = {
        name:        base?.name    ?? "",
        sports:      base?.sports  ?? [],
        structured:  mergedStructured,
        summary:     await mergeSummaries(base?.summary ?? "", extracted.summary ?? ""),
        completedAt: new Date().toISOString(),
        // Preserve branding if already set
        ...(base?.branding ? { branding: base.branding } : {}),
      };
      await saveProfile(merged);
      handleClose();
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  // ── Reset on close ───────────────────────────────────────────────────────────

  const handleClose = () => {
    setStatus("idle");
    setExtracted(null);
    setError(null);
    setContext("");
    onClose();
  };

  const isLoading = status === "downloading" || status === "analyzing";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Analyze with AI
          </DialogTitle>
        </DialogHeader>

        {doc && (
          <div className="space-y-4">
            {/* File info row */}
            <div className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-muted/40">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate font-medium flex-1" title={doc.name}>
                {doc.name}
              </span>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {canReadFile ? "Full content" : "Description only"}
              </Badge>
            </div>

            {/* Notice for non-readable types */}
            {!canReadFile && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                Full content reading is available for PDFs and images only. For this
                file type the AI will use the filename and your description below.
              </p>
            )}

            {/* Context / description input */}
            {status !== "done" && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {canReadFile ? "Additional context (optional)" : "Describe this document *"}
                </Label>
                <Textarea
                  placeholder={
                    canReadFile
                      ? "e.g. 12-week sprint preparation block for advanced athletes…"
                      : "e.g. 12-week strength block for sprinters, heavy compound movements, block periodization…"
                  }
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  disabled={isLoading}
                  className="text-sm resize-none"
                />
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {status === "downloading" ? "Downloading document…" : "Analyzing content…"}
              </div>
            )}

            {/* Error */}
            {status === "error" && error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Extraction results */}
            {status === "done" && extracted && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Extracted profile data
                </p>
                {RESULT_FIELDS.filter(({ key }) => extracted[key].trim()).map(({ key, label }) => (
                  <div key={key}>
                    <p className="text-xs font-semibold mb-0.5">{label}</p>
                    <p className="text-sm text-muted-foreground">{extracted[key]}</p>
                  </div>
                ))}
                {RESULT_FIELDS.every(({ key }) => !extracted[key].trim()) && (
                  <p className="text-sm text-muted-foreground">
                    No coaching patterns could be extracted from this document.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading || applying}
          >
            Cancel
          </Button>

          {status !== "done" ? (
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || (!canReadFile && !context.trim())}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {status === "downloading" ? "Downloading…" : "Analyzing…"}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleApply} disabled={applying}>
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apply to Coach Profile
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
