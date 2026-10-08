'use client';

import * as React from 'react';

// Which notifications have been read or cleared, kept in this browser's
// localStorage. Only ids are kept, and only of notifications that still exist.

const STORAGE_KEY = 'manasik-notifications';

interface Saved {
  read: string[];
  cleared: string[];
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Reading them in another tab counts too.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode or storage blocked: everything starts unread.
    return null;
  }
}

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

function parse(raw: string | null): Saved {
  if (!raw) return { read: [], cleared: [] };
  try {
    const saved = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    return { read: ids(saved.read), cleared: ids(saved.cleared) };
  } catch {
    return { read: [], cleared: [] };
  }
}

/**
 * Saves a change. `existing` is every notification there is right now — ids of
 * ones that have gone (the broker was paid) are dropped instead of piling up.
 */
function write(next: Saved, existing: string[]) {
  const alive = new Set(existing);
  const tidy = (values: string[]) => [...new Set(values)].filter((id) => alive.has(id));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ read: tidy(next.read), cleared: tidy(next.cleared) }));
  } catch {
    // Not saved — they'll just show again.
  }
  listeners.forEach((listener) => listener());
}

/** Adds to one of the lists. */
function add(list: keyof Saved, added: string[], existing: string[]) {
  const saved = parse(readRaw());
  write({ ...saved, [list]: [...saved[list], ...added] }, existing);
}

export function markRead(read: string[], existing: string[]) {
  add('read', read, existing);
}

/** Takes them off the list — until a new reason brings a new notification. */
export function clearNotifications(cleared: string[], existing: string[]) {
  add('cleared', cleared, existing);
}

/** Puts cleared ones back, for the Undo on the toast. */
export function restoreNotifications(restored: string[], existing: string[]) {
  const saved = parse(readRaw());
  const back = new Set(restored);
  write({ ...saved, cleared: saved.cleared.filter((id) => !back.has(id)) }, existing);
}

/** The ids of read and cleared notifications — none on the server. */
export function useNotificationState(): { read: Set<string>; cleared: Set<string> } {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => null);
  return React.useMemo(() => {
    const saved = parse(raw);
    return { read: new Set(saved.read), cleared: new Set(saved.cleared) };
  }, [raw]);
}
