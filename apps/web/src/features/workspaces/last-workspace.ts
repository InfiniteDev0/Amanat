// "The app remembers the last shop used and opens there." Kept per browser;
// it only ever names a shop, so a stale or tampered value just falls back to
// the first shop the user is a member of.

const KEY = 'sarrif-last-workspace';

export function getLastWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastWorkspaceId(workspaceId: string): void {
  try {
    window.localStorage.setItem(KEY, workspaceId);
  } catch {
    // Storage blocked: the app opens the first shop instead.
  }
}
