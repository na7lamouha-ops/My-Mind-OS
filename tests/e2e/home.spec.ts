import { expect, test } from '@playwright/test';

test('landing page renders the brand and the core cycle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('My Mind OS')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'تسجيل الدخول' })).toBeVisible();
});

test('/login shows the magic-link form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.locator('input#email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'أرسل رابط الدخول' })).toBeVisible();
});

test('/dashboard is protected → redirects to /login without a session', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
});
