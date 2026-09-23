import { test, expect } from '@playwright/test';

/**
 * 離線單檔 demo 回歸（file:// 協定）
 *
 * 覆蓋兩個曾實際發生的 bug：
 *   1. file:// 下 location.hash 指派被 Chrome 擋下（SecurityError）→ 第一次排盤無反應
 *   2. 已在 /chart 時 navigate('/chart') 為 no-op（無 hashchange）→ 改資料後第二次排盤無反應
 *
 * 也確保 file:// 使用 history.replaceState，不會整頁重載而清掉 state。
 */
test('demo.html：file:// 下第一次排盤與改資料後第二次排盤皆需更新', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file:///D:/AI_PROJECTS/ZiWeiJS/dist/ziwei-bible-demo.html#/');
  await page.waitForTimeout(300);

  const form = page.locator('form[data-form="birth"]').first();
  await expect(form).toBeVisible();

  // 第一次排盤
  await form.locator('input[name="year"]').fill('1985');
  await form.locator('input[name="month"]').fill('7');
  await form.locator('input[name="day"]').fill('20');
  await form.locator('input[name="hour"]').fill('14');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(600);

  await expect(page.locator('.chart-wrap svg')).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe('#/chart');
  const svg1 = await page.locator('.chart-wrap svg').innerHTML();

  // 改資料 → 第二次排盤（必須實際更新）
  await form.locator('input[name="year"]').fill('1992');
  await form.locator('input[name="month"]').fill('3');
  await form.locator('input[name="day"]').fill('9');
  await form.locator('input[name="hour"]').fill('6');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(800);

  const svg2 = await page.locator('.chart-wrap svg').innerHTML();
  expect(svg2, '第二次提交後 chart 應更新').not.toBe(svg1);
  expect(errors, `不得有 page error：${errors.join(' | ')}`).toEqual([]);
});
