// Where to send someone after signing in or opening an email link. A `next`
// value comes from the URL, so anyone can write one: these make sure it is a
// page of ours and never another site (an "open redirect" to a fake login).

/**
 * `next` as a path on this site, or null: one leading slash and nothing that
 * a browser could read as another host ("//evil.com", "/\evil.com",
 * "https://evil.com"), no control characters.
 */
export function sameSitePath(next: unknown): string | null {
  if (typeof next !== 'string' || next.length > 512) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  // Tabs and newlines are dropped by browsers ("/<tab>/evil.com" becomes "//evil.com").
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}

/**
 * The app page to go back to after signing in (`/w/…` or `/all-shops`, with
 * no language prefix: the router adds it), or null for anything else.
 */
export function appReturnPath(next: unknown): string | null {
  const path = sameSitePath(next);
  if (!path) return null;
  const page = path.split(/[?#]/)[0]!;
  return /^\/w\/[\w-]+(\/[\w-]+)*$/.test(page) || page === '/all-shops' ? path : null;
}
