import { describe, expect, it } from 'vitest';

import { routeFor, type RouteState } from './routing';

const signedOut: RouteState = { signedIn: false, emailConfirmed: false, onboarded: false };
const unconfirmed: RouteState = { signedIn: true, emailConfirmed: false, onboarded: false };
const settingUp: RouteState = { signedIn: true, emailConfirmed: true, onboarded: false };
const ready: RouteState = { signedIn: true, emailConfirmed: true, onboarded: true };

describe('routeFor: the routing table', () => {
  it.each([
    // [who, page, search, where to]
    ['signed out', '/', '', null],
    ['signed out', '/check-email', '', null],
    ['signed out', '/terms', '', null],
    ['signed out', '/all-shops', '', '/?next=%2Fall-shops'],
    ['signed out', '/w/abc/reports', '?day=2026-11-05', `/?next=${encodeURIComponent('/w/abc/reports?day=2026-11-05')}`],
    ['signed out', '/settings', '', '/'],

    ['unconfirmed', '/', '', '/check-email'],
    ['unconfirmed', '/check-email', '', null],
    ['unconfirmed', '/w/abc', '', '/check-email'],

    ['setting up', '/', '', '/all-shops'],
    ['setting up', '/', '?next=/w/abc', '/all-shops'],
    ['setting up', '/all-shops', '', null],
    ['setting up', '/w/abc', '', '/all-shops'],
    ['setting up', '/w/abc/profit', '', '/all-shops'],
    ['setting up', '/reset-password', '', null],

    ['ready', '/', '', '/all-shops'],
    ['ready', '/', '?next=/w/abc/reports', '/w/abc/reports'],
    ['ready', '/', '?next=https://evil.com', '/all-shops'],
    ['ready', '/check-email', '', '/all-shops'],
    ['ready', '/all-shops', '', null],
    ['ready', '/w/abc', '', null],
    ['ready', '/reset-password', '', null],
  ] as const)('%s on %s%s → %s', (who, page, search, expected) => {
    const state = { 'signed out': signedOut, unconfirmed, 'setting up': settingUp, ready }[who];
    expect(routeFor(page, state, search)).toBe(expected);
  });
});
