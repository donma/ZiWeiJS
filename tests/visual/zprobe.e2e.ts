import { test, expect } from '@playwright/test';

/**
 * file:// 環境回歸：location.hash 指派在 file:// 被 Chrome 擋下
 * （'file:' URLs are treated as unique security origins），
 * 導致 navigate('/chart') 拋 SecurityError、頁面不更新。
 */
test('standalone demo.html：file:// 提交表單可導航並更新', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('file:///D:/AI_PROJECTS/ZiWeiJS/dist/ziwei-bible-demo.html#/');
  await page.waitForTimeout(300);

  const form = page.locator('form[data-form="birth"]');
  await expect(form).toBeVisible();
  await form.locator('input[name="year"]').fill('1985');
  await form.locator('input[name="month"]').fill('7');
  await form.locator('input[name="day"]').fill('20');
  await form.locator('input[name="hour"]').fill('14');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(800);

  const hash = await page.evaluate(() => location.hash);
  console.log('hash =', hash, 'svg =', await page.locator('.chart-wrap svg').count(), 'errors =', errors.length);
  expect(hash).toBe('#/chart');
  await expect(page.locator('.chart-wrap svg')).toBeVisible();
});
