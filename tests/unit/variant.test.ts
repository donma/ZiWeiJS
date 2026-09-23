import { describe, it, expect } from 'vitest';
import { calculate, listProfiles, listRules } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const GENG: ZiWeiBirthInput = { calendarType: 'solar', date: { year: 1990, month: 6, day: 6 }, time: { hour: 10 }, sexForCalculation: 'male' };
const XIN: ZiWeiBirthInput = { calendarType: 'solar', date: { year: 1991, month: 6, day: 6 }, time: { hour: 10 }, sexForCalculation: 'male' };

describe('profiles', () => {
  it('exposes 5 built-in profiles', () => {
    const ids = listProfiles().map(p => p.profileId);
    expect(ids).toContain('canonical');
    expect(ids).toContain('traditional-zi');
    expect(ids).toContain('true-solar');
    expect(ids).toContain('school-zhongzhou');
    expect(ids).toContain('school-ma-hu');
  });

  it('every profile declares timeConvention and dayBoundary', () => {
    for (const p of listProfiles()) {
      expect(p.timeConvention, p.profileId).toBeTruthy();
      expect(p.dayBoundary, p.profileId).toBeTruthy();
    }
  });

  it('profile.ruleOverrides point to existing rules', () => {
    const ids = new Set(listRules().map(r => r.ruleId));
    for (const p of listProfiles()) {
      for (const [from, to] of Object.entries(p.ruleOverrides ?? {})) {
        expect(ids.has(to), `${p.profileId}: ${from} → ${to}`).toBe(true);
      }
    }
  });
});

describe('variant: sihua (zhongzhou geng stem)', () => {
  it('canonical geng: wu qu hua quan, tai yin hua ke', () => {
    const c = calculate(GENG, { profile: 'canonical' });
    const map = Object.fromEntries(c.chart.transformations.filter(t => t.sourceScope === 'natal').map(t => [t.type, t.targetStarId]));
    expect(map.quan).toBe('ZW.STAR.MAJOR.WUQU');
    expect(map.ke).toBe('ZW.STAR.MAJOR.TAIYIN');
  });

  it('zhongzhou geng: tian fu hua quan, tian xiang hua ke', () => {
    const c = calculate(GENG, { profile: 'school-zhongzhou' });
    const map = Object.fromEntries(c.chart.transformations.filter(t => t.sourceScope === 'natal').map(t => [t.type, t.targetStarId]));
    expect(map.quan).toBe('ZW.STAR.MAJOR.TIANFU');
    expect(map.ke).toBe('ZW.STAR.MAJOR.TIANXIANG');
  });

  it('zhongzhou still hua-ji tian tong (unchanged)', () => {
    const c = calculate(GENG, { profile: 'school-zhongzhou' });
    const map = Object.fromEntries(c.chart.transformations.filter(t => t.sourceScope === 'natal').map(t => [t.type, t.targetStarId]));
    expect(map.ji).toBe('ZW.STAR.MAJOR.TIANTONG');
  });

  it('trace records the variant rule id', () => {
    const c = calculate(GENG, { profile: 'school-zhongzhou', trace: true });
    expect(c.trace!.entries.some(e => e.ruleId === 'ZW.CALC.SIHUA.NATAL.V001')).toBe(true);
  });

  it('chart records which profile produced it', () => {
    expect(calculate(GENG, { profile: 'school-zhongzhou' }).generatedWith.profile).toBe('school-zhongzhou');
  });
});

describe('variant: kui yue (ma-she)', () => {
  it('canonical xin: tian yue at yin', () => {
    const c = calculate(XIN, { profile: 'canonical' });
    expect((c.chart.stars['ZW.STAR.AUX.TIANYUE'] ).branch).toBe('yin');
  });

  it('ma-hu variant xin: tian yue at si', () => {
    const c = calculate(XIN, { profile: 'school-ma-hu' });
    expect((c.chart.stars['ZW.STAR.AUX.TIANYUE'] ).branch).toBe('si');
  });

  it('tian kui unchanged across variants', () => {
    const a = calculate(XIN, { profile: 'canonical' });
    const b = calculate(XIN, { profile: 'school-ma-hu' });
    const kui = (c: typeof a) => (c.chart.stars['ZW.STAR.AUX.TIANKUI'] ).branch;
    expect(kui(a)).toBe(kui(b));
  });

  it('trace records the variant rule id', () => {
    const c = calculate(XIN, { profile: 'school-ma-hu', trace: true });
    expect(c.trace!.entries.some(e => e.ruleId === 'ZW.CALC.STAR.YEARSTEM_AUX.V001')).toBe(true);
  });
});

describe('variant registry consistency', () => {
  it('every variant rule declares variantOf pointing to a canonical rule', () => {
    const byId = new Map(listRules().map(r => [r.ruleId, r]));
    for (const r of listRules({ status: 'variant' })) {
      expect(r.variantOf, r.ruleId).toBeTruthy();
      const base = byId.get(r.variantOf!);
      expect(base, `${r.ruleId} variantOf ${r.variantOf}`).toBeTruthy();
      expect(base!.status).toBe('canonical');
    }
  });
});
