import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runPollutionChecks, isForbiddenSpecifier } from '../../tools/integrity-validator/pollution.js';

/**
 * Isolation / pollution defense（spec §6 / §44 / §52）
 *
 * 「最終不得出現：外部 runtime dependency / GPL code 混入 / 重複 Engine」——
 * 本測試把該硬性要求變成可執行檢查，並驗證判準本身有效（negative control）。
 */
describe('isolation: src 不得引入外部排盤實作', () => {
  const result = runPollutionChecks(process.cwd());

  it('0 違規（不含外部 import / vendor / node_modules 路徑）', () => {
    expect(result.failures).toEqual([]);
    expect(result.stats.forbiddenImports).toBe(0);
  });

  it('src 掃描確實有覆蓋（檔案數 > 30）', () => {
    expect(result.stats.srcFiles).toBeGreaterThan(30);
  });

  it('曆法換算集中於 3 個既定模組（新增使用點必須顯式更新 allowlist）', () => {
    expect(result.stats.calendarImporters).toEqual([
      'src/calendar/calendar-engine.ts',
      'src/period-engine/period-engine.ts',
      'src/period-engine/period-target.ts'
    ]);
  });

  it('判準有效：已知違規樣本必被判為禁止（negative control）', () => {
    for (const spec of ['iztro', 'fortel', 'ziwei-chart', 'ziwei-doushu', 'cdestiny', '../../node_modules/x', '../vendor/iztro']) {
      expect(isForbiddenSpecifier(spec), spec).toBe(true);
    }
    for (const spec of ['lunar-typescript', '../core/types.js', './pollution.js', 'node:fs', 'ajv/dist/2020.js']) {
      expect(isForbiddenSpecifier(spec), spec).toBe(false);
    }
  });
});

describe('isolation: package.json dependency 邊界', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

  it('dependencies 不得含外部排盤套件', () => {
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      expect(/iztro|fortel|cdestiny|ziwei/i.test(name), name).toBe(false);
    }
  });

  it('GPL-3.0 與授權不明專案不得成為任何 dependency', () => {
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(Object.keys(all)).not.toContain('ziwei-chart');
    expect(Object.keys(all)).not.toContain('ziwei-doushu-simple');
  });

  it('iztro 僅存在於 devDependencies（differential oracle 用）', () => {
    expect(pkg.devDependencies).toHaveProperty('iztro');
    expect(pkg.dependencies ?? {}).not.toHaveProperty('iztro');
  });
});
