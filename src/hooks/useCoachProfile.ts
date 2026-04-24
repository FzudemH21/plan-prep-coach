import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// ─── Storage keys ──────────────────────────────────────────────────────────────
/** Original localStorage key — read once for v1→v2 migration, then removed. */
const LEGACY_KEY = "coachProfile";
/** Mirrors the last known Supabase state so hasCoachProfile() can stay sync. */
const CACHE_KEY = "coachProfile_cache";

// ─── Types ─────────────────────────────────────────────────────────────────────
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

// ─── Cache helpers (sync, no network) ─────────────────────────────────────────
function readCache(): CoachProfile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    // Accept skipped-only profiles
    if (p.skipped === true) return parsed as CoachProfile;
    // Accept full profiles
    if ("name" in p && "completedAt" in p) return parsed as CoachProfile;
    return null;
  } catch {
    return null;
  }
}

function writeCache(profile: CoachProfile | null): void {
  if (profile) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(CACHE_KEY);
  }
}

// ─── Legacy reader (migration only) ───────────────────────────────────────────
function readLegacy(): CoachProfile | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (p.skipped === true) return parsed as CoachProfile;
    if ("name" in p && "completedAt" in p) return parsed as CoachProfile;
    return null;
  } catch {
    return null;
  }
}

// ─── Supabase row → CoachProfile ──────────────────────────────────────────────
// DB schema: id | user_id | name (text) | data (jsonb) | created_at | updated_at
// Everything except `name` lives in the jsonb `data` column.
function rowToProfile(row: Record<string, unknown>): CoachProfile {
  return {
    name: (row.name as string) ?? "",
    ...((row.data as object) ?? {}),
  } as CoachProfile;
}

// ─── Supabase upsert (insert or update on user_id conflict) ───────────────────
async function upsertRow(userId: string, profile: CoachProfile): Promise<void> {
  const { name, ...data } = profile;
  const { error } = await supabase.from("coach_profiles").upsert(
    {
      user_id: userId,
      name: name ?? "",
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

// ─── hasCoachProfile — sync, reads cache (used by HomeGuard in App.tsx) ────────
export function hasCoachProfile(): boolean {
  return readCache() !== null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCoachProfile() {
  const { user } = useAuth();

  // Initialise synchronously from cache → no UI flicker on revisits
  const [profile, setProfileState] = useState<CoachProfile | null>(readCache);

  // ── Load from Supabase on mount / when the logged-in user changes ─────────────
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from("coach_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[useCoachProfile] load error:", error);
        return;
      }

      if (data) {
        // ── Row exists — use it as the source of truth ──────────────────────────
        const loaded = rowToProfile(data as Record<string, unknown>);
        setProfileState(loaded);
        writeCache(loaded);
        // Remove any residual legacy key so it's never migrated twice
        localStorage.removeItem(LEGACY_KEY);
      } else {
        // ── No Supabase row — check for legacy localStorage data to migrate ──────
        const legacy = readLegacy();
        if (legacy) {
          try {
            await upsertRow(user.id, legacy);
            setProfileState(legacy);
            writeCache(legacy);
            localStorage.removeItem(LEGACY_KEY);
          } catch (migrateErr) {
            console.error("[useCoachProfile] migration error:", migrateErr);
          }
        } else {
          // Truly no profile anywhere
          setProfileState(null);
          writeCache(null);
        }
      }
    })();
  }, [user?.id]);

  // ── saveProfile — optimistic: state + cache first, Supabase in background ─────
  const saveProfile = useCallback(
    async (newProfile: CoachProfile): Promise<void> => {
      setProfileState(newProfile);
      writeCache(newProfile);
      if (!user) return;
      try {
        await upsertRow(user.id, newProfile);
      } catch (err) {
        console.error("[useCoachProfile] save error:", err);
      }
    },
    [user]
  );

  // ── clearProfile — optimistic: state + cache first, Supabase in background ────
  const clearProfile = useCallback(async (): Promise<void> => {
    setProfileState(null);
    writeCache(null);
    localStorage.removeItem(LEGACY_KEY);
    if (!user) return;
    const { error } = await supabase
      .from("coach_profiles")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      console.error("[useCoachProfile] clear error:", error);
    }
  }, [user]);

  return { profile, saveProfile, clearProfile };
}
