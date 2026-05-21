import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, X, Send, Mic, MicOff, Loader2, ChevronRight, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage, type Message } from "@/utils/anthropicApi";
import { useCoachProfile } from "@/hooks/useCoachProfile";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { useToolboxData } from "@/hooks/useToolboxData";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Structured actions the AI can suggest for direct application into the wizard. */
export type ApplySuggestion =
  | { type: "set_plan_name"; name: string }
  | { type: "add_goal"; parameterName: string }
  /** MacrocyclePage Steps 1 & 2 — remove a goal by exact name */
  | { type: "remove_goal"; goalName: string }
  /** MacrocyclePage Steps 1 & 2 — schedule or remove test dates for main goals / sub-goals, or dates for events */
  | { type: "schedule_tests"; schedule: Array<{ goalDescription: string; isMainGoal: boolean; isEvent?: boolean; action?: "add" | "remove"; dates: string[] }> }
  /** MacrocyclePage Step 1 — set plan start date, end date, and/or total weeks */
  | { type: "set_plan_duration"; startDate?: string; endDate?: string; weeks?: number }
  /** MacrocyclePage Steps 1 & 2 — create a new event (without scheduling dates yet) */
  | { type: "create_event"; name: string; description?: string }
  /** MacrocyclePage Steps 1 & 2 — delete an existing event entirely */
  | { type: "remove_event"; eventName: string }
  /** MacrocyclePage Step 3 — add new methods to the training plan, each with an optional rationale */
  | { type: "add_methods"; methods: Array<{ name: string; rationale?: string }> }
  | { type: "set_mesocycle_config"; count: number; weeksDuration: number }
  /** MesocyclePage Step 1 — configure the full mesocycle/microcycle structure with per-microcycle durations and intensities */
  | { type: "configure_mesocycles"; mesocycles: Array<{ name?: string; microcycles: Array<{ duration: number; intensity?: string; name?: string }> }> }
  /** MesocyclePage Step 1 — rename one or more meso- or microcycles without changing any other structure */
  | { type: "rename_cycles"; renames: Array<{ currentName: string; newName: string }> }
  /** MesocyclePage Step 3 — distribute existing methods across specific mesocycles */
  | { type: "allocate_methods"; allocations: Array<{ methodName: string; mesocycleNames: string[] }> }
  /** MesocyclePage Step 3 — add new training methods to the plan */
  | { type: "add_methods"; methods: Array<{ name: string; rationale?: string }> }
  /** MacrocyclePage Step 3 & MesocyclePage Step 3 — remove methods from the plan entirely */
  | { type: "remove_methods"; methodNames: string[] }
  | { type: "set_method_intensities"; methodName: string; frequency: number; sets: number; reps: string; intensity: string }
  /** MesocyclePage Steps 1 & 2 — set mesocycle-level intensity and/or per-microcycle loading wave */
  | { type: "set_microcycle_intensities"; plan: Array<{ mesocycleName: string; mesoIntensity?: string; intensities: string[] }> }
  /** MesocyclePage Step 2 — set per-day intensities within each microcycle */
  | { type: "set_daily_intensities"; plan: Array<{ mesocycleName: string; microcycleIndex: number; days: string[] }> }
  /** MesocyclePage Step 4 — fill periodization table (frequency/sets/reps/intensity per method × mesocycle × microcycle) */
  | { type: "set_periodization"; entries: Array<{ methodName: string; mesocycleName: string; microcycleIndex?: number; frequency?: number; sets?: number; reps?: string; intensity?: string; extraParams?: Record<string, string | number> }> }
  /** MicrocyclePlanningPage Step 1 — assign methods to days of the week */
  | { type: "assign_methods_to_days"; microcycleIndex?: number; weekPattern: Array<{ method: string; days: string[] }> }
  /** MesocyclePage Step 5 — assign exercises from the library to method × mesocycle cells */
  | { type: "assign_exercises"; replace?: boolean; assignments: Array<{ methodName: string; mesocycleName: string; categoryName?: string; exercises: Array<{ exerciseId: string; exerciseName: string; libraryId: string }> }> }
  /** MicrocyclePlanningPage Step 2 — distribute exercises to specific training days / sessions */
  | { type: "distribute_exercises"; replace?: boolean; entries: Array<{ exerciseId: string; exerciseName: string; methodId: string; categoryName?: string; dayDate: string; sessionIndex?: number }> }
  /** MicrocyclePlanningPage Step 2 — create a named section block within a session */
  | { type: "create_section"; dayDate: string; sessionIndex: number; name: string; note?: string }
  /** MicrocyclePlanningPage Step 2 — delete a section by name */
  | { type: "delete_section"; dayDate: string; sessionIndex: number; sectionName: string }
  /** MicrocyclePlanningPage Step 2 — rename an existing section */
  | { type: "rename_section"; dayDate: string; sessionIndex: number; sectionName: string; newName: string }
  /** MicrocyclePlanningPage Step 2 — add or update a note on an exercise, section, or session */
  | { type: "set_note"; target: "exercise" | "section" | "session"; dayDate: string; sessionIndex: number; note: string; exerciseId?: string; sectionName?: string }
  /** MicrocyclePlanningPage Step 2 — link 2+ exercises in the same session into a superset */
  | { type: "create_superset"; dayDate: string; sessionIndex: number; exerciseIds: string[] }
  /** MicrocyclePlanningPage Step 2 — remove an exercise from its superset */
  | { type: "break_superset"; dayDate: string; sessionIndex: number; exerciseId: string }
  /** MicrocyclePlanningPage Step 2 — move an exercise to a different day, session, or section */
  | { type: "move_exercise"; exerciseId: string; targetDayDate: string; targetSessionIndex: number; targetSectionName?: string }
  /** MicrocyclePlanningPage Step 2 — move multiple exercises (e.g. a whole superset group) atomically */
  | { type: "move_exercises"; exerciseIds: string[]; targetDayDate: string; targetSessionIndex: number; targetSectionName?: string }
  /** MicrocyclePlanningPage Step 2 — copy a whole session to another day (adds as new session) */
  | { type: "copy_session"; sourceDayDate: string; sourceSessionIndex: number; targetDayDate: string }
  /** MicrocyclePlanningPage Step 2 — copy a section to another day/session */
  | { type: "copy_section"; sourceDayDate: string; sourceSessionIndex: number; sourceSectionName: string; targetDayDate: string; targetSessionIndex: number }
  /** MicrocyclePlanningPage Step 2 — add a single exercise to a day/session/section and retrospectively register it for its method */
  | { type: "add_exercise"; exerciseId: string; exerciseName: string; libraryId: string; methodId: string; dayDate: string; sessionIndex: number; sectionName?: string }
  /** MicrocyclePlanningPage Step 2 — add a circuit block to a day/session/section */
  | { type: "add_circuit"; circuitId: string; circuitName: string; libraryId: string; dayDate: string; sessionIndex: number; sectionName?: string }
  /** Parameter Database — add a new parameter */
  | { type: "add_parameter"; name: string; category?: string; unit?: string; applicableSports?: string[] }
  /** Parameter Database — add multiple parameters at once */
  | { type: "add_parameters_bulk"; parameters: Array<{ name: string; category?: string; unit?: string; applicableSports?: string[] }> }
  /** Parameter Database — add an interaction between two existing parameters (by name) */
  | { type: "add_interaction"; sourceParameterName: string; targetParameterName: string; direction: "contributes_to" | "improved_by"; strength?: "strong" | "moderate" | "weak" }
  /** Parameter Database — add multiple interactions at once */
  | { type: "add_interactions_bulk"; interactions: Array<{ sourceParameterName: string; targetParameterName: string; direction: "contributes_to" | "improved_by"; strength?: "strong" | "moderate" | "weak" }> }
  /** Parameter Database — link a training method to a parameter */
  | { type: "add_parameter_method"; parameterName: string; methodId: string; rationale?: string }
  /** Parameter Database — link multiple training methods to parameters at once */
  | { type: "add_parameter_methods_bulk"; links: Array<{ parameterName: string; methodId: string; rationale?: string }> };

