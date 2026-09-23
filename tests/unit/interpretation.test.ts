import { describe, it, expect } from 'vitest';
import { calculate, listInterpretationRules, listPatterns, renderNarrative, groupByDomain } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const INPUTS: ZiWeiBirthInput[] = [
  { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10, minute: 30 }, sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 1985, month: 11, day: 20 }, time: { hour: 14 }, sexForCalculation: 'female' },
  { calendarType: 'solar', date: { year: 2000, month: 1, day: 1 }, time: { hour: 0 }, sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 1988, month: 8, day: 8 }, time: { hour: 20 }, sexForCalculation: 'female' },
];

describe('interpretation engine', () => {
  it('has >= 40 interpretation rules', () => {
    expect(listInterpretationRules().length).toBeGreaterThanOrEqual(40);
  });

  it('all interpretation rules have required fields', () => {
    for (const r of listInterpretationRules() as unknown as Array<Record<string, unknown>>) {
      expect(r.ruleId, 'ruleId').toBeTruthy();
      expect(r.domain, `${r.ruleId} domain`).toBeTruthy();
      expect(r.tendency, `${r.ruleId} tendency`).toBeTruthy();
      expect(typeof r.strength, `${r.ruleId} strength`).toBe('number');
      expect(typeof r.confidence, `${r.ruleId} confidence`).toBe('number');
    }
  });

  it('produces hits across >= 6 domains over test set', () => {
    const domains = new Set<string>();
    for (const input of INPUTS) {
      for (const h of calculate(input).interpretation.hits) domains.add(h.domain);
    }
    expect(domains.size).toBeGreaterThanOrEqual(6);
  });

  it('groupByDomain sorts by priority then strength', () => {
    const c = calculate(INPUTS[0]);
    const grouped = groupByDomain(c.interpretation.hits);
    for (const list of Object.values(grouped)) {
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1], cur = list[i];
        const ok = prev.priority > cur.priority || (prev.priority === cur.priority && prev.strength >= cur.strength);
        expect(ok).toBe(true);
      }
    }
  });

  it('narrative renders sections with rule ids', () => {
    const c = calculate(INPUTS[0]);
    const sections = renderNarrative(c);
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) {
      expect(s.hitRuleIds.length).toBeGreaterThan(0);
      expect(s.paragraphs.length).toBeGreaterThan(0);
    }
  });
});

describe('pattern engine', () => {
  it('has >= 20 patterns', () => {
    expect(listPatterns().length).toBeGreaterThanOrEqual(20);
  });

  it('every pattern has name and required conditions', () => {
    for (const p of listPatterns() as unknown as Array<Record<string, unknown>>) {
      expect(p.ruleId, 'ruleId').toBeTruthy();
      expect(p.name, `${p.ruleId} name`).toBeTruthy();
      expect(Array.isArray(p.required) || Array.isArray(p.breakers), `${p.ruleId} conditions`).toBeTruthy();
    }
  });

  it('pattern status is one of the defined states', () => {
    const valid = ['complete', 'partial', 'enhanced', 'broken', 'variant-only', 'insufficient'];
    for (const input of INPUTS) {
      for (const p of calculate(input).chart.patterns) {
        expect(valid, `${p.patternId} => ${p.status}`).toContain(p.status);
      }
    }
  });

  it('matches at least one pattern across the test set', () => {
    let matched = 0;
    for (const input of INPUTS) {
      matched += calculate(input).chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced').length;
    }
    expect(matched).toBeGreaterThan(0);
  });

  it('broken requires all required conditions met plus breakers', () => {
    for (const input of INPUTS) {
      for (const p of calculate(input).chart.patterns) {
        if (p.status === 'broken') {
          expect(p.matchedConditions.length).toBeGreaterThan(0);
          expect(p.breakers.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
