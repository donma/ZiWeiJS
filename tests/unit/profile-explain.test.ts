import { describe, it, expect } from 'vitest';
import { explainProfile, ZiWei, listProfiles, getRule } from '../../src/index.js';

/**
 * Profile Explain API（spec 0.6 §39）。
 */
describe('Profiles.explain（0.6 §39）', () => {
  it('canonical profile 無 ruleOverrides 差異', () => {
    const ex = explainProfile('canonical');
    expect(ex.diffs).toEqual([]);
    expect(ex.profileId).toBe('canonical');
  });

  it('school-zhongzhou 列出全部差異（sihua / masterStar / tianshiTianshang）', () => {
    const ex = explainProfile('school-zhongzhou');
    const dims = ex.diffs.map(d => d.dimension).sort();
    expect(dims).toContain('sihua');
    expect(dims).toContain('masterStar');
    expect(dims).toContain('tianshiTianshang');

    for (const d of ex.diffs) {
      expect(getRule(d.variantRule).status, d.variantRule).toBe('variant');
      expect(d.canonicalRule).toMatch(/^ZW\./);
    }
  });

  it('quanshu-classical 列出長生方向差異，且 policies 反映全 profile', () => {
    const ex = explainProfile('quanshu-classical');
    expect(ex.diffs.map(d => d.dimension)).toContain('changshengDirection');
  });

  it('school-jieqi-month policies.monthBoundaryPolicy = solar-term', () => {
    const ex = explainProfile('school-jieqi-month');
    expect(ex.policies.monthBoundaryPolicy).toBe('solar-term');
  });

  it('ZiWei.Profiles.explain 與 named export 一致，且 list/get 可用', () => {
    expect(ZiWei.Profiles.explain('school-zhongzhou')).toEqual(explainProfile('school-zhongzhou'));
    expect(listProfiles().some(p => p.profileId === 'quanshu-classical')).toBe(true);
  });
});
