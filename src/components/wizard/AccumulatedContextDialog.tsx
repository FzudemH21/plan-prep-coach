/**
 * AccumulatedContextDialog
 *
 * Triggered after saving on MicrocyclePlanningPage Step 3 (Training Calendar).
 * Asks the coach if the plan is complete, then uses AI to generate 1-2 targeted
 * questions about notable decisions. Answers are stored in plan_memory as
 * rationale context for future wizard sessions.
 *
 * Flow:
 *   confirm → generating → questions → saving → done
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { sendMessage } from "@/utils/anthropicApi";
import { saveRationaleNotes } from "@/lib/planMemory";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "confirm" | "generating" | "questions" | "saving" | "done";

interface QAndA {
  question: string;
  answer: string;
}

export interface AccumulatedContextDialogProps {
  open: boolean;
  /** Plain-text summary of the current plan state for AI analysis */
  planSummary: string;
  /** Saved program ID — needed to persist rationale back to plan_memory */
  programId: string;
  /** Authenticated user ID */
  userId: string;
  /** Called when the coach chooses "No, just save" — no AI interaction */
  onJustSave: () => void;
  /** Called when the full flow completes (either path) */
  onDone: () => void;
}

// ── AI prompt ─────────────────────────────────────────────────────────────────

const QUESTION_SYSTEM = `You are reviewing a completed training plan created by a sports coach.
Your task is to generate exactly 1 or 2 short, targeted questions that capture the coach's
reasoning for notable decisions in this plan.

Focus on:
- Unusual or non-standard choices (e.g. atypical mesocycle count, intensity distribution, method selection)
- Deliberate trade-offs the coach likely made
- Athlete-specific adaptations worth remembering
- Decisions that deviate from common practice

Do NOT ask:
- Generic questions ("What was your overall goal?" / "How did you approach periodization?")
- Questions whose answers are already obvious from the plan data
- More than 2 questions

Return ONLY a valid JSON array of question strings — no explanation, no markdown, no extra text.
Example output: ["Why did you use 5 mesocycles instead of the typical 3-4 for this duration?", "What drove the decision to keep sprint volume low in the accumulation block?"]`;

async function generateQuestions(planSummary: string): Promise<string[]> {
  const response = await sendMessage(
    [{ role: "user", content: `Plan summary:\n${planSummary}` }],
    QUESTION_SYSTEM,
    "claude-haiku-4-5",
  );

  // Extract the last assistant message content
  const text = response[response.length - 1]?.content ?? "";

  // Parse JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((q): q is string => typeof q === "string").slice(0, 2);
    }
  } catch {
    // fall through
  }
  return [];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AccumulatedContextDialog({
  open,
  planSummary,
  programId,
  userId,
  onJustSave,
  onDone,
}: AccumulatedContextDialogProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("confirm");
    setQuestions([]);
    setAnswers([]);
    setError(null);
  };

  const handleYes = async () => {
    setStep("generating");
    setError(null);
    try {
      const qs = await generateQuestions(planSummary);
      if (qs.length === 0) {
        // No meaningful questions generated — treat as done
        onDone();
        reset();
        return;
      }
      setQuestions(qs);
      setAnswers(qs.map(() => ""));
      setStep("questions");
    } catch {
      setError("Could not generate questions. You can skip for now.");
      setStep("confirm");
    }
  };

  const handleSubmitAnswers = async () => {
    setStep("saving");
    try {
      const qAndA: Array<{ question: string; answer: string }> = questions.map(
        (q, i) => ({ question: q, answer: answers[i] ?? "" })
      );
      await saveRationaleNotes(programId, userId, qAndA);
      setStep("done");
    } catch {
      setError("Could not save your answers. Please try again.");
      setStep("questions");
    }
  };

  const handleClose = () => {
    onDone();
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">

        {/* ── Step: confirm ── */}
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Feedback
              </DialogTitle>
              <DialogDescription>
                Is this plan complete and ready for AI feedback?
                <br />
                <span className="text-xs text-muted-foreground mt-1 block">
                  The AI will ask you 1–2 short questions about key decisions you made.
                  Your answers help the AI learn your reasoning for future sessions.
                </span>
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => { onJustSave(); reset(); }}>
                No, just save
              </Button>
              <Button onClick={handleYes}>
                Yes, get feedback
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: generating ── */}
        {step === "generating" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Analyzing your plan…
              </DialogTitle>
              <DialogDescription>
                The AI is reviewing your plan and preparing targeted questions.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </>
        )}

        {/* ── Step: questions ── */}
        {step === "questions" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Quick questions
              </DialogTitle>
              <DialogDescription>
                Answer briefly — these notes help the AI understand your reasoning in future sessions.
                You can skip any question by leaving it blank.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {questions.map((q, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-sm font-medium">{q}</p>
                  <Textarea
                    value={answers[i] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    placeholder="Your answer (optional)…"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={handleClose}>
                Skip
              </Button>
              <Button onClick={handleSubmitAnswers}>
                Save answers
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: saving ── */}
        {step === "saving" && (
          <>
            <DialogHeader>
              <DialogTitle>Saving your answers…</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Saved!
              </DialogTitle>
              <DialogDescription>
                Your reasoning has been stored. The AI will use it as context in future planning sessions.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
