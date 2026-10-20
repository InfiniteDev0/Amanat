import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Helpers for the auth tests: LOCAL Supabase only (refuses anything else),
// its admin API to make and remove test users, and Mailpit to read the emails.

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!SUPABASE_URL.startsWith('http://127.0.0.1')) throw new Error('The e2e tests run against local Supabase only.');

const admin = createClient(SUPABASE_URL, env.SUPABASE_SECRET_KEY ?? '', { auth: { persistSession: false } });
const MAILPIT = 'http://127.0.0.1:54324/api/v1';
const made: string[] = [];

export const PASSWORD = 'Amanat2026!';

export function uniqueEmail(name: string): string {
  return `${name}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** A confirmed account with a complete profile (phone and terms), as after sign-up and setup. */
export async function makeUser(email = uniqueEmail('e2e')): Promise<{ id: string; email: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: 'Amina', phone: '+254712345678', language: 'en', terms_version: '2026-10-20' },
  });
  if (error || !data.user) throw error ?? new Error('no user');
  made.push(data.user.id);
  return { id: data.user.id, email };
}

export async function forget(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) if (user.email === email) made.push(user.id);
}

export async function removeTestUsers() {
  for (const id of made.splice(0)) await admin.auth.admin.deleteUser(id);
}

/** The first link in the newest email to `address` whose subject contains `subject`. */
export async function linkFromEmail(address: string, subject: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${address}`)}`)).json();
    const found = (list.messages ?? []).find((m: { Subject: string }) => m.Subject.toLowerCase().includes(subject.toLowerCase()));
    if (found) {
      const message = await (await fetch(`${MAILPIT}/message/${found.ID}`)).json();
      const href = (message.HTML as string).match(/href="([^"]+)"/)?.[1];
      if (href) return href.replace(/&amp;/g, '&');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No "${subject}" email for ${address}`);
}

/**
 * Opens a tab of the auth page once the page responds: a click before React
 * has loaded (hydration) does nothing, so it's retried until the tab shows.
 */
export async function openTab(page: Page, tab: 'Log in' | 'Sign up') {
  const field = page.locator(tab === 'Log in' ? '#login-email' : '#signup-email');
  await expect(async () => {
    await page.getByRole('tab', { name: tab }).click();
    await expect(field).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

/** The auth page, on the Log in tab, with the form filled in. */
export async function fillLogIn(page: Page, email: string, password = PASSWORD) {
  await openTab(page, 'Log in');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
}

export const logInButton = (page: Page) => page.getByRole('button', { name: 'Log in', exact: true });

/** Signed in, past the auth page (the app, or the setup wizard over it). */
export async function expectInApp(page: Page) {
  await expect(page).toHaveURL(/\/en\/(w\/|all-shops)/);
}

/**
 * Makes the signed-in user a member of the demo data's first shop (the rest
 * of the app is still the in-browser mock), so they land in a shop, not the
 * setup wizard. Returns the shop's id.
 */
export async function joinDemoShop(page: Page, userId: string): Promise<string> {
  return page.evaluate((id) => {
    const db = JSON.parse(localStorage.getItem('sarrif-mock-db') ?? 'null');
    const shop = db.workspaces[0].id as string;
    db.members.push({ id: crypto.randomUUID(), workspaceId: shop, userId: id, role: 'owner', joinedAt: new Date().toISOString() });
    localStorage.setItem('sarrif-mock-db', JSON.stringify(db));
    return shop;
  }, userId);
}
