import { describe, it, expect } from 'vitest';
import { calculate, getProfile } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * 流月月界 Variant（spec 0.6 §25 / §49 Milestone E）。
 *
 * canonical：農曆月界（流月天干五虎遁；流月宮位自斗君起農曆正月順數）。
 * school-jieqi-month：節氣月界（立春起寅月；流月天干取節氣月柱），
 * 且流月宮位與流月天干共用同一 month 序。
 */
const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('流月月界 variant：節氣月（spec 0.6 §25）', () => {
  // 2026-02-05：立春後（節氣寅月）但仍在農曆臘月（春節 2026-02-17）
  const TARGET = { year: 2026, month: 2, day: 5 };

  it('profile 宣告 monthBoundaryPolicy=solar-term', () => {
    expect(getProfile('school-jieqi-month').monthBoundaryPolicy).toBe('solar-term');
  });

  it('canonical 採農曆月；節氣月 profile 採節氣月（同月宮位與天干同 policy）', () => {
    const canon = calculate(INPUT, { targetDate: TARGET });
    const jieqi = calculate(INPUT, { targetDate: TARGET, profile: 'school-jieqi-month' });

    const canonMonth = canon.periods.month!;
    const jieqiMonth = jieqi.periods.month!;

    // 農曆版本：2026-02-05 為農曆 2025 年 12 月
    expect(canonMonth.ganzhi!.branch).toBe('chou');
    // 節氣版本：立春後為寅月
    expect(jieqiMonth.ganzhi!.branch).toBe('yin');
    // 兩者 month 序不同 → 流月宮位（斗君順數）不同（除巧合外）
    expect(jieqiMonth.ganzhi).not.toEqual(canonMonth.ganzhi);
  });

  it('兩 profile 的流月宮位與流月天干皆存在（同 policy 一致）', () => {
    for (const profile of ['canonical', 'school-jieqi-month'] as const) {
      const chart = calculate(INPUT, { targetDate: TARGET, profile });
      const m = chart.periods.month!;
      expect(m.branch, profile).toBeTruthy();
      expect(m.ganzhi, profile).toBeDefined();
      expect(m.stem, profile).toBe(m.ganzhi!.stem);
    }
  });
});
