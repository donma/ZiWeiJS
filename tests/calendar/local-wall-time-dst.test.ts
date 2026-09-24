import { describe, it, expect } from 'vitest';
import { resolveLocalWallTime, localOffsetMinutes } from '../../src/calendar/calendar-engine.js';
import { calculateSafe } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * spec 3rd §P1-2：本地牆上時間 / DST 明確定義
 *
 * 「不存在的本地時間」（spring forward 跳躍）與
 * 「歧義的本地時間」（fall back 重疊）不得被靜默吞掉；
 * 預設 reject，可由 timezoneDisambiguation 明確選擇 earlier / later。
 */

describe('P1-2 resolveLocalWallTime — 正常時間', () => {
  it('非 DST 邊界：無 missing、無 ambiguous', () => {
    const r = resolveLocalWallTime(2024, 6, 15, 12, 0, 0, 'America/New_York');
    expect(r.nonexistent).toBe(false);
    expect(r.ambiguous).toBe(false);
    expect(r.offsetMinutes).toBe(-240); // EDT
  });

  it('localOffsetMinutes 與 resolveLocalWallTime 一致', () => {
    const o = localOffsetMinutes(2024, 6, 15, 12, 0, 'America/New_York');
    expect(o).toBe(resolveLocalWallTime(2024, 6, 15, 12, 0, 0, 'America/New_York').offsetMinutes);
  });
});

describe('P1-2 spring forward：不存在的本地時間', () => {
  // 2024-03-10 02:30 America/New_York 不存在（02:00 → 03:00）
  it('預設 reject → NONEXISTENT_LOCAL_TIME', () => {
    expect(() => resolveLocalWallTime(2024, 3, 10, 2, 30, 0, 'America/New_York')).toThrowError(
      /NONEXISTENT_LOCAL_TIME|does not exist/
    );
  });

  it('earlier / later 明確解析，且標記 nonexistent', () => {
    const earlier = resolveLocalWallTime(2024, 3, 10, 2, 30, 0, 'America/New_York', 'earlier');
    const later = resolveLocalWallTime(2024, 3, 10, 2, 30, 0, 'America/New_York', 'later');
    expect(earlier.nonexistent).toBe(true);
    expect(later.nonexistent).toBe(true);
    expect(earlier.instant.getTime()).not.toBe(later.instant.getTime());
  });
});

describe('P1-2 fall back：歧義的本地時間', () => {
  // 2024-11-03 01:30 America/New_York 出現兩次（EDT → EST）
  it('預設 reject → AMBIGUOUS_LOCAL_TIME', () => {
    expect(() => resolveLocalWallTime(2024, 11, 3, 1, 30, 0, 'America/New_York')).toThrowError(
      /AMBIGUOUS_LOCAL_TIME|ambiguous/
    );
  });

  it('earlier 取較早瞬間、later 取較晚瞬間，且標記 ambiguous', () => {
    const earlier = resolveLocalWallTime(2024, 11, 3, 1, 30, 0, 'America/New_York', 'earlier');
    const later = resolveLocalWallTime(2024, 11, 3, 1, 30, 0, 'America/New_York', 'later');
    expect(earlier.ambiguous).toBe(true);
    expect(later.ambiguous).toBe(true);
    expect(earlier.instant.getTime()).toBeLessThan(later.instant.getTime());
    // 兩者 offset 不同（-240 EDT vs -300 EST）
    expect(earlier.offsetMinutes).not.toBe(later.offsetMinutes);
  });
});

describe('P1-2 calculateSafe 對 DST 邊界提供結構化錯誤', () => {
  const base: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 2024, month: 11, day: 3 },
    time: { hour: 1, minute: 30 },
    timezone: 'America/New_York',
    sexForCalculation: 'male'
  };

  it('未指定 timezoneDisambiguation → AMBIGUOUS_LOCAL_TIME', () => {
    const res = calculateSafe(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('AMBIGUOUS_LOCAL_TIME');
  });

  it('指定 earlier → 成功', () => {
    const res = calculateSafe({ ...base, timezoneDisambiguation: 'earlier' });
    expect(res.ok).toBe(true);
  });

  it('指定 later → 成功', () => {
    const res = calculateSafe({ ...base, timezoneDisambiguation: 'later' });
    expect(res.ok).toBe(true);
  });
});
