import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { AUTH_COOKIE, expectInApp, fillLogIn, logInButton, makeShop, makeUser, removeTestUsers } from './support';

// Phase 1c: server-side sessions (the wristband). The door is proxy.ts, the
// hallway the server layouts (lib/auth/server.ts); these check both.

test.afterAll(removeTestUsers);

/** A fresh account with its main shop (setup finished), logged in. */
async function signedInWithShop(page: Page) {
  const user = await makeUser();
  const shop = await makeShop(user.id);
  await page.goto('/en');
  await fillLogIn(page, user.email);
  await logInButton(page).click();
  await expectInApp(page);
  return { user, shop };
}

/** Someone else's shop. */
async function strangersShop() {
  const stranger = await makeUser();
  return makeShop(stranger.id, 'Garissa');
}

async function authCookies(context: BrowserContext) {
  return (await context.cookies()).filter((cookie) => AUTH_COOKIE.test(cookie.name));
}

test('signed out, a shop page goes to log in first, then back to it', async ({ page }) => {
  const { user, shop } = await signedInWithShop(page);
  await page.context().clearCookies();

  const response = await page.goto(`/en/w/${shop}/reports`);
  // Redirected by the server before any of the page was sent.
  expect(response?.request().redirectedFrom()?.url()).toContain(`/en/w/${shop}/reports`);
  await expect(page).toHaveURL(new RegExp(`/en\\?next=${encodeURIComponent(`/w/${shop}/reports`)}`));

  await fillLogIn(page, user.email);
  await logInButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/en/w/${shop}/reports$`));
});

test('a tampered or deleted session cookie: log in, with nothing private sent first', async ({ page, context }) => {
  const { shop } = await signedInWithShop(page);
  await page.goto(`/en/w/${shop}`);

  // Tampered: same cookie name, a value Supabase didn't sign.
  const [cookie] = await authCookies(context);
  expect(cookie).toBeTruthy();
  await context.addCookies([{ ...cookie!, value: `base64-${Buffer.from('{"access_token":"forged","refresh_token":"forged"}').toString('base64url')}` }]);
  const tampered = await page.goto(`/en/w/${shop}`);
  expect(tampered?.request().redirectedFrom()).toBeTruthy();
  await expect(page).toHaveURL(/\/en\?next=/);

  // Deleted.
  await context.clearCookies();
  const deleted = await page.goto(`/en/w/${shop}/profit`);
  expect(deleted?.request().redirectedFrom()).toBeTruthy();
  await expect(page).toHaveURL(/\/en\?next=/);
});

test('signed in, the auth page sends you Home', async ({ page }) => {
  await signedInWithShop(page);
  await page.goto('/en');
  await expect(page).toHaveURL(/\/en\/home$/);
});

test('someone else\'s shop, by typing its URL: No access, nothing of it shown', async ({ page }) => {
  await signedInWithShop(page);
  const other = await strangersShop();
  await page.goto(`/en/w/${other}`);
  await expect(page.getByText("You don't have access to this shop.")).toBeVisible();
  await expect(page.getByText('Garissa')).toHaveCount(0);
});

test('an expired access token is renewed quietly on the next request', async ({ page, context }) => {
  const { shop } = await signedInWithShop(page);
  await page.goto(`/en/w/${shop}`);
  const before = await authCookies(context);
  // Make the stored session look expired, as it is an hour after logging in.
  const encoded = before.map((cookie) => cookie.value).join('');
  const session = JSON.parse(Buffer.from(encoded.replace(/^base64-/, ''), 'base64url').toString());
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  await context.clearCookies();
  await context.addCookies([{ ...before[0]!, name: before[0]!.name.replace(/\.\d+$/, ''), value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}` }]);

  await page.goto(`/en/w/${shop}/profit`);
  await expect(page).toHaveURL(new RegExp(`/en/w/${shop}/profit`));
  const renewed = JSON.parse(Buffer.from((await authCookies(context)).map((cookie) => cookie.value).join('').replace(/^base64-/, ''), 'base64url').toString());
  expect(renewed.refresh_token).not.toBe(session.refresh_token);
  expect(renewed.expires_at).toBeGreaterThan(Date.now() / 1000);
});

test('sign out of all devices: the other device is signed out on its next click', async ({ browser }) => {
  const laptopContext = await browser.newContext();
  const laptop = await laptopContext.newPage();
  const { user, shop } = await signedInWithShop(laptop);

  const phoneContext = await browser.newContext();
  const phone = await phoneContext.newPage();
  await phone.goto('/en');
  await fillLogIn(phone, user.email);
  await logInButton(phone).click();
  await expectInApp(phone);
  await phone.goto(`/en/w/${shop}`);
  await expect(phone).toHaveURL(new RegExp(`/en/w/${shop}`));

  await laptop.goto(`/en/w/${shop}`);
  await laptop.getByRole('button', { name: 'Your account' }).click();
  await laptop.getByRole('menuitem', { name: 'Sign out of all devices' }).click();
  await laptop.getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(laptop).toHaveURL(/\/en$/);

  await phone.goto(`/en/w/${shop}/profit`);
  await expect(phone).toHaveURL(/\/en\?next=/);
  await laptopContext.close();
  await phoneContext.close();
});

test('setup not finished (a first Google sign-in): no shop page opens, even by typing its URL', async ({ page }) => {
  const shop = await strangersShop();
  const user = await makeUser(undefined, { complete: false });
  await page.goto('/en');
  await fillLogIn(page, user.email);
  await logInButton(page).click();
  await expect(page).toHaveURL(/\/en\/home$/);
  for (const path of [`/en/w/${shop}`, `/en/w/${shop}/settings`, `/en/w/${shop}/team`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/home$/);
  }
});

test('?next=https://evil.com is ignored: Home', async ({ page }) => {
  await signedInWithShop(page);
  await page.goto('/en?next=https%3A%2F%2Fevil.example.com');
  await expect(page).toHaveURL(/\/en\/home$/);
  expect(new URL(page.url()).hostname).toBe('localhost');
});

test('"who am I" never comes from browser storage', async ({ page, context }) => {
  await signedInWithShop(page);
  const other = await strangersShop();
  // Claim to be the demo owner (who is in every demo shop) in the demo data.
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('sarrif-mock-db') ?? 'null');
    db.sessionUserId = 'user-owner';
    localStorage.setItem('sarrif-mock-db', JSON.stringify(db));
  });
  // Still yourself: someone else's shop isn't yours.
  await page.goto(`/en/w/${other}`);
  await expect(page.getByText("You don't have access to this shop.")).toBeVisible();

  // Signed out, the claim gets you nothing: the server sends you to log in.
  await context.clearCookies();
  await page.goto(`/en/w/${other}`);
  await expect(page).toHaveURL(/\/en\?next=/);
});
