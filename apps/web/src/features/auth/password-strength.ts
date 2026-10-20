import { passwordSchema } from '@sarrif/core';

/** 0 nothing typed · 1 doesn't meet the rule · 2 fair · 3 good · 4 strong. */
export type Strength = 0 | 1 | 2 | 3 | 4;

/**
 * For the meter under a new password. Below the rule (10+, letters and
 * digits: core's passwordSchema, which the server applies too) it's always
 * weak; above it, length and variety add strength.
 */
export function passwordStrength(password: string): Strength {
  if (!password) return 0;
  if (!passwordSchema.safeParse(password).success) return 1;
  let score = 2;
  if (password.length >= 14) score += 1;
  if ((/\p{Lu}/u.test(password) && /\p{Ll}/u.test(password)) || /[^\p{L}\d]/u.test(password)) score += 1;
  return Math.min(score, 4) as Strength;
}
