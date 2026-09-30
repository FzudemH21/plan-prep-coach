/**
 * useSpeechInput — voice input for text fields (AI chat, onboarding, athlete notes).
 *
 * Records in the browser and turns the recording into text with Mistral Voxtral (EU) — the same
 * path as the anamnesis dictation (see src/utils/transcribe.ts): the recording is deleted right
 * after the transcription, only the text is kept. German and English are recognised
 * automatically. Replaces the browser's own speech recognition, which sent the audio to Google /
 * Microsoft / Apple, was fixed to German and doesn't exist in Firefox.
 *
 * The text arrives after the recording is stopped (a few seconds), not while speaking:
 * `onResult` is called once with the whole transcript.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { transcribeDictation } from "@/utils/transcribe";

export function useSpeechInput(onResult: (text: string) => void) {
  const { user } = useAuth();
  const { toast } = useToast();
  const recorder = useVoiceRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Always point to the latest onResult — prevents stale closures on re-renders
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const isSupported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";
  const isListening = recorder.state === "recording";

  useEffect(() => {
    if (recorder.error) toast({ title: "Voice input", description: recorder.error, variant: "destructive" });
  }, [recorder.error, toast]);

  const startListening = useCallback(() => {
    if (isTranscribing) return;
    void recorder.start();
  }, [recorder, isTranscribing]);

  /** Stops the recording; resolves once the text has been handed to onResult */
  const stopListening = useCallback(async () => {
    const audio = await recorder.stop();
    if (!audio || audio.size === 0 || !user) return;
    setIsTranscribing(true);
    try {
      const text = await transcribeDictation(audio, { coachUserId: user.id });
      if (text) onResultRef.current(text);
      else toast({ title: "Voice input", description: "No speech was recognised. Please try again." });
    } catch (err) {
      console.error("[useSpeechInput] transcription failed", err);
      toast({ title: "Voice input", description: "The recording could not be turned into text.", variant: "destructive" });
    } finally {
      setIsTranscribing(false);
    }
  }, [recorder, user, toast]);

  const toggle = useCallback(() => {
    if (isListening) void stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return { isListening, isTranscribing, startListening, stopListening, toggle, isSupported };
}
