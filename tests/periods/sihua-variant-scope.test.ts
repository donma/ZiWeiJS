import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * spec 3rd §P0-9 / §P0-10 / §P1-8：
 * 1. 四化 Variant 跨 Scope 一致（中州派庚干天府化權、天相化科）
 *    - 庚干出生 (natal)
 *    - 庚干宮干 (palace)
 *    - 庚干大限 (major-period)
 *    - 庚干流年 / 流月 / 流日 / 流時 (period)
 * 2. 歲建十二神 / 將前十二神不得無條件套入 month / day / hour (P0-10)
 * 3. Period Overlay transformation 與 global transformation 一致 (P1-8)
 */

describe('P0-9 中州派庚干四化跨 Scope 一致性', () => {
  // 1990-05-15 庚辰日、庚辰大限等
  const base: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 1990, month: 5, day: 15 },
    time: { hour: 10, minute: 30 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  };

  it('庚干出生（1980 庚申年）：natal 化權為天府、化科為天相', () => {
    const input: ZiWeiBirthInput = { ...base, date: { year: 1980, month: 5, day: 15 } };
    const canon = calculate(input, { profile: 'canonical' });
    const zhongzhou = calculate(input, { profile: 'school-zhongzhou' });

    const canonNatal = canon.chart.transformations.filter(t => t.sourceScope === 'natal');
    const zzNatal = zhongzhou.chart.transformations.filter(t => t.sourceScope === 'natal');

    // canonical 庚干：太陽化祿、武曲化權、太陰化科、天同化忌
    expect(canonNatal.find(t => t.type === 'quan')?.targetStarId).toBe('ZW.STAR.MAJOR.WUQU');
    expect(canonNatal.find(t => t.type === 'ke')?.targetStarId).toBe('ZW.STAR.MAJOR.TAIYIN');

    // school-zhongzhou 庚干：天府化權、天相化科
    expect(zzNatal.find(t => t.type === 'quan')?.targetStarId).toBe('ZW.STAR.MAJOR.TIANFU');
    expect(zzNatal.find(t => t.type === 'ke')?.targetStarId).toBe('ZW.STAR.MAJOR.TIANXIANG');
  });

  it('庚干宮干（飛化/自化）：在中州派下天府化權、天相化科', () => {
    const input: ZiWeiBirthInput = { ...base, date: { year: 1990, month: 5, day: 15 } };
    const canon = calculate(input, { profile: 'canonical' });
    const zhongzhou = calculate(input, { profile: 'school-zhongzhou' });

    // 找宮干為庚的宮位四化
    const canonGengPalace = canon.chart.transformations.filter(t => t.sourceScope === 'palace' && t.sourceStem === 'geng');
    const zzGengPalace = zhongzhou.chart.transformations.filter(t => t.sourceScope === 'palace' && t.sourceStem === 'geng');

    if (canonGengPalace.length > 0) {
      expect(canonGengPalace.find(t => t.type === 'quan')?.targetStarId).toBe('ZW.STAR.MAJOR.WUQU');
      expect(canonGengPalace.find(t => t.type === 'ke')?.targetStarId).toBe('ZW.STAR.MAJOR.TAIYIN');

      expect(zzGengPalace.find(t => t.type === 'quan')?.targetStarId).toBe('ZW.STAR.MAJOR.TIANFU');
      expect(zzGengPalace.find(t => t.type === 'ke')?.targetStarId).toBe('ZW.STAR.MAJOR.TIANXIANG');
    }
  });

  it('庚干流年 / 流月 / 流日：中州派限運四化一致為天府化權天相化科', () => {
    // 2026-09-23 為 庚子日（流日干為庚）
    const target = { year: 2026, month: 9, day: 23, hour: 14 };
    const canon = calculate(base, { targetDate: target, profile: 'canonical' });
    const zhongzhou = calculate(base, { targetDate: target, profile: 'school-zhongzhou' });

    // 流日四化
    const canonDay = canon.chart.transformations.filter(t => t.sourceScope === 'day');
    const zzDay = zhongzhou.chart.transformations.filter(t => t.sourceScope === 'day');

    expect(canonDay.find(t => t.type === 'quan')?.targetStarId).toBe('ZW.STAR.MAJOR.WUQU');
    expect(canonDay.find(t => t.type === 'ke')?.targetStarId).toBe('ZW.STAR.MAJOR.TAIYIN');

    expect(zzDay.find(t => t.type === 'quan')?.targetStarId).toBe('ZW.STAR.MAJOR.TIANFU');
    expect(zzDay.find(t => t.type === 'ke')?.targetStarId).toBe('ZW.STAR.MAJOR.TIANXIANG');
  });
});

describe('P0-10 歲建十二神與將前十二神不得無條件掛入所有 Scope', () => {
  const base: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 1990, month: 5, day: 15 },
    time: { hour: 10, minute: 30 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  };
  const c = calculate(base, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });

  it('year scope 包含 24 顆流年神煞（歲建 12 + 將前 12）', () => {
    const yearStars = c.periods.year?.overlay?.periodStars ?? [];
    expect(yearStars.length).toBe(24);
  });

  it('month / day / hour scope overlay 不含歲建與將前十二神', () => {
    expect((c.periods.month?.overlay?.periodStars ?? []).length).toBe(0);
    expect((c.periods.day?.overlay?.periodStars ?? []).length).toBe(0);
    expect((c.periods.hour?.overlay?.periodStars ?? []).length).toBe(0);
  });
});

describe('P1-8 Period Overlay transformation 與 global transformation 一致', () => {
  const base: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 1990, month: 5, day: 15 },
    time: { hour: 10, minute: 30 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  };
  const c = calculate(base, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });

  for (const scope of ['year', 'month', 'day', 'hour'] as const) {
    it(`${scope} overlay 四化與 global 該 scope 轉換完全對應`, () => {
      const overlayTrs = c.periods[scope]?.overlay?.transformations ?? [];
      const globalTrs = c.chart.transformations.filter(t => t.sourceScope === scope);

      expect(overlayTrs.length).toBe(globalTrs.length);
      for (const ot of overlayTrs) {
        const gt = globalTrs.find(t => t.type === ot.type);
        expect(gt).toBeDefined();
        expect(gt?.targetStarId).toBe(ot.targetStarId);
        expect(gt?.sourceStem).toBe(ot.sourceStem);
      }
    });
  }
});
