import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, X, Send, Mic, MicOff, Loader2, ChevronRight, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage, type Message } from "@/utils/anthropicApi";
import { useCoachProfile } from "@/hooks/useCoachProfile";
import { useSpeechInput } from "@/hooks/useSpeechInput";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Structured actions the AI can suggest for direct application into the wizard. */
export type ApplySuggestion =
  | { type: "set_plan_name"; name: string }
  | { type: "add_goal"; description: string }
  /** MacrocyclePage Step 3 — add new methods to the training plan */
  | { type: "add_methods"; methods: string[] }
  | { type: "set_mesocycle_config"; count: number; weeksDuration: number }
  /** MesocyclePage Step 3 — distribute existing methods across specific mesocycles */
  | { type: "allocate_methods"; allocations: Array<{ methodName: string; mesocycleNames: string[] }> }
  | { type: "set_method_intensities"; methodName: string; frequency: number; sets: number; reps: string; intensity: string };

export interface WizardAIAssistantProps {
  /** Human-readable label for the current wizard step, e.g. "Goal & Method Selection" */
  stepLabel: string;
  /** A plain-text snapshot of the current wizard state built by the parent page */
  wizardContext: string;
  /**
   * When provided, the AI is told it can emit [[APPLY: {...}]] blocks and the
   * panel will render Apply buttons that call this handler.
   */
  onApplySuggestion?: (action: ApplySuggestion) => void;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const APPLY_FORMAT_INSTRUCTIONS = `
## Applying Suggestions Directly
When you have a concrete suggestion the coach can apply with one click, append ONE structured apply block at the very end of your message using this exact format:
[[APPLY: {"type": "...", ...fields}]]

Available types and their fields:
- set_plan_name: {"type":"set_plan_name","name":"<plan name>"}
- add_goal: {"type":"add_goal","description":"<full goal description including numbers and timeframe>"}
- add_methods: {"type":"add_methods","methods":["<exact method name>","<exact method name>"]}
- set_mesocycle_config: {"type":"set_mesocycle_config","count":<number>,"weeksDuration":<weeks per mesocycle>}
- allocate_methods: {"type":"allocate_methods","allocations":[{"methodName":"<exact method name>","mesocycleNames":["Mesocycle 1","Mesocycle 2"]},{"methodName":"<exact method name>","mesocycleNames":["Mesocycle 1","Mesocycle 2","Mesocycle 3"]}]}
- set_method_intensities: {"type":"set_method_intensities","methodName":"<name>","frequency":<sessions/week>,"sets":<number>,"reps":"<e.g. 3-5>","intensity":"<e.g. 85-90% 1RM>"}

Rules:
- Only ONE [[APPLY: ...]] block per message, at the very end.
- Only include it when you are confident the suggestion is appropriate and actionable.
- Use exact method names as listed in the wizard context.
- Do not add commentary after the [[APPLY: ...]] block.`;

function buildSystemPrompt(coachContext: string, wizardContext: string, canApply: boolean): string {
  return `You are an expert sports science advisor embedded in a training planning wizard.
You assist the coach in making smart, evidence-based planning decisions.

## Coach Style (background only — do NOT use to identify the current athlete)
${coachContext}

## Current Wizard State (authoritative — this is who the plan is for)
${wizardContext}

## Your role
- Give concrete, actionable suggestions relevant to the current planning step.
- Keep responses concise (2-4 sentences). If helpful, ask one focused follow-up question.
- Draw on the coach's philosophy and preferred methods when making suggestions.
- Always refer to the athlete named in "Current Wizard State" — never reference athletes mentioned in the Coach Style section.
- Reply in English.${canApply ? APPLY_FORMAT_INSTRUCTIONS : ""}`;
}

const PROACTIVE_SYSTEM = `You are an expert sports science advisor embedded in a training planning wizard.
Generate a brief, helpful proactive message (2-3 sentences) that:
- Acknowledges what the coach is currently working on in the wizard
- Offers one concrete, specific suggestion or asks one focused question relevant to this planning step
- References the athlete named in the Wizard Context (if one is selected) — NEVER reference any athletes mentioned in the Coach Style section
- Uses the Coach Style section only to understand coaching philosophy and methods, not to infer which athlete is being planned for

CRITICAL: The "Wizard Context" tells you exactly which athlete this plan is for. The "Coach Style" section describes the coach's background and may mention past athletes — do not confuse these with the current athlete. If no athlete is selected yet in the wizard, do not mention any athlete by name.

Be specific and practical, not generic. Do NOT include [[APPLY: ...]] blocks in the opening message. Reply in English.`;

// ─── Suggestion card ─────────────────────────────────────────────────────────

function getSuggestionPreview(action: ApplySuggestion): string {
  switch (action.type) {
    case "set_plan_name":
      return `Set plan name: "${action.name}"`;
    case "add_goal":
      return `Add goal: ${action.description}`;
    case "add_methods":
      return action.methods.length === 1
        ? `Add method: ${action.methods[0]}`
        : `Add ${action.methods.length} methods: ${action.methods.join(", ")}`;
    case "set_mesocycle_config":
      return `Configure ${action.count} mesocycle${action.count !== 1 ? "s" : ""}, ${action.weeksDuration} week${action.weeksDuration !== 1 ? "s" : ""} each`;
    case "allocate_methods":
      return action.allocations
        .map((a) => `${a.methodName} → ${a.mesocycleNames.join(", ")}`)
        .join("\n");
    case "set_method_intensities":
      return `${action.methodName}: ${action.frequency}×/week, ${action.sets} sets × ${action.reps} reps @ ${action.intensity}`;
  }
}

function SuggestionCard({
  action,
  onApply,
}: {
  action: ApplySuggestion;
  onApply: (a: ApplySuggestion) => void;
}) {
  const [applied, setApplied] = useState(false);

  return (
    <div className="mt-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <Sparkles className="h-3 w-3 flex-shrink-0" />
        Suggested action
      </div>
      <p className="text-xs text-foreground leading-snug">{getSuggestionPreview(action)}</p>
      <Button
        size="sm"
        variant={applied ? "outline" : "default"}
        className="h-7 text-xs w-full"
        disabled={applied}
        onClick={() => {
          onApply(action);
          setApplied(true);
        }}
      >
        {applied ? (
          <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" />Applied</>
        ) : (
          "Apply to wizard"
        )}
      </Button>
    </div>
  );
}

// ─── Markdown renderer + apply-block parser ───────────────────────────────────

function ChatMarkdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <span>
      {paragraphs.map((para, pi) => (
        <span key={pi}>
          {pi > 0 && <br />}
          {para.split(/\*\*(.+?)\*\*/g).map((chunk, ci) =>
            ci % 2 === 1 ? <strong key={ci}>{chunk}</strong> : chunk
          )}
        </span>
      ))}
    </span>
  );
}

