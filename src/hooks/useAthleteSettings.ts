/**
 * useAthleteSettings
 *
 * Persists athlete-side UI preferences in localStorage.
 * Calling update() merges a partial patch and writes immediately.
 */
import { useState } from 'react';

const STORAGE_KEY = 'athlete_settings_v1';

interface AthleteSettings {
  /** Whether the Messages tab, notification bell, and exercise comments are visible. */
  chatEnabled: boolean;
}

const DEFAULTS: AthleteSettings = {
  chatEnabled: true,
};

function load(): AthleteSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(s: AthleteSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // quota or private-mode — ignore
  }
}

export function useAthleteSettings() {
  const [settings, setSettings] = useState<AthleteSettings>(load);

  const update = (patch: Partial<AthleteSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  };

  return { ...settings, update };
}
