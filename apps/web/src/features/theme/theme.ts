/*
 * Theme constants, shared by the server (root layout) and the client (toggle).
 *
 * Dark mode is class-based (`@custom-variant dark` in globals.css): the `dark`
 * class on <html> switches the theme tokens and every `dark:` utility.
 *
 * The choice lives in a cookie, not localStorage, so the server can put the
 * class on <html> in the HTML it sends. That means no flash of the wrong theme
 * and no inline script — React 19 warns about any <script> rendered through
 * React, because it re-creates them in the browser.
 */

export type Theme = 'light' | 'dark';

/** Dark until someone picks otherwise: the auth screen and white logo were designed on dark. */
export const DEFAULT_THEME: Theme = 'dark';

export const THEME_COOKIE = 'sarrif-theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}
