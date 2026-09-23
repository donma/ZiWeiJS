import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const INPUTS: ZiWeiBirthInput[] = [
  { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10, minute: 30 }, sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 1985, month: 11, day: 20 }, time: { hour: 14 }, sexForCalculation: 'female' },
  { calendarType: 'solar', date: { year: 2000, month: 1, day: 1 }, time: { hour: 0 }, sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 1988, month: 8, day: 8 }, time: { hour: 20 }, sexForCalculation: 'female' },
  { calendarType: 'solar', date: { year: 1975, month: 6, day: 6 }, time: { hour: 12 }, sexForCalculation: 'male' }
];

describe('interpretation conflict model', () => {
  it('every hit has effectiveStrength', () => {
    for (const input of INPUTS) {
      for (const h of calculate(input).interpretation.hits) {
        expect(typeof h.effectiveStrength, h.ruleId).toBe('number');
      }
    }
  });

  it('conflicts are symmetric', () => {
    for (const input of INPUTS) {
      const hits = calculate(input).interpretation.hits;
      for (const h of hits) {
        for (const c of h.conflictsWith) {
          const other = hits.find(x => x.ruleId === c);
          if (other) expect(other.conflictsWith, `${c} should list ${h.ruleId}`).toContain(h.ruleId);
        }
      }
    }
  });

  it('overriddenBy only references matched rules', () => {
    for (const input of INPUTS) {
      const hits = calculate(input).interpretation.hits;
      const ids = new Set(hits.map(h => h.ruleId));
      for (const h of hits) {
        for (const by of h.overriddenBy) {
          expect(ids.has(by), `${h.ruleId} overriddenBy ${by} not matched`).toBe(true);
        }
      }
    }
  });

  it('overridesList is the inverse of overriddenBy', () => {
    for (const input of INPUTS) {
      const hits = calculate(input).interpretation.hits;
      for (const h of hits) {
        for (const o of h.overridesList ?? []) {
          const other = hits.find(x => x.ruleId === o);
          if (other) expect(other.overriddenBy, `${o} should be overriddenBy ${h.ruleId}`).toContain(h.ruleId);
        }
      }
    }
  });

  it('overridden hits get reduced effectiveStrength', () => {
    let found = false;
    for (const input of INPUTS) {
      for (const h of calculate(input).interpretation.hits) {
        if (h.overriddenBy.length > 0) {
          found = true;
          expect(h.effectiveStrength).toBeLessThan(h.strength);
        }
      }
    }
    expect(found, 'expected at least one overridden hit across test set').toBe(true);
  });

  it('does not remove overridden hits (explainability preserved)', () => {
    for (const input of INPUTS) {
      const hits = calculate(input).interpretation.hits;
      for (const h of hits) {
        if (h.overriddenBy.length > 0) {
          expect(h.text, h.ruleId).toBeTruthy();
        }
      }
    }
  });
});
