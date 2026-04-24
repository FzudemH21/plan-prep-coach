import { useState, useCallback } from "react";

const STORAGE_KEY = "coachProfile";

export interface CoachProfileStructured {
  philosophy: string;
  methods: string;
  targetGroup: string;
  experience: string;
}

export interface CoachProfile {
  name: string;
  sports: string[];
  structured: CoachProfileStructured;
  summary: string;
  completedAt: string;
  /** Set to true when the user explicitly skipped onboarding */
  skipped?: boolean;
}

function loadProfile(): CoachProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    // Migration: accept skipped profiles (no name/completedAt required)
    if ("skipped" in parsed && (parsed as Record<string, unknown>).skipped === true) {
      return parsed as CoachProfile;
    }
    // Migration: full profile requires name + completedAt
    if ("name" in parsed && "completedAt" in parsed) {
      return parsed as CoachProfile;
    }
    return null;
  } catch {
    return null;
  }
}

export function useCoachProfile() {
  const [profile, setProfileState] = useState<CoachProfile | null>(loadProfile);

  const saveProfile = useCallback((newProfile: CoachProfile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
    setProfileState(newProfile);
  }, []);

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProfileState(null);
  }, []);

  return { profile, saveProfile, clearProfile };
}

export function hasCoachProfile(): boolean {
  return loadProfile() !== null;
}
