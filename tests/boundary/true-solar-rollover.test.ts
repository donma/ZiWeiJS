import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * P1-6 真太陽時跨日（spec §13）
 *
 * 真太陽時 / 地方平太陽時校正可能把時間推過午夜，
 * 此時 solar date / lunar date / 日柱 / 時柱 必須同步調整，
 * 且子時換日判定必須以 effective time 為準。
 */
function input(over: { hour: number; minute?: number; tz: string; lon: number; boundary?: 'midnight' | 'zi-hour' }): ZiWeiBirthInput {
  return {
    calendarType: 'solar',
    date: { year: 2000, month: 1, day: 1 },
    time: { hour: over.hour, minute: over.minute ?? 10 },
    timezone: over.tz,
    location: { longitude: over.lon },
    timeConvention: 'local-mean-solar',
    dayBoundary: over.boundary,
    sexForCalculation: 'male'
  };
}

describe('P1-6 真太陽時跨日：往前一日', () => {
  // Asia/Taipei = +480 分 → 標準子午線 120°E；經度 0° → 位移 -480 分（-8 小時）
  const c = calculate(input({ hour: 0, tz: 'Asia/Taipei', lon: 0 }));

  it('校正後時間落在前一日', () => {
    expect(c.calendar.solar).toEqual({ year: 1999, month: 12, day: 31 });
    expect(c.calendar.trueSolarOffsetMinutes).toBe(-480);
    expect(c.calendar.hourBranch).toBe('shen'); // 16:xx → 申
  });

  it('農曆日期同步調整', () => {
    expect(c.calendar.lunar).toEqual({ year: 1999, month: 11, day: 24, isLeapMonth: false });
  });

  it('日柱隨 effective 日期改變（非原本的 1/1）', () => {
    const dec31 = calculate({
      calendarType: 'solar', date: { year: 1999, month: 12, day: 31 },
      time: { hour: 16, minute: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'male'
    });
    expect(c.calendar.ganzhi.day).toEqual(dec31.calendar.ganzhi.day);
  });
});

describe('P1-6 真太陽時跨日：往後一日', () => {
  // UTC = +0 → 標準子午線 0°；經度 180°E → 位移 +720 分（+12 小時）
  const c = calculate(input({ hour: 23, minute: 30, tz: 'UTC', lon: 180 }));

  it('校正後時間落在次日', () => {
    expect(c.calendar.solar).toEqual({ year: 2000, month: 1, day: 2 });
    expect(c.calendar.trueSolarOffsetMinutes).toBe(720);
    expect(c.calendar.hourBranch).toBe('wu'); // 11:xx → 午
  });

  it('農曆日期同步調整至次日', () => {
    expect(c.calendar.lunar).toEqual({ year: 1999, month: 11, day: 26, isLeapMonth: false });
  });

  it('日柱與該 effective 日期一致', () => {
    const jan2 = calculate({
      calendarType: 'solar', date: { year: 2000, month: 1, day: 2 },
      time: { hour: 11, minute: 30 }, timezone: 'UTC', sexForCalculation: 'male'
    });
    expect(c.calendar.ganzhi.day).toEqual(jan2.calendar.ganzhi.day);
  });
});

describe('P1-6 子時換日以 effective time 判定', () => {
  it('原始 22:xx 經校正在 zi-hour profile 下推入 23:xx → 視為子時換日', () => {
    // 22:50 + 位移（+30 分）= 23:20
    const c = calculate({
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 22, minute: 50 }, timezone: 'UTC', location: { longitude: 7.5 },
      timeConvention: 'local-mean-solar', dayBoundary: 'zi-hour', sexForCalculation: 'male'
    });
    expect(c.calendar.hourBranch).toBe('zi');
    // 子時換日 → 農曆進一日
    expect(c.calendar.lunar.day).toBe(26);
  });

  it('原始 23:xx 但校正後仍在 23:00 前 → 不換日', () => {
    const c = calculate({
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 23, minute: 5 }, timezone: 'UTC', location: { longitude: -1 },
      timeConvention: 'local-mean-solar', dayBoundary: 'zi-hour', sexForCalculation: 'male'
    });
    // 23:05 - 4 分 = 23:01 → 仍在子時
    expect(c.calendar.hourBranch).toBe('zi');
    expect(c.calendar.lunar.day).toBe(26);
  });
});

describe('P1-6 未使用真太陽時時不得位移', () => {
  it('civil 慣例下日期不變', () => {
    const c = calculate({
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 0, minute: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'male'
    });
    expect(c.calendar.solar).toEqual({ year: 2000, month: 1, day: 1 });
    expect(c.calendar.trueSolarOffsetMinutes).toBeUndefined();
  });

  it('true-solar 缺少經度 → MISSING_LOCATION_FOR_SOLAR_TIME', () => {
    const r = calculateSafe({
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 12 }, timezone: 'Asia/Taipei', timeConvention: 'true-solar', sexForCalculation: 'male'
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MISSING_LOCATION_FOR_SOLAR_TIME');
  });
});
