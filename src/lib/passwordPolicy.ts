/**
 * The password rule for everyone (coaches and athletes): at least 10 characters with letters and
 * digits. Supabase enforces the same rule on the server (Authentication → Policies) and also checks
 * passwords against known data leaks — this file only shows the rule while typing and turns the
 * server's answers into readable messages.
 */
import { AuthWeakPasswordError } from '@supabase/supabase-js';

export const MIN_PASSWORD_LENGTH = 10;

export interface PasswordRuleState {
  length: boolean;
  mix: boolean;
}

export function passwordRules(password: string): PasswordRuleState {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    mix: /\p{L}/u.test(password) && /\d/.test(password),
  };
}

export function passwordOk(password: string): boolean {
  const r = passwordRules(password);
  return r.length && r.mix;
}

/** Translation key for an error from Supabase when setting a password (null: not a password problem) */
export function weakPasswordKey(err: unknown): 'auth.pw.pwned' | 'auth.pw.tooWeak' | null {
  if (err instanceof AuthWeakPasswordError || (err as { code?: string } | null)?.code === 'weak_password') {
    const reasons = (err as { reasons?: string[] }).reasons ?? [];
    return reasons.includes('pwned') ? 'auth.pw.pwned' : 'auth.pw.tooWeak';
  }
  return null;
}

/** Set right after a login whose password no longer meets the rule — the app then asks for a new one */
export const WEAK_PASSWORD_FLAG = 'ppc-weak-password';

export function noteWeakPassword(weak: boolean) {
  try {
    if (weak) sessionStorage.setItem(WEAK_PASSWORD_FLAG, '1');
    else sessionStorage.removeItem(WEAK_PASSWORD_FLAG);
  } catch { /* no browser storage: asked again next login */ }
}

export function hasWeakPassword(): boolean {
  try { return sessionStorage.getItem(WEAK_PASSWORD_FLAG) === '1'; } catch { return false; }
}
