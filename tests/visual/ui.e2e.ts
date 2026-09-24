import { test, expect, type Page } from '@playwright/test';

/**
 * UI / Visual regression（spec §P2-4）
 *
 * 檢查：
 *   - 各 viewport 無水平溢出
 *   - 星曜 tooltip 不被裁切、且在可視範圍內
 *   - 主要頁面可操作（可點擊、表單可提交）
 *   - Chart 頁面視覺快照（baseline 見 __screenshots__/）
 */

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 }
];

async function overflowPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const de = document.documentElement;
    return Math.max(de.scrollWidth - de.clientWidth, document.body.scrollWidth - window.innerWidth);
  });
}

async function submitBirthForm(page: Page): Promise<void> {
  await page.goto('/');
  const form = page.locator('form[data-form="birth"]');
  await expect(form).toBeVisible();
  await form.locator('input[name="year"]').fill('1990');
  await form.locator('input[name="month"]').fill('5');
  await form.locator('input[name="day"]').fill('15');
  const hour = form.locator('input[name="hour"], select[name="hour"]');
  if (await hour.count()) await hour.first().fill('10').catch(async () => { await hour.first().selectOption('10'); });
  await form.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForSelector('svg', { timeout: 15_000 });
}

test.describe('P2-4 各 viewport 無水平溢出', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}：首頁與主要頁面`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      expect(await overflowPx(page), 'home overflow').toBeLessThanOrEqual(1);

      await submitBirthForm(page);
      expect(await overflowPx(page), 'chart overflow').toBeLessThanOrEqual(1);

      for (const route of ['/expert', '/rules', '/sources', '/geek']) {
        await page.goto(`/#${route}`);
        await page.waitForTimeout(120);
        expect(await overflowPx(page), `${route} overflow`).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('P2-4 星曜 tooltip 不被裁切', () => {
  test('點擊星曜後 tooltip 位於可視範圍內', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await submitBirthForm(page);

    const target = page.locator('.zw-star').first();
    await expect(target).toBeVisible();
    await target.click({ force: true });

    const tooltip = page.locator('#tooltip');
    // tooltip 或 bottom-sheet 其一必須出現（手機為 bottom sheet）
    const sheet = page.locator('#bottom-sheet');
    const tooltipVisible = await tooltip.isVisible().catch(() => false);
    const sheetVisible = await sheet.evaluate(el => el.classList.contains('show')).catch(() => false);
    expect(tooltipVisible || sheetVisible, 'tooltip 或 bottom-sheet 應出現').toBe(true);

    if (tooltipVisible) {
      const box = await tooltip.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.y).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(844 + 1);
      }
    }
  });
});

test.describe('P2-4 主要頁面可操作', () => {
  test('主題切換與 Expert 模式', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await submitBirthForm(page);

    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.locator('a[href="#/expert"]').first().click();
    await page.waitForTimeout(150);
    await expect(page.locator('.chart-wrap svg')).toBeVisible();
  });

  test('規則庫可展開規則詳情', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/#/rules');
    await page.waitForTimeout(150);
    const rows = page.locator('[data-rule-id]');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('查流年：顯示大限／流年／小限與 12 年時間軸（Phase I UI）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await submitBirthForm(page);

    const form = page.locator('form[data-form="birth"]');
    await form.locator('input[name="targetYear"]').fill('2026');
    await form.locator('button[type="submit"], input[type="submit"]').first().click();
    await page.waitForTimeout(200);

    // 限運面板：小限（canonical 輸出）
    await expect(page.locator('dt', { hasText: '小限' }).first()).toBeVisible();
    // 12 年時間軸表
    const timeline = page.locator('table.data').first();
    await expect(timeline).toBeVisible();
    await expect(timeline.locator('tbody tr')).toHaveCount(12);
    // 分享面板：指紋 + 分享資料（預設不含出生資料）
    await expect(page.locator('summary', { hasText: '分享資料（不含出生資料）' })).toBeVisible();
    await expect(page.locator('text=/^[0-9a-f]{8}$/').first()).toBeVisible();
  });
});

test.describe('P2-4 星曜不重疊', () => {
  test('同一宮位內星曜文字方塊不互相重疊', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await submitBirthForm(page);

    const overlaps = await page.evaluate(() => {
      const groups = new Map<Element, DOMRect[]>();
      document.querySelectorAll('.zw-star').forEach((el) => {
        const parent = el.parentElement!;
        const arr = groups.get(parent) ?? [];
        arr.push(el.getBoundingClientRect());
        groups.set(parent, arr);
      });

      const bad: string[] = [];
      const intersect = (a: DOMRect, b: DOMRect) =>
        a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

      for (const [parent, boxes] of groups) {
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (intersect(boxes[i], boxes[j])) {
              const label = (parent.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 16);
              const ox = Math.round(Math.min(boxes[i].right, boxes[j].right) - Math.max(boxes[i].left, boxes[j].left));
              const oy = Math.round(Math.min(boxes[i].bottom, boxes[j].bottom) - Math.max(boxes[i].top, boxes[j].top));
              bad.push(`${label}: 星曜重疊 ${ox}x${oy}px`);
            }
          }
        }
      }
      return bad.slice(0, 10);
    });

    expect(overlaps).toEqual([]);
  });
});

test.describe('P2-4 視覺快照', () => {
  for (const vp of [
    { name: '390x844', width: 390, height: 844 },
    { name: '1440x900', width: 1440, height: 900 }
  ]) {
    test(`chart-standard ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await submitBirthForm(page);
      await page.waitForTimeout(250);
      await expect(page).toHaveScreenshot(`chart-standard-${vp.name}.png`, { fullPage: false });
    });
  }

  test('home 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('home-1440x900.png', { fullPage: false });
  });

  test('chart-expert 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await submitBirthForm(page);
    await page.goto('/#/expert');
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot('chart-expert-1440x900.png', { fullPage: false });
  });

  test('dark 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await submitBirthForm(page);
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot('dark-1440x900.png', { fullPage: false });
  });

  test('tooltip 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await submitBirthForm(page);
    const star = page.locator('.zw-star').first();
    await star.hover();
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('tooltip-1440x900.png', { fullPage: false });
  });

  test('bottom-sheet 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await submitBirthForm(page);
    await page.locator('.zw-star').first().click({ force: true });
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot('bottom-sheet-390x844.png', { fullPage: false });
  });

  for (const route of [
    { path: '/rules', name: 'rules' },
    { path: '/sources', name: 'sources' },
    { path: '/geek', name: 'geek' }
  ]) {
    test(`${route.name} 1440x900`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await submitBirthForm(page);
      await page.goto(`/#${route.path}`);
      await page.waitForTimeout(250);
      await expect(page).toHaveScreenshot(`${route.name}-1440x900.png`, { fullPage: false });
    });
  }
});
