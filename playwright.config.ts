import { defineConfig, devices } from '@playwright/test';

/**
 * Visual / UI regression（spec §P2-4）
 *
 * 執行：
 *   npm run build          # 產生 dist/app
 *   npm run test:visual
 *
 * 第一次執行會建立 baseline 截圖（tests/visual/__screenshots__/）。
 * 之後若 UI 有非預期變化，測試會失敗並產生 diff。
 */
export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.e2e.ts',
  outputDir: './test-results',
  snapshotDir: './tests/visual/__screenshots__',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.03 } },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    video: 'off',
    screenshot: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      // 跨瀏覽器 smoke / a11y；快照僅在 chromium 維護（避免字型跨引擎 diff 膨脹）
      testIgnore: /ui\.e2e\.ts/
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /ui\.e2e\.ts/
    }
  ],
  webServer: {
    // vite preview 預設只綁 localhost(IPv6)；明確指定 127.0.0.1 才能被 Playwright 探測
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
