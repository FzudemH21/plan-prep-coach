/**
 * TrainingPlanPDF.tsx
 *
 * Redesigned to match design_handoff_plan_prep_coach/ visual language:
 *   - Full-bleed dark cover with large adaptive title, athlete card, date strip
 *   - Goals page (flat goal cards, AI intro narrative)
 *   - Arc page (mesocycle overview with intensity stripes + mini-bar previews)
 *   - One page per mesocycle (intensity progression chart + rep week bar chart)
 *   - Methods / "The Why" closing page
 *
 * Fonts: Geist (body/UI), Geist Mono (numbers), Fraunces (display headlines).
 *   Served from public/fonts/ as plain URLs — no Vite ?url imports needed.
 * Colors: exact hex values from design_system/colors_and_type.css.
 * Accent: coach-configurable via branding.primaryColor (default #e2522b).
 */

import React from "react";
import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
  Circle,
} from "@react-pdf/renderer";

// ─── Font registration ────────────────────────────────────────────────────────
// Fonts are served from public/fonts/ — no module imports needed, just string URLs.
// This avoids Vite 8 / rolldown package.json exports restrictions.

Font.register({
  family: "Geist",
  fonts: [
    { src: "/fonts/Geist-Regular.ttf",   fontWeight: 400 },
    { src: "/fonts/Geist-Regular.ttf",   fontWeight: 400, fontStyle: "italic" }, // Geist has no italic — use regular as fallback
    { src: "/fonts/Geist-Medium.ttf",    fontWeight: 500 },
    { src: "/fonts/Geist-Medium.ttf",    fontWeight: 500, fontStyle: "italic" },
    { src: "/fonts/Geist-SemiBold.ttf",  fontWeight: 600 },
    { src: "/fonts/Geist-SemiBold.ttf",  fontWeight: 600, fontStyle: "italic" },
    { src: "/fonts/Geist-Bold.ttf",      fontWeight: 700 },
    { src: "/fonts/Geist-Bold.ttf",      fontWeight: 700, fontStyle: "italic" },
  ],
});

Font.register({
  family: "Geist Mono",
  fonts: [
    { src: "/fonts/GeistMono-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/GeistMono-Regular.ttf", fontWeight: 400, fontStyle: "italic" },
    { src: "/fonts/GeistMono-Bold.ttf",    fontWeight: 700 },
    { src: "/fonts/GeistMono-Bold.ttf",    fontWeight: 700, fontStyle: "italic" },
  ],
});

// Fraunces: woff format (react-pdf/fontkit supports woff, NOT woff2 or variable TTF).
// Static per-weight woff files from fonts.bunny.net — clean subsetting in pdfkit.
Font.register({
  family: "Fraunces",
  fonts: [
    { src: "/fonts/Fraunces-Regular.woff",  fontWeight: 400 },
    { src: "/fonts/Fraunces-Italic.woff",   fontWeight: 400, fontStyle: "italic" },
    { src: "/fonts/Fraunces-SemiBold.woff", fontWeight: 600 },
    { src: "/fonts/Fraunces-Bold.woff",     fontWeight: 700 },
  ],
});

// Disable hyphenation — prevents words breaking mid-character at line ends
Font.registerHyphenationCallback((word) => [word]);
import { TrainingProgram } from "@/hooks/useTrainingPrograms";
import { PlanNarrative, MesocycleNarrative } from "@/lib/generatePlanNarrative";
import type { DetailLevel } from "./ExportPDFButton";
import { ExerciseDistribution } from "@/types/microcycle-planning";

// ─── Design Tokens ────────────────────────────────────────────────────────────
// Source: design_handoff_plan_prep_coach/design_system/colors_and_type.css

const D = {
  ink:          "#0c0a09",
  inkFg:        "#fafaf9",
  bg:           "#ffffff",
  bgElev:       "#fafaf9",
  bgMuted:      "#f4f4f3",
  fg1:          "#18181b",
  fg2:          "#44403c",
  fg3:          "#78716c",
  fg4:          "#a8a29e",
  border:       "#e7e5e4",
  borderStrong: "#d6d3d1",
} as const;

const DEFAULT_ACCENT = "#e2522b";

/** Intensity palette — exact hex from design tokens */
const IC: Record<string, { bg: string; fg: string }> = {
  "off":             { bg: "#f2f2f2", fg: "#78716c" },
  "deload":          { bg: "#2e7a2e", fg: "#ffffff" },
  "easy":            { bg: "#33cc33", fg: "#ffffff" },
  "easy-moderate":   { bg: "#3d8df0", fg: "#ffffff" },
  "moderate":        { bg: "#f7c512", fg: "#0c0a09" },
  "moderate-hard":   { bg: "#f78d12", fg: "#ffffff" },
  "hard":            { bg: "#e22424", fg: "#ffffff" },
  "extremely-hard":  { bg: "#8f1f1f", fg: "#ffffff" },
  "extremely_hard":  { bg: "#8f1f1f", fg: "#ffffff" },
};

/** Bar height ratios (0–1) for intensity bar charts */
const IH: Record<string, number> = {
  "off":            0.06,
  "deload":         0.20,
  "easy":           0.30,
  "easy-moderate":  0.44,
  "moderate":       0.56,
  "moderate-hard":  0.70,
  "hard":           0.84,
  "extremely-hard": 1.00,
  "extremely_hard": 1.00,
};

const IL: Record<string, string> = {
  "off":            "Off",
  "deload":         "Deload",
  "easy":           "Easy",
  "easy-moderate":  "Easy–Mod",
  "moderate":       "Moderate",
  "moderate-hard":  "Mod–Hard",
  "hard":           "Hard",
  "extremely-hard": "Extremely Hard",
  "extremely_hard": "Extremely Hard",
};

function iColor(key: string) { return IC[key] ?? { bg: D.bgMuted, fg: D.fg3 }; }
function iLabel(key: string) { return IL[key] ?? key; }
function iHeight(key: string) { return IH[key] ?? 0.5; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

export interface PdfBranding {
  logoBase64?: string;
  primaryColor?: string;
  businessName?: string;
}

function lightenHex(hex: string, ratio = 0.84): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `#${[r, g, b]
    .map((c) => Math.round(c + (255 - c) * ratio).toString(16).padStart(2, "0"))
    .join("")}`;
}

