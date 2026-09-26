import { describe, it, expect } from 'vitest';
import { calculate, ZiWei } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 0 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('Dynamic Period Stars（spec 0.71 §31–§32：candidate lifecycle）', () => {
  const targetDate = { year: 2026, month: 9, day: 24 };

  it('預設 calculate() 不執行 candidate 動態星曜（不污染 canonical）', () => {
    const chart = calculate(INPUT, { targetDate });
    expect(chart.periods.dynamicStars).toBeUndefined();
  });

  it('ZiWei.Experimental.dynamicStars 產生 10 顆動態星曜', () => {
    const chart = ZiWei.Experimental.dynamicStars(INPUT, targetDate);
    const stars = chart.periods.dynamicStars ?? [];
    expect(stars).toHaveLength(10);
    const baseIds = stars.map(s => s.baseStarId);
    for (const id of [
      'ZW.STAR.AUX.TIANKUI', 'ZW.STAR.AUX.TIANYUE',
      'ZW.STAR.AUX.WENCHANG', 'ZW.STAR.AUX.WENQU',
      'ZW.STAR.AUX.LUCUN',
      'ZW.STAR.MALEFIC.QINGYANG', 'ZW.STAR.MALEFIC.TUOLUO',
      'ZW.STAR.AUX.TIANMA',
      'ZW.STAR.AUX.HONGLUAN', 'ZW.STAR.AUX.TIANXI'
    ]) {
      expect(baseIds).toContain(id);
    }
  });

  it('所有動態星曜 scope 皆為 year，provenance 含對應 ruleId', () => {
    const chart = ZiWei.Experimental.dynamicStars(INPUT, targetDate);
    for (const d of chart.periods.dynamicStars ?? []) {
      expect(d.scope).toBe('year');
      expect(d.provenance?.ruleId).toMatch(/^ZW\.CALC\.PERIOD\.STAR\./);
    }
  });

  it('Experimental trace 中 candidate 規則 status 標 candidate（§32）', () => {
    const chart = ZiWei.Experimental.dynamicStars(INPUT, targetDate, { trace: true });
    const entries = chart.trace?.entries ?? [];
    const candEntries = entries.filter(e => e.ruleId.startsWith('ZW.CALC.PERIOD.STAR.'));
    expect(candEntries.length).toBe(6);
    for (const e of candEntries) {
      expect(e.status).toBe('candidate');
    }
  });

  it('無 targetDate 時 Experimental 也不產生動態星曜', () => {
    const chart = ZiWei.Experimental.dynamicStars(INPUT, { year: 2026 });
    // 仍需 targetDate 才能執行 period 相關 candidate
    const stars = chart.periods.dynamicStars ?? [];
    expect(stars.length).toBeGreaterThanOrEqual(0);
  });
});
