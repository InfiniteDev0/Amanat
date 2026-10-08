// The sidebar's pages, in order, in one place. Paths are relative to the shop
// (/w/<id>…); labels are the `nav.*` messages.

export type NavKey = 'home' | 'book' | 'clients' | 'reports' | 'settings';

export interface NavItem {
  key: NavKey;
  /** '' is the shop's Home. */
  path: string;
  /** An SVG in public/, used as a mask (lib/mask.ts). */
  icon: string;
}

// Only these for now; the other pages (accounts, close day, team,
// notifications) get their place later.
export const NAV_MAIN: NavItem[] = [
  { key: 'home', path: '', icon: '/home.svg' },
  { key: 'book', path: '/book', icon: '/book.svg' },
  { key: 'clients', path: '/clients', icon: '/clients.svg' },
  { key: 'reports', path: '/reports', icon: '/report.svg' },
];

/** Pinned to the bottom of the sidebar. */
export const NAV_BOTTOM: NavItem[] = [{ key: 'settings', path: '/settings', icon: '/settings.svg' }];

export function hrefFor(workspaceId: string, item: Pick<NavItem, 'path'>) {
  return `/w/${workspaceId}${item.path}`;
}

/** Home only on itself; any other page also on its sub-pages (/clients/abc). */
export function isLinkActive(pathname: string, workspaceId: string, item: Pick<NavItem, 'path'>) {
  const href = hrefFor(workspaceId, item);
  return item.path === '' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The page the pathname is on, for the breadcrumb in the top bar: the first
 * part after the shop ('book', 'team', …), whose label is `nav.<key>`. Null on
 * Home (the shop's name already says where you are).
 */
export function pageKeyFor(pathname: string, workspaceId: string): string | null {
  const prefix = `/w/${workspaceId}/`;
  if (!pathname.startsWith(prefix)) return null;
  return pathname.slice(prefix.length).split('/')[0] || null;
}
