import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import { evalDsl } from '../../src/rule-engine/dsl.js';
import { buildTestContext } from '../helpers/context.js';

/**
 * spec §37 必做 Regression Cases
 *
 * 逐條對應規格清單，作為 hardening 的驗收清單：
 *   無時辰 → error
 *   未知性別 → 不得偷偷 forward
 *   無 targetDate → 不產流年
 *   targetDate 改變 → active period 改變
 *   真太陽時：00:10 → 前日 / 23:55 → 次日
 *   23:00：midnight 與 zi-hour 可得不同結果
 *   DSL typo → error
 *   profile override 真的影響 output
 *   Trace 自動帶 source / evidence / version
 */

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('§37 無時辰 → error', () => {
  it('缺 time.hour → UNKNOWN_BIRTH_TIME', () => {
    const input = { ...base, time: undefined } as ZiWeiBirthInput;
    const res = calculateSafe(input);
    expect(res.ok).toBe(false);
    expect(res.ok ? '' : res.error.code).toBe('UNKNOWN_BIRTH_TIME');
  });

  it('timezone 不合法 → INVALID_TIMEZONE', () => {
    const res = calculateSafe({ ...base, timezone: 'Not/AZone' });
    expect(res.ok).toBe(false);
    expect(res.ok ? '' : res.error.code).toBe('INVALID_TIMEZONE');
  });
});

describe('§37 未知性別 → 不得偷偷 forward', () => {
  const chart = calculate({ ...base, sexForCalculation: 'unknown' });

  it('direction 為 undetermined，不預設 forward', () => {
    expect(chart.birthContext.direction).toBe('undetermined');
    expect(JSON.stringify(chart)).not.toContain('"direction":"forward"');
  });

  it('依賴性別的結果標為 unknown / unavailable', () => {
    expect(chart.certainty.direction).toBe('unknown');
    expect(chart.certainty.changsheng).toBe('unknown');
    expect(chart.certainty.majorPeriods).toBe('unknown');
    expect(chart.periods.major).toEqual([]);
  });

  it('不依賴性別的 natal 資料仍正常計算', () => {
    expect(chart.chart.natal.lifePalaceBranch).toBeTruthy();
    expect(chart.chart.palaces.length).toBe(12);
  });
});

describe('§37 無 targetDate → 不產流年', () => {
  const chart = calculate(base);

  it('大限靜態表仍在，但無 active', () => {
    expect(chart.periods.major.length).toBe(12);
    expect(chart.periods.active).toBeUndefined();
  });

  it('流年 / 流月 / 流日 / 流時 皆不產生', () => {
    expect(chart.periods.year).toBeUndefined();
    expect(chart.periods.month).toBeUndefined();
    expect(chart.periods.day).toBeUndefined();
    expect(chart.periods.hour).toBeUndefined();
  });

  it('certainty.periods = unavailable', () => {
    expect(chart.certainty.periods).toBe('unavailable');
  });

  it('不因執行時間而改變（無隱含 new Date）', () => {
    expect(JSON.stringify(calculate(base))).toBe(JSON.stringify(chart));
  });
});

describe('§37 targetDate 改變 → active period 改變', () => {
  it('不同 targetDate 落在不同大限', () => {
    const young = calculate(base, { targetDate: { year: 1995, month: 6, day: 1 } });
    const old = calculate(base, { targetDate: { year: 2035, month: 6, day: 1 } });

    expect(young.periods.active?.major?.fromAge).toBe(6);
    expect(old.periods.active?.major?.fromAge).toBe(46);
    expect(young.periods.active?.major?.ganzhi).not.toEqual(old.periods.active?.major?.ganzhi);
    expect(young.periods.active?.major?.palaceId).not.toBe(old.periods.active?.major?.palaceId);
  });

  it('流年干支隨 targetDate 改變', () => {
    const a = calculate(base, { targetDate: { year: 2026, month: 9, day: 23 } });
    const b = calculate(base, { targetDate: { year: 2027, month: 9, day: 23 } });
    expect(a.periods.year).not.toBeUndefined();
    expect(JSON.stringify(a.periods.year)).not.toBe(JSON.stringify(b.periods.year));
  });
});

