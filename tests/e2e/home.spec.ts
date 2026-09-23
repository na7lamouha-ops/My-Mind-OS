import { expect, test } from '@playwright/test';

test('landing page renders the brand and the core cycle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('My Mind OS')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'تسجيل الدخول' })).toBeVisible();
});

test('/login shows the email + password form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.locator('input#email')).toBeVisible();
  await expect(page.locator('input#password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'دخول' })).toBeVisible();
});

test('/dashboard is protected → redirects to /login without a session', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
});

test('new workspace routes are protected too (e.g. /graph → /login)', async ({ page }) => {
  await page.goto('/graph');
  await expect(page).toHaveURL(/\/login/);
});

test('source notebook route is protected → redirects to /login', async ({ page }) => {
  await page.goto('/knowledge/11111111-1111-1111-1111-111111111111');
  await expect(page).toHaveURL(/\/login/);
});

test('onboarding route is protected → redirects to /login', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/login/);
});
