import { describe, expect, it } from 'vitest';

import { appReturnPath, sameSitePath } from './paths';

describe('sameSitePath', () => {
  it('keeps a path on this site', () => {
    expect(sameSitePath('/en/reset-password')).toBe('/en/reset-password');
    expect(sameSitePath('/so?next=%2Fw%2Fabc')).toBe('/so?next=%2Fw%2Fabc');
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', '/\t/evil.com', '/\n/evil.com', '', null, 42])(
    'refuses %j',
    (next) => {
      expect(sameSitePath(next)).toBeNull();
    },
  );
});

describe('appReturnPath (the ?next after a session ended)', () => {
  it('takes the app pages', () => {
    expect(appReturnPath('/w/shop-1')).toBe('/w/shop-1');
    expect(appReturnPath('/w/shop-1/profit?day=2026-10-20')).toBe('/w/shop-1/profit?day=2026-10-20');
    expect(appReturnPath('/all-shops')).toBe('/all-shops');
  });

  it('refuses other sites and pages that are not the app', () => {
    for (const next of ['//evil.com', '/\\evil.com', 'https://evil.com/w/x', '/terms', '/', '/w/', '/w/../../evil', '/api/auth/callback']) {
      expect(appReturnPath(next)).toBeNull();
    }
  });
});