export interface WizardAIAssistantProps {
  /** Human-readable label for the current wizard step, e.g. "Goal & Method Selection" */
  stepLabel: string;
  /** A plain-text snapshot of the current wizard state built by the parent page */
  wizardContext: string;
  /**
   * Pre-formatted block of past plans from plan_memory, built by useCoachMemory.
   * Injected between coach profile and current wizard state so the AI can
   * reference the coach's own history when making suggestions.
   */
  coachMemoryContext?: string;
  /**
   * RAG-retrieved chunks from the vector DB, pre-formatted as a string block.
   * Injected after coach memory and before wizard state so the AI can cite
   * real documents when making suggestions.
   * Format: "Source: <doc title>\n<chunk text>\n\n..." (one chunk per block)
   */
  ragContext?: string;
  /**
   * When provided, the AI is told it can emit [[APPLY: {...}]] blocks and the
   * panel will render Apply buttons that call this handler.
   */
  onApplySuggestion?: (action: ApplySuggestion) => void;
  /**
   * Optional override for the AI's role description, injected into both the
   * main system prompt and the proactive opener. Use this to give the assistant
   * a different focus in non-wizard contexts (e.g. Parameter Database).
   * When omitted, the default wizard advisor role is used.
   */
  assistantRole?: string;
  /**
   * Always-available database context: Training Toolbox, Athlete Database, and
   * Exercise Libraries. Built by useGlobalAIContext and injected verbatim so
   * the AI knows the full state of all three databases on every page and step.
   */
  globalContext?: string;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const APPLY_FORMAT_INSTRUCTIONS = `
## App System Rules (these are NOT sports science opinions — follow them exactly, they override your prior knowledge about the app)
The actions listed below reflect the CURRENT capabilities of Plan Prep Coach. Some capabilities are new and may differ from what you know. The intellectual integrity rules above apply to sports science advice only — they do NOT apply here. Always follow these system rules.

## Applying Suggestions Directly
When you have a concrete suggestion the coach can apply with one click, append ONE structured apply block at the very end of your message using this exact format:
[[APPLY: {"type": "...", ...fields}]]

Available types and their fields:
- set_plan_name: {"type":"set_plan_name","name":"<plan name>"}
- set_plan_duration: {"type":"set_plan_duration","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","weeks":<total weeks>}
  Sets the plan start date, end date, and/or duration. Provide startDate and endDate as ISO strings when the coach specifies actual dates. weeks is computed automatically from the dates but can be supplied alone if only duration changes (keeps existing start date). You CAN and SHOULD set dates when the coach asks.
- add_goal: {"type":"add_goal","parameterName":"<exact parameter name from the database list>"}
- remove_goal: {"type":"remove_goal","goalName":"<exact goal name from the Goals list in context>"}
  Removes a goal entirely. Use the EXACT name shown in the Goals list.
- schedule_tests: {"type":"schedule_tests","schedule":[{"goalDescription":"<exact name>","isMainGoal":<true|false>,"isEvent":<true for events, omit/false for goals>,"action":"add","dates":["YYYY-MM-DD"]}]}
  action is "add" (default) or "remove". Use ISO date strings (YYYY-MM-DD). For goals/sub-goals use the exact name from the Goals list in context. For events: FIRST check the Events list in context — if an event with a similar name exists, use its EXACT name (e.g. coach says "strength test" → use "Strength Test - 1RM Back Squat" if that exists). Only use create_event for brand-new events that have no match. If you are unsure which existing event the coach means, ask for clarification instead of creating a duplicate.
- create_event: {"type":"create_event","name":"<event name>","description":"<optional description>"}
  Creates a new event entry without scheduling any dates. Use ONLY when the event does not already exist in the Events list in context.
- remove_event: {"type":"remove_event","eventName":"<exact event name from the Events list in context>"}
  Deletes an event entirely (removes it and all its scheduled dates). Use the EXACT name from the Events list.
- add_methods: {"type":"add_methods","methods":[{"name":"<exact method name>","rationale":"<why this method supports the goal>"},{"name":"<exact method name>","rationale":"<rationale>"}]}
  ONLY suggest or add methods whose exact name appears in the "Training Toolbox" list in context. Never invent method names from general knowledge. Always include a rationale for methods that are not goal-linked.
- set_mesocycle_config: {"type":"set_mesocycle_config","count":<number>,"weeksDuration":<weeks per mesocycle>}
  Use for quick uniform setup (all mesocycles same length, all microcycles 7 days). For variable durations use configure_mesocycles instead.
- configure_mesocycles: {"type":"configure_mesocycles","mesocycles":[{"name":"Mesocycle 1","microcycles":[{"duration":7,"intensity":"easy"},{"duration":7,"intensity":"moderate"},{"duration":7,"intensity":"hard"},{"duration":7,"intensity":"deload"}]},{"name":"Mesocycle 2","microcycles":[{"duration":7,"intensity":"moderate"},{"duration":7,"intensity":"hard"},{"duration":5,"intensity":"extremely-hard"},{"duration":2,"intensity":"deload"}]}]}
  Full structure replacement — use when microcycles have different durations or when adding/removing mesocycles or microcycles. Duration is in days. Intensity is optional (defaults to "moderate"). Valid intensities: "off","deload","easy","easy-moderate","moderate","moderate-hard","hard","extremely-hard".
- rename_cycles: {"type":"rename_cycles","renames":[{"currentName":"Mesocycle 1","newName":"Accumulation"},{"currentName":"Microcycle 1","newName":"Week 1 - Base"}]}
  Renames one or more mesocycles or microcycles without touching any other structure. Use the EXACT current name shown in the mesocycle structure in context.
- allocate_methods: {"type":"allocate_methods","allocations":[{"methodName":"<exact method name>","mesocycleNames":["Mesocycle 1","Mesocycle 2"]},{"methodName":"<exact method name>","mesocycleNames":["Mesocycle 1","Mesocycle 2","Mesocycle 3"]}]}
- remove_methods: {"type":"remove_methods","methodNames":["<exact method name>","<exact method name>"]}
  Removes methods from the plan entirely. Use exact method names as listed in the wizard context.
- set_method_intensities: {"type":"set_method_intensities","methodName":"<name>","frequency":<sessions/week>,"sets":<number>,"reps":"<e.g. 3-5>","intensity":"<e.g. 85-90% 1RM>"}
- set_microcycle_intensities: {"type":"set_microcycle_intensities","plan":[{"mesocycleName":"Mesocycle 1","mesoIntensity":"hard","intensities":["easy","moderate","hard","deload"]},{"mesocycleName":"Mesocycle 2","mesoIntensity":"extremely-hard","intensities":["moderate","hard","extremely-hard","deload"]}]}
  Valid intensity values: "off", "deload", "easy", "easy-moderate", "moderate", "moderate-hard", "hard", "extremely-hard". Use hyphens, not underscores.
  mesoIntensity sets the overall intensity of the mesocycle (its peak/characterization). intensities sets each individual microcycle in order. Both are optional — include only what you want to change.
- set_daily_intensities: {"type":"set_daily_intensities","plan":[{"mesocycleName":"Mesocycle 1","microcycleIndex":1,"days":["easy","moderate","hard","off","moderate","hard","off"]},{"mesocycleName":"Mesocycle 1","microcycleIndex":2,"days":["moderate","hard","extremely-hard","off","hard","extremely-hard","off"]}]}
  Sets the intensity for each individual training day within a microcycle. microcycleIndex is 1-based (1 = first microcycle of that mesocycle). days array length must match the microcycle duration in days — provide one value per day in calendar order. Valid values: "off","deload","easy","easy-moderate","moderate","moderate-hard","hard","extremely-hard".
- set_periodization: {"type":"set_periodization","entries":[{"methodName":"<exact name>","mesocycleName":"Mesocycle 1","microcycleIndex":1,"frequency":3,"sets":4,"reps":"3-5","intensity":"80-85% 1RM","extraParams":{"Organization":"Whole","Contrast":"No"}}]}
  microcycleIndex is 1-based (1 = first microcycle). Omit microcycleIndex to apply to ALL microcycles of that mesocycle. Only include the fields you want to set.
  ALL additional parameters listed in the context under each method (both qualitative/dropdown AND quantitative, e.g. rest durations) MUST be included in extraParams. Use the exact parameter name as the key. For qualitative/dropdown parameters, pick one of the listed options as the value. For quantitative parameters, provide a number (e.g. 90 for seconds). Do not skip any parameter listed in the context.
- assign_methods_to_days: {"type":"assign_methods_to_days","microcycleIndex":1,"weekPattern":[{"method":"<exact method name or Method::Category>","days":["Monday","Wednesday","Friday"]},{"method":"<exact method name or Method::Category>","days":["Tuesday","Thursday"]}]}
  Valid day names: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
  microcycleIndex is 1-based — include to target a specific microcycle only (e.g. 1 = first week), omit to apply the pattern to ALL microcycles in the current mesocycle. Do NOT assign methods to days marked as "off" — those are rest days with no sessions.
  SPLIT METHODS: If the wizard context shows a method as "[split into categories: Squat, Hinge]", you MUST add a separate weekPattern entry for EACH category using the "Method::Category" format (e.g. "Lower Body Resistance Training - Strength::Squat" and "Lower Body Resistance Training - Strength::Hinge"). Never assign just the base name for a split method — always use all its category variants. Include ALL methods the coach requests — never silently omit a method from the weekPattern.
- assign_exercises: {"type":"assign_exercises","replace":false,"assignments":[{"methodName":"<exact method name>","mesocycleName":"Mesocycle 1","categoryName":"<exercise category — include ONLY if method has categories, omit otherwise>","exercises":[{"exerciseId":"<exact id>","exerciseName":"<name>","libraryId":"<exact library id>"}]}]}
  IMPORTANT: This assigns exercises from the existing database to a method in the plan. You CAN do this — it does NOT modify the exercise database, it only selects which exercises to use for a method.
  LIBRARY RULES (follow exactly):
  1. ONLY recommend or assign exercises that appear in the "Available exercises" section of the wizard context. Never invent exercise names, IDs, or library IDs.
  2. When the coach asks what exercises to recommend: base your recommendations ONLY on what exists in the library. Do not suggest exercises by generic name if they are not listed — if no suitable exercises are found for a method, say so explicitly and suggest the coach adds them to the Exercise Database.
  3. When producing an assign_exercises block: include ONLY exercises whose exerciseId appears in the wizard context. If some exercises the coach requested are not in the database, still produce the block for the ones that ARE found, and in your text response explicitly list which ones were skipped and why (not in database).
  4. Never silently omit exercises — always tell the coach which exercises could not be assigned and why.
  Set "replace": true to replace the current selection; omit or false to append. If the method context lists "Categories:", produce one assignment entry per category.
- distribute_exercises: {"type":"distribute_exercises","replace":false,"entries":[{"exerciseId":"<exact id from context>","exerciseName":"<name>","methodId":"<exact methodId from context>","categoryName":"<category — include ONLY if the method has categories, omit otherwise>","dayDate":"YYYY-MM-DD","sessionIndex":0}]}
  IMPORTANT: Use this action in Phase 3 Step 2 whenever the coach asks to assign or distribute exercises to training days. You CAN assign exercises directly to specific calendar dates — this is exactly what this action is for. Do NOT tell the coach this is impossible or that they need to use the hierarchy manually.
  Use ONLY exerciseIds and methodIds listed under "Available exercises" in the wizard context. dayDate must be YYYY-MM-DD and must exactly match a date from the training schedule in context. sessionIndex is 0-based (0 = first session of the day). Set "replace":true to clear the existing exercise distribution for the entire current mesocycle before adding. Do NOT invent dates — use only dates from the training schedule provided in context.
- create_section: {"type":"create_section","dayDate":"YYYY-MM-DD","sessionIndex":0,"name":"Warm-up","note":"<optional note>"}
  Creates a named block within a session (e.g. Warm-up, Main Block, Cooldown). Use this to structure session architecture. sessionIndex is 0-based.
- delete_section: {"type":"delete_section","dayDate":"YYYY-MM-DD","sessionIndex":0,"sectionName":"<exact section name>"}
- rename_section: {"type":"rename_section","dayDate":"YYYY-MM-DD","sessionIndex":0,"sectionName":"<current exact name>","newName":"<new name>"}
- set_note: {"type":"set_note","target":"exercise","dayDate":"YYYY-MM-DD","sessionIndex":0,"exerciseId":"<exact id from context>","note":"<note text>"}
  Or for a section: {"type":"set_note","target":"section","dayDate":"YYYY-MM-DD","sessionIndex":0,"sectionName":"<exact section name>","note":"<text>"}
  Or for a session: {"type":"set_note","target":"session","dayDate":"YYYY-MM-DD","sessionIndex":0,"note":"<text>"}
  Adds or replaces a note/comment. target="exercise" requires exerciseId, target="section" requires sectionName, target="session" needs neither. To annotate multiple items, emit one set_note action per item.
- create_superset: {"type":"create_superset","dayDate":"YYYY-MM-DD","sessionIndex":0,"exerciseIds":["<id1>","<id2>"]}
  Links 2 or more exercises in the same session into a superset (the app labels them A1, A2, …). All exerciseIds must already be distributed to that day/session. To create multiple independent supersets, emit one create_superset action per group.
- break_superset: {"type":"break_superset","dayDate":"YYYY-MM-DD","sessionIndex":0,"exerciseId":"<id>"}
  Removes one exercise from its superset. If fewer than 2 exercises remain in the superset, it is automatically disbanded.
- move_exercise: {"type":"move_exercise","exerciseId":"<exact id from distributed exercises context>","targetDayDate":"YYYY-MM-DD","targetSessionIndex":0,"targetSectionName":"<exact section name or omit>"}
  Moves a single exercise to a different day, session, or section. If the exercise is in a superset it is automatically removed from it. targetSectionName is optional — omit to place the exercise outside any section.
- move_exercises: {"type":"move_exercises","exerciseIds":["<id1>","<id2>"],"targetDayDate":"YYYY-MM-DD","targetSessionIndex":0,"targetSectionName":"<exact section name or omit>"}
  Moves multiple exercises to the same target in one atomic action. ALWAYS use this (not repeated move_exercise) when moving a superset group or any set of exercises together — it applies all moves in a single step so nothing is left behind.
- copy_session: {"type":"copy_session","sourceDayDate":"YYYY-MM-DD","sourceSessionIndex":0,"targetDayDate":"YYYY-MM-DD"}
  Copies all exercises, sections, and supersets from a source session and adds them as a new session on the target day. If exercises in the session belong to methods not assigned to the target day, the app will warn the coach.
- copy_section: {"type":"copy_section","sourceDayDate":"YYYY-MM-DD","sourceSessionIndex":0,"sourceSectionName":"<exact section name>","targetDayDate":"YYYY-MM-DD","targetSessionIndex":0}
  Copies a single named section (with its exercises) to a target day/session. Use exact section names from the distributed exercises context. If exercises belong to methods not assigned to the target day, the app will warn the coach.
- add_exercise: {"type":"add_exercise","exerciseId":"<exact exerciseId>","exerciseName":"<name>","libraryId":"<exact libraryId>","methodId":"<exact method name>","dayDate":"YYYY-MM-DD","sessionIndex":0,"sectionName":"<exact section name — REQUIRED>"}
  Adds a single exercise to a specific day/session/section. The exercise is ALSO retroactively registered to the method's exercise selection (Step 5) — this means you can add ANY exercise from the exercise libraries, not only those already pre-selected in Step 5. Do NOT block or refuse because an exercise isn't in the "Available exercises" list; adding it here IS the way to get it into Step 5.
  Use exerciseId and libraryId from the Exercise Libraries section of the global context (or from "Available exercises" if it is already there).
  SECTION RULE: sectionName is REQUIRED — every exercise must live inside a section. Use an existing section name from the distributed exercises context, or propose a new one (e.g. "Warm-up", "Main Block", "Cooldown"). Never omit sectionName.
  METHOD RULE (mandatory): You MUST always ask the coach which method to assign the exercise to before emitting this action — even if you think it is obvious. Present ONLY the methods assigned to that specific day/session as numbered options (visible in the training schedule in context as "session X: [Method A, Method B]"). Never suggest a method not assigned to that day/session, and never invent or add new methods. Wait for the coach to pick a number or name, then emit the action with that exact method name.
- add_circuit: {"type":"add_circuit","circuitId":"<exact circuitId from Available circuits context>","circuitName":"<name>","libraryId":"<exact libraryId from Available circuits context>","dayDate":"YYYY-MM-DD","sessionIndex":0,"sectionName":"<exact section name — REQUIRED>"}
  Adds a circuit block (pre-built set of exercises with rest intervals) to a session/section. Use only circuitId and libraryId values from "Available circuits" in the context. sectionName is REQUIRED — use an existing section or propose a new one.
- add_parameter: {"type":"add_parameter","name":"<parameter name>","category":"<one of: strength|speed|power|endurance|mobility|technique|body_composition|other>","unit":"<unit e.g. kg, s, cm — omit if not applicable>","applicableSports":["<sport>","<sport>"]}
  applicableSports is optional — include when the parameter is sport-specific (e.g. ["Soccer","Rugby"]). Omit for universal parameters.
- add_parameters_bulk: {"type":"add_parameters_bulk","parameters":[{"name":"<parameter name>","category":"<category>","unit":"<unit or omit>","applicableSports":["<sport>"]},{"name":"<parameter name>","category":"<category>","unit":"<unit or omit>"}]}
  Use this when adding multiple parameters at once (e.g. filling a whole database section). Preferred over add_parameter when adding 2 or more parameters.
  applicableSports per entry is optional — omit for universal parameters, include for sport-specific ones.
- add_interaction: {"type":"add_interaction","sourceParameterName":"<exact name of existing parameter>","targetParameterName":"<exact name of existing parameter>","direction":"contributes_to","strength":"<strong|moderate|weak>"}
  direction "contributes_to" means sourceParameter positively influences targetParameter. Use exact parameter names as listed in the wizard context.
- add_interactions_bulk: {"type":"add_interactions_bulk","interactions":[{"sourceParameterName":"<exact name>","targetParameterName":"<exact name>","direction":"contributes_to","strength":"<strong|moderate|weak>"},{"sourceParameterName":"<exact name>","targetParameterName":"<exact name>","direction":"contributes_to","strength":"<strong|moderate|weak>"}]}
  Use this when adding multiple interactions at once. Preferred over add_interaction when adding 2 or more interactions.
- add_parameter_method: {"type":"add_parameter_method","parameterName":"<exact name of existing parameter>","methodId":"<exact method ID from wizard context>","rationale":"<optional: why this method improves this parameter>"}
  Only use method IDs as listed in the wizard context. Do not invent method IDs.
- add_parameter_methods_bulk: {"type":"add_parameter_methods_bulk","links":[{"parameterName":"<exact parameter name>","methodId":"<exact method ID from wizard context>","rationale":"<optional>"},{"parameterName":"<exact parameter name>","methodId":"<exact method ID from wizard context>"}]}
  Use this when linking multiple training methods to parameters at once. Preferred over add_parameter_method when adding 2 or more links.

Rules:
- You may include MULTIPLE [[APPLY: ...]] blocks in one message — one per action. Place them all at the very end of your message.
- Only include action blocks when you are confident the suggestion is appropriate and actionable.
- Use exact method names as listed in the wizard context.
- Do not add commentary after the [[APPLY: ...]] block.`;

const DEFAULT_ROLE = `## Your role
- Be objective and direct. If the current plan has weaknesses, gaps, or contradicts evidence — say so clearly and constructively.
- Do not default to agreement or validation. A good sports scientist pushes back when warranted.
- Give concrete, actionable suggestions relevant to the current planning step.
- Keep responses concise (2-4 sentences). If helpful, ask one focused follow-up question.
- Understand the coach's philosophy and methods — but do not let it override scientific evidence. If their approach conflicts with consensus, flag it respectfully and explain why.
- When citing research from the References section, mention the source document name.
- Always refer to the athlete named in "Current Wizard State" — never reference athletes mentioned in the Coach Style section.
- Reply in English.`;

const INTELLECTUAL_INTEGRITY = `## Intellectual integrity (critical)
- Only change your position when the coach provides a genuinely compelling argument, new evidence, or corrects a factual error. Update your view in those cases — that is good science.
- Do NOT back down simply because the coach disagrees, repeats their point more firmly, or expresses frustration. Capitulating under social pressure is not open-mindedness — it is sycophancy and it makes you useless.
- If you were wrong on a specific point, concede that specific point clearly and explain why — but do not abandon your broader position unless that too is undermined.
- If the coach pushes back without new reasoning, hold your position and explain your reasoning again more clearly. It is fine to say: "I understand we see this differently — here is why I still think X."
- The coach hired you for an honest expert opinion, not for agreement.
- Do NOT hide behind "it depends" or "every athlete is different" as a substitute for a real answer. Those phrases are only acceptable when you follow them immediately with a concrete position based on the specific context you have. Vagueness is not neutrality — it is a failure to do your job.
- Do NOT present false balance. If scientific consensus strongly favors one view and a fringe position opposes it, say so clearly — weight evidence by quality and volume, not by treating all views as equally valid.

## Exercise placement judgment (apply in Phase 3)
Before executing any structural change to a session (moving, copying, placing exercises), consider whether the placement makes physiological sense. Flag and push back on clearly inappropriate requests — do not blindly comply. Examples of things that warrant a warning or refusal:
- Power/speed/strength exercises (cleans, squats, deadlifts, sprints, jumps) placed in a Cooldown section — these require full CNS readiness and belong in Warm-up activation or Main block.
- High-intensity CNS work at the end of a session when the athlete will be fatigued.
- Mobility/flexibility work placed as the primary Main block.
- Excessive volume added to a day already at high intensity.
When you flag an issue, briefly explain WHY it is problematic and offer the correct placement as an alternative. Still provide the action block if the coach explicitly confirms they want to proceed after your warning.`;

function buildSystemPrompt(
  coachContext: string,
  wizardContext: string,
  canApply: boolean,
  coachMemoryContext?: string,
  ragContext?: string,
  assistantRole?: string,
  toolboxContext?: string,
  globalContext?: string,
): string {
  const memoryBlock = coachMemoryContext
    ? `\n\n## Coach's Past Plans (most recent first — defer to newer patterns when in doubt)\n${coachMemoryContext}`
    : "";
  const ragBlock = ragContext
    ? `\n\n## Relevant Research & References (retrieved from the coach's uploaded documents)\n${ragContext}\n\n## Research Integration Instructions\n- Cite the source document name when referencing uploaded research.\n- Cross-reference the uploaded content against your own sports science knowledge (textbooks, peer-reviewed literature, established guidelines e.g. NSCA, ACSM).\n- If an uploaded source aligns with scientific consensus, note that briefly.\n- If an uploaded source contradicts or challenges consensus, explicitly flag it: explain both positions and let the coach decide — do not silently blend conflicting views.\n- If sources within the uploaded documents contradict each other, surface that tension clearly.\n- Never fabricate citations. Only cite documents that appear in the References section above.\n\n## Evidence Hierarchy (apply when evaluating any source — uploaded or from your own knowledge)\nWeight evidence by study design, from strongest to weakest:\n1. Meta-analysis / Systematic review — highest confidence; synthesizes multiple studies; flag if heterogeneity is high (I² > 75%) as pooled conclusions may be unreliable\n2. Randomised Controlled Trial (RCT) — strong causal inference; note sample size, blinding quality, and whether the population matches the athlete\n3. Controlled trial without randomisation — moderate confidence; confounding risk higher\n4. Prospective cohort study — useful for dose-response and long-term outcomes; observational only\n5. Case-control study — good for rare outcomes; susceptible to recall and selection bias\n6. Cross-sectional study — snapshot only; cannot establish causality\n7. Case series / Case report — hypothesis-generating; very low generalisability\n8. Expert opinion / Consensus statement — useful when evidence is sparse; weight by the credibility of the body issuing it (e.g. NSCA, ACSM, IOC)\nWhen citing or evaluating a source, briefly indicate its level (e.g. "RCT, n=24" or "systematic review of 12 RCTs"). When a recommendation rests only on lower-level evidence, say so explicitly rather than presenting it with the same confidence as meta-analytic findings.`
    : "";
  const toolboxBlock = toolboxContext ? `\n\n## ${toolboxContext}` : "";
  const globalBlock = globalContext ? `\n\n${globalContext}` : "";
  const roleBlock = assistantRole
    ? `## Your role\n${assistantRole}`
    : DEFAULT_ROLE;
  // When assistantRole is provided (e.g. Parameter Database), label the context
  // block differently so the AI doesn't treat it as an athlete-specific plan state.
  const contextLabel = assistantRole ? "Database State" : "Current Context";
  return `You are an expert sports scientist and training advisor working inside Plan Prep Coach — a training planning app for coaches and sports scientists that replaces complex Excel workflows with a guided, intelligent wizard.

## About Plan Prep Coach

### Philosophy
- Training planning is a chain of dependent decisions — the wizard guides the coach step by step
- Data is entered once and flows automatically through all levels (no double entry)
- The coach focuses on thinking and decision-making, not manual data entry

### Plan Hierarchy
Macrocycle → Mesocycle(s) → Microcycle(s) → Training Day(s) → Session(s) → Sections (Warm-up / Main / Cooldown) → Exercises

- **Macrocycle**: The complete training plan from start to competition/goal date (e.g. 16 weeks). Contains all mesocycles.
- **Mesocycle**: A training block within the macrocycle (e.g. 4-week general prep, 4-week specific prep, 3-week competition prep, 1-week taper). Each mesocycle has its own method allocation and training focus.
- **Microcycle**: A training unit within a mesocycle — typically 7 days but any duration is supported. Microcycles within the same mesocycle CAN have different durations (e.g. 7+7+7+5 days). Each microcycle has one intensity level.
- **Training Day / Session**: Specific days and sessions within a microcycle. A day can have multiple sessions. Sessions contain sections (warm-up, main, cooldown) with exercises.

### Intensity Scale (8 levels, low → high)
off → deload → easy → easy-moderate → moderate → moderate-hard → hard → extremely-hard
Use hyphens (not underscores). "Deload" = active recovery week at very low load.

### Databases (coach-configurable)
- **Athlete Database**: Athlete profiles with demographics, performance parameter values, assigned plans, personal calendar
- **Parameter Database**: Performance parameters (e.g. Squat 1RM, Sprint 30m) with categories, units, inter-parameter dependencies (positive/negative), and research citations. Parameters link to training methods.
- **Training Methods Database** (Toolbox): Training methods organized by category → subcategory (e.g. "Lower Body Resistance Training - Strength"). Methods can be split by exercise category (e.g. Squat, Hinge) — shown as "Method::Category" internally. Each method has configurable parameters (frequency, sets, reps, intensity, rest durations, etc.).
- **Exercise Database**: Exercises with video, description, category, and linked parameters. Importable via CSV/Excel.

### Wizard Flow
**Phase 1 — Plan Setup** (MacrocyclePage):
  Step 1: Select athlete, set plan name and date range, choose target parameters (SMART goals)
  Step 2: Add sub-goals and define test/event schedule
  Step 3: Select training methods from the toolbox (goal-linked methods are auto-suggested; additional methods can be added manually with a rationale)

**Phase 2 — Mesocycle Planning** (MesocyclePage):
  Step 1: Configure mesocycle/microcycle structure (count, durations, intensities)
  Step 2: Set daily intensity planning within each microcycle (loading wave)
  Step 3: Allocate methods to specific mesocycles (not all methods need to be active in every mesocycle)
  Step 4: Periodization table — set frequency, sets, reps, intensity per method × microcycle (values flow automatically to exercises and calendar)
  Step 5: Assign exercises from the library to each method × mesocycle slot

**Phase 3 — Microcycle Planning** (MicrocyclePlanningPage):
  Step 1: Assign methods to days of the week (drag & drop)
  Step 2: Exercise Distribution — assign exercises from the Step 5 library to specific training days and sessions. The wizard provides exact calendar dates for every training day; you CAN and SHOULD assign exercises directly to those dates using the distribute_exercises action.

### Data Flow
Parameter values set in the Periodization Table (Phase 2 Step 4) flow automatically down to exercises and the training calendar. Changing a value at a higher level propagates consistently downward. Tests and events scheduled in Phase 1 appear in the mesocycle calendar and athlete calendar upon plan assignment.

## Coach Background
${coachContext}${memoryBlock}${ragBlock}${toolboxBlock}${globalBlock}

## ${contextLabel}
${wizardContext}

${roleBlock}

${INTELLECTUAL_INTEGRITY}${canApply ? APPLY_FORMAT_INSTRUCTIONS : ""}`;
}

function buildProactiveSystem(assistantRole?: string): string {
  const roleHint = assistantRole
    ? `Your role in this context: ${assistantRole}`
    : `Your role is to give the coach an honest, objective, evidence-based perspective — not to validate their decisions, but to help them make better ones.`;

  const proactiveInstructions = assistantRole
    ? `Generate a brief, helpful opening message (1-2 sentences) that offers to help with the current task. Do not critique or make assumptions about existing content — wait to be asked.`
    : `Write a short 1-2 sentence opening. Greet the coach briefly, then mention that you've noticed a few things and offer to share them if they'd like — but do NOT state the observations yet. Example tone: "Hi! How can I help you? I've spotted a few things — let me know if you'd like me to go through them." Adapt naturally to the current step and context.`;

  return `You are an expert sports scientist and training advisor. ${roleHint}

${proactiveInstructions}

Be specific and direct. Do not open with flattery, generic encouragement, or filler phrases. Do not hide behind "it depends" — if you have a view, state it. Do NOT include [[APPLY: ...]] blocks in the opening message. Reply in English.`;
}

// ─── Suggestion card ─────────────────────────────────────────────────────────

function getSuggestionPreview(action: ApplySuggestion): string {
  switch (action.type) {
    case "set_plan_name":
      return `Set plan name: "${action.name}"`;
    case "add_goal":
      return `Add goal: ${action.parameterName}`;
    case "schedule_tests":
      return `Schedule tests for ${action.schedule.length} goal${action.schedule.length !== 1 ? "s" : ""}`;
    case "create_event":
      return `Create event: ${action.name}`;
    case "add_methods":
      return action.methods.length === 1
        ? `Add method: ${action.methods[0].name}`
        : `Add ${action.methods.length} methods: ${action.methods.map((m) => m.name).join(", ")}`;
    case "set_mesocycle_config":
      return `Configure ${action.count} mesocycle${action.count !== 1 ? "s" : ""}, ${action.weeksDuration} week${action.weeksDuration !== 1 ? "s" : ""} each`;
    case "configure_mesocycles": {
      const totalMicros = action.mesocycles.reduce((s, m) => s + m.microcycles.length, 0);
      const totalDays = action.mesocycles.reduce((s, m) => s + m.microcycles.reduce((ss, mc) => ss + mc.duration, 0), 0);
      return `Configure ${action.mesocycles.length} mesocycle${action.mesocycles.length !== 1 ? "s" : ""}, ${totalMicros} microcycles, ${totalDays} days total`;
    }
    case "allocate_methods":
      return action.allocations
        .map((a) => `${a.methodName} → ${a.mesocycleNames.join(", ")}`)
        .join("\n");
    case "remove_methods":
      return action.methodNames.length === 1
        ? `Remove method: ${action.methodNames[0]}`
        : `Remove ${action.methodNames.length} methods: ${action.methodNames.join(", ")}`;
    case "set_method_intensities":
      return `${action.methodName}: ${action.frequency}×/week, ${action.sets} sets × ${action.reps} reps @ ${action.intensity}`;
    case "set_microcycle_intensities":
      return `Set microcycle intensities for ${action.plan.length} mesocycle${action.plan.length !== 1 ? "s" : ""}`;
    case "set_daily_intensities": {
      const totalMicros = action.plan.length;
      const totalDays = action.plan.reduce((s, p) => s + p.days.length, 0);
      return `Set daily intensities: ${totalMicros} microcycle${totalMicros !== 1 ? "s" : ""}, ${totalDays} days`;
    }
    case "set_periodization": {
      const methods = [...new Set(action.entries.map((e) => e.methodName))];
      return `Set periodization for: ${methods.join(", ")}`;
    }
    case "assign_methods_to_days":
      return action.weekPattern.map((p) => `${p.method} → ${p.days.join(", ")}`).join("\n");
    case "assign_exercises": {
      const total = action.assignments.reduce((n, a) => n + a.exercises.length, 0);
      return `Assign ${total} exercise${total !== 1 ? "s" : ""} across ${action.assignments.length} method-mesocycle cell${action.assignments.length !== 1 ? "s" : ""}`;
    }
    case "distribute_exercises": {
      const total = action.entries.length;
      const days = [...new Set(action.entries.map(e => e.dayDate))].length;
      return `Distribute ${total} exercise slot${total !== 1 ? "s" : ""} across ${days} day${days !== 1 ? "s" : ""}${action.replace ? " (replace existing)" : ""}`;
    }
    case "create_section":
      return `Create section "${action.name}" on ${action.dayDate} session ${action.sessionIndex + 1}`;
    case "delete_section":
      return `Delete section "${action.sectionName}" on ${action.dayDate} session ${action.sessionIndex + 1}`;
    case "rename_section":
      return `Rename section "${action.sectionName}" → "${action.newName}"`;
    case "set_note":
      return `Set ${action.target} note on ${action.dayDate} session ${action.sessionIndex + 1}`;
    case "create_superset":
      return `Create superset (${action.exerciseIds.length} exercises) on ${action.dayDate} session ${action.sessionIndex + 1}`;
    case "break_superset":
      return `Break superset on ${action.dayDate} session ${action.sessionIndex + 1}`;
    case "move_exercise":
      return `Move exercise to ${action.targetDayDate} session ${action.targetSessionIndex + 1}${action.targetSectionName ? ` / ${action.targetSectionName}` : ''}`;
    case "move_exercises":
      return `Move ${action.exerciseIds.length} exercises to ${action.targetDayDate} session ${action.targetSessionIndex + 1}${action.targetSectionName ? ` / ${action.targetSectionName}` : ''}`;
    case "copy_session":
      return `Copy session ${action.sourceSessionIndex + 1} from ${action.sourceDayDate} → ${action.targetDayDate}`;
    case "copy_section":
      return `Copy section "${action.sourceSectionName}" from ${action.sourceDayDate} → ${action.targetDayDate} session ${action.targetSessionIndex + 1}`;
    case "add_exercise":
      return `Add "${action.exerciseName}" to ${action.dayDate} session ${action.sessionIndex + 1}${action.sectionName ? ` / ${action.sectionName}` : ''} [${action.methodId}]`;
    case "add_circuit":
      return `Add circuit "${action.circuitName}" to ${action.dayDate} session ${action.sessionIndex + 1}${action.sectionName ? ` / ${action.sectionName}` : ''}`;
    case "add_parameter":
      return `Add parameter: ${action.name}${action.category ? ` (${action.category})` : ""}${action.unit ? ` [${action.unit}]` : ""}`;
    case "add_parameters_bulk":
      return `Add ${action.parameters.length} parameter${action.parameters.length !== 1 ? "s" : ""}: ${action.parameters.map((p) => p.name).join(", ")}`;
    case "add_interaction":
      return `${action.sourceParameterName} → ${action.targetParameterName} (${action.strength ?? "moderate"})`;
    case "add_interactions_bulk":
      return `Add ${action.interactions.length} interaction${action.interactions.length !== 1 ? "s" : ""}: ${action.interactions.map((i) => `${i.sourceParameterName} → ${i.targetParameterName}`).join(", ")}`;
    case "add_parameter_method":
      return `Link method to ${action.parameterName}${action.rationale ? `: ${action.rationale.slice(0, 60)}…` : ""}`;
    case "add_parameter_methods_bulk":
      return `Link ${action.links.length} method${action.links.length !== 1 ? "s" : ""} to parameters: ${action.links.map((l) => `${l.methodId} → ${l.parameterName}`).join(", ")}`;
  }
}

function SuggestionCard({
  action,
  onApply,
}: {
  action: ApplySuggestion;
  onApply: (a: ApplySuggestion) => void;
}) {
  const [applied, setApplied] = useState(false);

  return (
    <div className="mt-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <Sparkles className="h-3 w-3 flex-shrink-0" />
        Suggested action
      </div>
      <p className="text-xs text-foreground leading-snug">{getSuggestionPreview(action)}</p>
      <Button
        size="sm"
        variant={applied ? "outline" : "default"}
        className="h-7 text-xs w-full"
        disabled={applied}
        onClick={() => {
          onApply(action);
          setApplied(true);
        }}
      >
        {applied ? (
          <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" />Applied</>
        ) : (
          "Apply to wizard"
        )}
      </Button>
    </div>
  );
}

// ─── Markdown renderer + apply-block parser ───────────────────────────────────

function ChatMarkdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <span>
      {paragraphs.map((para, pi) => (
        <span key={pi}>
          {pi > 0 && <br />}
          {para.split(/\*\*(.+?)\*\*/g).map((chunk, ci) =>
            ci % 2 === 1 ? <strong key={ci}>{chunk}</strong> : chunk
          )}
        </span>
      ))}
    </span>
  );
}

