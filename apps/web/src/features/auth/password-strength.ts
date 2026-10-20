import { PASSWORD_MIN_LENGTH, passwordSchema } from '@sarrif/core';

export type StrengthLabel = 'tooWeak' | 'weak' | 'fair' | 'strong' | 'veryStrong';

export interface Strength {
  /** How many of the four bars light up (0–4). */
  bars: number;
  label: StrengthLabel;
  /** Meets the rule the server applies (core's passwordSchema: 8+, letters and digits). */
  allowed: boolean;
}

/**
 * For the meter under a new password, as in the old project: five checks
 * (long enough, uppercase, lowercase, a number, a symbol), each one met lights
 * the next step, so it climbs as you type: Too weak → Weak → Fair → Strong →
 * Very strong. The server's rule is separate (`allowed`): while it isn't met,
 * the field says what's missing. Null while nothing is typed.
 */
export function passwordStrength(password: string): Strength | null {
  if (!password) return null;
  const score = [
    password.length >= PASSWORD_MIN_LENGTH,
    /\p{Lu}/u.test(password),
    /\p{Ll}/u.test(password),
    /\d/.test(password),
    /[^\p{L}\d\s]/u.test(password),
  ].filter(Boolean).length;
  const allowed = passwordSchema.safeParse(password).success;
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
