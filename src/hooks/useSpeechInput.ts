import { useState, useRef, useCallback } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSRCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Thin wrapper around the Web Speech API.
 * - continuous: keeps listening until manually stopped
 * - auto-restarts on unexpected browser timeouts
 * - ignores onresult events fired after an intentional stop
 * - uses a ref for onResult so the latest callback is always called (no stale closures)
 * @param onResult  called with each new final transcript chunk
 * @param lang      BCP-47 language tag, defaults to "de-DE"
 */
export function useSpeechInput(onResult: (text: string) => void, lang = "de-DE") {
  const [isListening, setIsListening] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
  const intentionalStop = useRef(false);
  const isSupported = getSRCtor() !== null;

  // Always point to the latest onResult — prevents stale closures on re-renders
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const startListening = useCallback(() => {
    const SR = getSRCtor();
    if (!SR || ref.current) return;

    intentionalStop.current = false;

    const makeRecognition = (): SpeechRecognition => {
      const recognition = new SR();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        if (intentionalStop.current) return;
        const transcript = Array.from(e.results)
          .slice(e.resultIndex)
          .filter((r) => r.isFinal)
          .map((r) => r[0].transcript)
          .join("");
        // Always call the latest onResult via ref — never a stale closure
        if (transcript) onResultRef.current(transcript);
      };

      recognition.onend = () => {
        if (!intentionalStop.current) {
          // Browser timed out due to silence — restart automatically
          ref.current = null;
          const next = makeRecognition();
          ref.current = next;
          setTimeout(() => {
            if (!intentionalStop.current) {
              try { next.start(); } catch { /* ignore race-condition start errors */ }
            } else {
              ref.current = null;
              setIsListening(false);
            }
          }, 150);
          return;
        }
        ref.current = null;
        setIsListening(false);
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        const error = (e as { error?: string }).error ?? "";
        if (error === "no-speech" || error === "network") return;
        intentionalStop.current = true;
        ref.current = null;
        setIsListening(false);
      };

      return recognition;
    };

    const recognition = makeRecognition();
    ref.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [lang]);

  const stopListening = useCallback(() => {
    intentionalStop.current = true;
    ref.current?.stop();
    ref.current = null;
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return { isListening, startListening, stopListening, toggle, isSupported };
}
