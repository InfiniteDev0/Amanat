import type { ControllerFieldState } from 'react-hook-form';

/**
 * A react-hook-form field's error, translated from its `validation.*` key.
 * The forms validate on submit, and editing a field clears its error.
 */
export function fieldError(state: ControllerFieldState, message: (key: string) => string): string | null {
  return state.error?.message ? message(state.error.message) : null;
}
