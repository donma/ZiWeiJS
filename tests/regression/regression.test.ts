import { describe, it, expect } from 'vitest';
import { calculate, ZiWei } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const cases: Array<{ name: string; input: ZiWeiBirthInput; check: (c: ReturnType<typeof calculate>) => void }> = [
  {
    name: 'each palace has exactly one major palace id & 12 palaces',
    input: {
      calendarType: 'solar', date: { year: 2000, month: 6, day: 6 },
      time: { hour: 12 }, sexForCalculation: 'female'
    },
    check: c => {
      expect(c.chart.palaces.length).toBe(12);
      expect(c.chart.palaces.filter(p => p.isLifePalace).length).toBe(1);
      expect(c.chart.palaces.filter(p => p.isBodyPalace).length).toBe(1);
    }
  },
  {
    name: 'all 14 majors are placed',
    input: {
      calendarType: 'solar', date: { year: 1995, month: 3, day: 3 },
      time: { hour: 5 }, sexForCalculation: 'male'
    },
    check: c => {
      const majors = Object.values(c.chart.stars).filter((s: unknown) => (s as { star: { category: string } }).star.category === 'major');
      expect(majors.length).toBe(14);
    }
  },
  {
    name: 'natal sihua always has 4 entries',
    input: {
      calendarType: 'solar', date: { year: 1988, month: 8, day: 8 },
      time: { hour: 20 }, sexForCalculation: 'female'
    },
    check: c => {
      const natal = c.chart.transformations.filter(t => t.sourceScope === 'natal');
      expect(natal.length).toBe(4);
      expect(new Set(natal.map(t => t.type)).size).toBe(4);
    }
  },
  {
    name: 'palace-stem sihua produces 48 (12 palaces × 4) transforms',
    input: {
      calendarType: 'solar', date: { year: 1992, month: 2, day: 14 },
      time: { hour: 9 }, sexForCalculation: 'male'
    },
    check: c => {
      const palace = c.chart.transformations.filter(t => t.sourceScope === 'palace');
      expect(palace.length).toBe(48);
    }
  },
  {
    name: 'ZiWei.AI.toContext returns all required keys',
    input: {
      calendarType: 'solar', date: { year: 1980, month: 12, day: 25 },
      time: { hour: 3 }, sexForCalculation: 'female'
    },
    check: c => {
      const ctx = ZiWei.AI.toContext(c);
      for (const k of ['birth', 'pillars', 'lifePalace', 'bodyPalace', 'bureau', 'palaces', 'transformations', 'patterns', 'periods', 'interpretationHits', 'ruleIds', 'profile', 'schemaVersion', 'certainty']) {
        expect(ctx).toHaveProperty(k);
      }
      expect(ctx.palaces.length).toBe(12);
    }
  },
  {
    name: 'rendered svg contains palace group and star groups',
    input: {
      calendarType: 'solar', date: { year: 1978, month: 7, day: 17 },
      time: { hour: 16 }, sexForCalculation: 'male'
    },
    check: c => {
      const svg = ZiWei.Renderer.render(c, { mode: 'expert' });
      expect(svg).toContain('<svg');
      expect(svg).toContain('zw-palace');
      expect(svg).toContain('zw-star');
      expect(svg).toContain('data-rule=');
      expect((svg.match(/class="zw-palace"/g) ?? []).length).toBe(12);
    }
  }
];

describe('regression', () => {
  for (const tc of cases) {
    it(tc.name, () => tc.check(calculate(tc.input)));
  }
});
