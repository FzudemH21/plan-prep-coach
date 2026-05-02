import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  Plus,
  X,
  ChevronRight,
  Loader2,
  User,
  Mic,
  MicOff,
  AlertTriangle,
  Upload,
  FileText,
} from "lucide-react";
import { sendMessage, type Message } from "@/utils/anthropicApi";
import { useCoachProfile, type CoachProfile } from "@/hooks/useCoachProfile";
import { useCoachDocuments } from "@/hooks/useCoachDocuments";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// System prompts
// ─────────────────────────────────────────────

function buildConversationSystemPrompt(name: string, sports: string[]): string {
  return `Du bist ein erfahrener Sportwissenschaftler und Coach-Berater.
Du führst ein erstes Kennenlerngespräch mit ${name}, einem Coach im Bereich ${sports.join(", ")}.

Dein Ziel: Verstehe die Coaching-Philosophie, bevorzugte Trainingsmethoden, Zielgruppe und Erfahrung des Coaches.
Führe ein natürliches, offenes Gespräch – stelle eine Frage nach der anderen.
Sei neugierig, freundlich und auf Augenhöhe. Kein formales Verhör.
Antworte auf Deutsch. Halte deine Antworten kurz (2-4 Sätze), dann eine konkrete Folgefrage.`;
}

const OPENER_SYSTEM = `Du bist ein Coach-Berater. Generiere einen kurzen, freundlichen Gesprächseinstieg (2-3 Sätze) der den Coach willkommen heißt und eine erste offene Frage stellt. Antworte auf Deutsch.`;

