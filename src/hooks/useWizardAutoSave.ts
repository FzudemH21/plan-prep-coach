import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Always the latest save (it closes over the current programs list)
  const saveRef = useRef(saveCurrentSession);
  saveRef.current = saveCurrentSession;

  const runSave = useCallback(async () => {
    timerRef.current = null;
    setStatus('saving');
    try {
      await saveRef.current();
      setStatus('saved');
      resetTimerRef.current = setTimeout(() => setStatus('idle'), SAVED_DISPLAY_MS);
    } catch {
      setStatus('error');
      resetTimerRef.current = setTimeout(() => setStatus('idle'), ERROR_DISPLAY_MS);
    }
  }, []);

  const markDirty = useCallback(() => {
    if (!hasSaveableContent()) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    timerRef.current = setTimeout(runSave, DEBOUNCE_MS);
  }, [runSave]);

  // Leaving the page (or the tab) with a save still waiting: save now. Otherwise a change made in
  // the last 3 s was lost when the plan was left and reopened quickly — reopening loads the saved
  // version, and the late save then stored that old version again.
  useEffect(() => {
    const flush = () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      void saveRef.current().catch(() => {});
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return { markDirty, status };
}
