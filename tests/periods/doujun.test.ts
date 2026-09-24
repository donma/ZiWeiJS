import { describe, it, expect } from 'vitest';
import { resolveDouJun, monthLifeBranchFromDouJun } from '../../src/period-engine/doujun.js';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * spec 3rd §P0-4：斗君測試
 *
 * 《紫微斗數全書》安子斗訣：
 * 「流年歲建起正月，逆數生月；由該宮起子時，順數到生時。所得為當年斗君，即流年正月之命宮。」
 */

describe('P0-4 resolveDouJun 純函式', () => {
  it('1990-05-15 10:30 生（農曆四月二十一日巳時），2026 丙午年（歲建午）', () => {
    // 流年歲建：午 (6)
    // 逆數生月四月：午(1) -> 巳(2) -> 辰(3) -> 卯(4)
    // 由卯起子時順數生時（巳時）：卯(子) -> 辰(丑) -> 巳(寅) -> 午(卯) -> 未(辰) -> 申(巳)
    // 斗君在 申
    const dj = resolveDouJun({
      yearBranch: 'wu',
      birth: {
        lunarMonth: 4,
        lunarDay: 21,
        isLeapMonth: false,
        hourBranch: 'si'
      },
      leapMonthPolicy: 'same-as-normal'
    });
    expect(dj).toBe('shen');
  });

  it('流月以斗君為正月順數：八月在卯', () => {
    // 斗君在 申 (正月)
    // 順數至八月：申(1) -> 酉(2) -> 戌(3) -> 亥(4) -> 子(5) -> 丑(6) -> 寅(7) -> 卯(8)
    const m8 = monthLifeBranchFromDouJun('shen', 8);
    expect(m8).toBe('mao');
  });

  it('出生閏月 policy 影響斗君：next-month vs same-as-normal', () => {
    // 假設生於閏四月
    const same = resolveDouJun({
      yearBranch: 'wu',
      birth: { lunarMonth: 4, lunarDay: 10, isLeapMonth: true, hourBranch: 'si' },
      leapMonthPolicy: 'same-as-normal'
    });
    const next = resolveDouJun({
      yearBranch: 'wu',
      birth: { lunarMonth: 4, lunarDay: 10, isLeapMonth: true, hourBranch: 'si' },
      leapMonthPolicy: 'next-month'
    });
    // 生月視為 4 月 vs 5 月，斗君必定不同
    expect(same).not.toBe(next);
  });
});

describe('P0-4 完整排盤流月斗君整合', () => {
  const base: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 1990, month: 5, day: 15 },
    time: { hour: 10, minute: 30 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  };

  it('2026-09-23（農曆八月十三日）：流月命宮精確在卯（與斗君訣一致）', () => {
    const c = calculate(base, { targetDate: { year: 2026, month: 9, day: 23 } });
    expect(c.periods.year?.branch).toBe('wu');
    expect(c.periods.month?.branch).toBe('mao');
  });

  it('流日自流月初一順數：十三日在卯', () => {
    const c = calculate(base, { targetDate: { year: 2026, month: 9, day: 23 } });
    expect(c.periods.day?.branch).toBe('mao');
  });

  it('流時自流日子時順數：未時（14:00）在戌', () => {
    const c = calculate(base, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });
    expect(c.periods.hour?.branch).toBe('xu');
  });
});