const APPLY_REGEX = /\[\[APPLY:\s*(\{[\s\S]*?\})\]\]/g;

function AssistantMessage({
  text,
  onApply,
}: {
  text: string;
  onApply?: (a: ApplySuggestion) => void;
}) {
  const suggestions: ApplySuggestion[] = [];
  if (onApply) {
    for (const m of text.matchAll(APPLY_REGEX)) {
      try {
        suggestions.push(JSON.parse(m[1]) as ApplySuggestion);
      } catch {
        // malformed JSON from AI — ignore the block
      }
    }
  }
  const cleanText = text.replace(APPLY_REGEX, "").trim();

  return (
    <span>
      <ChatMarkdown text={cleanText} />
      {suggestions.map((s, i) => (
        <SuggestionCard key={i} action={s} onApply={onApply!} />
      ))}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WizardAIAssistant({
  stepLabel,
  wizardContext,
  coachMemoryContext,
  ragContext,
  onApplySuggestion,
  assistantRole,
  globalContext,
}: WizardAIAssistantProps) {
  const { profile } = useCoachProfile();
  const { data: toolboxData } = useToolboxData();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const hasOpened = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef(input);
  useEffect(() => { inputRef.current = input; }, [input]);

  // Voice input
  const handleVoiceResult = useCallback(
    (text: string) => setInput((prev) => (prev ? `${prev} ${text}` : text)),
    []
  );
  const { isListening, toggle: toggleMic, isSupported: micSupported, stopListening } =
    useSpeechInput(handleVoiceResult);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build full toolbox method list (available on every page/step)
  const toolboxContext = (() => {
    const names = Array.from(
      new Set((toolboxData?.entries ?? []).filter((e) => e.subCategory).map((e) => e.subCategory))
    ).sort();
    return names.length
      ? `Training Toolbox (all available methods):\n${names.map((n) => `- ${n}`).join("\n")}`
      : "";
  })();

  // Build coach context string from profile
  const coachContext = profile
    ? [
        profile.name ? `Name: ${profile.name}` : "",
        profile.sports?.length ? `Sports: ${profile.sports.join(", ")}` : "",
        profile.structured?.philosophy ? `Philosophy: ${profile.structured.philosophy}` : "",
        profile.structured?.methods ? `Methods: ${profile.structured.methods}` : "",
        profile.structured?.targetGroup ? `Target group: ${profile.structured.targetGroup}` : "",
        profile.structured?.experience ? `Experience: ${profile.structured.experience}` : "",
        profile.summary ? `Summary: ${profile.summary}` : "",
      ].filter(Boolean).join("\n")
    : "No coach profile available.";

  // Generate proactive opener the first time the panel opens.
  // When assistantRole is provided (e.g. Parameter Database), skip the AI call
  // and use a static greeting — sending wizardContext would cause the AI to
  // volunteer unsolicited analysis of existing content.
  const generateOpener = useCallback(async () => {
    if (hasOpened.current) return;
    hasOpened.current = true;

    if (assistantRole) {
      setMessages([{
        role: "assistant",
        content: `Hi! How can I help you?`,
      }]);
      return;
    }

    setMessages([{
      role: "assistant",
      content: `Hi! How can I help you? I've spotted a few things — let me know if you'd like me to go through them.`,
    }]);
  }, [coachContext, stepLabel, wizardContext, assistantRole, coachMemoryContext]);

  const handleOpen = () => {
    setIsOpen(true);
    generateOpener();
  };

  const sendUserMessage = async () => {
    if (isLoading) return;
    if (isListening) {
      stopListening();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const text = inputRef.current.trim();
    if (!text) return;

    const newMessages: Message[] = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await sendMessage(
        newMessages,
        buildSystemPrompt(coachContext, wizardContext, !!onApplySuggestion, coachMemoryContext, ragContext, assistantRole, toolboxContext, globalContext),
        "claude-sonnet-4-5",
        8192
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("[WizardAIAssistant] sendMessage failed:", err);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, an error occurred. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendUserMessage(); }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={cn(
            "fixed bottom-6 right-6 z-[200]",
            "w-14 h-14 rounded-full shadow-lg",
            "bg-primary text-primary-foreground",
            "flex items-center justify-center",
            "hover:scale-105 active:scale-95 transition-transform",
            "ring-2 ring-primary/20"
          )}
          title="Open AI Assistant"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Side panel */}
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <div
            className="fixed inset-0 z-[199] bg-black/20 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className={cn(
            "fixed right-0 top-0 bottom-0 z-[200]",
            "w-full md:w-[400px]",
            "bg-card border-l shadow-2xl",
            "flex flex-col"
          )}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-none">AI Assistant</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{stepLabel}</p>
              </div>
              {onApplySuggestion && (
                <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 mr-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  Can fill wizard
                </div>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 items-start",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white",
                      msg.role === "assistant" ? "bg-primary" : "bg-muted-foreground"
                    )}>
                      {msg.role === "assistant"
                        ? <Bot className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />
                      }
                    </div>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      msg.role === "assistant"
                        ? "bg-muted text-foreground rounded-tl-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                    )}>
                      {msg.role === "assistant"
                        ? <AssistantMessage text={msg.content} onApply={onApplySuggestion} />
                        : msg.content
                      }
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2.5">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="px-4 py-3 border-t">
              <div className="flex gap-2">
                {micSupported && (
                  <Button
                    type="button"
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    onClick={toggleMic}
                    disabled={isLoading}
                    className={cn("flex-shrink-0", isListening && "animate-pulse")}
                    title={isListening ? "Stop recording" : "Voice input"}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
                <Input
                  placeholder={isListening ? "Recording…" : "Ask anything…"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={sendUserMessage}
                  disabled={!input.trim() || isLoading}
                  className="flex-shrink-0"
                >
                  {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />
                  }
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
