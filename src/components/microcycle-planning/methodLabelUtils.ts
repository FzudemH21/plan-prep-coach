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
