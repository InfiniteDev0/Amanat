'use client';

import { useSyncExternalStore } from 'react';

import { DEFAULT_THEME, THEME_COOKIE, type Theme } from './theme';

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** What's showing right now — the server already put the class on <html>. */
function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;

  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  listeners.forEach((listener) => listener());
}

/** The current theme and a setter. Rendering on the server assumes light. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  return { theme, setTheme };
}
