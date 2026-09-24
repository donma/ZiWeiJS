import { describe, it, expect } from 'vitest';
import { resolveDouJun, monthLifeBranchFromDouJun } from '../../src/period-engine/doujun.js';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * spec 3rd §P0-4 / §1. 斗君：出生閏月必須正確影響斗君
 *
 * 斗君 = 流年歲建起正月，逆數「出生有效農曆月」，再自該宮起子時順數至出生時。
 * 出生閏月的有效月序由 profile.leapMonthPolicy 決定（same-as-normal / next-month / mid-month）。
 */

const LEAP_BIRTH: ZiWeiBirthInput = {
  calendarType: 'lunar',
  date: { year: 2020, month: 4, day: 10, isLeapMonth: true }, // 2020 閏四月初十
  time: { hour: 10 }, // 巳時
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('P0-4 出生閏月 → 有效生月 → 斗君', () => {
  it('閏四月初十（≤15）: same-as-normal 與 mid-month 同視為四月', () => {
    const same = resolveDouJun({
      yearBranch: 'wu',
      birth: { lunarMonth: 4, lunarDay: 10, isLeapMonth: true, hourBranch: 'si' },
      leapMonthPolicy: 'same-as-normal'
    });
    const mid = resolveDouJun({
      yearBranch: 'wu',
      birth: { lunarMonth: 4, lunarDay: 10, isLeapMonth: true, hourBranch: 'si' },
      leapMonthPolicy: 'mid-month'
    });
    expect(same).toBe('shen');
    expect(mid).toBe('shen');
  });

  it('閏四月初十: next-month 視為五月 → 斗君前移一宮', () => {
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
    expect(same).toBe('shen');
    expect(next).toBe('wei');
  });

  it('mid-month 閏月十六起改視為次月', () => {
    const early = resolveDouJun({
      yearBranch: 'wu',
      birth: { lunarMonth: 4, lunarDay: 16, isLeapMonth: true, hourBranch: 'si' },
      leapMonthPolicy: 'mid-month'
    });
    const next = resolveDouJun({
      yearBranch: 'wu',
      birth: { lunarMonth: 4, lunarDay: 16, isLeapMonth: true, hourBranch: 'si' },
      leapMonthPolicy: 'next-month'
    });
    expect(early).toBe(next);
  });

  it('非閏月出生時 policy 不影響斗君', () => {
    const a = resolveDouJun({
      yearBranch: 'wu',
      birth: { lunarMonth: 4, lunarDay: 10, isLeapMonth: false, hourBranch: 'si' },
      leapMonthPolicy: 'same-as-normal'
    });
    const b = resolveDouJun({
      yearBranch: 'wu',
      birth: { lunarMonth: 4, lunarDay: 10, isLeapMonth: false, hourBranch: 'si' },
      leapMonthPolicy: 'next-month'
    });
    expect(a).toBe(b);
  });
});

describe('P0-4 閏月出生完整排盤整合', () => {
  it('閏月出生被接受，且流月命宮 = 由斗君（same-as-normal）順數', () => {
    const c = calculate(LEAP_BIRTH, { targetDate: { year: 2026, month: 9, day: 23 } });
    // 出生閏月資訊保留在 calendar
    expect(c.calendar.lunar.isLeapMonth).toBe(true);
    expect(c.periods.year?.branch).toBe('wu');

    const douJun = resolveDouJun({
      yearBranch: c.periods.year!.branch,
      birth: {
        lunarMonth: c.calendar.lunar.month,
        lunarDay: c.calendar.lunar.day,
        isLeapMonth: c.calendar.lunar.isLeapMonth,
        hourBranch: c.calendar.hourBranch
      },
      leapMonthPolicy: 'same-as-normal'
    });
    // 2026-09-23 = 農曆八月十三，斗君（正月）為申 → 八月為卯
    expect(douJun).toBe('shen');
    expect(c.periods.month?.branch).toBe(monthLifeBranchFromDouJun(douJun, 8));
    expect(c.periods.month?.branch).toBe('mao');
  });
});
