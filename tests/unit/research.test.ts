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
