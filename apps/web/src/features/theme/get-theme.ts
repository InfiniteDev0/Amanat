import 'server-only';

import { cookies } from 'next/headers';

import { DEFAULT_THEME, THEME_COOKIE, isTheme, type Theme } from './theme';

/** The theme saved in the visitor's cookie, for rendering <html> on the server. */
export async function getTheme(): Promise<Theme> {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(stored) ? stored : DEFAULT_THEME;
}
