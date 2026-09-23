import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar', date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 }, sexForCalculation: 'male'
};

const TARGET = { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } };

describe('period overlay', () => {
  const c = calculate(INPUT, TARGET);

  it('year period has 12 palaces and 24 period stars', () => {
    const y = c.periods.year!;
    expect(y.overlay).toBeTruthy();
    expect(y.overlay!.palaces.length).toBe(12);
    expect(y.overlay!.periodStars.length).toBe(24);
  });

  it('流年命宮 sits at the annual ganzhi branch', () => {
    const y = c.periods.year!;
    expect(y.branch).toBe(y.overlay!.lifePalaceBranch);
    const life = y.overlay!.palaces.find(p => p.palaceId === 'life')!;
    expect(life.branch).toBe(y.branch);
  });

  it('歲建 sits at the annual branch', () => {
    const y = c.periods.year!;
    const suijian = y.overlay!.periodStars.find(s => s.starId === 'ZW.STAR.PERIOD.SUIJIAN')!;
    expect(suijian.branch).toBe(y.branch);
  });

  it('12 palaces are distinct branches', () => {
    const y = c.periods.year!;
    expect(new Set(y.overlay!.palaces.map(p => p.branch)).size).toBe(12);
  });

  it('all four scopes have overlays', () => {
    for (const k of ['year', 'month', 'day', 'hour'] as const) {
      expect(c.periods[k]!.overlay, k).toBeTruthy();
      expect(c.periods[k]!.overlay!.palaces.length, k).toBe(12);
    }
  });

  it('period transformations use the correct stem for the year', () => {
    // 2026 = 丙午 → 天同化祿、天機化權、文昌化科、廉貞化忌
    const y = c.periods.year!;
    expect(y.stem).toBe('bing');
    const map = Object.fromEntries(y.overlay!.transformations.map(t => [t.type, t.targetStarId]));
    expect(map.lu).toBe('ZW.STAR.MAJOR.TIANTONG');
    expect(map.quan).toBe('ZW.STAR.MAJOR.TIANJI');
    expect(map.ke).toBe('ZW.STAR.AUX.WENCHANG');
    expect(map.ji).toBe('ZW.STAR.MAJOR.LIANZHEN');
  });

  it('period palaces carry ganzhi', () => {
    for (const p of c.periods.year!.overlay!.palaces) {
      expect(p.ganzhi.stem, p.palaceId).toBeTruthy();
      expect(p.ganzhi.branch).toBe(p.branch);
    }
  });

  it('month/day/hour stems differ from year (real ganzhi, not approximation)', () => {
    const y = c.periods.year!;
    const m = c.periods.month!;
    const d = c.periods.day!;
    const h = c.periods.hour!;
    expect([m.stem, d.stem, h.stem].some(s => s !== y.stem)).toBe(true);
  });

  it('period transformation count = 4 per scope', () => {
    const scopes = ['year', 'month', 'day', 'hour'] as const;
    for (const s of scopes) {
      const count = c.chart.transformations.filter(t => t.sourceScope === s).length;
      expect(count, s).toBe(4);
    }
  });
});
