import { expect, test } from '@playwright/test';

test('home page renders the core cycle and links to the dashboard', async ({ page }) => {
  await page.goto('/');

  // Brand + headline are present.
  await expect(page.getByText('My Mind OS')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // The primary CTA navigates to the dashboard.
  await page.getByRole('link', { name: 'ادخل إلى لوحة التحكم' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible();
});
