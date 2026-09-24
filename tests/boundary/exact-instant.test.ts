import { describe, it, expect } from 'vitest';
import { Solar } from 'lunar-typescript';
import { resolveYearGanzhi } from '../../src/calendar/calendar-engine.js';
import { calculate, calculateSafe } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * Exact-instant boundary method（spec Post-Stability §30）
 *
 * 立春 / 農曆新年 不只測「前一天 / 後一天」，而是測**當天具體時刻**的
 * before / boundary / after，確認年柱在正確的瞬間切換。
 */

const WINDOW_MINUTES = 3 * 24 * 60;

/** 以線性分鐘建構該時刻之農曆（可跨日） */
function lunarAtMinutes(baseY: number, baseM: number, baseD: number, minutes: number) {
  const d = new Date(Date.UTC(baseY, baseM - 1, baseD, 0, 0, 0));
  d.setUTCMinutes(minutes);
  return Solar.fromYmdHms(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), 0
  ).getLunar();
}

/** 回傳視窗內年柱（依 policy）首次變化的分鐘數；找不到回傳 -1 */
function findFlip(baseY: number, baseM: number, baseD: number, policy: 'lunar-new-year' | 'lichun'): number {
  let prev = resolveYearGanzhi(lunarAtMinutes(baseY, baseM, baseD, 0), policy);
  for (let t = 1; t < WINDOW_MINUTES; t++) {
    const cur = resolveYearGanzhi(lunarAtMinutes(baseY, baseM, baseD, t), policy);
    if (cur.stem !== prev.stem || cur.branch !== prev.branch) return t;
    prev = cur;
  }
  return -1;
}

describe('§30 exact boundary: 立春（lichun）', () => {
  it('立春當日 year 柱於精確時刻切換（before != at == after）', () => {
    const flip = findFlip(2026, 2, 3, 'lichun');
    expect(flip).toBeGreaterThanOrEqual(0);

    const before = resolveYearGanzhi(lunarAtMinutes(2026, 2, 3, flip - 1), 'lichun');
    const at = resolveYearGanzhi(lunarAtMinutes(2026, 2, 3, flip), 'lichun');
    const after = resolveYearGanzhi(lunarAtMinutes(2026, 2, 3, flip + 1), 'lichun');

    expect(`${before.stem}${before.branch}`).not.toBe(`${at.stem}${at.branch}`);
    expect(`${after.stem}${after.branch}`).toBe(`${at.stem}${at.branch}`);
  });

  it('立春切換瞬間，lunar-new-year 政策不變', () => {
    const flip = findFlip(2026, 2, 3, 'lichun');
    expect(flip).toBeGreaterThanOrEqual(0);
    const a = resolveYearGanzhi(lunarAtMinutes(2026, 2, 3, flip - 1), 'lunar-new-year');
    const b = resolveYearGanzhi(lunarAtMinutes(2026, 2, 3, flip), 'lunar-new-year');
    expect(`${a.stem}${a.branch}`).toBe(`${b.stem}${b.branch}`);
  });
});

describe('§30 exact boundary: 農曆新年（lunar-new-year）', () => {
  it('農曆正月初一 00:00 切換（before != at）', () => {
    const flip = findFlip(2026, 2, 16, 'lunar-new-year');
    expect(flip).toBeGreaterThanOrEqual(0);

    const before = resolveYearGanzhi(lunarAtMinutes(2026, 2, 16, flip - 1), 'lunar-new-year');
    const at = resolveYearGanzhi(lunarAtMinutes(2026, 2, 16, flip), 'lunar-new-year');
    expect(`${before.stem}${before.branch}`).not.toBe(`${at.stem}${at.branch}`);
  });
});

describe('§30 profile 端到端：lichun vs lunar-new-year', () => {
  const input: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 1990, month: 5, day: 15 },
    time: { hour: 10 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  };

  it('立春後、農曆新年前之日：lichun 屬新年、lunar-new-year 屬前一年', () => {
    const lichun = calculate(input, { profile: 'lichun', targetDate: { year: 2026, month: 2, day: 15 } });
    const lunar = calculate(input, { profile: 'canonical', targetDate: { year: 2026, month: 2, day: 15 } });
    expect(lichun.periods.year?.yearBoundaryPolicy).toBe('lichun');
    expect(lunar.periods.year?.yearBoundaryPolicy).toBe('lunar-new-year');
    expect(lichun.periods.year?.resolvedYear).toBe(2026);
    expect(lunar.periods.year?.resolvedYear).toBe(2025);
  });
});

describe('§M8 fail-close：targetDate 早於出生', () => {
  const input: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 1990, month: 5, day: 15 },
    time: { hour: 10 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  };

  it('回傳具名錯誤碼 INVALID_TARGET_DATE（不產生負虛歲、不丟未包裝例外）', () => {
    const res = calculateSafe(input, { targetDate: { year: 1989, month: 5, day: 15 } });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_TARGET_DATE');
      expect(res.error.message).toContain('before the birth date');
    }
  });

  it('出生當日為合法目標（虛歲 1，小限不存在於虛歲 <1）', () => {
    const chart = calculate(input, { targetDate: { year: 1990, month: 5, day: 16 } });
    expect(chart.periods.xiaoxian?.age).toBe(1);
    expect(chart.certainty.xiaoxian).toBe('high');
  });

  it('目標早於出生但同農曆年（虛歲 1 之前）亦 fail-close', () => {
    const before = calculateSafe(input, { targetDate: { year: 1990, month: 1, day: 1 } });
    expect(before.ok).toBe(false);
  });
});
