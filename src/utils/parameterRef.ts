/**
 * Parameter references. Body metrics used to be a separate list in the athlete database, referenced
 * as "bio:{definitionId}" (tests, goals, athlete results). They are now parameters marked
 * "Biometric" in the parameter database with the SAME id — so an old "bio:X" reference means the
 * parameter X.
 */
export function toParameterId(ref: string): string;
export function toParameterId(ref: string | null | undefined): string | undefined;
export function toParameterId(ref: string | null | undefined): string | undefined {
  if (!ref) return undefined;
  return ref.startsWith('bio:') ? ref.slice(4) : ref;
}
