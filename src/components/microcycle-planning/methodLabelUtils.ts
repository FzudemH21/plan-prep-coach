/**
 * Shared display-label helpers for method keys used across microcycle planning.
 *
 * Method keys come in two forms:
 *   • Plain method   →  "Lower Body Resistance Training - Power"
 *   • With ex-cat    →  "Lower Body Resistance Training - Strength::Hinge"
 *
 * displayLabel() converts them to human-readable labels:
 *   • "Power"
 *   • "Strength › Hinge"
 */

/** Returns the sub-category portion of "Category - SubCategory", else the full string */
export function methodShortName(methodKey: string): string {
  // Strip ::exerciseCategory suffix first
  const base = methodKey.includes('::') ? methodKey.split('::')[0] : methodKey;
  const idx = base.indexOf(' - ');
  return idx > -1 ? base.slice(idx + 3) : base;
}

/**
 * Human-readable label for any method key.
 *   "…- Power"           → "Power"
 *   "…- Strength::Hinge" → "Strength › Hinge"
 */
export function displayMethodLabel(key: string): string {
  if (key.includes('::')) {
    const sep = key.indexOf('::');
    return `${methodShortName(key.slice(0, sep))} › ${key.slice(sep + 2)}`;
  }
  return methodShortName(key);
}

// Full class strings (not built dynamically) so Tailwind picks them up.
const METHOD_COLOR_CLASSES = [
  'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-900',
  'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-900',
  'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900',
  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
  'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900',
  'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-900',
  'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-900',
  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-900',
  'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950 dark:text-lime-200 dark:border-lime-900',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-200 dark:border-fuchsia-900',
];

/**
 * Stable colour (tag classes) per method, based on the full base method name — so e.g.
 * "Lower Body … - Strength" and "Lower Body … - Hypertrophy" look different on exercise cards.
 */
export function methodColorClasses(methodKey: string): string {
  const base = methodKey.split('::')[0];
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  return METHOD_COLOR_CLASSES[hash % METHOD_COLOR_CLASSES.length];
}