const EXTRACTION_SYSTEM = `Du bist ein Coach-Berater der ein Gesprächstranskript analysiert.
Extrahiere aus dem Gespräch strukturierte Informationen über den Coach und gib sie als valides JSON zurück.
Das JSON muss exakt diese Struktur haben:
{
  "philosophy": "Kurze Beschreibung der Coaching-Philosophie (1-2 Sätze) – leer lassen wenn nicht erwähnt",
  "methods": "Bevorzugte Trainingsmethoden und Ansätze (1-2 Sätze) – leer lassen wenn nicht erwähnt",
  "targetGroup": "Beschreibung der Zielgruppe/Athleten (1 Satz) – leer lassen wenn nicht erwähnt",
  "experience": "Erfahrungshintergrund des Coaches (1 Satz) – leer lassen wenn nicht erwähnt",
  "summary": "Zusammenfassender Fließtext über den Coach (3-5 Sätze, für das Coach-Profil)"
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

// ─────────────────────────────────────────────
// Skip warning banner (inline, compact)
// ─────────────────────────────────────────────

function SkipWarning({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="mt-6 space-y-2">
      <div className="flex items-start gap-2 text-amber-600 dark:text-amber-500 text-xs leading-relaxed">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Without a coach profile, the AI cannot give you personalized recommendations –
          you're missing the core of the app.
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground hover:text-foreground"
        onClick={onSkip}
      >
        Skip
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stage 1 – short form
// ─────────────────────────────────────────────

interface Stage1Props {
  onNext: (name: string, sports: string[]) => void;
  /** Receives whatever the coach has typed so far — may be empty strings / empty array */
  onSkip: (name: string, sports: string[]) => void;
}

function Stage1Form({ onNext, onSkip }: Stage1Props) {
  const [name, setName] = useState("");
  const [sportInput, setSportInput] = useState("");
  const [sports, setSports] = useState<string[]>([]);

  const addSport = () => {
    const trimmed = sportInput.trim();
    if (trimmed && !sports.includes(trimmed)) setSports((p) => [...p, trimmed]);
    setSportInput("");
  };

  const removeSport = (s: string) => setSports((p) => p.filter((x) => x !== s));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); addSport(); }
  };

  const canProceed = name.trim().length > 0 && sports.length > 0;

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="space-y-2">
        <Label htmlFor="coach-name">Your Name</Label>
        <Input
          id="coach-name"
          placeholder="e.g. Maria Muster"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>Sport(s)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Sprinting, Weightlifting …"
            value={sportInput}
            onChange={(e) => setSportInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button type="button" variant="outline" size="icon" onClick={addSport} disabled={!sportInput.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {sports.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {sports.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button onClick={() => removeSport(s)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Press Enter or + to add a sport</p>
      </div>

      <Button className="w-full" disabled={!canProceed} onClick={() => onNext(name.trim(), sports)}>
        Continue
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>

      <SkipWarning onSkip={() => onSkip(name.trim(), sports)} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Stage 2 – AI conversation
// ─────────────────────────────────────────────

interface Stage2Props {
  coachName: string;
  sports: string[];
  onComplete: (messages: Message[]) => void;
  onSkip: () => void;
}

function Stage2Chat({ coachName, sports, onComplete, onSkip }: Stage2Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasOpened = useRef(false);
  // Always-current ref so the send handler reads the latest input after a voice delay
  const inputRef = useRef(input);
  useEffect(() => { inputRef.current = input; }, [input]);

  // Voice input – appends transcript to the text field
  const handleVoiceResult = useCallback(
    (text: string) => setInput((prev) => (prev ? `${prev} ${text}` : text)),
    []
  );
  const { isListening, toggle: toggleMic, isSupported: micSupported, stopListening } =
    useSpeechInput(handleVoiceResult);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // AI opens the conversation automatically
  useEffect(() => {
    if (hasOpened.current) return;
    hasOpened.current = true;

    const fallback: Message = {
      role: "assistant",
      content: `Hallo ${coachName}! Schön, dass du hier bist. Erzähl mir – wie bist du zum Coaching gekommen und was treibt dich an?`,
    };

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    if (!apiKey) {
      setMessages([fallback]);
      return;
    }

    setIsLoading(true);
    sendMessage(
      [{ role: "user", content: `Begrüße ${coachName}, Coach im Bereich ${sports.join(", ")}. Stelle eine erste offene Frage.` }],
      OPENER_SYSTEM,
      "claude-haiku-4-5"
    )
      .then((text) => setMessages([{ role: "assistant", content: text }]))
      .catch(() => setMessages([fallback]))
      .finally(() => setIsLoading(false));
  }, [coachName, sports]);

  const sendUserMessage = async () => {
    if (isLoading) return;

    if (isListening) {
      stopListening();
      // Wait briefly for the last speech chunk to be finalized before reading input
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const text = inputRef.current.trim();
    if (!text) return;

    const newMessages: Message[] = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await sendMessage(newMessages, buildConversationSystemPrompt(coachName, sports), "claude-haiku-4-5");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("[Stage2Chat] sendMessage error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, an error occurred. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendUserMessage(); }
  };

  const hasEnoughContext = messages.filter((m) => m.role === "user").length >= 2;

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 pb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 items-start",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                msg.role === "assistant" ? "bg-primary" : "bg-muted-foreground"
              )}>
                {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "assistant"
                  ? "bg-muted text-foreground rounded-tl-sm"
                  : "bg-primary text-primary-foreground rounded-tr-sm"
              )}>
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="pt-4 border-t space-y-3">
        <div className="flex gap-2">
          {/* Voice input button */}
          {micSupported && (
            <Button
              type="button"
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              onClick={toggleMic}
              disabled={isLoading || isCreating}
              title={isListening ? "Stop recording" : "Start voice input"}
              className={cn(isListening && "animate-pulse")}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          <Input
            placeholder={isListening ? "Recording…" : "Your answer…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isCreating}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={sendUserMessage}
            disabled={!input.trim() || isLoading || isCreating}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {hasEnoughContext && (
          <Button
            className="w-full"
            disabled={isLoading || isCreating}
            onClick={() => { setIsCreating(true); onComplete(messages); }}
          >
            {isCreating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating profile…</>
            ) : (
              "Create profile"
            )}
          </Button>
        )}

        <SkipWarning onSkip={onSkip} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stage 3 – Document upload (optional)
// ─────────────────────────────────────────────

interface Stage3Props {
  onFinish: () => void;
  onSkip: () => void;
}

function Stage3Upload({ onFinish, onSkip }: Stage3Props) {
  const { addDocument } = useCoachDocuments();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const names: string[] = [];
    for (const file of Array.from(files)) {
      await addDocument(file, null);
      names.push(file.name);
    }
    setUploadedNames((prev) => [...prev, ...names]);
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40"
        )}
      >
        <Upload className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground")} />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Drop files here</p>
          <p className="text-xs text-muted-foreground">or click to select files</p>
          <p className="text-xs text-muted-foreground">All file types allowed</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Uploaded files list */}
      {uploadedNames.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Uploaded:</p>
          <div className="space-y-1.5">
            {uploadedNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="truncate">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading…
        </div>
      )}

      <Button className="w-full" onClick={onFinish} disabled={uploading}>
        Finish
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>

      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main OnboardingPage
// ─────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRefresh = searchParams.get("mode") === "refresh";
  const { profile: existingProfile, saveProfile } = useCoachProfile();
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [coachName, setCoachName] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Prevents the refresh-init branch from re-running after saveProfile updates existingProfile
  const refreshInitialized = useRef(false);

  // Guard: if a full (non-skipped) profile already exists, skip onboarding entirely
  // Exception: ?mode=refresh allows re-entering the AI conversation from the profile page
  useEffect(() => {
    if (!isRefresh && existingProfile && !existingProfile.skipped) {
      navigate("/coach-profile", { replace: true });
    }
    // In refresh mode: pre-fill from existing profile and jump straight to Stage 2 — only once
    if (isRefresh && existingProfile && !existingProfile.skipped && !refreshInitialized.current) {
      refreshInitialized.current = true;
      setCoachName(existingProfile.name ?? "");
      setSports(existingProfile.sports ?? []);
      setStage(2);
    }
  }, [isRefresh, existingProfile, navigate]);

  /** Builds a partial-but-persisted profile with whatever data the coach has entered so far. */
  const buildSkippedProfile = (name: string, skipSports: string[]): CoachProfile => {
    if (name) {
      // Coach entered real data — treat as a partial profile, not skipped.
      // The coach profile page will show their name/sports with empty AI fields.
      return {
        name,
        sports: skipSports,
        structured: { philosophy: "", methods: "", targetGroup: "", experience: "" },
        summary: "",
        completedAt: new Date().toISOString(),
      };
    }
    // No name entered at all — bare skip marker
    return { skipped: true } as unknown as CoachProfile;
  };

  /**
   * Stage 1 skip — the form passes its current local values because they live
   * in Stage1Form's own state and aren't yet in OnboardingPage state.
   */
  const handleStage1Skip = (name: string, skipSports: string[]) => {
    const profile = buildSkippedProfile(name, skipSports);
    console.log("[handleStage1Skip] name:", name, "sports:", skipSports, "→ saveProfile:", profile);
    saveProfile(profile);
    navigate("/");
  };

  /**
   * Stage 2 skip — coachName and sports are already promoted to OnboardingPage
   * state (the coach completed Stage 1 before arriving here).
   */
  const handleStage2Skip = () => {
    const profile = buildSkippedProfile(coachName, sports);
    console.log("[handleStage2Skip] coachName:", coachName, "sports:", sports, "→ saveProfile:", profile);
    saveProfile(profile);
    navigate("/");
  };

  const handleStage1Next = (name: string, selectedSports: string[]) => {
    setCoachName(name);
    setSports(selectedSports);
    setStage(2);
  };

  const handleChatComplete = async (messages: Message[]) => {
    setError(null);
    try {
      const transcript = messages
        .map((m) => `${m.role === "user" ? coachName : "KI"}: ${m.content}`)
        .join("\n\n");

      const raw = await sendMessage(
        [{ role: "user", content: `Hier ist das Gespräch mit dem Coach:\n\n${transcript}\n\nBitte extrahiere die strukturierten Informationen als JSON.` }],
        EXTRACTION_SYSTEM,
        "claude-sonnet-4-5"
      );

      let parsed: {
        philosophy: string;
        methods: string;
        targetGroup: string;
        experience: string;
        summary: string;
      };

      try {
        const jsonText = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        parsed = JSON.parse(jsonText) as typeof parsed;
      } catch {
        throw new Error("Profile could not be parsed. Please try again.");
      }

      // ── Merge with existing profile if it exists and isn't skipped ──
      const hasExisting = existingProfile && !existingProfile.skipped;

      const mergedStructured = {
        philosophy: parsed.philosophy?.trim() || (hasExisting ? existingProfile.structured?.philosophy : "") || "",
        methods:    parsed.methods?.trim()    || (hasExisting ? existingProfile.structured?.methods    : "") || "",
        targetGroup: parsed.targetGroup?.trim() || (hasExisting ? existingProfile.structured?.targetGroup : "") || "",
        experience: parsed.experience?.trim() || (hasExisting ? existingProfile.structured?.experience : "") || "",
      };

      const mergedSummary = hasExisting
        ? await mergeSummaries(existingProfile.summary ?? "", parsed.summary ?? "")
        : (parsed.summary ?? "");

      const profile: CoachProfile = {
        name: coachName,
        sports,
        structured: mergedStructured,
        summary: mergedSummary,
        completedAt: new Date().toISOString(),
      };

      saveProfile(profile);
      setStage(3);
    } catch (err) {
      console.error("Profile creation error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      // Reset the "creating" state in Stage2Chat via error display
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shadow-sm px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-none">Set Up Coach Profile</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stage === 1
                ? "Step 1 of 3 – Quick form"
                : stage === 2
                ? "Step 2 of 3 – AI conversation"
                : "Step 3 of 3 – Upload documents"}
            </p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <span className={cn("w-2 h-2 rounded-full", stage >= 1 ? "bg-primary" : "bg-muted")} />
          <span className={cn("w-2 h-2 rounded-full", stage >= 2 ? "bg-primary" : "bg-muted")} />
          <span className={cn("w-2 h-2 rounded-full", stage >= 3 ? "bg-primary" : "bg-muted")} />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-10">
        {stage === 1 ? (
          <div className="w-full max-w-md">
            <div className="text-center mb-8 space-y-2">
              <h2 className="text-2xl font-bold">Welcome!</h2>
              <p className="text-muted-foreground">
                Let's quickly set up your coach profile so the AI can get to know you better.
              </p>
            </div>
            <Stage1Form onNext={handleStage1Next} onSkip={handleStage1Skip} />
          </div>
        ) : stage === 2 ? (
          <div className="w-full max-w-2xl flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
            <div className="mb-4">
              <h2 className="text-xl font-bold">Let's talk, {coachName}</h2>
              <p className="text-sm text-muted-foreground">
                The AI will ask you a few questions to better understand your coaching philosophy.
                Answer as detailed as you like.
              </p>
            </div>

            {error && (
              <div className="mb-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
                {error}
                <button className="ml-2 underline text-xs" onClick={() => setError(null)}>
                  Dismiss
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0">
              <Stage2Chat
                coachName={coachName}
                sports={sports}
                onComplete={handleChatComplete}
                onSkip={handleStage2Skip}
              />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="text-center mb-8 space-y-2">
              <h2 className="text-2xl font-bold">Upload Documents</h2>
              <p className="text-muted-foreground">
                Upload existing training plans, studies, or other references.
                The AI will analyze them and enrich your coach profile.
              </p>
            </div>
            <Stage3Upload
              onFinish={() => navigate("/")}
              onSkip={() => navigate("/")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