const APPLY_REGEX = /\[\[APPLY:\s*(\{[\s\S]*?\})\]\]/;

function AssistantMessage({
  text,
  onApply,
}: {
  text: string;
  onApply?: (a: ApplySuggestion) => void;
}) {
  const match = text.match(APPLY_REGEX);
  const cleanText = text.replace(APPLY_REGEX, "").trim();

  let suggestion: ApplySuggestion | null = null;
  if (match && onApply) {
    try {
      suggestion = JSON.parse(match[1]) as ApplySuggestion;
    } catch {
      // malformed JSON from AI — ignore the block
    }
  }

  return (
    <span>
      <ChatMarkdown text={cleanText} />
      {suggestion && onApply && (
        <SuggestionCard action={suggestion} onApply={onApply} />
      )}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WizardAIAssistant({
  stepLabel,
  wizardContext,
  onApplySuggestion,
}: WizardAIAssistantProps) {
  const { profile } = useCoachProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const hasOpened = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef(input);
  useEffect(() => { inputRef.current = input; }, [input]);

  // Voice input
  const handleVoiceResult = useCallback(
    (text: string) => setInput((prev) => (prev ? `${prev} ${text}` : text)),
    []
  );
  const { isListening, toggle: toggleMic, isSupported: micSupported, stopListening } =
    useSpeechInput(handleVoiceResult);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build coach context string from profile
  const coachContext = profile
    ? [
        profile.name ? `Name: ${profile.name}` : "",
        profile.sports?.length ? `Sports: ${profile.sports.join(", ")}` : "",
        profile.structured?.philosophy ? `Philosophy: ${profile.structured.philosophy}` : "",
        profile.structured?.methods ? `Methods: ${profile.structured.methods}` : "",
        profile.structured?.targetGroup ? `Target group: ${profile.structured.targetGroup}` : "",
        profile.structured?.experience ? `Experience: ${profile.structured.experience}` : "",
        profile.summary ? `Summary: ${profile.summary}` : "",
      ].filter(Boolean).join("\n")
    : "No coach profile available.";

  // Generate proactive opener the first time the panel opens
  const generateOpener = useCallback(async () => {
    if (hasOpened.current) return;
    hasOpened.current = true;
    setIsLoading(true);
    try {
      const contextForOpener = `## Coach Style (background only — do NOT use to identify the current athlete)\n${coachContext}\n\n## Wizard Context (authoritative — this is who the plan is for)\n${wizardContext}`;
      const text = await sendMessage(
        [{ role: "user", content: contextForOpener }],
        PROACTIVE_SYSTEM,
        "claude-haiku-4-5"
      );
      setMessages([{ role: "assistant", content: text }]);
    } catch {
      setMessages([{
        role: "assistant",
        content: `I'm here to help with **${stepLabel}**. What would you like to work on?`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [coachContext, stepLabel, wizardContext]);

  const handleOpen = () => {
    setIsOpen(true);
    generateOpener();
  };

  const sendUserMessage = async () => {
    if (isLoading) return;
    if (isListening) {
      stopListening();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const text = inputRef.current.trim();
    if (!text) return;

    const newMessages: Message[] = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await sendMessage(
        newMessages,
        buildSystemPrompt(coachContext, wizardContext, !!onApplySuggestion),
        "claude-haiku-4-5"
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, an error occurred. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendUserMessage(); }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "w-14 h-14 rounded-full shadow-lg",
            "bg-primary text-primary-foreground",
            "flex items-center justify-center",
            "hover:scale-105 active:scale-95 transition-transform",
            "ring-2 ring-primary/20"
          )}
          title="Open AI Assistant"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Side panel */}
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <div
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className={cn(
            "fixed right-0 top-0 bottom-0 z-50",
            "w-full md:w-[400px]",
            "bg-card border-l shadow-2xl",
            "flex flex-col"
          )}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-none">AI Assistant</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{stepLabel}</p>
              </div>
              {onApplySuggestion && (
                <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 mr-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  Can fill wizard
                </div>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 items-start",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white",
                      msg.role === "assistant" ? "bg-primary" : "bg-muted-foreground"
                    )}>
                      {msg.role === "assistant"
                        ? <Bot className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />
                      }
                    </div>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      msg.role === "assistant"
                        ? "bg-muted text-foreground rounded-tl-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                    )}>
                      {msg.role === "assistant"
                        ? <AssistantMessage text={msg.content} onApply={onApplySuggestion} />
                        : msg.content
                      }
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2.5">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="px-4 py-3 border-t">
              <div className="flex gap-2">
                {micSupported && (
                  <Button
                    type="button"
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    onClick={toggleMic}
                    disabled={isLoading}
                    className={cn("flex-shrink-0", isListening && "animate-pulse")}
                    title={isListening ? "Stop recording" : "Voice input"}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
                <Input
                  placeholder={isListening ? "Recording…" : "Ask anything…"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={sendUserMessage}
                  disabled={!input.trim() || isLoading}
                  className="flex-shrink-0"
                >
                  {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />
                  }
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
