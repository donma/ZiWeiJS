import { describe, it, expect } from 'vitest';
import { calculate, listProfiles, getProfile } from '../../src/index.js';
import { resolveYearGanzhi } from '../../src/calendar/calendar-engine.js';
import { Solar } from 'lunar-typescript';

/**
 * spec 3rd §P0-2：年柱分界契約
 *
 * canonical：農曆正月初一換年（lunar-new-year）
 * variant  ：二十四節氣立春換年（lichun）
 *
 * 必加案例（春節 2024-02-10、立春 2024-02-04 16:27）：
 *   2024-02-03（立春前，春節前）→ 兩者皆癸卯
 *   2024-02-04（立春日）        → 立春時刻前後分歧
 *   2024-02-09（立春後，除夕）  → canonical 癸卯 / lichun 甲辰
 *   2024-02-10（春節）          → 兩者皆甲辰
 */

const birthInput = (y: number, m: number, d: number, hour = 20) => ({
  calendarType: 'solar' as const,
  date: { year: y, month: m, day: d },
  time: { hour },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male' as const
});

describe('P0-2 yearBoundaryPolicy 註冊與契約', () => {
  it('profile lichun 已註冊且 policy = lichun', () => {
    const ids = listProfiles().map(p => p.profileId);
    expect(ids).toContain('lichun');
    expect(getProfile('lichun').yearBoundaryPolicy).toBe('lichun');
  });

  it('canonical profile policy = lunar-new-year', () => {
    expect(getProfile('canonical').yearBoundaryPolicy).toBe('lunar-new-year');
  });

  it('所有 profiles 皆有合法 yearBoundaryPolicy', () => {
    for (const p of listProfiles()) {
      expect(['lunar-new-year', 'lichun']).toContain(p.yearBoundaryPolicy);
    }
  });
});

describe('P0-2 resolveYearGanzhi 純函式', () => {
  it('lunar-new-year 與 lichun 在立春後、春節前分歧', () => {
    const lunar = Solar.fromYmd(2024, 2, 9).getLunar();
    expect(resolveYearGanzhi(lunar, 'lunar-new-year')).toEqual({ stem: 'gui', branch: 'mao' });
    expect(resolveYearGanzhi(lunar, 'lichun')).toEqual({ stem: 'jia', branch: 'chen' });
  });

  it('立春精確時刻：2024-02-04 16:00 前仍屬前一年', () => {
    const before = Solar.fromYmdHms(2024, 2, 4, 10, 0, 0).getLunar();
    const after = Solar.fromYmdHms(2024, 2, 4, 20, 0, 0).getLunar();
    // 立春 2024-02-04 16:27，10:00 未過立春
    expect(resolveYearGanzhi(before, 'lichun')).toEqual({ stem: 'gui', branch: 'mao' });
    expect(resolveYearGanzhi(after, 'lichun')).toEqual({ stem: 'jia', branch: 'chen' });
  });
});

describe('P0-2 兩 Profile 產生預期差異（natal）', () => {
  const cases: Array<[number, number, number, string]> = [
    [2024, 2, 3, 'gui-mao'],
    [2024, 2, 9, 'gui-mao'],
    [2024, 2, 10, 'jia-chen']
  ];

  for (const [y, m, d, expectedCanonical] of cases) {
    it(`${y}-${m}-${d} canonical = ${expectedCanonical}`, () => {
      const c = calculate(birthInput(y, m, d), { profile: 'canonical' });
      expect(`${c.calendar.ganzhi.year.stem}-${c.calendar.ganzhi.year.branch}`).toBe(expectedCanonical);
    });
  }

  it('2024-02-09（立春後、除夕）lichun = jia-chen，canonical = gui-mao', () => {
    const canon = calculate(birthInput(2024, 2, 9), { profile: 'canonical' });
    const lichun = calculate(birthInput(2024, 2, 9), { profile: 'lichun' });
    expect(`${canon.calendar.ganzhi.year.stem}-${canon.calendar.ganzhi.year.branch}`).toBe('gui-mao');
    expect(`${lichun.calendar.ganzhi.year.stem}-${lichun.calendar.ganzhi.year.branch}`).toBe('jia-chen');
  });

  it('2024-02-10（春節）兩者一致 = jia-chen', () => {
    const canon = calculate(birthInput(2024, 2, 10), { profile: 'canonical' });
    const lichun = calculate(birthInput(2024, 2, 10), { profile: 'lichun' });
    expect(`${canon.calendar.ganzhi.year.stem}-${canon.calendar.ganzhi.year.branch}`).toBe('jia-chen');
    expect(`${lichun.calendar.ganzhi.year.stem}-${lichun.calendar.ganzhi.year.branch}`).toBe('jia-chen');
  });

  it('2024-02-03（立春前、春節前）兩者一致 = gui-mao', () => {
    const canon = calculate(birthInput(2024, 2, 3), { profile: 'canonical' });
    const lichun = calculate(birthInput(2024, 2, 3), { profile: 'lichun' });
    expect(`${canon.calendar.ganzhi.year.stem}-${canon.calendar.ganzhi.year.branch}`).toBe('gui-mao');
    expect(`${lichun.calendar.ganzhi.year.stem}-${lichun.calendar.ganzhi.year.branch}`).toBe('gui-mao');
  });
});

describe('P0-2 年界亦影響限運流年（P1-3 共用）', () => {
  const target = { year: 2024, month: 2, day: 9 };

  it('canonical 採正月初一：2024-02-09 流年為癸卯', () => {
    const c = calculate(birthInput(1990, 5, 15), { targetDate: target, profile: 'canonical' });
    expect(`${c.periods.year?.ganzhi?.stem}-${c.periods.year?.ganzhi?.branch}`).toBe('gui-mao');
  });

  it('lichun 採立春：2024-02-09 流年為甲辰', () => {
    const c = calculate(birthInput(1990, 5, 15), { targetDate: target, profile: 'lichun' });
    expect(`${c.periods.year?.ganzhi?.stem}-${c.periods.year?.ganzhi?.branch}`).toBe('jia-chen');
  });

  it('natal 與 period 使用同一 policy（不得各用一套）', () => {
    const lichunNatal = calculate(birthInput(2024, 2, 9), { profile: 'lichun' });
    const lichunPeriod = calculate(birthInput(1990, 5, 15), { targetDate: target, profile: 'lichun' });
    expect(lichunNatal.calendar.ganzhi.year).toEqual(lichunPeriod.periods.year?.ganzhi);
  });
});
