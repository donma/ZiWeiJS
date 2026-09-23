import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe } from '../../src/index.js';
import { listStars } from '../../src/executors/star-executors.js';
import { analyzeUnknownTime, toContext, renderChartSvg, listRules } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar', date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 }, timezone: 'Asia/Taipei', sexForCalculation: 'male'
};

const MULTI: ZiWeiBirthInput[] = [
  INPUT,
  { calendarType: 'solar', date: { year: 1985, month: 11, day: 20 }, time: { hour: 14 }, sexForCalculation: 'female' },
  { calendarType: 'solar', date: { year: 2000, month: 1, day: 1 }, time: { hour: 0 }, sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 1988, month: 8, day: 8 }, time: { hour: 20 }, sexForCalculation: 'female' },
  { calendarType: 'lunar', date: { year: 1990, month: 5, day: 10, isLeapMonth: true }, time: { hour: 6 }, sexForCalculation: 'female' }
];

describe('integrity: star coverage', () => {
  it('all non-deprecated stars get placed across test inputs', () => {
    const placed = new Set<string>();
    for (const input of MULTI) {
      const c = calculate(input);
      for (const id of Object.keys(c.chart.stars)) placed.add(id);
    }
    const unplaced = listStars().filter(s => !placed.has(s.id) && s.status !== 'deprecated');
    expect(unplaced.map(s => s.id)).toEqual([]);
  });
});

describe('integrity: chart structure', () => {
  const c = calculate(INPUT);

  it('12 palaces, exactly 1 life + 1 body', () => {
    expect(c.chart.palaces.length).toBe(12);
    expect(c.chart.palaces.filter(p => p.isLifePalace).length).toBe(1);
    expect(c.chart.palaces.filter(p => p.isBodyPalace).length).toBe(1);
  });

  it('all 14 majors placed', () => {
    const majors = Object.values(c.chart.stars).filter((s: unknown) => (s as { star: { category: string } }).star.category === 'major');
    expect(majors.length).toBe(14);
  });

  it('natal sihua = 4, palace sihua = 48', () => {
    expect(c.chart.transformations.filter(t => t.sourceScope === 'natal').length).toBe(4);
    expect(c.chart.transformations.filter(t => t.sourceScope === 'palace').length).toBe(48);
  });

  it('all majors have dignity', () => {
    for (const s of Object.values(c.chart.stars) as unknown as Array<{ star: { category: string }; starId: string; dignity?: string }>) {
      if (s.star.category === 'major') expect(s.dignity, s.starId).toBeTruthy();
    }
  });

  it('12 major periods starting at bureau number', () => {
    expect(c.periods.major.length).toBe(12);
    expect(c.periods.major[0].fromAge).toBe(2);
  });

  it('all palaces have changsheng + boshi', () => {
    for (const p of c.chart.palaces) {
      expect(p.changsheng, p.id).toBeTruthy();
      expect(p.boshi, p.id).toBeTruthy();
    }
  });
});

describe('integrity: outputs', () => {
  const c = calculate(INPUT, { trace: true });

  it('svg contains required structure', () => {
    const svg = renderChartSvg(c, { mode: 'expert' });
    expect((svg.match(/class="zw-palace"/g) ?? []).length).toBe(12);
    expect(svg).toContain('data-rule=');
    expect(svg).toContain('data-star=');
  });

  it('interpretation produces hits across multiple domains', () => {
    const domains = new Set(c.interpretation.hits.map(h => h.domain));
    expect(domains.size).toBeGreaterThanOrEqual(4);
  });

  it('patterns evaluated', () => {
    expect(c.chart.patterns.length).toBeGreaterThanOrEqual(12);
  });

  it('trace has >= 10 entries with ruleId', () => {
    expect(c.trace!.entries.length).toBeGreaterThanOrEqual(10);
    expect(c.trace!.entries.every(e => e.ruleId)).toBe(true);
  });

  it('ai context has all required keys', () => {
    const ctx = toContext(c);
    for (const k of ['birth', 'pillars', 'lifePalace', 'bodyPalace', 'bureau', 'palaces', 'transformations', 'patterns', 'periods', 'interpretationHits', 'ruleIds', 'profile', 'schemaVersion', 'certainty']) {
      expect(ctx, k).toHaveProperty(k);
    }
  });

  it('unknown-time gives 12 candidates', () => {
    const { time, ...rest } = INPUT;
    const r = analyzeUnknownTime(rest);
    expect(r.candidates.length).toBe(12);
  });
});

describe('integrity: error paths', () => {
  it('UNKNOWN_SEX_FOR_CALCULATION', () => {
    const r = calculateSafe({ calendarType: 'solar', date: { year: 2000, month: 1, day: 1 }, time: { hour: 8 } });
    expect(!r.ok && r.error.code === 'UNKNOWN_SEX_FOR_CALCULATION').toBe(true);
  });
  it('INVALID_TIMEZONE', () => {
    const r = calculateSafe({ calendarType: 'solar', date: { year: 2000, month: 1, day: 1 }, time: { hour: 8 }, timezone: 'X/Y', sexForCalculation: 'male' });
    expect(!r.ok && r.error.code === 'INVALID_TIMEZONE').toBe(true);
  });
  it('INVALID_DATE', () => {
    const r = calculateSafe({ calendarType: 'solar', date: { year: 2000, month: 13, day: 1 }, time: { hour: 8 }, sexForCalculation: 'male' });
    expect(!r.ok && r.error.code === 'INVALID_DATE').toBe(true);
  });
  it('MISSING_LOCATION_FOR_SOLAR_TIME', () => {
    const r = calculateSafe({ calendarType: 'solar', date: { year: 2000, month: 1, day: 1 }, time: { hour: 8 }, sexForCalculation: 'male' }, { profile: 'true-solar' });
    expect(!r.ok && r.error.code === 'MISSING_LOCATION_FOR_SOLAR_TIME').toBe(true);
  });
});

describe('integrity: canonical rules have sources', () => {
  it('every canonical rule has sourceRefs (except validation rules)', () => {
    const bad = listRules({ status: 'canonical' }).filter(r =>
      (!r.sourceRefs || r.sourceRefs.length === 0) && !r.tags?.includes('validation')
    );
    expect(bad.map(r => r.ruleId)).toEqual([]);
  });
});
