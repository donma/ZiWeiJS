import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * spec 3rd §P0-10：歲建 / 將前十二神不得無條件套用到 month / day / hour
 *
 * 歲建十二神（period）與將前十二神（interim）只依「流年」安放，
 * 流月 / 流日 / 流時的 overlay.periodStars 必須為空。
 */

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

const full = calculate(base, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });

describe('P0-10 overlay periodStars 依 scope', () => {
  it('流年安放歲建（12）+ 將前（12）= 24 顆', () => {
    const stars = full.periods.year?.overlay?.periodStars ?? [];
    expect(stars).toHaveLength(24);
    const ids = stars.map(s => s.starId);
    expect(ids.some(id => id.startsWith('ZW.STAR.PERIOD.'))).toBe(true);
    expect(ids.some(id => id.startsWith('ZW.STAR.INTERIM.'))).toBe(true);
  });

  it('流月 / 流日 / 流時 periodStars 一律為空', () => {
    expect(full.periods.month?.overlay?.periodStars ?? []).toHaveLength(0);
    expect(full.periods.day?.overlay?.periodStars ?? []).toHaveLength(0);
    expect(full.periods.hour?.overlay?.periodStars ?? []).toHaveLength(0);
  });

  it('各限運 overlay 仍有十二宮與四化', () => {
    for (const info of [full.periods.year, full.periods.month, full.periods.day, full.periods.hour]) {
      expect(info?.overlay?.palaces.length).toBe(12);
      expect((info?.overlay?.transformations.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it('只有 year-only target 時，不得產生任何非流年 overlay', () => {
    const y = calculate(base, { targetDate: { year: 2026 } });
    expect(y.periods.year).toBeTruthy();
    expect(y.periods.month).toBeUndefined();
    expect(y.periods.day).toBeUndefined();
    expect(y.periods.hour).toBeUndefined();
  });
});
