import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import { virtualAge, ageAt } from '../../src/period-engine/major-period-resolver.js';

/**
 * spec 3rd §P0-1：大限年齡不得使用 Gregorian target.year
 *
 * 虛歲 = target lunar year − birth lunar year + 1
 * 驗收：同一 Gregorian year 內，跨農曆新年前後，virtualAge 必須在正確邊界才 +1。
 */

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 }, // 農曆 1990 年
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male' // 陽男順行，土五局，大限 5-14, 15-24, 25-34, 35-44, 45-54 ...
};

describe('P0-1 virtualAge 純函式契約', () => {
  it('以農曆年份計算', () => {
    expect(virtualAge(1990, 2025)).toBe(36);
    expect(virtualAge(1990, 2026)).toBe(37);
  });

  it('ageAt 吃兩個農曆年數字', () => {
    expect(ageAt(1990, 2025)).toBe(36);
    expect(ageAt(1990, 2026)).toBe(37);
  });
});

describe('P0-1 跨農曆新年邊界：大限年齡不在 1/1 提早 +1', () => {
  // 2026 年春節為 2026-02-17
  // 2026-02-16 仍屬農曆 2025 年（乙巳年）
  // 2026-02-17 進入農曆 2026 年（丙午年）

  it('國曆 1 月仍在前一農曆年（虛歲 36，非 37）', () => {
    const jan5 = calculate(base, { targetDate: { year: 2026, month: 1, day: 5 } });
    expect(jan5.periods.active?.age).toBe(36);
  });

  it('農曆年前一天：仍為 36 歲', () => {
    const eve = calculate(base, { targetDate: { year: 2026, month: 2, day: 16 } });
    expect(eve.periods.active?.age).toBe(36);
  });

  it('農曆新年當天：滿 37 歲', () => {
    const day1 = calculate(base, { targetDate: { year: 2026, month: 2, day: 17 } });
    expect(day1.periods.active?.age).toBe(37);
  });

  it('農曆新年後一天：維持 37 歲', () => {
    const day2 = calculate(base, { targetDate: { year: 2026, month: 2, day: 18 } });
    expect(day2.periods.active?.age).toBe(37);
  });

  it('大限切換精確在農曆新年：火六局 35 歲與 36 歲切換測試', () => {
    // 1990-05-15 生（火六局），大限 6-15, 16-25, 26-35, 36-45 ...
    // 2025 年春節為 2025-01-29
    // 2025-01-28（春節前，仍屬農曆 2024 年）→ 虛歲 2024 - 1990 + 1 = 35 歲 → 仍為 26-35 大限
    // 2025-01-29（春節當天，農曆 2025 年）→ 虛歲 36 歲 → 切換至 36-45 大限
    const eve = calculate(base, { targetDate: { year: 2025, month: 1, day: 28 } });
    const day1 = calculate(base, { targetDate: { year: 2025, month: 1, day: 29 } });

    // 若誤用 Gregorian target.year，春節前會被算成 2025-1990+1 = 36 而提早換限
    expect(eve.periods.active?.age).toBe(35);
    expect(eve.periods.active?.major?.fromAge).toBe(26);
    expect(eve.periods.active?.major?.toAge).toBe(35);

    expect(day1.periods.active?.age).toBe(36);
    expect(day1.periods.active?.major?.fromAge).toBe(36);
    expect(day1.periods.active?.major?.toAge).toBe(45);

    expect(eve.periods.active?.major?.branch).not.toBe(day1.periods.active?.major?.branch);
    expect(eve.periods.active?.major?.ganzhi).not.toEqual(day1.periods.active?.major?.ganzhi);
  });
});
