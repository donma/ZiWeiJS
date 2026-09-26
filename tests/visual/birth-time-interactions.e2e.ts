import { test, expect } from '@playwright/test';

/**
 * 0.71 E2E Interactions（spec 0.71 §55 / §72）
 *
 * 測：
 *   - 切換出生時間模式（精確時間 / 只知道時辰 / 大概時段 / 不知道）
 *   - 選時辰卡（12 時辰）
 *   - 不知道 → 12 candidates → #unknown-time
 *   - 比較 2–3 candidates
 *   - 選 candidate 進完整命盤
 *   - AI Handoff Dialog（複製給 AI、下載 JSON、下載 Markdown）
 *   - Bible deep-links（#bible/star/{id}、#bible/rule/{id} 等）
 */

test.describe('0.71 出生時間模式與未知時辰分析', () => {
  test('切換時間模式：精確 / 時辰 / 時段 / 不知道', async ({ page }) => {
    await page.goto('/');

    const exactBtn = page.locator('button[data-time-precision="exact"]');
    const branchBtn = page.locator('button[data-time-precision="hour-branch"]');
    const rangeBtn = page.locator('button[data-time-precision="range"]');
    const unknownBtn = page.locator('button[data-time-precision="unknown"]');

    await expect(exactBtn).toBeVisible();
    await expect(branchBtn).toBeVisible();
    await expect(rangeBtn).toBeVisible();
    await expect(unknownBtn).toBeVisible();

    // 切到「只知道時辰」
    await branchBtn.click();
    await expect(branchBtn).toHaveClass(/active/);
    const hourCards = page.locator('.hour-card');
    await expect(hourCards).toHaveCount(12);

    // 選「午時」
    const wuCard = page.locator('button[data-hour-branch="wu"]');
    await wuCard.click();
    await expect(wuCard).toHaveClass(/selected/);

    // 切到「不知道」
    await unknownBtn.click();
    await expect(unknownBtn).toHaveClass(/active/);
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toHaveText('比較 12 個時辰');
  });

  test('未知時辰 → 比較 12 時辰工作區 → 選 candidate 排盤', async ({ page }) => {
    await page.goto('/');

    // 點「不知道」
    await page.locator('button[data-time-precision="unknown"]').click();
    // 點「比較 12 個時辰」
    await page.locator('button[type="submit"]').click();

    // 進入 #unknown-time 工作區
    await page.waitForTimeout(300);
    expect(page.url()).toContain('#/unknown-time');
    await expect(page.locator('h1', { hasText: '未知時辰分析' })).toBeVisible();

    // 候選表有 12 列
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(12);

    // 勾選 2 個候選時辰（子時與午時）
    const cbZi = page.locator('input[data-compare-branch="zi"]');
    const cbWu = page.locator('input[data-compare-branch="wu"]');
    await cbZi.check();
    await cbWu.check();

    // 點擊「並排比較選中的時辰」
    await page.locator('button[data-ut-action="compare-selected"]').click();
    const compareBox = page.locator('#side-by-side-compare');
    await expect(compareBox).toBeVisible();
    await expect(compareBox.locator('.card.card-pad')).toHaveCount(3); // 1 container + 2 cards

    // 點擊「選此時辰」進完整命盤
    const selectWu = page.locator('button[data-select-candidate="wu"]').first();
    await selectWu.click();

    await page.waitForTimeout(300);
    expect(page.url()).toContain('#/chart');
    await expect(page.locator('.chart-wrap svg')).toBeVisible();
  });

  test('AI Handoff Dialog 開啟與選項切換', async ({ page }) => {
    await page.goto('/');
    // 正常排盤
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector('.chart-wrap svg', { timeout: 15_000 });

    // 點「複製給 AI」
    const handoffBtn = page.locator('button[data-ai-handoff="dialog"]');
    await expect(handoffBtn).toBeVisible();
    await handoffBtn.click();

    // Dialog 應顯示
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toHaveText('複製給 AI');

    // 關閉
    await page.locator('#ai-dialog-close').click();
    await expect(modal).not.toBeVisible();
  });

  test('Bible Deep-link 路由（#bible/star / #bible/rule）', async ({ page }) => {
    // Star 頁
    await page.goto('/#/bible/star/ZW.STAR.MAJOR.ZIWEI');
    await page.waitForTimeout(150);
    await expect(page.locator('h1', { hasText: '紫微' })).toBeVisible();

    // Rule 頁
    await page.goto('/#/bible/rule/ZW.CALC.PALACE.LIFE.001');
    await page.waitForTimeout(150);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('p.mono.faint', { hasText: 'ZW.CALC.PALACE.LIFE.001' })).toBeVisible();

    // Profile 頁
    await page.goto('/#/bible/profile/school-zhongzhou');
    await page.waitForTimeout(150);
    await expect(page.locator('h1', { hasText: '中州派' })).toBeVisible();
  });
});