describe('§37 真太陽時跨日', () => {
  it('00:10 → 前一日', () => {
    const c = calculate({
      calendarType: 'solar',
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 0, minute: 10 },
      timezone: 'Asia/Taipei',
      location: { longitude: 0 },
      timeConvention: 'local-mean-solar',
      sexForCalculation: 'male'
    });
    expect(c.calendar.solar).toEqual({ year: 1999, month: 12, day: 31 });
  });

  it('23:55 → 次一日', () => {
    const c = calculate({
      calendarType: 'solar',
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 23, minute: 50 },
      timezone: 'Asia/Taipei',
      location: { longitude: 180 },
      timeConvention: 'local-mean-solar',
      sexForCalculation: 'male'
    });
    expect(c.calendar.solar).toEqual({ year: 2000, month: 1, day: 2 });
  });
});

describe('§37 23:00 換日慣例可得不同結果', () => {
  const at23 = { ...base, time: { hour: 23, minute: 0 } };

  it('midnight 與 zi-hour（traditional-zi）日柱不同', () => {
    const midnight = calculate({ ...at23, dayBoundary: 'midnight' });
    const ziHour = calculate(at23, { profile: 'traditional-zi' });

    expect(midnight.calendar.solar).toEqual({ year: 1990, month: 5, day: 15 });
    expect(ziHour.calendar.solar).toEqual({ year: 1990, month: 5, day: 16 });
    expect(midnight.calendar.ganzhi.day).not.toEqual(ziHour.calendar.ganzhi.day);
    // 命宮由生月 + 生時決定（不依賴日），故兩者相同；差異表現在日柱與農曆日
    expect(midnight.chart.natal.lifePalaceBranch).toBe(ziHour.chart.natal.lifePalaceBranch);
    expect(midnight.calendar.lunar.day).not.toBe(ziHour.calendar.lunar.day);
  });
});

describe('§37 DSL typo → error', () => {
  const ctx = buildTestContext();

  it('star-in-palce → UNKNOWN_DSL_OPERATOR（不得 fail-open 回 true）', () => {
    expect(() => evalDsl({ type: 'star-in-palce', star: 'ZW.STAR.MAJOR.ZIWEI', palace: 'life' }, ctx))
      .toThrowError(/UNKNOWN_DSL_OPERATOR|Unknown DSL operator/);
  });
});

describe('§37 profile override 真的影響 output', () => {
  it('school-zhongzhou 觸發 variant 執行（trace status=variant）', () => {
    const canonical = calculate(base, { trace: true });
    const school = calculate(base, { profile: 'school-zhongzhou', trace: true });

    const canonicalVariants = canonical.trace!.entries.filter(e => e.status === 'variant');
    expect(canonicalVariants).toEqual([]);

    const variant = school.trace!.entries.filter(e => e.status === 'variant');
    expect(variant.length).toBeGreaterThan(0);
    expect(variant.some(e => e.ruleId.includes('ZW.CALC.SIHUA.NATAL.V001'))).toBe(true);
  });

  it('school-ma-hu 的年干輔星 override 亦生效', () => {
    const school = calculate(base, { profile: 'school-ma-hu', trace: true });
    const variant = school.trace!.entries.filter(e => e.status === 'variant');
    expect(variant.some(e => e.ruleId.includes('YEARSTEM_AUX.V001'))).toBe(true);
  });
});

describe('§37 Trace 自動帶 source / evidence / version', () => {
  const chart = calculate(base, { trace: true });
  const entries = chart.trace!.entries;

  it('每筆 trace 都有 ruleId / ruleVersion / profile / sourceRefs / evidenceRefs', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.ruleId, JSON.stringify(e)).toBeTruthy();
      expect(e.ruleVersion, e.ruleId).toBeTruthy();
      expect(e.profile, e.ruleId).toBe('canonical');
      expect(Array.isArray(e.sourceRefs), e.ruleId).toBe(true);
      expect(Array.isArray(e.evidenceRefs), e.ruleId).toBe(true);
    }
  });

  it('trace 狀態僅為已定義列舉', () => {
    const allowed = ['executed', 'skipped', 'unavailable', 'variant', 'error'];
    for (const e of entries) expect(allowed, e.ruleId).toContain(e.status);
  });

  it('來源與證據由 registry 注入，非 executor 自填', () => {
    const withSource = entries.filter(e => (e.sourceRefs ?? []).length > 0);
    expect(withSource.length).toBe(entries.length);
  });
});
