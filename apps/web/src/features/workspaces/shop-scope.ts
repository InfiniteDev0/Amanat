'use client';

import { useSyncExternalStore } from 'react';

// Which shops the app is showing, ticked in the sidebar's shop switcher: one
// shop, several, or 'all'. Home and Amanat show only the ticked ones; the
// pages under a shop (Profit, Reports, Settings, Trash…) are for one shop, in
// their address. Kept on this device.

export type ShopScope = string[] | 'all';

const KEY = 'amanat.shop-scope';
const listeners = new Set<() => void>();
/** The same array until the choice changes, so React sees no change in between. */
let cache: { raw: string | null; value: ShopScope } = { raw: null, value: 'all' };

function read(): ShopScope {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Storage blocked: every shop.
  }
  if (raw === cache.raw) return cache.value;
  let value: ShopScope = 'all';
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : 'all';
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((id) => typeof id === 'string')) value = parsed as string[];
  } catch {
    // An older single id, or nothing: every shop.
  }
  cache = { raw, value };
  return value;
}

export function setShopScope(scope: ShopScope) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(scope === 'all' || scope.length === 0 ? 'all' : scope));
  } catch {
    // Kept for this visit only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The shops ticked, or 'all'. Before the browser takes over: all. */
export function useShopScope(): ShopScope {
  return useSyncExternalStore(subscribe, read, () => 'all');
}

/** Only the shops ticked (every one for 'all'; all of them too if none ticked is still there). */
export function inScope<T extends { workspace: { id: string } }>(list: T[], scope: ShopScope): T[] {
  if (scope === 'all') return list;
  const picked = list.filter((m) => scope.includes(m.workspace.id));
  return picked.length ? picked : list;
}
