import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * P2-5 無障礙（spec §22）
 *
 * 檢查：keyboard / focus / aria / tooltip / dialog / drawer / bottom-sheet /
 *       contrast / touch target，以及「SVG 星曜互動不得只支援 mouse」。
 */

const ROUTES = ['/', '/chart', '/expert', '/rules', '/sources', '/geek'] as const;

async function prepare(page: Page, width = 1440, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  const form = page.locator('form[data-form="birth"]');
  await form.locator('input[name="year"]').fill('1990');
  await form.locator('input[name="month"]').fill('5');
  await form.locator('input[name="day"]').fill('15');
  const hour = form.locator('input[name="hour"], select[name="hour"]');
  if (await hour.count()) await hour.first().fill('10').catch(async () => { await hour.first().selectOption('10'); });
  await form.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForSelector('svg', { timeout: 15_000 });
}

test.describe('P2-5 axe 無障礙掃描', () => {
  for (const route of ROUTES) {
    test(`${route} 無 serious / critical 違規`, async ({ page }) => {
      await prepare(page);
      await page.goto(`/#${route}`);
      await page.waitForTimeout(200);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const bad = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
      const detail = bad.map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`);
      expect(detail, `axe violations on ${route}`).toEqual([]);
    });
  }
});

test.describe('P2-5 鍵盤操作', () => {
  test('Tab 順序涵蓋 nav → 表單欄位 → 送出', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('form[data-form="birth"]')).toBeVisible();

    const order: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const d = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || a === document.body) return 'body';
        if (a.tagName === 'INPUT') return `input:${(a as HTMLInputElement).name}`;
        if (a.tagName === 'SELECT') return `select:${(a as HTMLSelectElement).name || a.id}`;
        if (a.tagName === 'BUTTON') return `button:${a.getAttribute('type') ?? 'none'}`;
        if (a.tagName === 'A') return `a:${a.getAttribute('href') ?? ''}`;
        return a.tagName.toLowerCase();
      });
      order.push(d);
    }

    const trace = order.join(' > ');
    const iYear = order.indexOf('input:year');
    const iHour = order.indexOf('input:hour');
    const iSubmit = order.indexOf('button:submit');
    // WebKit (Safari) 預設 Tab 不聚焦一般 <a>（需 Option+Tab），在此僅 Chromium/Firefox 強求 nav 連結
    const isWebKit = test.info().project.name === 'webkit';
    if (!isWebKit) {
      expect(order.some(x => x.startsWith('a:#')), `Tab 需到達 nav 連結（${trace}）`).toBe(true);
    }
    expect(iYear, `Tab 需到達年份欄位（${trace}）`).toBeGreaterThanOrEqual(0);
    expect(iHour).toBeGreaterThan(iYear);
    expect(iSubmit).toBeGreaterThanOrEqual(0);
    expect(iSubmit).toBeGreaterThan(iYear);
  });

  test('Enter 可提交表單並完成排盤', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const form = page.locator('form[data-form="birth"]');
    await expect(form).toBeVisible();
    await form.locator('input[name="year"]').fill('1990');
    await form.locator('input[name="month"]').fill('5');
    await form.locator('input[name="day"]').fill('15');
    await form.locator('input[name="hour"]').fill('10');

    const submit = form.locator('button[type="submit"], input[type="submit"]').first();
    await submit.focus();
    await expect(submit).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.chart-wrap svg')).toBeVisible({ timeout: 15_000 });
  });

  test('SVG 星曜可用鍵盤聚焦（非僅滑鼠）並以 Enter 開啟詳情', async ({ page }) => {
    await prepare(page);
    const star = page.locator('.zw-star').first();
    await expect(star).toHaveAttribute('tabindex', '0');
    await expect(star).toHaveAttribute('role', 'button');
    await expect(star).toHaveAttribute('aria-label', /.+/);

    await star.focus();
    await expect(star).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const drawer = page.locator('#drawer');
    const sheet = page.locator('#bottom-sheet');
    const opened = (await drawer.evaluate(el => el.classList.contains('show'))) ||
      (await sheet.evaluate(el => el.classList.contains('show')));
    expect(opened, 'Enter 應開啟星曜詳情面板').toBe(true);
  });

  test('Esc 可關閉詳情面板（dialog 行為）', async ({ page }) => {
    await prepare(page);
    await page.locator('.zw-star').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const drawerOpen = await page.locator('#drawer').evaluate(el => el.classList.contains('show'));
    const sheetOpen = await page.locator('#bottom-sheet').evaluate(el => el.classList.contains('show'));
    expect(drawerOpen || sheetOpen, 'Esc 後面板應關閉').toBe(false);
  });
});

test.describe('P2-5 aria / dialog 屬性', () => {
  test('tooltip 為 role=tooltip；detail 面板為 role=dialog + aria-modal', async ({ page }) => {
    await prepare(page);
    await expect(page.locator('#tooltip')).toHaveAttribute('role', 'tooltip');
    await expect(page.locator('#bottom-sheet')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#bottom-sheet')).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('#drawer')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#drawer')).toHaveAttribute('aria-modal', 'true');
  });

  test('圖表 SVG 有 role=group 與可讀 aria-label', async ({ page }) => {
    await prepare(page);
    const svg = page.locator('.chart-wrap svg');
    await expect(svg).toHaveAttribute('role', 'group');
    await expect(svg).toHaveAttribute('aria-label', /.+/);
  });
});

test.describe('P2-5 touch target', () => {
  test('可點擊元素至少 24x24 CSS px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(150);

    const tooSmall = await page.evaluate(() => {
      const out: string[] = [];
      const sel = 'a, button, select, input:not([type="hidden"]), [role="button"], .zw-star';
      document.querySelectorAll(sel).forEach((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        // WCAG 2.5.8：內文中的 inline 連結豁免
        if (el.tagName === 'A' && cs.display === 'inline' && el.closest('p, li, .footer, .lede, .sub')) return;
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.width < 24 || r.height < 24) {
          out.push(`${el.tagName.toLowerCase()}#${el.id || ''}.${(el.className && String(el.className).slice(0, 24)) || ''} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
      return out.slice(0, 10);
    });
    expect(tooSmall, '這些元素小於 24x24').toEqual([]);
  });
});
