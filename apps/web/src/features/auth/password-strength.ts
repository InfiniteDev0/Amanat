import { passwordSchema } from '@sarrif/core';

export type StrengthLabel = 'tooWeak' | 'weak' | 'fair' | 'strong' | 'veryStrong';

export interface Strength {
  /** How many of the four bars light up (0–4). */
  bars: number;
  label: StrengthLabel;
  /** Meets the rule the server applies (core's passwordSchema: 10+, letters and digits). */
  allowed: boolean;
}

/**
 * For the meter under a new password: five checks (length, a letter, a digit,
 * upper and lower case, a symbol), as in the old project. A password the
 * server would refuse never shows more than Weak, so the meter can't promise
 * what the server says no to. Null while nothing is typed.
 */
export function passwordStrength(password: string): Strength | null {
  if (!password) return null;
  const allowed = passwordSchema.safeParse(password).success;
  const checks = [
    password.length >= 10,
    /\p{L}/u.test(password),
    /\d/.test(password),
    /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password),
    /[^\p{L}\d\s]/u.test(password),
  ].filter(Boolean).length;
  const score = allowed ? checks : Math.min(checks, 2);
  switch (score) {
    case 5:
      return { bars: 4, label: 'veryStrong', allowed };
    case 4:
      return { bars: 3, label: 'strong', allowed };
    case 3:
      return { bars: 2, label: 'fair', allowed };
    case 2:
      return { bars: 1, label: 'weak', allowed };
    default:
      return { bars: score, label: 'tooWeak', allowed };
  }
}
