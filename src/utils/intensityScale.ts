/**
 * intensityScale.ts — Single source of truth for the Borg CR10 intensity scale.
 *
 * Replaces the old 8-level string scale (off → extremely-hard).
 * All intensity colors, labels, helpers, and migration live here.
 * Do NOT duplicate any of this logic in components.
 */

// ── Type ──────────────────────────────────────────────────────────────────────

export type BorgLevel = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";

export const BORG_LEVELS: BorgLevel[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// ── Scale definition ───────────────────────────────────────────────────────────

interface BorgEntry {
  level: BorgLevel;
  label: string;
  bgHex: string;   // background color (used as fill / badge bg)
  fgHex: string;   // foreground text color that ensures readability on bgHex
}

export const BORG_SCALE: BorgEntry[] = [
  { level: "0",  label: "Rest",             bgHex: "#94a3b8", fgHex: "#ffffff" },
  { level: "1",  label: "Very, Very Easy",  bgHex: "#14532d", fgHex: "#ffffff" },
  { level: "2",  label: "Easy",             bgHex: "#4ade80", fgHex: "#1a1a1a" },
  { level: "3",  label: "Moderate",         bgHex: "#fef08a", fgHex: "#1a1a1a" },
  { level: "4",  label: "Somewhat Hard",    bgHex: "#eab308", fgHex: "#ffffff" },
  { level: "5",  label: "Hard",             bgHex: "#f97316", fgHex: "#ffffff" },
  { level: "6",  label: "Hard+",            bgHex: "#ea580c", fgHex: "#ffffff" },
  { level: "7",  label: "Very Hard",        bgHex: "#f87171", fgHex: "#1a1a1a" },
  { level: "8",  label: "Very Hard+",       bgHex: "#ef4444", fgHex: "#ffffff" },
  { level: "9",  label: "Extremely Hard",   bgHex: "#991b1b", fgHex: "#ffffff" },
  { level: "10", label: "Maximal",          bgHex: "#111827", fgHex: "#ffffff" },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

const _byLevel = Object.fromEntries(BORG_SCALE.map((e) => [e.level, e])) as Record<BorgLevel, BorgEntry>;

/** Background hex for a given Borg level (safe fallback: moderate). */
export function getBorgBg(level: BorgLevel): string {
  return _byLevel[level]?.bgHex ?? "#f97316";
}

/** Foreground text hex that is readable on top of getBorgBg(). */
export function getBorgFg(level: BorgLevel): string {
  return _byLevel[level]?.fgHex ?? "#ffffff";
}

/** Human-readable label (e.g. "Hard+"). */
export function getBorgLabel(level: BorgLevel): string {
  return _byLevel[level]?.label ?? level;
}

/** Short label with number prefix, e.g. "5 – Hard". */
export function getBorgLabelFull(level: BorgLevel): string {
  return `${level} – ${getBorgLabel(level)}`;
}

/** Numeric value 0–10. */
export function getBorgValue(level: BorgLevel): number {
  return parseInt(level, 10);
}

/** BorgLevel from a 0–10 numeric index (clamped). */
export function getBorgFromValue(value: number): BorgLevel {
  const clamped = Math.max(0, Math.min(10, Math.round(value)));
  return String(clamped) as BorgLevel;
}

// ── Type guard ────────────────────────────────────────────────────────────────

export function isBorgLevel(value: unknown): value is BorgLevel {
  return typeof value === "string" && BORG_LEVELS.includes(value as BorgLevel);
}

// ── Migration ─────────────────────────────────────────────────────────────────

/** Maps legacy 8-level string values to Borg CR10. */
const LEGACY_MAP: Record<string, BorgLevel> = {
  "off":              "0",
  "deload":           "1",
  "easy":             "2",
  "easy-moderate":    "4",
  "moderate":         "5",
  "moderate-hard":    "6",
  "hard":             "7",
  "extremely-hard":   "9",
  "extremely_hard":   "9",
};

/**
 * Converts any intensity value — legacy or current — to a valid BorgLevel.
 * Safe to call on already-migrated values (returns them unchanged).
 */
export function migrateLegacyIntensity(value: unknown): BorgLevel {
  if (typeof value !== "string") return "5";
  if (isBorgLevel(value)) return value;
  return LEGACY_MAP[value] ?? "5";
}

// ── CSS helpers ───────────────────────────────────────────────────────────────

/**
 * Returns a Tailwind-safe inline style object for a Borg level background.
 * Use this instead of dynamic Tailwind class names (which are purged).
 */
export function getBorgStyle(level: BorgLevel): React.CSSProperties {
  return {
    backgroundColor: getBorgBg(level),
    color: getBorgFg(level),
  };
}

/**
 * Returns a semi-transparent background style (for calendar cells, column headers etc.)
 */
export function getBorgStyleLight(level: BorgLevel, opacity = 0.25): React.CSSProperties {
  // Convert hex to rgba
  const hex = getBorgBg(level).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`,
  };
}

// React import for CSSProperties (type-only, no runtime cost)
import type React from "react";
