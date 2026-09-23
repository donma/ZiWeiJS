import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe, analyzeUnknownTime, ZiWei } from '../../src/index.js';
import { ganzhiAt } from '../../src/period-engine/period-engine.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const BASE: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('P0-2 未知時辰不得預設', () => {
  it('calculate 缺 time → UNKNOWN_BIRTH_TIME', () => {
    const { time, ...noTime } = BASE;
    void time;
    const r = calculateSafe(noTime);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN_BIRTH_TIME');
  });

  it('calculate 丟出 ZiWeiError（非靜默 12:00）', () => {
    expect(() => calculate({ ...BASE, time: {} })).toThrow(/UNKNOWN_BIRTH_TIME|required/);
  });

  it('analyzeUnknownTime 仍可產生 12 個候選', () => {
    const { time, ...noTime } = BASE;
    void time;
    const r = analyzeUnknownTime(noTime);
    expect(r.candidates.length).toBe(12);
    expect(r.candidates.every(c => c.chart !== undefined)).toBe(true);
  });
});

describe('P0-3E 不得隱含現在時間', () => {
  it('無 targetDate → 不產出 any 限運', () => {
    const c = calculate(BASE);
    expect(c.periods.year).toBeUndefined();
    expect(c.periods.month).toBeUndefined();
    expect(c.periods.day).toBeUndefined();
    expect(c.periods.hour).toBeUndefined();
    expect(c.periods.active).toBeUndefined();
    expect(c.certainty.periods).toBe('unavailable');
  });

  it('無 targetDate → 兩次執行 JSON 完全相同（不需 strip）', () => {
    const strip = (c: ReturnType<typeof calculate>) => {
      const { trace, ...rest } = c;
      void trace;
      return JSON.stringify(rest);
    };
    expect(strip(calculate(BASE))).toBe(strip(calculate(BASE)));
  });

  it('本命盤本身在同一天不同時間執行仍相同', async () => {
    const a = JSON.stringify(calculate(BASE));
    await new Promise(r => setTimeout(r, 20));
    expect(JSON.stringify(calculate(BASE))).toBe(a);
  });
});

describe('P0-3D targetDate 契約', () => {
  it('day 有值但 month 沒值 → INVALID_TARGET_DATE', () => {
    const r = calculateSafe(BASE, { targetDate: { year: 2020, day: 5 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_TARGET_DATE');
  });

  it('hour 有值但 day 沒值 → INVALID_TARGET_DATE', () => {
    const r = calculateSafe(BASE, { targetDate: { year: 2020, month: 3, hour: 5 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_TARGET_DATE');
  });

  it('year 缺值 → INVALID_TARGET_DATE', () => {
    const r = calculateSafe(BASE, { targetDate: { month: 3 } as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_TARGET_DATE');
  });

  it('月超範圍 → INVALID_TARGET_DATE', () => {
    const r = calculateSafe(BASE, { targetDate: { year: 2020, month: 13 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_TARGET_DATE');
  });

  it('只給 year → 僅流年，無流月/流日/流時', () => {
    const c = calculate(BASE, { targetDate: { year: 2020 } });
    expect(c.periods.year).toBeDefined();
    expect(c.periods.month).toBeUndefined();
    expect(c.periods.day).toBeUndefined();
    expect(c.periods.hour).toBeUndefined();
  });

  it('year+month → 流年 + 流月，無流日/流時', () => {
    const c = calculate(BASE, { targetDate: { year: 2020, month: 6 } });
    expect(c.periods.year).toBeDefined();
    expect(c.periods.month).toBeDefined();
    expect(c.periods.day).toBeUndefined();
    expect(c.periods.hour).toBeUndefined();
  });

  it('year+month+day → 到流日為止', () => {
    const c = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10 } });
    expect(c.periods.day).toBeDefined();
    expect(c.periods.hour).toBeUndefined();
  });

  it('完整 targetDate → 四層限運齊備', () => {
    const c = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10, hour: 14 } });
    expect(c.periods.year).toBeDefined();
    expect(c.periods.month).toBeDefined();
    expect(c.periods.day).toBeDefined();
    expect(c.periods.hour).toBeDefined();
    expect(c.certainty.periods).toBe('high');
  });
});

describe('P0-3B/C 流日與流時干支由真實目標日期推算', () => {
  it('不同日 → 流日干支改變', () => {
    const a = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10 } });
    const b = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 11 } });
    expect(`${a.periods.day!.ganzhi!.stem}-${a.periods.day!.ganzhi!.branch}`)
      .not.toBe(`${b.periods.day!.ganzhi!.stem}-${b.periods.day!.ganzhi!.branch}`);
  });

  it('不同時辰 → 流時干支改變', () => {
    const a = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10, hour: 2 } });
    const b = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10, hour: 14 } });
    expect(`${a.periods.hour!.ganzhi!.stem}-${a.periods.hour!.ganzhi!.branch}`)
      .not.toBe(`${b.periods.hour!.ganzhi!.stem}-${b.periods.hour!.ganzhi!.branch}`);
  });

  it('流日天干 ≠ 流月天干（不得沿用）', () => {
    const c = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10 } });
    expect(c.periods.day!.stem).not.toBe(c.periods.month!.stem);
  });

  it('流日干支與該日期之真實日柱一致', () => {
    const c = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10 } });
    const gz = ganzhiAt(2020, 6, 10, 12);
    expect(c.periods.day!.ganzhi!.stem).toBe(gz.day.stem);
    expect(c.periods.day!.ganzhi!.branch).toBe(gz.day.branch);
  });

  it('限運命宮位置與限運干支地支為不同概念', () => {
    const c = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10 } });
    // branch = 流日命宮疊盤位置；ganzhi.branch = 該日真實日支
    expect(c.periods.day!.branch).toBeDefined();
    expect(c.periods.day!.ganzhi!.branch).toBeDefined();
    // 疊盤以流月命宮起子時/初一日，因此兩者通常不同
    expect(c.periods.day!.branch).not.toBe(c.periods.day!.ganzhi!.branch);
  });

  it('流時干支由日干 + 時支推算', () => {
    const c = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10, hour: 2 } });
    const gz = ganzhiAt(2020, 6, 10, 2);
    expect(c.periods.hour!.ganzhi!.stem).toBe(gz.hour.stem);
    expect(c.periods.hour!.ganzhi!.branch).toBe(gz.hour.branch);
  });

  it('流月干支與該年該月之真實月柱一致', () => {
    const c = calculate(BASE, { targetDate: { year: 2020, month: 6, day: 10 } });
    const gz = ganzhiAt(2020, 6, 10, 12);
    expect(c.periods.month!.ganzhi!.stem).toBe(gz.month.stem);
    expect(c.periods.month!.ganzhi!.branch).toBe(gz.month.branch);
  });
});

