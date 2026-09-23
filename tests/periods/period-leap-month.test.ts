import { describe, it, expect } from 'vitest';
import { normalizePeriodTarget, resolveEffectiveLunarMonth } from '../../src/period-engine/period-target.js';
import { getProfile } from '../../src/rule-engine/registry.js';
import type { Profile } from '../../src/index.js';

/**
 * spec 2nd §P0-7：leapMonthPolicy 必須真正控制演算法，
 * 同一閏月 target 在不同 policy 下必須有可觀察輸出差異。
 *
 * 測資：2025-08-05 → 農曆 2025 閏六月十二
 */

const canonical = getProfile('canonical');
const baseProfile: Profile = { ...canonical, leapMonthPolicy: 'same-as-normal' };

function profileWith(policy: string): Profile {
  return { ...baseProfile, profileId: `test-${policy}`, leapMonthPolicy: policy };
}

describe('P0-7 resolveEffectiveLunarMonth', () => {
  const leapMonth = 6, leapDay = 12, isLeap = true;

  it('same-as-normal：閏六月 → 六月', () => {
    expect(resolveEffectiveLunarMonth(leapMonth, leapDay, isLeap, 'same-as-normal')).toBe(6);
  });

  it('next-month：閏六月 → 七月', () => {
    expect(resolveEffectiveLunarMonth(leapMonth, leapDay, isLeap, 'next-month')).toBe(7);
  });

  it('mid-month：閏月上半月 → 本月；下半月 → 次月', () => {
    expect(resolveEffectiveLunarMonth(6, 12, true, 'mid-month')).toBe(6);
    expect(resolveEffectiveLunarMonth(6, 16, true, 'mid-month')).toBe(7);
  });

  it('split：現行模型不支援 → UNSUPPORTED_PROFILE', () => {
    try {
      resolveEffectiveLunarMonth(6, 12, true, 'split');
      expect.fail('should throw');
    } catch (e: any) {
      expect(e.name).toBe('ZiWeiError');
      expect(e.code).toBe('UNSUPPORTED_PROFILE');
    }
  });

  it('非閏月不受 policy 影響', () => {
    for (const p of ['same-as-normal', 'next-month', 'mid-month', 'split']) {
      expect(resolveEffectiveLunarMonth(6, 12, false, p)).toBe(6);
    }
  });
});

describe('P0-7 同一閏月 target 在不同 policy 之可觀察差異', () => {
  const leapTarget = { year: 2025, month: 8, day: 5 }; // 農曆 2025 閏六月十二

  it('same-as-normal 與 next-month 產出不同 effectiveLunarMonth', () => {
    const a = normalizePeriodTarget(leapTarget, profileWith('same-as-normal'));
    const b = normalizePeriodTarget(leapTarget, profileWith('next-month'));
    expect(a.lunar.isLeapMonth).toBe(true);
    expect(a.effectiveLunarMonth).toBe(6);
    expect(b.effectiveLunarMonth).toBe(7);
    expect(a.effectiveLunarMonth).not.toBe(b.effectiveLunarMonth);
  });

  it('mid-month 閏月下半月 → 次月', () => {
    const upper = normalizePeriodTarget({ year: 2025, month: 8, day: 5 }, profileWith('mid-month')); // 閏六月初十二
    const lower = normalizePeriodTarget({ year: 2025, month: 8, day: 20 }, profileWith('mid-month')); // 閏六月二十七
    expect(upper.effectiveLunarMonth).toBe(6);
    expect(lower.effectiveLunarMonth).toBe(7);
  });
});
