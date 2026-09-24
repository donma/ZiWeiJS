import { describe, it, expect } from 'vitest';
import { Solar } from 'lunar-typescript';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import { normalizePeriodTarget, dayLifeBranch } from '../../src/period-engine/period-target.js';
import { getProfile } from '../../src/rule-engine/registry.js';

/**
 * spec 2nd §P0-1 / §P0-2：流月 / 流日必須以「農曆」語意定位，
 * 不得把 Gregorian month / day 當作農曆序。
 *
 * 驗收標準：同一農曆月份內，不得單純因 Gregorian month 不同而判為不同流月；
 *           流日 branch 必須依 lunar day 推算。
 *
 * 註：chart.calendar.lunar 為「本命農曆」（出生），
 *     目標日期的農曆由 Solar 獨立換算作為 oracle。
 */

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

const canonical = getProfile('canonical');

function targetLunar(y: number, m: number, d: number) {
  const l = Solar.fromYmd(y, m, d).getLunar();
  return { year: l.getYear(), month: Math.abs(l.getMonth()), day: l.getDay(), isLeap: l.getMonth() < 0 };
}

describe('P0-1 流月：以農曆月定位（非 Gregorian）', () => {
  it('國曆 2 月仍為農曆正月時，流月命宮 = 斗君（正月命宮）', () => {
    // 2026-02-20 → 農曆 2026-1-4（正月）
    expect(targetLunar(2026, 2, 20).month).toBe(1);
    const c = calculate(base, { targetDate: { year: 2026, month: 2, day: 20 } });
    // spec 3rd §P0-4：正月流月命宮即斗君。
    // base 盤：生月四月、生時巳時；2026 丙午年（歲建午）→ 歲建起正月逆數生月、順數生時 = 申。
    // 因屬農曆正月，流月命宮 = 斗君 = 申（與舊「流年命宮起正月順數」的午不同）。
    expect(c.periods.year!.branch).toBe('wu');
    expect(c.periods.month!.branch).toBe('shen');
  });

  it('同一農曆月內不因 Gregorian 日期不同而換月', () => {
    // 2026-02-17(正月初一) 與 2026-02-28(正月十二) 同屬農曆正月
    const a = calculate(base, { targetDate: { year: 2026, month: 2, day: 17 } });
    const b = calculate(base, { targetDate: { year: 2026, month: 2, day: 28 } });
    expect(targetLunar(2026, 2, 17).month).toBe(1);
    expect(targetLunar(2026, 2, 28).month).toBe(1);
    expect(a.periods.month!.branch).toBe(b.periods.month!.branch);
  });

  it('Gregorian 2 月 vs 3 月：農曆月不同 → 流月不同', () => {
    const feb = calculate(base, { targetDate: { year: 2026, month: 2, day: 20 } }); // 正月
    const mar = calculate(base, { targetDate: { year: 2026, month: 3, day: 19 } }); // 二月
    expect(targetLunar(2026, 2, 20).month).toBe(1);
    expect(targetLunar(2026, 3, 19).month).toBe(2);
    expect(feb.periods.month!.branch).not.toBe(mar.periods.month!.branch);
  });

  it('normalizePeriodTarget 產出 effectiveLunarMonth', () => {
    const pt = normalizePeriodTarget({ year: 2026, month: 2, day: 20 }, canonical);
    expect(pt.lunar.month).toBe(1);
    expect(pt.effectiveLunarMonth).toBe(1);
    expect(pt.isRepresentativeDate).toBe(false);
  });

  it('無 day 時以 15 日為代表日並標記 isRepresentativeDate', () => {
    const pt = normalizePeriodTarget({ year: 2026, month: 2 }, canonical);
    expect(pt.isRepresentativeDate).toBe(true);
    expect(pt.granularity).toBe('month');
    // spec 3rd §P0-3：不得謊稱使用者指定了某日 —— solar.day / lunar.day 均留空，
    // 僅以 isRepresentativeDate 標示，代表日 15 只用於內部推算有效農曆月序。
    expect(pt.solar.day).toBeUndefined();
    expect(pt.lunar.day).toBeUndefined();
    const repr = Solar.fromYmd(2026, 2, 15).getLunar();
    expect(pt.effectiveLunarMonth).toBe(Math.abs(repr.getMonth()));
  });
});

describe('P0-2 流日：以農曆日定位（非 Gregorian）', () => {
  it('流日命宮 = 流月命宮起初一順數至農曆當日', () => {
    // 2026-03-19 → 農曆 2026-2-1（初一）
    const lunar = targetLunar(2026, 3, 19);
    expect(lunar.day).toBe(1);
    const c = calculate(base, { targetDate: { year: 2026, month: 3, day: 19 } });
    expect(c.periods.day!.branch).toBe(dayLifeBranch(c.periods.month!.branch, 1));
  });

  it('Gregorian day 與 lunar day 不同時，依 lunar day 推算', () => {
    // 2026-03-25 → 農曆 2026-2-7（Gregorian day=25，lunar day=7，明顯不同）
    const lunar = targetLunar(2026, 3, 25);
    expect(lunar.day).not.toBe(25);
    const c = calculate(base, { targetDate: { year: 2026, month: 3, day: 25 } });
    expect(c.periods.day!.branch).toBe(dayLifeBranch(c.periods.month!.branch, lunar.day));
  });
});