function fmtDate(date: string): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return date;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  // Pages
  coverPage: {
    fontFamily: "Geist",
    backgroundColor: "#0c0a09",
    overflow: "hidden",
  },
  page: {
    fontFamily: "Geist",
    fontSize: 10,
    color: D.ink,
    backgroundColor: D.bg,
    paddingTop: 48,
    paddingBottom: 72,
    paddingHorizontal: 48,
  },

  // Page header (eyebrow + bold section title + optional right label)
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 14,
    marginBottom: 22,
    borderBottomWidth: 2,
    borderBottomColor: "#0c0a09",
  },
  eyebrow: {
    fontFamily: "Geist", fontWeight: 700,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: "Geist", fontWeight: 700,
    fontSize: 30,
    letterSpacing: -1.2,
    lineHeight: 1.0,
    color: "#0c0a09",
  },

  // Running footer (fixed on every non-cover page)
  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerStudio: {
    fontFamily: "Geist", fontWeight: 700,
    fontSize: 9,
    color: "#0c0a09",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  footerPage: {
    fontFamily: "Geist",
    fontSize: 10,
    color: "#78716c",
  },
  footerWatermark: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: "#a8a29e",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    fontFamily: "Geist",
  },

  // Body text
  body: {
    fontSize: 11.5,
    lineHeight: 1.55,
    color: "#44403c",
    marginBottom: 18,
  },

  // Arc overview row
  arcRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#fafaf9",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
  },

  // Method card on closing page
  methodCard: {
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
});

// ─── Data Types & Extraction ──────────────────────────────────────────────────

interface MesoPdfData {
  id: string;
  name: string;
  weeks: number;
  intensity: string;
  microcycles: Array<{ id: string; name: string; intensity: string }>;
  trainingDays: Array<{
    date: string;
    dayName: string;
    intensity: string;
    sessionNames?: string[];
    methods: string[];
  }>;
  methodsWithExercises: Array<{
    methodName: string;
    params: string;
    exercises: Array<{ name: string; param: string }>;
  }>;
}

