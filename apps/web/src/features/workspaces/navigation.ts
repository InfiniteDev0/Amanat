// The sidebar's pages, in order, in one place. Paths are relative to the shop
// (/w/<id>…); labels are the `nav.*` messages.

export type NavKey = 'home' | 'profit' | 'amanat' | 'reports' | 'settings' | 'trash';

export interface NavItem {
  key: NavKey;
  /** '' is the shop's Home. */
  path: string;
  /** An SVG in public/, used as a mask (lib/mask.ts). */
  icon: string;
}

// Build Plan v2, section 7: four items. Balances live on Home; People (Team)
// and Settings are in the shop menu; Close day is a sheet, opened from the
// sidebar's foot. amanat.svg and close.svg are stand-ins copied from other
// icons until the real ones are dropped into public/ under those names.
export const NAV_MAIN: NavItem[] = [
  { key: 'home', path: '', icon: '/home.svg' },
  { key: 'profit', path: '/profit', icon: '/book.svg' },
  { key: 'reports', path: '/reports', icon: '/report.svg' },
  { key: 'amanat', path: '/amanat', icon: '/amanat.svg' },
];

/** At the sidebar's foot, above the shop menu. Trash is a placeholder page for now. */
export const NAV_FOOT: NavItem[] = [
  { key: 'settings', path: '/settings', icon: '/settings.svg' },
  { key: 'trash', path: '/trash', icon: '/trash.svg' },
];

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
 * part after the shop ('profit', 'team', …), whose label is `nav.<key>`. Null on
 * Home (the shop's name already says where you are).
 */
export function pageKeyFor(pathname: string, workspaceId: string): string | null {
  const prefix = `/w/${workspaceId}/`;
  if (!pathname.startsWith(prefix)) return null;
  return pathname.slice(prefix.length).split('/')[0] || null;
}