describe('P0-3A active major period', () => {
  it('2020 年（虛歲 31）落於第三大限', () => {
    const c = calculate(BASE, { targetDate: { year: 2020 } });
    expect(c.periods.active).toBeDefined();
    expect(c.periods.active!.age).toBe(31);
    expect(c.periods.active!.major!.fromAge).toBe(26);
    expect(c.periods.active!.major!.toAge).toBe(35);
  });

  it('不同年份 → active major 改變', () => {
    const a = calculate(BASE, { targetDate: { year: 2000 } });
    const b = calculate(BASE, { targetDate: { year: 2020 } });
    expect(a.periods.active!.major!.fromAge).toBe(6);
    expect(b.periods.active!.major!.fromAge).toBe(26);
  });

  it('未上運（虛歲低於起運）→ 無 active major 並附原因', () => {
    const c = calculate(BASE, { targetDate: { year: 1992 } });
    expect(c.periods.active!.age).toBe(3);
    expect(c.periods.active!.major).toBeUndefined();
    expect(c.periods.active!.majorSkippedReason).toBe('BELOW_FIRST_MAJOR_PERIOD');
  });

  it('性別未知 → active major unavailable（不猜）', () => {
    const c = calculateSafe(
      { ...BASE, sexForCalculation: 'unknown' },
      { targetDate: { year: 2020 } }
    );
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.chart.periods.active!.major).toBeUndefined();
    expect(c.chart.periods.active!.majorSkippedReason).toBe('UNKNOWN_SEX_FOR_CALCULATION');
  });
});

describe('P0-3A/C period 四化跟隨 active major period', () => {
  it('大限四化使用目標年齡所在之大限，而非 majorPeriods[0]', () => {
    const early = calculate(BASE, { targetDate: { year: 2000 } });   // 虛歲 11 → 大限 6-15（子，戊）
    const mid = calculate(BASE, { targetDate: { year: 2010 } });     // 虛歲 21 → 大限 16-25（丑，己）
    const majorStem = (c: ReturnType<typeof calculate>) =>
      c.chart.transformations.find(t => t.sourceScope === 'major-period')?.sourceStem;

    expect(early.periods.active!.major!.fromAge).toBe(6);
    expect(mid.periods.active!.major!.fromAge).toBe(16);
    expect(majorStem(early)).toBe(early.periods.active!.major!.stem);
    expect(majorStem(mid)).toBe(mid.periods.active!.major!.stem);
    // 若仍固定取 majorPeriods[0]，mid 的來源天干會與 early 相同
    expect(majorStem(mid)).not.toBe(majorStem(early));
  });

  it('同一大限內不同年份 → 大限四化不變', () => {
    const a = calculate(BASE, { targetDate: { year: 2016 } });
    const b = calculate(BASE, { targetDate: { year: 2024 } });
    expect(a.periods.active!.major!.fromAge).toBe(26);
    expect(b.periods.active!.major!.fromAge).toBe(26);
    expect(a.chart.transformations.find(t => t.sourceScope === 'major-period')!.sourceStem)
      .toBe(b.chart.transformations.find(t => t.sourceScope === 'major-period')!.sourceStem);
  });

  it('無 targetDate → 不得產出任何限運四化', () => {
    const c = calculate(BASE);
    expect(c.chart.transformations.filter(t => t.sourceScope !== 'natal' && t.sourceScope !== 'palace')).toEqual([]);
  });
});

describe('ZiWei.Periods.at', () => {
  it('在既有本命盤上疊加限運，且不改變本命盤', () => {
    const natal = calculate(BASE);
    const timed = ZiWei.Periods.at(natal, { year: 2020, month: 6, day: 10 });
    expect(timed.periods.year).toBeDefined();
    expect(natal.periods.year).toBeUndefined();
    expect(timed.chart.natal.lifePalaceBranch).toBe(natal.chart.natal.lifePalaceBranch);
  });
});
