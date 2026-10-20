// "The app remembers the last shop used and opens there." A small cookie, and
// only ever a hint: it names a shop, and the app opens it only if the user is
// a member (GoToShop, homePathFor), so a stale or tampered value, someone
// else's shop above all, just falls back to their own first shop.

const COOKIE = 'amanat_last_workspace';
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function getLastWorkspaceId(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(COOKIE.length + 1)) || null;
  } catch {
    return null;
  }
}

export function setLastWorkspaceId(workspaceId: string): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(workspaceId)}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax${secure}`;
}
