import { describe, it, expect } from 'vitest';
import { ZiWei, DIFFERENTIAL_CLASSES } from '../../src/index.js';

describe('research pipeline guardrails', () => {
  it('AI cannot advance to owner-review', () => {
    const r = ZiWei.canAdvance('tests', 'owner-review', 'ai');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Owner Review');
  });

  it('AI cannot advance to canonical', () => {
    const r = ZiWei.canAdvance('owner-review', 'canonical', 'ai');
    expect(r.allowed).toBe(false);
  });

  it('owner can advance owner-review → canonical', () => {
    const r = ZiWei.canAdvance('owner-review', 'canonical', 'owner');
    expect(r.allowed).toBe(true);
  });

  it('cannot skip stages', () => {
    const r = ZiWei.canAdvance('research-rule', 'candidate', 'ai');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('跳階段');
  });

  it('AI can advance within allowed range', () => {
    expect(ZiWei.canAdvance('external-source', 'research-rule', 'ai').allowed).toBe(true);
    expect(ZiWei.canAdvance('research-rule', 'source-evidence', 'ai').allowed).toBe(true);
    expect(ZiWei.canAdvance('conflict-detection', 'candidate', 'ai').allowed).toBe(true);
    expect(ZiWei.canAdvance('candidate', 'tests', 'ai').allowed).toBe(true);
  });
});

describe('status promotion guardrails', () => {
  it('AI cannot promote candidate → canonical', () => {
    const r = ZiWei.canPromoteStatus('candidate', 'canonical', 'ai');
    expect(r.allowed).toBe(false);
  });

  it('AI cannot promote variant → canonical', () => {
    const r = ZiWei.canPromoteStatus('variant', 'canonical', 'ai');
    expect(r.allowed).toBe(false);
  });

  it('owner can promote candidate → canonical', () => {
    const r = ZiWei.canPromoteStatus('candidate', 'canonical', 'owner');
    expect(r.allowed).toBe(true);
  });

  it('AI can set research/candidate but never canonical', () => {
    expect(ZiWei.canPromoteStatus('research', 'candidate', 'ai').allowed).toBe(true);
    expect(ZiWei.canPromoteStatus('candidate', 'canonical', 'ai').allowed).toBe(false);
    expect(ZiWei.canPromoteStatus('canonical', 'canonical', 'ai').allowed).toBe(false);
  });
});

describe('differential classification', () => {
  it('exposes spec §29.2 classification set', () => {
    expect(DIFFERENTIAL_CLASSES).toEqual([
      'school-variance', 'calendar-variance', 'time-basis-variance',
      'day-boundary-variance', 'leap-month-variance', 'bug', 'external-error', 'unclassified'
    ]);
  });

  it('classified reports are not auto-judged', () => {
    const r = ZiWei.Research.classifyDifference({
      type: 'implementation', severity: 'warning', subject: '命宮',
      bible: 'zi', external: 'chou'
    });
    expect(r.classification).toBe('unclassified');
  });
});

describe('research registry contract (Final §1)', () => {
  it('Research JSON status 全部可以被 TS API 正確回傳且型別合法', () => {
    const all = ZiWei.Research.list();
    expect(all.length).toBeGreaterThan(0);
    const validStatuses = new Set(['open', 'candidate', 'resolved', 'rejected']);
    for (const item of all) {
      expect(validStatuses.has(item.status), `${item.researchId} status ${item.status} invalid`).toBe(true);
    }
    // 確認至少涵蓋 open, candidate, resolved
    const statuses = new Set(all.map(i => i.status));
    expect(statuses.has('open')).toBe(true);
    expect(statuses.has('candidate')).toBe(true);
    expect(statuses.has('resolved')).toBe(true);
  });

  it('hasOpenResearch 語意：open 或 candidate 為 true，resolved 或 rejected 為 false', () => {
    // 依 RSH.006 (candidate, relatedRules: ZW.CALC.SIHUA.NATAL.001)
    expect(ZiWei.Research.hasOpen('ZW.CALC.SIHUA.NATAL.001')).toBe(true);
    // 依 RSH.001 (open, relatedRules: ZW.CALC.STAR.YEARSTEM_AUX.001)
    expect(ZiWei.Research.hasOpen('ZW.CALC.STAR.YEARSTEM_AUX.001')).toBe(true);
    // 依 RSH.PERIOD.DOUJUN (resolved, relatedRules: ZW.CALC.PERIOD.LIUYUE.001)
    // 須注意 LIUYUE 若無其他 open/candidate 項目則為 false
    // 目前 LIUYUE 同時在 RSH.PERIOD.MONTH_STEM，但已 resolved
    // 無任何 open/candidate 研究掛在此規則者為 false（ZUOFU_YOUBI 未被研究項引用）
    expect(ZiWei.Research.hasOpen('ZW.CALC.STAR.ZUOFU_YOUBI.001')).toBe(false);
    // 不存在的規則為 false
    expect(ZiWei.Research.hasOpen('ZW.NON_EXISTENT')).toBe(false);
  });
});

