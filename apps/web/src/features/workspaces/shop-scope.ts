'use client';

import { useSyncExternalStore } from 'react';

// Which shop the app is showing, picked in the sidebar's shop switcher (as
// Notion's workspaces): one shop's id, or 'all' to see every shop together.
// Home and Amanat show only that shop (or all); the pages under a shop
// (Profit, Reports, Settings, Trash…) follow it in their address. Kept on this
// device.

export type ShopScope = string | 'all';

const KEY = 'amanat.shop-scope';
const listeners = new Set<() => void>();

function read(): ShopScope {
  try {
    return window.localStorage.getItem(KEY) ?? 'all';
  } catch {
    return 'all';
  }
}

export function setShopScope(scope: ShopScope) {
  try {
    window.localStorage.setItem(KEY, scope);
  } catch {
    // Kept for this visit only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The shop picked, or 'all'. Before the browser takes over: all. */
export function useShopScope(): ShopScope {
  return useSyncExternalStore(subscribe, read, () => 'all');
}

/** Only the shops in scope: every one for 'all', else just the one picked (all of them, if it's gone). */
export function inScope<T extends { workspace: { id: string } }>(list: T[], scope: ShopScope): T[] {
  if (scope === 'all') return list;
  const picked = list.filter((m) => m.workspace.id === scope);
  return picked.length ? picked : list;
}
