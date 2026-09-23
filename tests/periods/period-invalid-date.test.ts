import { describe, it, expect } from 'vitest';
import { calculateSafe, calculate } from '../../src/index.js';
import type { ZiWeiBirthInput, TargetDate } from '../../src/index.js';

/**
 * spec 2nd §P0-5：targetDate 必須驗證「真實日期」，
 * 不得靠 JS Date rollover 默默接受 2025-02-29 / 2026-04-31 / 2026-13-01。
 */

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

function codeFor(target: TargetDate): string {
  const res = calculateSafe(base, { targetDate: target });
  return res.ok ? 'OK' : res.error.code;
}

describe('P0-5 targetDate 真實日期驗證', () => {
  it('2024-02-29（閏年）合法', () => {
    expect(codeFor({ year: 2024, month: 2, day: 29 })).toBe('OK');
  });

  it('2025-02-29（平年）→ INVALID_TARGET_DATE', () => {
    expect(codeFor({ year: 2025, month: 2, day: 29 })).toBe('INVALID_TARGET_DATE');
  });

  it('2026-04-31 → INVALID_TARGET_DATE', () => {
    expect(codeFor({ year: 2026, month: 4, day: 31 })).toBe('INVALID_TARGET_DATE');
  });

  it('2026-13-01 → INVALID_TARGET_DATE', () => {
    expect(codeFor({ year: 2026, month: 13, day: 1 })).toBe('INVALID_TARGET_DATE');
  });

  it('2026-02-30 / 2026-06-31 → INVALID_TARGET_DATE', () => {
    expect(codeFor({ year: 2026, month: 2, day: 30 })).toBe('INVALID_TARGET_DATE');
    expect(codeFor({ year: 2026, month: 6, day: 31 })).toBe('INVALID_TARGET_DATE');
  });

  it('calculate()（非 Safe）直接丟 INVALID_TARGET_DATE', () => {
    try {
      calculate(base, { targetDate: { year: 2025, month: 2, day: 29 } });
      expect.fail('should throw');
    } catch (e: any) {
      expect(e.name).toBe('ZiWeiError');
      expect(e.code).toBe('INVALID_TARGET_DATE');
    }
  });
});

describe('P0-6 minute 支援與驗證', () => {
  it('minute 0..59 合法', () => {
    expect(codeFor({ year: 2026, month: 9, day: 23, hour: 14, minute: 30 })).toBe('OK');
  });

  it('minute 超界 → INVALID_TARGET_DATE', () => {
    expect(codeFor({ year: 2026, month: 9, day: 23, hour: 14, minute: 60 })).toBe('INVALID_TARGET_DATE');
    expect(codeFor({ year: 2026, month: 9, day: 23, hour: 14, minute: -1 })).toBe('INVALID_TARGET_DATE');
  });

  it('minute 無 hour → INVALID_TARGET_DATE', () => {
    expect(codeFor({ year: 2026, month: 9, day: 23, minute: 30 })).toBe('INVALID_TARGET_DATE');
  });
});
