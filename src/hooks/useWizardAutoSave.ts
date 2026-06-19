import { useCallback, useRef, useState } from 'react';
import { useTrainingPrograms } from './useTrainingPrograms';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 3000;
const SAVED_DISPLAY_MS = 3000;
const ERROR_DISPLAY_MS = 5000;

function hasSaveableContent(): boolean {
  try {
    const raw = localStorage.getItem('macrocycleData');
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!data?.planName;
  } catch {
    return false;
  }
}

export function useWizardAutoSave() {
  const { saveCurrentSession } = useTrainingPrograms();
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDirty = useCallback(() => {
    if (!hasSaveableContent()) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveCurrentSession();
        setStatus('saved');
        resetTimerRef.current = setTimeout(() => setStatus('idle'), SAVED_DISPLAY_MS);
      } catch {
        setStatus('error');
        resetTimerRef.current = setTimeout(() => setStatus('idle'), ERROR_DISPLAY_MS);
      }
    }, DEBOUNCE_MS);
  }, [saveCurrentSession]);

  return { markDirty, status };
}
