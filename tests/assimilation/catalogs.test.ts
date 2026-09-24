import { describe, it, expect } from 'vitest';
import { runCatalogChecks } from '../../tools/assimilation/checks.js';

/**
 * Assimilation catalog governance（spec Post-Stability Phase A）
 *
 * 與 `npm run validate:catalogs` 共用同一份實作（spec §25 精神）。
 */
describe('assimilation catalogs', () => {
  const { failures, stats } = runCatalogChecks();

  it('catalog 全數通過治理檢查', () => {
    expect(failures).toEqual([]);
  });

  it('四個 cycle registry、各 12 entries', () => {
    expect(stats.cycles).toBe(4);
    expect(stats.cycleEntries).toBe(48);
  });

  it('alias / candidate / rejection / snapshot 數量 >= 1', () => {
    expect(stats.aliases).toBeGreaterThanOrEqual(10);
    expect(stats.candidates).toBeGreaterThanOrEqual(10);
    expect(stats.rejections).toBeGreaterThanOrEqual(10);
    expect(stats.snapshots).toBe(6);
  });
});
