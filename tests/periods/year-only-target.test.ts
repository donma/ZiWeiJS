import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * spec 3rd §P0-3：year-only target 不得偷偷用 1/15；month-only 同義須標示並降 certainty
 *
 *   { year }             → 只算 active major + 流年，resolution = year-only
 *   { year, month }      → resolution = representative-date，certainty 降級，且無流日
 *   { year, month, day } → resolution = exact-date
 */

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'female'
};

describe('P0-3 year-only', () => {
  const c = calculate(base, { targetDate: { year: 2035 } });

  it('年柱以年度解析（不落回上一年農曆年）', () => {
    expect(c.periods.year?.ganzhi).toEqual({ stem: 'yi', branch: 'mao' });
    expect(c.periods.year?.branch).toBe('mao');
  });

  it('lunarYear / resolvedYear / yearBoundaryPolicy 明確', () => {
    expect(c.periods.year?.lunarYear).toBe(2035);
    expect(c.periods.year?.resolvedYear).toBe(2035);
    expect(c.periods.year?.yearBoundaryPolicy).toBe('lunar-new-year');
  });

  it('resolution = year-only，且不捏造月 / 日 / 時', () => {
    expect(c.periods.year?.resolution).toBe('year-only');
    expect(c.periods.month).toBeUndefined();
    expect(c.periods.day).toBeUndefined();
    expect(c.periods.hour).toBeUndefined();
  });

  it('active major 仍存在', () => {
    expect(c.periods.active).toBeTruthy();
  });
});

describe('P0-3 month-only（representative date）', () => {
  const c = calculate(base, { targetDate: { year: 2026, month: 2 } });

  it('resolution = representative-date，且不產生流日', () => {
    expect(c.periods.year?.resolution).toBe('representative-date');
    expect(c.periods.month).toBeTruthy();
    expect(c.periods.day).toBeUndefined();
  });

  it('certainty.periods 降級（非 high）', () => {
    expect(c.certainty.periods).toBe('medium');
  });
});

describe('P0-3 exact date', () => {
  const c = calculate(base, { targetDate: { year: 2026, month: 3, day: 19 } });

  it('resolution = exact-date，且 certainty 維持 high', () => {
    expect(c.periods.year?.resolution).toBe('exact-date');
    expect(c.periods.day).toBeTruthy();
    expect(c.certainty.periods).toBe('high');
  });
});
