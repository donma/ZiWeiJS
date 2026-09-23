import { test, expect } from '@playwright/test';

test('demo.html：第一次排盤後再改資料，第二次提交仍應更新', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file:///D:/AI_PROJECTS/ZiWeiJS/dist/ziwei-bible-demo.html#/');
  await page.waitForTimeout(300);

  // 第一次排盤
  let form = page.locator('form[data-form="birth"]').first();
  await form.locator('input[name="year"]').fill('1985');
  await form.locator('input[name="month"]').fill('7');
  await form.locator('input[name="day"]').fill('20');
  await form.locator('input[name="hour"]').fill('14');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(600);
  console.log('1st: hash=', await page.evaluate(() => location.hash), 'forms=', await page.locator('form[data-form="birth"]').count());

  // 記下第一張盤的命宮位置
  const svg1 = await page.locator('.chart-wrap svg').innerHTML();
  console.log('1st chart snippet =', svg1.slice(0, 80));

  // 回到 /chart（已在），修改資料 → 第二次提交
  form = page.locator('form[data-form="birth"]').first();
  await form.locator('input[name="year"]').fill('1992');
  await form.locator('input[name="month"]').fill('3');
  await form.locator('input[name="day"]').fill('9');
  await form.locator('input[name="hour"]').fill('6');
  console.log('2nd forms on page =', await page.locator('form[data-form="birth"]').count());
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(800);

  const svg2 = await page.locator('.chart-wrap svg').innerHTML();
  console.log('2nd chart changed =', svg1 !== svg2);
  console.log('pageerrors =', errors);
  expect(svg1 !== svg2, '第二次提交後 chart 應更新').toBe(true);
});
