import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * spec 3rd §P1-1：Birth Input 嚴格驗證
 * spec 3rd §P1-2：Timezone Local Wall Time / DST 邊界處理
 */

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

function errorCode(input: ZiWeiBirthInput): string {
  const res = calculateSafe(input);
  return res.ok ? 'OK' : res.error.code;
}

describe('P1-1 Birth Input 嚴格日期與時間驗證', () => {
  it('平年 2/29 拋 INVALID_DATE', () => {
    expect(errorCode({ ...base, date: { year: 2025, month: 2, day: 29 } })).toBe('INVALID_DATE');
  });

  it('大月小月邊界：4/31 拋 INVALID_DATE', () => {
    expect(errorCode({ ...base, date: { year: 2026, month: 4, day: 31 } })).toBe('INVALID_DATE');
  });

  it('閏年 2/29 正常通過', () => {
    expect(errorCode({ ...base, date: { year: 2024, month: 2, day: 29 } })).toBe('OK');
  });

  it('時辰超界：hour 25 不得被 modulo 吞掉，拋 INVALID_INPUT', () => {
    expect(errorCode({ ...base, time: { hour: 25 } })).toBe('INVALID_INPUT');
    expect(errorCode({ ...base, time: { hour: -1 } })).toBe('INVALID_INPUT');
  });

  it('分秒超界：minute 61 拋 INVALID_INPUT', () => {
    expect(errorCode({ ...base, time: { hour: 10, minute: 60 } })).toBe('INVALID_INPUT');
    expect(errorCode({ ...base, time: { hour: 10, second: 60 } })).toBe('INVALID_INPUT');
  });

  it('經緯度超界或 NaN 拋 INVALID_INPUT', () => {
    expect(errorCode({ ...base, location: { longitude: 200 } })).toBe('INVALID_INPUT');
    expect(errorCode({ ...base, location: { longitude: -190 } })).toBe('INVALID_INPUT');
    expect(errorCode({ ...base, location: { latitude: 100 } })).toBe('INVALID_INPUT');
    expect(errorCode({ ...base, location: { longitude: NaN } })).toBe('INVALID_INPUT');
    expect(errorCode({ ...base, location: { longitude: Infinity } })).toBe('INVALID_INPUT');
  });

  it('農曆小月（29天）給 30 號拋 INVALID_LUNAR_DATE', () => {
    // 2024 年農曆正月為小月（只有 29 天）
    expect(errorCode({
      ...base,
      calendarType: 'lunar',
      date: { year: 2024, month: 1, day: 30 }
    })).toBe('INVALID_LUNAR_DATE');
  });

  it('農曆大月（30天）30 號正常通過', () => {
    // 2024 年農曆二月為大月（30 天）
    expect(errorCode({
      ...base,
      calendarType: 'lunar',
      date: { year: 2024, month: 2, day: 30 }
    })).toBe('OK');
  });
});

describe('P1-2 Timezone Local Wall Time / DST 邊界處理', () => {
  const ny = (y: number, m: number, d: number, hour: number, minute = 0): ZiWeiBirthInput => ({
    calendarType: 'solar',
    date: { year: y, month: m, day: d },
    time: { hour, minute },
    timezone: 'America/New_York',
    sexForCalculation: 'male'
  });

  it('春季切換缺洞（不存在的 2:30）預設 reject 拋 NONEXISTENT_LOCAL_TIME', () => {
    expect(errorCode(ny(2024, 3, 10, 2, 30))).toBe('NONEXISTENT_LOCAL_TIME');
  });

  it('秋季切換重複（歧義的 1:30）預設 reject 拋 AMBIGUOUS_LOCAL_TIME', () => {
    expect(errorCode(ny(2024, 11, 3, 1, 30))).toBe('AMBIGUOUS_LOCAL_TIME');
  });

  it('以 timezoneDisambiguation: earlier / later 處理缺洞與歧義', () => {
    const hole = { ...ny(2024, 3, 10, 2, 30), timezoneDisambiguation: 'earlier' as const };
    const amb = { ...ny(2024, 11, 3, 1, 30), timezoneDisambiguation: 'later' as const };
    expect(errorCode(hole)).toBe('OK');
    expect(errorCode(amb)).toBe('OK');
  });
});
