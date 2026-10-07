import { expect, test } from '@playwright/test';

test.describe('auth guard', () => {
  for (const path of ['/dashboard', '/dashboard/products', '/admin']) {
    test(`redirects anonymous ${path} to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});