function extractMesoData(
  program: TrainingProgram,
  selectedMesoIds?: string[],
): MesoPdfData[] {
  const allRawMesos = (
    (program.mesocycleData as { mesocycles?: unknown[] } | null)?.mesocycles ?? []
  ) as Array<{
    id?: string;
    name?: string;
    weeks?: number;
    intensity?: string;
    microcycles?: Array<{ id?: string; name?: string; intensity?: string }>;
  }>;

  const rawMesos =
    selectedMesoIds && selectedMesoIds.length > 0
      ? allRawMesos.filter((m, i) =>
          selectedMesoIds.includes(m.id ?? `meso_${i}`),
        )
      : allRawMesos;

  const trainingDays = (program.trainingDays ?? []) as Array<{
    date: string;
    dayName: string;
    mesocycleId: string;
    microcycleId: string;
    intensity: string;
    sessionNames?: string[];
  }>;

  const exercises = (program.exerciseDistribution ?? []) as ExerciseDistribution[];
  const paramValues = (program.parameterValues ?? {}) as Record<
    string,
    Record<number, Record<string, Record<number, Record<string, string | number>>>>
  >;

  return rawMesos.map((m, idx) => {
    const mesoId = m.id ?? `meso_${idx}`;
    const mesoTrainingDays = trainingDays.filter((td) => td.mesocycleId === mesoId);
    const mesoDateSet = new Set(mesoTrainingDays.map((td) => td.date));
    const mesoExercises = exercises.filter((ex) => mesoDateSet.has(ex.dayDate));

    const methodSet = new Set(mesoExercises.map((ex) => ex.methodId));
    const methods = Array.from(methodSet);

    const methodsWithExercises = methods.map((methodName) => {
      const methodExercises = mesoExercises
        .filter((ex) => ex.methodId === methodName)
        .sort((a, b) => a.order - b.order);
      const seen = new Set<string>();
      const unique = methodExercises.filter((ex) => {
        if (seen.has(ex.exerciseName)) return false;
        seen.add(ex.exerciseName);
        return true;
      });
      const mcParams = paramValues[mesoId]?.[0]?.[methodName]?.[0] ?? {};
      const paramParts: string[] = [];
      Object.entries(mcParams).forEach(([k, v]) => {
        if (v !== "" && v != null) paramParts.push(`${k}: ${v}`);
      });
      return {
        methodName,
        params: paramParts.join("  ·  "),
        exercises: unique.map((ex) => ({ name: ex.exerciseName, param: "" })),
      };
    });

    // Representative week = first microcycle's days
    const firstMicroId = (m.microcycles ?? [])[0]?.id;
    const firstMicroDays = firstMicroId
      ? mesoTrainingDays.filter((td) => td.microcycleId === firstMicroId)
      : mesoTrainingDays.slice(0, 7);

    const enrichedDays = firstMicroDays.map((td) => {
      const dayExercises = mesoExercises.filter((ex) => ex.dayDate === td.date);
      const dayMethods = [...new Set(dayExercises.map((ex) => ex.methodId))];
      return {
        date: td.date,
        dayName: td.dayName,
        intensity: td.intensity,
        sessionNames: td.sessionNames,
        methods: dayMethods,
      };
    });

    return {
      id: mesoId,
      name: m.name ?? `Phase ${idx + 1}`,
      weeks: m.weeks ?? 0,
      intensity: m.intensity ?? "",
      microcycles: (m.microcycles ?? []).map((mc, i) => ({
        id: mc.id ?? `mc_${i}`,
        name: mc.name ?? `Week ${i + 1}`,
        intensity: mc.intensity ?? "",
      })),
      trainingDays: enrichedDays,
      methodsWithExercises,
    };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BFooter({
  studioLabel,
}: {
  studioLabel: string;
}) {
  return (
    <>
      <View style={S.footer} fixed>
        <Text style={S.footerStudio}>{studioLabel}</Text>
        <Text
          style={S.footerPage}
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
      <Text style={S.footerWatermark} fixed>
        Created with plan-prep-coach
      </Text>
    </>
  );
}

function PageHdr({
  eyebrow,
  title,
  accent,
  right,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  right?: string;
}) {
  return (
    <View style={S.pageHeader}>
      <View>
        <Text style={[S.eyebrow, { color: accent }]}>{eyebrow}</Text>
        <Text style={S.sectionTitle}>{title}</Text>
      </View>
      {right ? (
        <Text style={{ fontFamily: "Geist", fontSize: 10, color: D.fg3 }}>
          {right}
        </Text>
      ) : null}
    </View>
  );
}

/** Mesocycle row for the arc overview page */
function ArcRow({ meso, ordinal }: { meso: MesoPdfData; ordinal: number }) {
  const col = iColor(meso.intensity);
  return (
    <View style={S.arcRow}>
      {/* 6-px intensity stripe */}
      <View style={{ width: 6, backgroundColor: col.bg }} />

      {/* Main content */}
      <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 5 }}>
          <Text style={{
            fontFamily: "Geist", fontSize: 9, color: D.fg3,
            letterSpacing: 1.8, textTransform: "uppercase",
          }}>
            M{String(ordinal).padStart(2, "0")}
          </Text>
          <Text style={{
            fontFamily: "Geist", fontWeight: 700, fontSize: 15, letterSpacing: -0.4,
            lineHeight: 1.05, color: D.ink, flex: 1,
          }}>
            {meso.name.toUpperCase()}
          </Text>
          {/* Intensity badge */}
          <View style={{
            backgroundColor: col.bg, borderRadius: 3,
            paddingVertical: 3, paddingHorizontal: 8,
          }}>
            <Text style={{
              fontFamily: "Geist", fontWeight: 700, fontSize: 7.5,
              letterSpacing: 1.4, textTransform: "uppercase", color: col.fg,
            }}>
              {iLabel(meso.intensity)}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: "Geist", fontSize: 9, color: D.fg3, letterSpacing: 0.4 }}>
          {meso.microcycles.length} MC{meso.weeks > 0 ? ` · ${meso.weeks}w` : ""}
        </Text>
      </View>

      {/* Micro bar mini-preview */}
      <View style={{
        paddingVertical: 10, paddingHorizontal: 12,
        flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: 4,
      }}>
        <Text style={{
          fontSize: 7, fontFamily: "Geist", fontWeight: 700, color: D.fg3,
          letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
        }}>
          Microcycles
        </Text>
        <View style={{ flexDirection: "row", gap: 3, alignItems: "flex-end", height: 28 }}>
          {meso.microcycles.map((mc, i) => {
            const c = iColor(mc.intensity);
            return (
              <View
                key={i}
                style={{
                  width: 9,
                  height: Math.max(2, iHeight(mc.intensity) * 28),
                  backgroundColor: c.bg,
                  borderRadius: 2,
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Bar chart: one bar per microcycle showing its intensity level */
function IntensityProgressionChart({
  microcycles,
}: {
  microcycles: MesoPdfData["microcycles"];
}) {
  if (microcycles.length === 0) return null;
  const BAR_AREA_H = 150; // fixed pixel budget for bars — prevents overflow into heading above
  const LABEL_BELOW_H = 18; // reserved height for week-name below each bar
  const nBars = microcycles.length;
  // Scale label font smaller as bars get narrower (more microcycles)
  const labelFontSz = Math.max(4.5, 6.5 - Math.max(0, nBars - 3) * 0.5);

  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={{
        fontFamily: "Geist", fontWeight: 700, fontSize: 8.5, letterSpacing: 1.8,
        textTransform: "uppercase", color: D.ink, marginBottom: 10,
      }}>
        Microcycle Intensity Progression
      </Text>
      {/* Each column = fixed bar area + reserved week-label row — no overflow into heading */}
      <View style={{ flexDirection: "row", gap: 5 }}>
        {microcycles.map((mc, i) => {
          const col = iColor(mc.intensity);
          const ratio = iHeight(mc.intensity);
          const barH = Math.max(4, ratio * BAR_AREA_H);
          const labelInside = ratio > 0.35;
          const fullLabel = iLabel(mc.intensity);

          return (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              {/* Fixed-height bar area — overflow hidden clips content so tall bars
                  never bleed into the chart heading above */}
              <View style={{
                height: BAR_AREA_H, width: "100%",
                justifyContent: "flex-end", alignItems: "center",
                overflow: "hidden",
              }}>
                {/* Label above bar (short bars only) */}
                {!labelInside && (
                  <Text style={{
                    fontSize: labelFontSz, fontFamily: "Geist", fontWeight: 700,
                    letterSpacing: 0.3, textTransform: "uppercase",
                    color: D.fg2, textAlign: "center", marginBottom: 2,
                  }}>
                    {fullLabel}
                  </Text>
                )}
                {/* Bar */}
                <View style={{
                  width: "100%", height: barH,
                  backgroundColor: col.bg, borderRadius: 3, alignItems: "center",
                  overflow: "hidden",
                }}>
                  {labelInside && (
                    <Text style={{
                      fontSize: labelFontSz, fontFamily: "Geist", fontWeight: 700,
                      letterSpacing: 0.3, textTransform: "uppercase",
                      color: col.fg, textAlign: "center", marginTop: 4,
                    }}>
                      {fullLabel}
                    </Text>
                  )}
                </View>
              </View>

              {/* Week label in its own reserved row — never competes with bars */}
              <View style={{ height: LABEL_BELOW_H, justifyContent: "flex-start", alignItems: "center" }}>
                <Text style={{
                  fontSize: 6.5, fontFamily: "Geist", fontWeight: 700, color: D.fg3,
                  textAlign: "center", marginTop: 4, letterSpacing: 0.2,
                }}>
                  {truncate(mc.name.replace(/^Week\s+/i, "Microcycle "), 15)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
/** Bar chart: one column per day of the representative microcycle */
function RepWeekChart({ trainingDays }: { trainingDays: MesoPdfData["trainingDays"] }) {
  if (trainingDays.length === 0) return null;
  const CHART_H = 130;
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayMap = new Map(trainingDays.map((td) => [td.dayName, td]));
  const days = DAY_NAMES.map((name) =>
    dayMap.get(name) ?? { dayName: name, intensity: "off", sessionNames: [], methods: [] },
  );

  return (
    <View>
      <View style={{
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 10,
      }}>
        <Text style={{
          fontFamily: "Geist", fontWeight: 700, fontSize: 8.5, letterSpacing: 1.8,
          textTransform: "uppercase", color: D.ink,
        }}>
          Representative Microcycle
        </Text>
        <Text style={{ fontFamily: "Geist", fontSize: 7.5, color: D.fg3, letterSpacing: 0.4 }}>
          INTENSITY · FOCUS · MAIN WORK
        </Text>
      </View>

      <View style={{
        flexDirection: "row", gap: 4,
        paddingTop: 8, paddingBottom: 10,
        borderTopWidth: 1, borderTopColor: D.border,
        borderBottomWidth: 1, borderBottomColor: D.border,
      }}>
        {days.map((day, i) => {
          const isOff = day.intensity === "off";
          const col = iColor(day.intensity);
          const ratio = iHeight(day.intensity);
          const barH = Math.max(3, ratio * CHART_H);
          const labelInside = ratio > 0.38;
          const sessionName = (day.sessionNames ?? [])[0] ?? "";
          const fullLabel = iLabel(day.intensity);

          return (
            <View
              key={i}
              style={{
                flex: 1, flexDirection: "column", alignItems: "center",
                opacity: isOff ? 0.5 : 1,
              }}
            >
              {/* Bar */}
              <View style={{ height: CHART_H, width: "100%", justifyContent: "flex-end", alignItems: "center", marginBottom: 5 }}>
                {!labelInside && !isOff && (
                  <Text style={{
                    fontSize: 5, fontFamily: "Geist", fontWeight: 700, letterSpacing: 0.3,
                    textTransform: "uppercase", color: D.fg2, textAlign: "center", marginBottom: 2,
                  }}>
                    {fullLabel}
                  </Text>
                )}
                <View style={{ width: "100%", height: barH, backgroundColor: col.bg, borderRadius: 2, alignItems: "center" }}>
                  {labelInside && (
                    <Text style={{
                      fontSize: 5, fontFamily: "Geist", fontWeight: 700, letterSpacing: 0.3,
                      textTransform: "uppercase", color: col.fg, textAlign: "center", marginTop: 3,
                    }}>
                      {fullLabel}
                    </Text>
                  )}
                </View>
              </View>

              {/* Day name */}
              <Text style={{
                fontFamily: "Geist", fontWeight: 700, fontSize: 7, color: D.fg3,
                letterSpacing: 1.1, marginBottom: 4, textAlign: "center",
              }}>
                {day.dayName.slice(0, 3).toUpperCase()}
              </Text>

              {/* Session focus */}
              {sessionName ? (
                <Text style={{
                  fontFamily: "Geist", fontWeight: 700, fontSize: 6.5, color: D.ink,
                  lineHeight: 1.25, textAlign: "center", marginBottom: 3,
                }}>
                  {sessionName}
                </Text>
              ) : null}

              {/* Main methods (italic) */}
              {day.methods.slice(0, 2).map((m, mi) => (
                <Text
                  key={mi}
                  style={{
                    fontSize: 5.5, color: D.fg3, lineHeight: 1.3,
                    textAlign: "center", fontStyle: "italic",
                  }}
                >
                  {m}
                </Text>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Document ────────────────────────────────────────────────────────────

interface TrainingPlanPDFProps {
  program: TrainingProgram;
  narrative: PlanNarrative;
  coachName?: string;
  branding?: PdfBranding;
  /** Which mesocycle IDs to include — undefined = all */
  selectedMesoIds?: string[];
  /** How deep the PDF renders */
  detailLevel?: DetailLevel;
  /** Athlete name/sport/team — looked up in ExportPDFButton from the Athlete record */
  athleteDisplayName?: string | null;
  athleteSport?: string | null;
  athleteTeam?: string | null;
}

export function TrainingPlanPDF({
  program,
  narrative,
  coachName,
  branding,
  selectedMesoIds,
  detailLevel = "overview",
  athleteDisplayName,
  athleteSport,
  athleteTeam,
}: TrainingPlanPDFProps) {
  // ── Brand ───────────────────────────────────────────────────────────────────
  const accent       = branding?.primaryColor ?? DEFAULT_ACCENT;
  const accentLight  = lightenHex(accent, 0.84);
  const businessName = branding?.businessName;
  const logoBase64   = branding?.logoBase64;
  const studioLabel  = businessName ?? coachName ?? "plan-prep-coach";

  // ── Plan data ────────────────────────────────────────────────────────────────
  const macro = program.macrocycleData;

  interface SmartGoalRaw {
    id?: string;
    description?: string;
    baselineValue?: number | null;
    desiredValue?: number | null;
    unit?: string | null;
    percentChange?: number | null;
  }

  interface SubGoalRaw {
    id?: string;
    parentGoalId?: string;
    description?: string;
    preTestValue?: number | null;
    goalValue?: number | null;
    unit?: string | null;
    percentChange?: number | null;
    testMethod?: string | null;
    isDerived?: boolean;
  }

  const smartGoals: SmartGoalRaw[] = macro?.smartGoals?.length
    ? (macro.smartGoals as SmartGoalRaw[])
    : program.primaryGoal
    ? [{ description: program.primaryGoal }]
    : [];

  const subGoals: SubGoalRaw[] = (macro?.subGoals ?? []) as SubGoalRaw[];

  // Total goal count for badge (main + sub)
  const goals = smartGoals.map((g) => g.description ?? "").filter(Boolean);

  const methods = [
    ...(macro?.selectedMethods ?? []),
    ...((macro?.manuallyAddedMethods ?? []).map(
      (m: { name?: string; method?: string }) => m.name ?? m.method ?? "",
    )),
  ].filter(Boolean) as string[];

  const mesoPdfData  = extractMesoData(program, selectedMesoIds);
  const athleteName  = athleteDisplayName || program.athleteName || "Athlete";
  const planName     = program.name ?? "Training Plan";
  const totalWeeks   = program.duration?.weeks ?? 0;
  const startDate    = program.duration?.startDate ? fmtDate(program.duration.startDate) : "";
  const endDate      = program.duration?.endDate   ? fmtDate(program.duration.endDate)   : "";
  const totalMicrocycles = mesoPdfData.reduce((s, m) => s + m.microcycles.length, 0);

  // Cover title split at em-dash / en-dash / hyphen
  const sep = planName.match(/[—–-]/);
  let coverPrimary   = planName;
  let coverSecondary = "";
  if (sep) {
    const idx      = planName.indexOf(sep[0]);
    coverPrimary   = planName.slice(0, idx).trim();
    coverSecondary = planName.slice(idx + 1).trim();
  }
  const longest       = Math.max(coverPrimary.length, coverSecondary.length);
  const coverFontSize = longest > 18 ? 42 : longest > 12 ? 54 : 68;

  // Athlete initials (for avatar circle)
  const initials = athleteName
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Page-number helpers for eyebrows
  const goalsPage  = goals.length > 0;
  let pageOrdinal  = 1; // cover
  const nextOrdinal = () => {
    pageOrdinal += 1;
    return String(pageOrdinal).padStart(2, "0");
  };

  return (
    <Document
      title={`${planName} — ${athleteName}`}
      author={businessName ?? coachName ?? "Plan Prep Coach"}
      subject="Training Plan"
    >

      {/* ─────────────────────────────────────────────────────────────────────
          PAGE 1 — COVER
          ───────────────────────────────────────────────────────────────────── */}
      <Page size="A4" style={S.coverPage}>

        {/* Decorative large microcycle-count watermark */}
        {totalMicrocycles > 0 && (
          <Text style={{
            position: "absolute", top: -40, right: -24,
            fontFamily: "Geist", fontWeight: 700,
            fontSize: 280, letterSpacing: -18,
            color: accent, opacity: 0.13,
          }}>
            {totalMicrocycles}
          </Text>
        )}

        {/* Top bar: logo / business name + date */}
        <View style={{
          position: "absolute", top: 48, left: 48, right: 48,
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        }}>
          {logoBase64 ? (
            <Image
              src={logoBase64}
              style={{ height: 26, objectFit: "contain" as const }}
            />
          ) : (
            <Text style={{
              fontFamily: "Geist", fontWeight: 700, fontSize: 12, color: D.inkFg,
              letterSpacing: 2, textTransform: "uppercase",
            }}>
              {businessName ?? ""}
            </Text>
          )}
          <Text style={{ fontFamily: "Geist", fontSize: 9, color: D.fg4, letterSpacing: 0.4 }}>
            {new Date().toISOString().split("T")[0]}
          </Text>
        </View>

        {/* Plan title */}
        <View style={{ position: "absolute", left: 48, right: 48, top: 155 }}>
          <Text style={{
            fontFamily: "Geist", fontWeight: 700, fontSize: 10, letterSpacing: 3.2,
            textTransform: "uppercase", color: accent, marginBottom: 18,
          }}>
            Macrocycle{totalMicrocycles > 0 ? ` · ${totalMicrocycles} Microcycles` : ""}
          </Text>
          <Text style={{
            fontFamily: "Geist", fontWeight: 700,
            fontSize: coverFontSize,
            lineHeight: 0.88,
            letterSpacing: -1.5,
            textTransform: "uppercase",
            color: D.inkFg,
          }}>
            {coverPrimary}
          </Text>
          {coverSecondary ? (
            <Text style={{
              fontFamily: "Geist", fontWeight: 700,
              fontSize: coverFontSize,
              lineHeight: 0.88,
              letterSpacing: -1.5,
              textTransform: "uppercase",
              color: accent,
            }}>
              {coverSecondary}
            </Text>
          ) : null}
        </View>

        {/* Athlete / coach card */}
        <View style={{
          position: "absolute", left: 48, right: 48, bottom: 98,
          flexDirection: "row", alignItems: "center",
          padding: 18,
          backgroundColor: "rgba(255,255,255,0.07)",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.13)",
        }}>
          {/* Avatar */}
          <View style={{
            width: 50, height: 50, borderRadius: 25,
            backgroundColor: accent,
            alignItems: "center", justifyContent: "center",
            marginRight: 16,
          }}>
            <Text style={{
              fontFamily: "Geist", fontWeight: 700, fontSize: 17,
              color: "#ffffff", letterSpacing: -0.5,
            }}>
              {initials}
            </Text>
          </View>

          {/* Athlete info */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 8, fontFamily: "Geist", fontWeight: 700,
              letterSpacing: 2, textTransform: "uppercase",
              color: D.fg4, marginBottom: 4,
            }}>
              Programmed for
            </Text>
            <Text style={{
              fontFamily: "Geist", fontWeight: 700, fontSize: 19,
              letterSpacing: -0.5, lineHeight: 1, color: "#ffffff",
            }}>
              {athleteName}
            </Text>
            {(athleteSport || athleteTeam) && (
              <Text style={{ fontSize: 10, color: D.fg4, marginTop: 4 }}>
                {[athleteSport, athleteTeam].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>

          {/* Coach info */}
          {(coachName || businessName) && (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{
                fontSize: 8, fontFamily: "Geist", fontWeight: 700,
                letterSpacing: 2, textTransform: "uppercase",
                color: D.fg4, marginBottom: 4,
              }}>
                Coach
              </Text>
              {coachName && (
                <Text style={{ fontFamily: "Geist", fontWeight: 700, fontSize: 13, color: "#ffffff" }}>
                  {coachName}
                </Text>
              )}
              {businessName && (
                <Text style={{ fontSize: 9.5, color: D.fg4, marginTop: 2 }}>
                  {businessName}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Date strip */}
        <View style={{
          position: "absolute", left: 48, right: 48, bottom: 52,
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)",
        }}>
          <Text style={{
            fontFamily: "Geist", fontSize: 9, color: D.fg4,
            letterSpacing: 0.6, textTransform: "uppercase",
          }}>
            {startDate}
          </Text>
          <Text style={{
            fontFamily: "Geist", fontWeight: 700, fontSize: 9, letterSpacing: 3.2,
            textTransform: "uppercase", color: accent,
          }}>
            {totalMicrocycles > 0 ? `→ ${totalMicrocycles} Microcycles` : "→"}
            {totalWeeks > 0 ? ` · ${totalWeeks}W` : ""} →
          </Text>
          <Text style={{
            fontFamily: "Geist", fontSize: 9, color: D.fg4,
            letterSpacing: 0.6, textTransform: "uppercase",
          }}>
            {endDate}
          </Text>
        </View>

        {/* Watermark */}
        <Text style={{
          position: "absolute", bottom: 14, left: 0, right: 0,
          textAlign: "center", fontSize: 8, letterSpacing: 1.8,
          textTransform: "uppercase", fontFamily: "Geist",
          color: "rgba(255,255,255,0.25)",
        }}>
          Created with plan-prep-coach
        </Text>
      </Page>

      {/* ─────────────────────────────────────────────────────────────────────
          PAGE 2 — GOALS  (skipped if no goals)
          ───────────────────────────────────────────────────────────────────── */}
      {goalsPage && (
        <Page size="A4" style={S.page}>
          <PageHdr
            eyebrow={`${nextOrdinal()} / The Mission`}
            title="GOALS"
            accent={accent}
            right={`${goals.length + subGoals.length} goal${goals.length + subGoals.length !== 1 ? "s" : ""}`}
          />

          {narrative.intro ? (
            <Text style={S.body}>{narrative.intro}</Text>
          ) : null}

          {/* ── Goals hierarchy: two-row grid (main goals / sub-goals) + bezier connectors ── */}
          {(() => {
            const CONTENT_W = 499; // A4 595 − 2×48 padding
            const CONNECTOR_H = 160;
            const MAIN_GAP = 10;
            const SUB_GAP = 8;
            const DOT_R = 3;

            const fmt = (v: number | null | undefined) =>
              v == null ? "" : Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");

            // scale: applied to fonts + padding based on card width
            // Calculated after nMain/nSub are known — placeholder fn, overridden below
            const makeValueStrip = (scale: number) =>
              ({ baseline, target, unit, pct }: {
                baseline?: number | null; target?: number | null;
                unit?: string | null; pct?: string;
              }) => {
                const labelSz  = Math.max(5,   6.5 * scale);
                const valueSz  = Math.max(7.5, 11  * scale);
                const arrowSz  = Math.max(8,   11  * scale);
                const padV     = Math.round(Math.max(4, 8 * scale));
                return (
                  <View style={{
                    flexDirection: "row",
                    // align to bottom so arrow sits level with the value text, not the label
                    alignItems: "flex-end",
                    borderTopWidth: 1, borderTopColor: "#444444",
                    paddingTop: padV, marginTop: padV,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontFamily: "Geist", fontWeight: 700, fontSize: labelSz,
                        letterSpacing: 1.2, textTransform: "uppercase",
                        color: D.fg3, marginBottom: 1,
                      }}>Baseline</Text>
                      <Text style={{ fontFamily: "Geist Mono", fontWeight: 400, fontSize: valueSz, color: D.fg3 }}>
                        {fmt(baseline)}{unit ? ` ${unit}` : ""}
                      </Text>
                    </View>
                    <Text style={{
                      fontFamily: "Geist", fontSize: arrowSz, color: accent,
                      marginHorizontal: Math.round(4 * scale), marginBottom: 0,
                    }}>{"→"}</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{
                        fontFamily: "Geist", fontWeight: 700, fontSize: labelSz,
                        letterSpacing: 1.2, textTransform: "uppercase",
                        color: D.fg3, marginBottom: 1,
                      }}>Target</Text>
                      <Text style={{ fontFamily: "Geist Mono", fontWeight: 700, fontSize: valueSz, color: "#ffffff" }}>
                        {fmt(target)}{unit ? ` ${unit}` : ""}{pct ?? ""}
                      </Text>
                    </View>
                  </View>
                );
              };

            // Only export sub-goals that have actual goal values set (baseline or target).
            // Sub-goals without values are derived parameters shown in the wizard but not
            // meaningful in the athlete-facing PDF (they have no measurable target).
            const subsWithValues = subGoals.filter(
              sg => sg.preTestValue != null || sg.goalValue != null
            );

            // Build ordered sub-goal list: parented first (sorted by parent order), orphans after
            const parentIds = new Set(smartGoals.map(g => g.id).filter(Boolean));
            const parentedSubs = subsWithValues.filter(sg => sg.parentGoalId && parentIds.has(sg.parentGoalId));
            const orphanSubs   = subsWithValues.filter(sg => !sg.parentGoalId || !parentIds.has(sg.parentGoalId));
            const allSubs = [...parentedSubs, ...orphanSubs];

            // Connections: map each sub-goal → main goal index
            const nMain = smartGoals.length;
            const nSub  = allSubs.length;
            const mainGap = MAIN_GAP;
            const subGap  = SUB_GAP;
            const mainCardW = nMain > 0 ? (CONTENT_W - Math.max(0, nMain - 1) * mainGap) / nMain : CONTENT_W;
            const subCardW  = nSub  > 0 ? (CONTENT_W - Math.max(0, nSub  - 1) * subGap)  / nSub  : CONTENT_W;
            const mainCX = (i: number) => i * (mainCardW + mainGap) + mainCardW / 2;
            const subCX  = (j: number) => j * (subCardW  + subGap)  + subCardW  / 2;

            // Adaptive scale: shrink fonts/padding as cards get narrower
            // 240pt = comfortable 2-col main width; 170pt = comfortable 3-col sub width
            const mainScale = Math.min(1.0, Math.max(0.60, mainCardW / 240));
            const subScale  = Math.min(1.0, Math.max(0.60, subCardW  / 170));
            const MainValueStrip = makeValueStrip(mainScale);
            const SubValueStrip  = makeValueStrip(subScale);

            // ── Main→Sub connections (parentGoalId → SmartGoal) ──────────────
            const connections: Array<{ mainIdx: number; subIdx: number }> = [];
            allSubs.forEach((sub, subIdx) => {
              if (!sub.parentGoalId) return;
              const mainIdx = smartGoals.findIndex(g => g.id === sub.parentGoalId);
              if (mainIdx >= 0) connections.push({ mainIdx, subIdx });
            });

            // ── Sub→Sub connections (parentGoalId → another SubGoal) ─────────
            // These are drawn as a shallow arch BELOW the sub-goal row so they
            // are visually distinct from the main→sub connectors above.
            const SUB_ARCH_H = 32; // depth of the arch below the sub-goal cards
            const subConnections: Array<{ parentSubIdx: number; childSubIdx: number }> = [];
            allSubs.forEach((sub, childSubIdx) => {
              if (!sub.parentGoalId) return;
              // Skip if already handled as a main→sub connection
              if (smartGoals.findIndex(g => g.id === sub.parentGoalId) >= 0) return;
              const parentSubIdx = allSubs.findIndex(s => s.id === sub.parentGoalId);
              // Guard against self-reference and missing parents
              if (parentSubIdx >= 0 && parentSubIdx !== childSubIdx) {
                subConnections.push({ parentSubIdx, childSubIdx });
              }
            });

            const mid = CONNECTOR_H / 2;

            return (
              <View>
                {/* ── Row 1: main goal cards ── */}
                <View style={{ flexDirection: "row", gap: mainGap }}>
                  {smartGoals.map((sg, i) => {
                    const hasValues = sg.baselineValue != null || sg.desiredValue != null;
                    const pct = sg.percentChange != null
                      ? ` (${sg.percentChange > 0 ? "+" : ""}${sg.percentChange.toFixed(1)}%)`
                      : "";
                    const pad = Math.round(Math.max(8, 12 * mainScale));
                    return (
                      <View key={sg.id ?? i} style={{ flex: 1, backgroundColor: "#1e1e1e", borderRadius: 10, padding: pad }}>
                        <Text style={{
                          fontFamily: "Geist", fontWeight: 700,
                          fontSize: Math.max(5.5, 7.5 * mainScale),
                          letterSpacing: 1.8, textTransform: "uppercase",
                          color: accent, marginBottom: Math.round(4 * mainScale),
                        }}>Main Goal</Text>
                        <Text style={{
                          fontFamily: "Geist", fontWeight: 700,
                          fontSize: Math.max(8, 13 * mainScale),
                          color: "#ffffff", lineHeight: 1.25,
                        }}>
                          {sg.description ?? ""}
                        </Text>
                        {hasValues && (
                          <MainValueStrip
                            baseline={sg.baselineValue} target={sg.desiredValue}
                            unit={sg.unit} pct={pct}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* ── Main→Sub bezier connector SVG ── */}
                {connections.length > 0 && (
                  <Svg width={CONTENT_W} height={CONNECTOR_H}>
                    {connections.map(({ mainIdx, subIdx }, ci) => (
                      <Path
                        key={`curve-${ci}`}
                        d={`M ${mainCX(mainIdx)} 0 C ${mainCX(mainIdx)} ${mid} ${subCX(subIdx)} ${mid} ${subCX(subIdx)} ${CONNECTOR_H}`}
                        stroke={accentLight}
                        strokeWidth="1.2"
                        fill="none"
                      />
                    ))}
                    {connections.map(({ mainIdx }, ci) => (
                      <Circle key={`dt-${ci}`} cx={mainCX(mainIdx)} cy={DOT_R + 1} r={DOT_R} fill={accentLight} />
                    ))}
                    {connections.map(({ subIdx }, ci) => (
                      <Circle key={`db-${ci}`} cx={subCX(subIdx)} cy={CONNECTOR_H - DOT_R - 1} r={DOT_R} fill={accentLight} />
                    ))}
                  </Svg>
                )}
                {connections.length === 0 && allSubs.length > 0 && (
                  <View style={{ height: 14 }} />
                )}

                {/* ── Row 2: sub-goal cards ── */}
                {allSubs.length > 0 && (
                  <View style={{ flexDirection: "row", gap: subGap }}>
                    {allSubs.map((sub, j) => {
                      const subHas = sub.preTestValue != null || sub.goalValue != null;
                      const subPct = sub.percentChange != null
                        ? ` (${sub.percentChange > 0 ? "+" : ""}${sub.percentChange.toFixed(1)}%)`
                        : "";
                      const pad = Math.round(Math.max(6, 10 * subScale));
                      return (
                        <View key={sub.id ?? j} style={{ flex: 1, backgroundColor: "#4a4a4a", borderRadius: 8, padding: pad }}>
                          <Text style={{
                            fontFamily: "Geist", fontWeight: 700,
                            fontSize: Math.max(5, 6.5 * subScale),
                            letterSpacing: 1.4, textTransform: "uppercase",
                            color: accentLight, marginBottom: Math.round(3 * subScale),
                          }}>Sub-Goal</Text>
                          <Text style={{
                            fontFamily: "Geist", fontWeight: 700,
                            fontSize: Math.max(7, 11 * subScale),
                            color: "#ffffff", lineHeight: 1.25,
                          }}>
                            {sub.description ?? ""}
                          </Text>
                          {subHas && (
                            <SubValueStrip
                              baseline={sub.preTestValue} target={sub.goalValue}
                              unit={sub.unit} pct={subPct}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* ── Sub→Sub arch SVG (below sub-goal cards) ──
                    Drawn as a downward arch so it is visually separate from the
                    main→sub connectors above. Both connections on the same sub-goal
                    are shown simultaneously — nothing is removed. */}
                {subConnections.length > 0 && (
                  <Svg width={CONTENT_W} height={SUB_ARCH_H}>
                    {subConnections.map(({ parentSubIdx, childSubIdx }, ci) => (
                      <Path
                        key={`subcurve-${ci}`}
                        d={`M ${subCX(parentSubIdx)} 0 C ${subCX(parentSubIdx)} ${SUB_ARCH_H} ${subCX(childSubIdx)} ${SUB_ARCH_H} ${subCX(childSubIdx)} 0`}
                        stroke={accentLight}
                        strokeWidth="1.0"
                        strokeDasharray="3,2"
                        fill="none"
                      />
                    ))}
                    {/* Endpoint dots — one at each sub-goal involved */}
                    {subConnections.map(({ parentSubIdx }, ci) => (
                      <Circle key={`sdt-${ci}`} cx={subCX(parentSubIdx)} cy={DOT_R} r={DOT_R} fill={accentLight} />
                    ))}
                    {subConnections.map(({ childSubIdx }, ci) => (
                      <Circle key={`sdb-${ci}`} cx={subCX(childSubIdx)} cy={DOT_R} r={DOT_R} fill={accentLight} />
                    ))}
                  </Svg>
                )}
              </View>
            );
          })()}

          <BFooter studioLabel={studioLabel} />
        </Page>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          PAGE 3 — ARC (mesocycle overview)
          ───────────────────────────────────────────────────────────────────── */}
      {mesoPdfData.length > 0 && (
        <Page size="A4" style={S.page}>
          <PageHdr
            eyebrow={`${nextOrdinal()} / The Arc`}
            title={`${mesoPdfData.length} MESOCYCLE${mesoPdfData.length !== 1 ? "S" : ""}`}
            accent={accent}
            right="MACROCYCLE STRUCTURE"
          />
          <Text style={S.body}>
            {`The macrocycle is divided into ${mesoPdfData.length} block${mesoPdfData.length !== 1 ? "s" : ""}. Each has a focus, an overall intensity character, and a stack of microcycles. The story moves from base to peak.`}
          </Text>
          <View>
            {mesoPdfData.map((meso, i) => (
              <ArcRow key={meso.id} meso={meso} ordinal={i + 1} />
            ))}
          </View>
          <BFooter studioLabel={studioLabel} />
        </Page>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          PAGES 4..N — ONE PAGE PER MESOCYCLE
          ───────────────────────────────────────────────────────────────────── */}
      {mesoPdfData.map((meso, i) => {
        const mesoNarrObj =
          narrative.mesocycles.find(
            (mn) => mn.name.toLowerCase() === meso.name.toLowerCase(),
          ) ?? narrative.mesocycles[i];
        const mesoNarr = mesoNarrObj?.narrative ?? "";
        const col      = iColor(meso.intensity);

        return (
          <Page key={meso.id} size="A4" style={S.page}>
            {/* Header: eyebrow + title + intensity badge + meta.
                Left side gets flex:1 so the title wraps/shrinks instead of
                overflowing into the intensity badge on the right. */}
            {(() => {
              const n = meso.name.length;
              const mesoTitleSz = n > 28 ? 20 : n > 22 ? 24 : n > 16 ? 26 : 30;
              return (
                <View style={S.pageHeader}>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <Text style={[S.eyebrow, { color: accent }]}>
                      {nextOrdinal()} / Mesocycle {String(i + 1).padStart(2, "0")}
                    </Text>
                    <Text style={[S.sectionTitle, { fontSize: mesoTitleSz }]}>
                      {meso.name.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexShrink: 0 }}>
                    <View style={{
                      backgroundColor: col.bg, borderRadius: 4,
                      paddingVertical: 5, paddingHorizontal: 10,
                    }}>
                      <Text style={{
                        fontFamily: "Geist", fontWeight: 700, fontSize: 8.5,
                        letterSpacing: 1.6, textTransform: "uppercase", color: col.fg,
                      }}>
                        {iLabel(meso.intensity)}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "Geist", fontSize: 10, color: D.fg3 }}>
                      {meso.microcycles.length} MC{meso.weeks > 0 ? ` · ${meso.weeks}w` : ""}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Description block with intensity-colored left bar */}
            {mesoNarr ? (
              <View style={{
                flexDirection: "row", alignItems: "stretch",
                marginBottom: 20, gap: 12,
              }}>
                <View style={{ width: 5, backgroundColor: col.bg, borderRadius: 2 }} />
                <Text style={{ flex: 1, fontSize: 12, color: D.fg1, lineHeight: 1.55 }}>
                  {mesoNarr}
                </Text>
              </View>
            ) : null}

            {/* Microcycle intensity progression chart (microcycles + full-week) */}
            {detailLevel !== "overview" && (
              <IntensityProgressionChart microcycles={meso.microcycles} />
            )}

            {/* Overview only: compact intensity chip row */}
            {detailLevel === "overview" && meso.microcycles.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                {meso.microcycles.map((mc, mi) => {
                  const c = iColor(mc.intensity);
                  return (
                    <View
                      key={mi}
                      style={{
                        backgroundColor: c.bg, borderRadius: 3,
                        paddingVertical: 3, paddingHorizontal: 8,
                      }}
                    >
                      <Text style={{ fontFamily: "Geist", fontWeight: 700, fontSize: 7.5, color: c.fg }}>
                        W{mi + 1}: {iLabel(mc.intensity)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Microcycle narratives (microcycles detail level) */}
            {detailLevel === "microcycles" &&
              mesoNarrObj?.microcycles &&
              mesoNarrObj.microcycles.length > 0 && (
                <View style={{ marginBottom: 18, gap: 6 }}>
                  {mesoNarrObj.microcycles.map((mc: MesocycleNarrative["microcycles"][number], mi: number) => {
                    const mcData = meso.microcycles[mi];
                    const c = mcData ? iColor(mcData.intensity) : { bg: D.bgMuted, fg: D.fg3 };
                    return (
                      <View key={mi} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                        <View style={{
                          backgroundColor: c.bg, borderRadius: 3,
                          paddingVertical: 3, paddingHorizontal: 7,
                          flexShrink: 0, marginTop: 1,
                        }}>
                          <Text style={{ fontFamily: "Geist", fontWeight: 700, fontSize: 7.5, color: c.fg }}>
                            W{mi + 1}
                          </Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: 9.5, color: D.fg2, lineHeight: 1.5 }}>
                          {mc.narrative}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

            {/* Representative training week chart (full-week only) */}
            {detailLevel === "full-week" && meso.trainingDays.length > 0 && (
              <View style={{ marginBottom: 18 }}>
                <RepWeekChart trainingDays={meso.trainingDays} />
              </View>
            )}


            <BFooter studioLabel={studioLabel} />
          </Page>
        );
      })}

      {/* ─────────────────────────────────────────────────────────────────────
          FINAL PAGE — THE WHY (methods + coach closing)
          ───────────────────────────────────────────────────────────────────── */}
      {(narrative.closing || methods.length > 0) && (
        <Page size="A4" style={S.page}>
          <PageHdr
            eyebrow={`${nextOrdinal()} / The Why`}
            title="SCIENCE BEHIND IT"
            accent={accent}
          />

          {/* Coach closing narrative */}
          {narrative.closing ? (
            <View style={{ flexDirection: "row", alignItems: "stretch", marginBottom: 22, gap: 12 }}>
              <View style={{ width: 4, backgroundColor: accent, borderRadius: 2 }} />
              <Text style={{ flex: 1, fontSize: 12, color: D.fg1, lineHeight: 1.6 }}>
                {narrative.closing}
              </Text>
            </View>
          ) : null}

          {/* Methods list */}
          {methods.length > 0 && (
            <View>
              <Text style={{
                fontFamily: "Geist", fontWeight: 700, fontSize: 8.5,
                letterSpacing: 1.8, textTransform: "uppercase",
                color: D.ink, marginBottom: 10,
              }}>
                Training Methods Used
              </Text>
              <View style={{ gap: 0 }}>
                {methods.map((method, i) => (
                  <View
                    key={i}
                    style={[S.methodCard, { borderLeftColor: accent }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      <Text style={{
                        fontFamily: "Geist", fontWeight: 700, fontSize: 18,
                        color: accent, letterSpacing: -0.5,
                        lineHeight: 1, width: 26,
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </Text>
                      <Text style={{
                        fontFamily: "Geist", fontWeight: 700, fontSize: 11.5,
                        color: D.ink, lineHeight: 1.2, flex: 1,
                        textTransform: "uppercase",
                      }}>
                        {method}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <BFooter studioLabel={studioLabel} />
        </Page>
      )}
    </Document>
  );
}
