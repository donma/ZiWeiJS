import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * 十二宮諸星得地合格訣／失陷破格訣（Interpretation 層，Owner 2026-09-25 授權）
 *
 * 逐宮歌訣（《全書》卷一〈十二宮諸星得地／失陷訣〉），本質為命宮地支＋星曜三方四正之吉凶斷語，
 * 非傳統大格局，故歸入 Interpretation 層。測試以掃描所得案例驗證規則命中。
 */

const mk = (year: number, month: number, day: number, hour: number): ZiWeiBirthInput => ({
  calendarType: 'solar',
  date: { year, month, day },
  time: { hour, minute: 0 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
});

const hitsOf = (input: ZiWeiBirthInput) => calculate(input).interpretation.hits.map(h => h.ruleId);

describe('得地合格訣（ZW.INT.GENERAL.SHIDE_*）', () => {
  it('命宮在丑且三方會太陽太陰 → 命中 SHIDE_CHOU', () => {
    expect(hitsOf(mk(1984, 1, 20, 0))).toContain('ZW.INT.GENERAL.SHIDE_CHOU.001');
  });
  it('命宮在酉且三方會太陰，對宮巨門太陽 → 命中 SHIDE_YOU', () => {
    expect(hitsOf(mk(1984, 6, 1, 18))).toContain('ZW.INT.GENERAL.SHIDE_YOU.001');
  });
  it('命宮在戍且三方會紫微 → 命中 SHIDE_XU', () => {
    expect(hitsOf(mk(1984, 1, 5, 6))).toContain('ZW.INT.GENERAL.SHIDE_XU.001');
  });
  it('命宮在亥且三方會太陰 → 命中 SHIDE_HAI', () => {
    expect(hitsOf(mk(1984, 2, 10, 6))).toContain('ZW.INT.GENERAL.SHIDE_HAI.001');
  });
});

describe('失陷破格訣（ZW.INT.GENERAL.SHIUO_*）', () => {
  it('命宮在子且三方會天機 → 命中 SHIUO_ZI', () => {
    expect(hitsOf(mk(1984, 3, 10, 6))).toContain('ZW.INT.GENERAL.SHIUO_ZI.001');
  });
  it('命宮在卯且三方會太陰＋擎羊 → 命中 SHIUO_MAO', () => {
    expect(hitsOf(mk(1984, 6, 1, 6))).toContain('ZW.INT.GENERAL.SHIUO_MAO.001');
  });
  it('命宮在未且三方會巨門太陽 → 命中 SHIUO_WEI', () => {
    expect(hitsOf(mk(1984, 1, 20, 12))).toContain('ZW.INT.GENERAL.SHIUO_WEI.001');
  });
  it('命宮在申且三方會天機巨門 → 命中 SHIUO_SHEN', () => {
    expect(hitsOf(mk(1984, 2, 20, 12))).toContain('ZW.INT.GENERAL.SHIUO_SHEN.001');
  });
  it('命宮在酉且三方會天機巨門 → 命中 SHIUO_YOU', () => {
    expect(hitsOf(mk(1984, 1, 1, 6))).toContain('ZW.INT.GENERAL.SHIUO_YOU.001');
  });
});

describe('negative cases（命宮不在對應宮位 → 不得命中）', () => {
  it('命宮在子但三方不全會貪狼七殺太陰 → 不得命中 SHIDE_ZI', () => {
    expect(hitsOf(mk(1950, 1, 5, 0))).not.toContain('ZW.INT.GENERAL.SHIDE_ZI.001');
  });
});
