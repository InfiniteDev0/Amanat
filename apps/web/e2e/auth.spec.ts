import { expect, test } from '@playwright/test';

import {
  expectInApp,
  fillLogIn,
  forget,
  joinDemoShop,
  linkFromEmail,
  logInButton,
  makeUser,
  openTab,
  PASSWORD,
  removeTestUsers,
  uniqueEmail,
} from './support';

// Phase 1b hardening: sign-in survives interruptions. Against local Supabase
// and the dev server (playwright.config.ts).

test.afterAll(removeTestUsers);

test('offline: a banner says so and the button waits', async ({ page, context }) => {
  await page.goto('/en');
  await fillLogIn(page, 'amina@example.com');
  await context.setOffline(true);
  await expect(page.getByText('You’re offline. Check your connection.')).toBeVisible();
  await expect(logInButton(page)).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByText('You’re offline. Check your connection.')).toBeHidden();
  await expect(logInButton(page)).toBeEnabled();
});

test('a request cut off on the way: "No connection", the email stays, the password goes', async ({ page }) => {
  await page.goto('/en');
  await page.route('**/auth/v1/token**', (route) => route.abort('internetdisconnected'));
  await fillLogIn(page, 'amina@example.com');
  await logInButton(page).click();
  await expect(page.getByText('No connection. Try again.')).toBeVisible();
  await expect(page.locator('#login-email')).toHaveValue('amina@example.com');
  await expect(page.locator('#login-password')).toHaveValue('');
});

test('a double click sends one request', async ({ page }) => {
  await page.goto('/en');
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/auth/v1/token')) requests++;
  });
  await fillLogIn(page, uniqueEmail('nobody'), 'wrong-pass-1');
  await logInButton(page).dblclick();
  await expect(page.getByText('Email or password is wrong.')).toBeVisible();
  expect(requests).toBe(1);
});

test('an expired or made-up email link: a page that offers a new one', async ({ page }) => {
  await page.goto('/api/auth/confirm?next=%2Fen&token_hash=not-a-real-token&type=signup');
  await expect(page).toHaveURL(/\/en\/link-expired\?type=signup/);
  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send a new link' })).toBeVisible();
});

test('the confirmation link works in a different browser', async ({ page, browser }) => {
  const email = uniqueEmail('twobrowsers');
  await page.goto('/en');
  await openTab(page, 'Log in'); // waits until the page responds
  await openTab(page, 'Sign up');
  await page.locator('#signup-first-name').fill('Amina');
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(PASSWORD);
  await page.getByText('I have read and agree to the').click();
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/check-email/);
  await forget(email);

  const link = await linkFromEmail(email, 'confirm');
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.goto(link);
  await expectInApp(phone);
  await other.close();
});

test('cancelled on Google\'s screen: back on log in with a calm message', async ({ page }) => {
  await page.goto('/api/auth/callback?error=access_denied&next=%2Fen');
  await expect(page).toHaveURL(/\/en\?auth_error=google_cancelled/);
  await expect(page.getByText('Google sign-in was cancelled.')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Log in' })).toHaveAttribute('aria-selected', 'true');
});

test('Google came back but the code is no good: an error and the button to try again, no spinner', async ({ page }) => {
  await page.goto('/api/auth/callback?code=not-a-real-code&next=%2Fen');
  await expect(page.getByText('We couldn’t finish signing you in with Google. Try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
});

test('the session ends on a page: log in again and land back on it', async ({ page, context }) => {
  const user = await makeUser();
  await page.goto('/en');
  await fillLogIn(page, user.email);
  await logInButton(page).click();
  await expectInApp(page);

  const shop = await joinDemoShop(page, user.id);
  await page.goto(`/en/w/${shop}/profit`);
  await expect(page).toHaveURL(new RegExp(`/en/w/${shop}/profit`));

  // The session ends (cookies gone, as when it expires).
  await context.clearCookies();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/en\\?next=${encodeURIComponent(`/w/${shop}/profit`)}`));
  await expect(page.getByText('Your session ended. Log in again to pick up where you were.')).toBeVisible();

  await fillLogIn(page, user.email);
  await logInButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/en/w/${shop}/profit$`));
});

test('?next can never send anyone to another site', async ({ page }) => {
  const user = await makeUser();
  await page.goto('/en?next=%2F%2Fevil.example.com%2Fsteal');
  await fillLogIn(page, user.email);
  await logInButton(page).click();
  await expectInApp(page);
  expect(new URL(page.url()).hostname).toBe('localhost');

  // The callbacks too.
  await page.goto('/api/auth/callback?error=access_denied&next=%2F%2Fevil.example.com');
  expect(new URL(page.url()).hostname).toBe('localhost');
  await page.goto('/api/auth/confirm?token_hash=x&type=signup&next=https%3A%2F%2Fevil.example.com');
  expect(new URL(page.url()).hostname).toBe('localhost');
});

test('signed out in one tab: the other tab signs out too', async ({ context }) => {
  const user = await makeUser();
  const first = await context.newPage();
  await first.goto('/en');
  await fillLogIn(first, user.email);
  await logInButton(first).click();
  await expectInApp(first);
  const shop = await joinDemoShop(first, user.id);
  await first.goto(`/en/w/${shop}`);

  const second = await context.newPage();
  await second.goto(`/en/w/${shop}`);
  await expect(second).toHaveURL(new RegExp(`/en/w/${shop}`));

  // Sign out through the app's own menu in the first tab.
  await first.getByRole('button', { name: 'Switch shop' }).click();
  await first.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(first).toHaveURL(/\/en$/);
  await expect(second).toHaveURL(/\/en(\?|$)/);
});

test('forgot password: the link works in another browser and the new password signs in', async ({ page, browser }) => {
  const user = await makeUser();
  await page.goto('/en/forgot-password');
  await expect(async () => {
    await page.locator('#forgot-email').fill(user.email);
    await expect(page.locator('#forgot-email')).toHaveValue(user.email, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Send link' }).click();
  await expect(page.getByText(`has an account, we sent it a link`)).toBeVisible();

  const link = await linkFromEmail(user.email, 'reset');
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.goto(link);
  await expect(phone).toHaveURL(/\/en\/reset-password/);
  await phone.locator('#reset-password').fill('Fresh-pass-2026');
  await phone.getByRole('button', { name: 'Save password' }).click();
  await expectInApp(phone);
  await other.close();

  const fresh = await browser.newContext();
  const again = await fresh.newPage();
  await again.goto('/en');
  await fillLogIn(again, user.email, 'Fresh-pass-2026');
  await logInButton(again).click();
  await expectInApp(again);
  await fresh.close();
});
