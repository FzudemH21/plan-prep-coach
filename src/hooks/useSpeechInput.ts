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
 * @param onResult  called with the final transcript when recognition ends
 * @param lang      BCP-47 language tag, defaults to "de-DE"
 */
export function useSpeechInput(onResult: (text: string) => void, lang = "de-DE") {
  const [isListening, setIsListening] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
  const isSupported = getSRCtor() !== null;

  const startListening = useCallback(() => {
    const SR = getSRCtor();
    if (!SR || ref.current) return;

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      onResult(transcript);
    };

    recognition.onend = () => {
      ref.current = null;
      setIsListening(false);
    };

    recognition.onerror = () => {
      ref.current = null;
      setIsListening(false);
    };

    ref.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [lang, onResult]);

  const stopListening = useCallback(() => {
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
