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
 * Font: Helvetica (react-pdf built-in — Geist requires font registration files).
 * Colors: exact hex values from design_system/colors_and_type.css.
 * Accent: coach-configurable via branding.primaryColor (default #e2522b).
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
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
    fontFamily: "Helvetica",
    backgroundColor: "#0c0a09",
    overflow: "hidden",
  },
  page: {
    fontFamily: "Helvetica",
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
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 30,
    letterSpacing: -0.8,
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
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#0c0a09",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  footerPage: {
    fontFamily: "Helvetica",
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
    fontFamily: "Helvetica",
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
  studioName,
}: {
  studioName: string;
}) {
  return (
    <>
      <View style={S.footer} fixed>
        <Text style={S.footerStudio}>{studioName}</Text>
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
        <Text style={{ fontFamily: "Helvetica", fontSize: 10, color: D.fg3 }}>
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
            fontFamily: "Helvetica", fontSize: 9, color: D.fg3,
            letterSpacing: 1.8, textTransform: "uppercase",
          }}>
            M{String(ordinal).padStart(2, "0")}
          </Text>
          <Text style={{
            fontFamily: "Helvetica-Bold", fontSize: 15, letterSpacing: -0.4,
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
              fontFamily: "Helvetica-Bold", fontSize: 7.5,
              letterSpacing: 1.4, textTransform: "uppercase", color: col.fg,
            }}>
              {iLabel(meso.intensity)}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: "Helvetica", fontSize: 9, color: D.fg3, letterSpacing: 0.4 }}>
          {meso.microcycles.length} MC{meso.weeks > 0 ? ` · ${meso.weeks}w` : ""}
        </Text>
      </View>

      {/* Micro bar mini-preview */}
      <View style={{
        paddingVertical: 10, paddingHorizontal: 12,
        flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: 4,
      }}>
        <Text style={{
          fontSize: 7, fontFamily: "Helvetica-Bold", color: D.fg3,
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
  const CHART_H = 150;

  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={{
        fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 1.8,
        textTransform: "uppercase", color: D.ink, marginBottom: 10,
      }}>
        Microcycle Intensity Progression
      </Text>
      <View style={{ flexDirection: "row", gap: 5, height: CHART_H, alignItems: "flex-end" }}>
        {microcycles.map((mc, i) => {
          const col = iColor(mc.intensity);
          const ratio = iHeight(mc.intensity);
          const barH = Math.max(4, ratio * CHART_H);
          const labelInside = ratio > 0.35;
          const shortLabel = iLabel(mc.intensity).replace("Extremely Hard", "X-Hard");

          return (
            <View
              key={i}
              style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}
            >
              {/* Label above bar when bar is too short */}
              {!labelInside && (
                <Text style={{
                  fontSize: 5.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.4,
                  textTransform: "uppercase", color: D.fg2, textAlign: "center", marginBottom: 2,
                }}>
                  {shortLabel}
                </Text>
              )}
              {/* Bar */}
              <View style={{
                width: "100%", height: barH,
                backgroundColor: col.bg, borderRadius: 3, alignItems: "center",
              }}>
                {labelInside && (
                  <Text style={{
                    fontSize: 5.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.4,
                    textTransform: "uppercase", color: col.fg, textAlign: "center", marginTop: 4,
                  }}>
                    {shortLabel}
                  </Text>
                )}
              </View>
              {/* Microcycle name below bar */}
              <Text style={{
                fontSize: 6.5, fontFamily: "Helvetica-Bold", color: D.fg3,
                textAlign: "center", marginTop: 4, letterSpacing: 0.2,
              }}>
                {truncate(mc.name.replace(/Microcycle\s*/i, "MC "), 10)}
              </Text>
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
          fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 1.8,
          textTransform: "uppercase", color: D.ink,
        }}>
          Representative Microcycle
        </Text>
        <Text style={{ fontFamily: "Helvetica", fontSize: 7.5, color: D.fg3, letterSpacing: 0.4 }}>
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
          const shortLabel = iLabel(day.intensity).replace("Extremely Hard", "X-Hard");

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
                    fontSize: 5, fontFamily: "Helvetica-Bold", letterSpacing: 0.3,
                    textTransform: "uppercase", color: D.fg2, textAlign: "center", marginBottom: 2,
                  }}>
                    {shortLabel}
                  </Text>
                )}
                <View style={{ width: "100%", height: barH, backgroundColor: col.bg, borderRadius: 2, alignItems: "center" }}>
                  {labelInside && (
                    <Text style={{
                      fontSize: 5, fontFamily: "Helvetica-Bold", letterSpacing: 0.3,
                      textTransform: "uppercase", color: col.fg, textAlign: "center", marginTop: 3,
                    }}>
                      {shortLabel}
                    </Text>
                  )}
                </View>
              </View>

              {/* Day name */}
              <Text style={{
                fontFamily: "Helvetica-Bold", fontSize: 7, color: D.fg3,
                letterSpacing: 1.1, marginBottom: 4, textAlign: "center",
              }}>
                {day.dayName.slice(0, 3).toUpperCase()}
              </Text>

              {/* Session focus */}
              {sessionName ? (
                <Text style={{
                  fontFamily: "Helvetica-Bold", fontSize: 6.5, color: D.ink,
                  lineHeight: 1.25, textAlign: "center", marginBottom: 3,
                }}>
                  {truncate(sessionName, 16)}
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
                  {truncate(m, 18)}
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
}

export function TrainingPlanPDF({
  program,
  narrative,
  coachName,
  branding,
  selectedMesoIds,
  detailLevel = "overview",
}: TrainingPlanPDFProps) {
  // ── Brand ───────────────────────────────────────────────────────────────────
  const accent       = branding?.primaryColor ?? DEFAULT_ACCENT;
  const accentLight  = lightenHex(accent, 0.84);
  const businessName = branding?.businessName;
  const logoBase64   = branding?.logoBase64;
  const studioLabel  = businessName ?? coachName ?? "plan-prep-coach";

  // ── Plan data ────────────────────────────────────────────────────────────────
  const macro = program.macrocycleData;
  const goals = (
    macro?.smartGoals
      ?.map((g: { description?: string }) => g.description)
      .filter(Boolean) ??
    (program.primaryGoal ? [program.primaryGoal] : [])
  ) as string[];

  const methods = [
    ...(macro?.selectedMethods ?? []),
    ...((macro?.manuallyAddedMethods ?? []).map(
      (m: { name?: string; method?: string }) => m.name ?? m.method ?? "",
    )),
  ].filter(Boolean) as string[];

  const mesoPdfData  = extractMesoData(program, selectedMesoIds);
  const athleteName  = program.athleteName ?? "Athlete";
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
            fontFamily: "Helvetica-Bold",
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
              fontFamily: "Helvetica-Bold", fontSize: 12, color: D.inkFg,
              letterSpacing: 2, textTransform: "uppercase",
            }}>
              {businessName ?? ""}
            </Text>
          )}
          <Text style={{ fontFamily: "Helvetica", fontSize: 9, color: D.fg4, letterSpacing: 0.4 }}>
            {new Date().toISOString().split("T")[0]}
          </Text>
        </View>

        {/* Plan title */}
        <View style={{ position: "absolute", left: 48, right: 48, top: 155 }}>
          <Text style={{
            fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 3.2,
            textTransform: "uppercase", color: accent, marginBottom: 18,
          }}>
            Macrocycle{totalMicrocycles > 0 ? ` · ${totalMicrocycles} Microcycles` : ""}
          </Text>
          <Text style={{
            fontFamily: "Helvetica-Bold",
            fontSize: coverFontSize,
            lineHeight: 0.92,
            letterSpacing: -2,
            color: D.inkFg,
            textTransform: "uppercase",
          }}>
            {coverPrimary.toUpperCase()}
          </Text>
          {coverSecondary ? (
            <Text style={{
              fontFamily: "Helvetica-Bold",
              fontSize: coverFontSize,
              lineHeight: 0.92,
              letterSpacing: -2,
              color: accent,
              textTransform: "uppercase",
            }}>
              {coverSecondary.toUpperCase()}
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
              fontFamily: "Helvetica-Bold", fontSize: 17,
              color: "#ffffff", letterSpacing: -0.5,
            }}>
              {initials}
            </Text>
          </View>

          {/* Athlete info */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 8, fontFamily: "Helvetica-Bold",
              letterSpacing: 2, textTransform: "uppercase",
              color: D.fg4, marginBottom: 4,
            }}>
              Programmed for
            </Text>
            <Text style={{
              fontFamily: "Helvetica-Bold", fontSize: 19,
              letterSpacing: -0.5, lineHeight: 1, color: "#ffffff",
            }}>
              {athleteName}
            </Text>
            {(macro?.athleteSport || macro?.athleteTeam) && (
              <Text style={{ fontSize: 10, color: D.fg4, marginTop: 4 }}>
                {[macro?.athleteSport, macro?.athleteTeam].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>

          {/* Coach info */}
          {(coachName || businessName) && (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{
                fontSize: 8, fontFamily: "Helvetica-Bold",
                letterSpacing: 2, textTransform: "uppercase",
                color: D.fg4, marginBottom: 4,
              }}>
                Coach
              </Text>
              {coachName && (
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, color: "#ffffff" }}>
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
            fontFamily: "Helvetica", fontSize: 9, color: D.fg4,
            letterSpacing: 0.6, textTransform: "uppercase",
          }}>
            {startDate}
          </Text>
          <Text style={{
            fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 3.2,
            textTransform: "uppercase", color: accent,
          }}>
            {totalMicrocycles > 0 ? `→ ${totalMicrocycles} Microcycles` : "→"}
            {totalWeeks > 0 ? ` · ${totalWeeks}W` : ""} →
          </Text>
          <Text style={{
            fontFamily: "Helvetica", fontSize: 9, color: D.fg4,
            letterSpacing: 0.6, textTransform: "uppercase",
          }}>
            {endDate}
          </Text>
        </View>

        {/* Watermark */}
        <Text style={{
          position: "absolute", bottom: 14, left: 0, right: 0,
          textAlign: "center", fontSize: 8, letterSpacing: 1.8,
          textTransform: "uppercase", fontFamily: "Helvetica",
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
            right={`${goals.length} goal${goals.length !== 1 ? "s" : ""}`}
          />

          {narrative.intro ? (
            <Text style={S.body}>{narrative.intro}</Text>
          ) : null}

          <View style={{ gap: 8 }}>
            {goals.map((goal, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row", alignItems: "flex-start",
                  backgroundColor: D.ink, borderRadius: 10,
                  padding: 14, gap: 12,
                }}
              >
                <Text style={{
                  fontFamily: "Helvetica-Bold", fontSize: 20,
                  color: accent, letterSpacing: -0.5,
                  lineHeight: 1, width: 30,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </Text>
                <Text style={{
                  fontFamily: "Helvetica-Bold", fontSize: 12,
                  color: "#ffffff", lineHeight: 1.35, flex: 1,
                }}>
                  {goal}
                </Text>
              </View>
            ))}
          </View>

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
            {/* Header: eyebrow + title + intensity badge + meta */}
            <View style={S.pageHeader}>
              <View>
                <Text style={[S.eyebrow, { color: accent }]}>
                  {nextOrdinal()} / Mesocycle {String(i + 1).padStart(2, "0")}
                </Text>
                <Text style={S.sectionTitle}>{meso.name.toUpperCase()}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <View style={{
                  backgroundColor: col.bg, borderRadius: 4,
                  paddingVertical: 5, paddingHorizontal: 10,
                }}>
                  <Text style={{
                    fontFamily: "Helvetica-Bold", fontSize: 8.5,
                    letterSpacing: 1.6, textTransform: "uppercase", color: col.fg,
                  }}>
                    {iLabel(meso.intensity)}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Helvetica", fontSize: 10, color: D.fg3 }}>
                  {meso.microcycles.length} MC{meso.weeks > 0 ? ` · ${meso.weeks}w` : ""}
                </Text>
              </View>
            </View>

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
                      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7.5, color: c.fg }}>
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
                          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7.5, color: c.fg }}>
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

            {/* Methods used in this mesocycle */}
            {meso.methodsWithExercises.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={{
                  fontFamily: "Helvetica-Bold", fontSize: 8.5,
                  letterSpacing: 1.8, textTransform: "uppercase",
                  color: D.ink, marginBottom: 8,
                }}>
                  Methods
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {meso.methodsWithExercises.map((m, mi) => (
                    <View
                      key={mi}
                      style={{
                        backgroundColor: D.ink, borderRadius: 999,
                        paddingVertical: 4, paddingHorizontal: 10,
                      }}
                    >
                      <Text style={{
                        fontFamily: "Helvetica-Bold", fontSize: 8,
                        color: "#ffffff", letterSpacing: 0.3,
                      }}>
                        {m.methodName}
                      </Text>
                    </View>
                  ))}
                </View>
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
                fontFamily: "Helvetica-Bold", fontSize: 8.5,
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
                        fontFamily: "Helvetica-Bold", fontSize: 18,
                        color: accent, letterSpacing: -0.5,
                        lineHeight: 1, width: 26,
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </Text>
                      <Text style={{
                        fontFamily: "Helvetica-Bold", fontSize: 11.5,
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
