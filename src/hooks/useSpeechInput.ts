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
 * @param onResult  called with each new final transcript chunk
 * @param lang      BCP-47 language tag, defaults to "de-DE"
 */
export function useSpeechInput(onResult: (text: string) => void, lang = "de-DE") {
  const [isListening, setIsListening] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
  const intentionalStop = useRef(false);
  const isSupported = getSRCtor() !== null;

  const startListening = useCallback(() => {
    const SR = getSRCtor();
    if (!SR || ref.current) return;

    intentionalStop.current = false;

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      // Ignore any results that fire after we intentionally stopped
      if (intentionalStop.current) return;
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join("");
      if (transcript) onResult(transcript);
    };

    recognition.onend = () => {
      if (!intentionalStop.current) {
        // Browser timed out due to silence — restart automatically
        ref.current = null;
        const SR2 = getSRCtor();
        if (!SR2) return;
        const next = new SR2();
        next.lang = lang;
        next.continuous = true;
        next.interimResults = true;
        next.onresult = recognition.onresult;
        next.onend = recognition.onend;
        next.onerror = recognition.onerror;
        ref.current = next;
        next.start();
        return;
      }
      ref.current = null;
      setIsListening(false);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      // no-speech is normal during pauses — let onend handle the restart
      if ((e as { error?: string }).error === "no-speech") return;
      intentionalStop.current = true;
      ref.current = null;
      setIsListening(false);
    };

    ref.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [lang, onResult]);

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
