import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Solar, LunarYear } from 'lunar-typescript';
import * as lunarLite from 'lunar-lite';
import { calculate, utcOffsetMinutes } from '../../src/index.js';

/**
 * P2-6 曆法層差分測試（spec §P2-6）
 *
 * 以兩套彼此獨立的曆法實作互相驗證：
 *   A = lunar-typescript（本引擎 runtime 依賴）
 *   B = lunar-lite（iztro 依賴，獨立移植版本）
 *
 * 完整逐日差分（1900-01-31 ~ 2100-12-31，73,384 日）由
 * tools/calendar-differential/run.ts 產生 fixtures/calendar/calendar-differential.json；
 * 本測試檔另外做即時抽樣重驗，確保 fixture 未與實作脫節。
 *
 * 已知且已驗證的慣例差異（非 bug）：
 *   - 年柱換年：本引擎採「農曆正月初一」（lunar-typescript 預設），
 *     lunar-lite 預設採「立春」。兩者差異已以 lunar-typescript 的立春版逐筆驗證。
 *   - 23:00 起子時之日歸屬。
 */

type Fixture = {
  counts: Record<string, number>;
  totals: { mismatches: number; unexplained: number; classified: number };
  classifications: Record<string, number>;
  leapMonths: { year: number; lunarTypescript: number; lunarLite: number }[];
  unexplainedSamples: unknown[];
};

const fixture: Fixture = JSON.parse(
  readFileSync(new URL('../../fixtures/calendar/calendar-differential.json', import.meta.url), 'utf8'),
);

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const ymd = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

describe('P2-6 曆法差分：fixture 完整性', () => {
  it('全區間逐日比較，無未解釋差異', () => {
    expect(fixture.totals.unexplained).toBe(0);
    expect(fixture.unexplainedSamples).toEqual([]);
  });

  it('覆蓋範圍達 1900~2100 全區間', () => {
    expect(fixture.counts.daysCompared).toBeGreaterThanOrEqual(73_000);
    expect(fixture.counts.dayPillarCompared).toBe(fixture.counts.daysCompared);
    expect(fixture.counts.leapMonthsCompared).toBe(201);
    expect(fixture.counts.monthPillarCompared).toBeGreaterThanOrEqual(4_800);
    expect(fixture.counts.yearPillarCompared).toBeGreaterThanOrEqual(4_800);
  });

  it('所有差異均歸類為已知慣例', () => {
    expect(fixture.totals.mismatches).toBe(fixture.totals.classified);
    for (const key of Object.keys(fixture.classifications)) {
      expect(
        ['year-boundary-convention:day1-vs-lichun', 'zi-hour-boundary-convention'],
        `未預期的差異分類 ${key}`,
      ).toContain(key);
    }
  });
});

describe('P2-6 曆法差分：即時抽樣重驗', () => {
  const slices: [number, number][] = [[1900, 1902], [1949, 1950], [2098, 2100]];

  it('農曆 年/月/日/閏月 與日柱（即時）', () => {
    let compared = 0;
    for (const [fromYear, toYear] of slices) {
      for (let y = fromYear; y <= toYear; y++) {
        for (let m = 1; m <= 12; m++) {
          for (let d = 1; d <= daysInMonth(y, m); d++) {
            const ds = ymd(y, m, d);
            const a = Solar.fromYmd(y, m, d).getLunar();
            const b = lunarLite.solar2lunar(ds);

            expect([a.getYear(), Math.abs(a.getMonth()), a.getDay(), a.getMonth() < 0], `${ds} 農曆`)
              .toEqual([b.lunarYear, b.lunarMonth, b.lunarDay, b.isLeap]);
            expect(a.getDayInGanZhiExact(), `${ds} 日柱`)
              .toBe(lunarLite.getHeavenlyStemAndEarthlyBranchBySolarDate(ds, 0).daily.join(''));
            compared++;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(2_000);
  });

  it('月柱（即時，逐年每月 1 日與 15 日）', () => {
    let compared = 0;
    for (let y = 1900; y <= 2100; y += 7) {
      for (let m = 1; m <= 12; m++) {
        for (const d of [1, 15]) {
          const ds = ymd(y, m, d);
          const a = Solar.fromYmd(y, m, d).getLunar();
          const b = lunarLite.getHeavenlyStemAndEarthlyBranchBySolarDate(ds, 0);
          expect(a.getMonthInGanZhi(), `${ds} 月柱`).toBe(b.monthly.join(''));
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(600);
  });

  it('閏月表：lunar-typescript 現值 = 獨立掃描結果', () => {
    for (const row of fixture.leapMonths) {
      expect(LunarYear.fromYear(row.year).getLeapMonth(), `${row.year} 閏月`)
        .toBe(row.lunarTypescript);
      expect(row.lunarTypescript, `${row.year} 兩套實作閏月應一致`)
        .toBe(row.lunarLite);
    }
    expect(fixture.leapMonths.some(r => r.lunarTypescript !== 0)).toBe(true);
  });
});

describe('P2-6 本引擎曆法輸出 vs 獨立實作', () => {
  const samples: [number, number, number][] = [
    [1900, 1, 31], [1912, 2, 12], [1949, 10, 1], [1976, 7, 1], [1987, 8, 15],
    [2000, 1, 1], [2004, 2, 29], [2024, 2, 10], [2033, 12, 31], [2100, 12, 31],
  ];

  it('農曆日期與日柱一致', () => {
    for (const [y, m, d] of samples) {
      const ds = ymd(y, m, d);
      const c = calculate({
        calendarType: 'solar',
        date: { year: y, month: m, day: d },
        time: { hour: 12, minute: 0 },
        timezone: 'Asia/Taipei',
        sexForCalculation: 'male',
      });
      const lite = lunarLite.solar2lunar(ds);
      const gz = lunarLite.getHeavenlyStemAndEarthlyBranchBySolarDate(ds, 0);

      expect(c.calendar.lunar, `${ds} 農曆`).toEqual({
        year: lite.lunarYear,
        month: lite.lunarMonth,
        day: lite.lunarDay,
        isLeapMonth: lite.isLeap,
      });
      expect(`${c.calendar.ganzhi.day.stem}-${c.calendar.ganzhi.day.branch}`, `${ds} 日柱`)
        .toBe(lunarLiteToId(gz.daily.join('')));
    }
  });

  it('年柱採農曆正月初一慣例（非立春）', () => {
    // 2024-02-05：農曆 12/26（立春 2/4 已過、春節 2/10 未到）
    const c = calculate({
      calendarType: 'solar',
      date: { year: 2024, month: 2, day: 5 },
      time: { hour: 12, minute: 0 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'male',
    });
    expect(`${c.calendar.ganzhi.year.stem}-${c.calendar.ganzhi.year.branch}`).toBe('gui-mao');

    const l = Solar.fromYmd(2024, 2, 5).getLunar();
    expect(l.getYearInGanZhi()).toBe('癸卯');
    expect(l.getYearInGanZhiExact()).toBe('甲辰');
  });

  it('23:00 子時依換日慣例歸屬', () => {
    const at23 = calculate({
      calendarType: 'solar',
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 23, minute: 0 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'male',
    });
    expect(at23.calendar.hourBranch).toBe('zi');
  });
});

describe('P2-6 歷史時區 / 日光節約時間', () => {
  // 獨立於本引擎的歷史事實（IANA tzdata）：
  const cases: [string, string, number, string][] = [
    ['America/New_York', '1974-01-06T12:00:00Z', -240, '1974 美國日光節約時間（冬季仍為 EDT）'],
    ['America/New_York', '2024-03-10T12:00:00Z', -240, 'DST 起始日（02:00 EST → 03:00 EDT）'],
    ['America/New_York', '2024-01-15T12:00:00Z', -300, 'EST 標準時間'],
    ['Europe/London', '1969-06-15T12:00:00Z', 60, '1968-1971 英國全年 BST'],
    ['Asia/Taipei', '1979-07-01T12:00:00Z', 540, '1979 台灣日光節約時間'],
    ['Asia/Taipei', '1980-01-01T12:00:00Z', 480, '台灣標準時間 UTC+8'],
    ['Asia/Shanghai', '1988-06-15T12:00:00Z', 540, '1986-1991 中國日光節約時間'],
    ['UTC', '1970-01-01T00:00:00Z', 0, 'UTC 基準'],
  ];

  for (const [tz, iso, expected, note] of cases) {
    it(`${tz} ${iso.slice(0, 10)} = ${expected} 分（${note}）`, () => {
      expect(utcOffsetMinutes(new Date(iso), tz)).toBe(expected);
    });
  }

  it('DST 日之時區偏移與本地時辰', () => {
    // 契約：輸入的 date/time 為該時區的「本地牆鐘時間」，引擎不額外平移；
    // 1974-01-06 為美國日光節約時間期間（UTC-4），本地 12:00 → 午時。
    const c = calculate({
      calendarType: 'solar',
      date: { year: 1974, month: 1, day: 6 },
      time: { hour: 12, minute: 0 },
      timezone: 'America/New_York',
      sexForCalculation: 'male',
    });
    expect(c.calendar.utcOffsetMinutes).toBe(-240);
    expect(c.calendar.hourBranch).toBe('wu');
  });

  it('DST 期間的日光節約偏移會進入真太陽時計算', () => {
    // 同一時區、同一經度，DST 日（1974-01-06，全年 DST 期內）與標準日
    // （1974-11-06，DST 於 10/27 結束後）的真太陽時偏移應相差 60 分鐘
    const dstDay = calculate({
      calendarType: 'solar',
      date: { year: 1974, month: 1, day: 6 },
      time: { hour: 12, minute: 0 },
      timezone: 'America/New_York',
      location: { longitude: 0 },
      timeConvention: 'local-mean-solar',
      sexForCalculation: 'male',
    });
    const standardDay = calculate({
      calendarType: 'solar',
      date: { year: 1974, month: 11, day: 6 },
      time: { hour: 12, minute: 0 },
      timezone: 'America/New_York',
      location: { longitude: 0 },
      timeConvention: 'local-mean-solar',
      sexForCalculation: 'male',
    });
    expect(dstDay.calendar.trueSolarOffsetMinutes).toBe(240);
    expect(standardDay.calendar.trueSolarOffsetMinutes).toBe(300);
    expect(Math.abs((standardDay.calendar.trueSolarOffsetMinutes ?? 0) - (dstDay.calendar.trueSolarOffsetMinutes ?? 0))).toBe(60);
  });
});

/** 「甲子」→「jia-zi」 */
function lunarLiteToId(gz: string): string {
  const stems = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];
  const branches = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
  const stemZh = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branchZh = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return `${stems[stemZh.indexOf(gz[0])]}-${branches[branchZh.indexOf(gz[1])]}`;
}

/* ---------- fixtures/calendar/day-boundary.json ---------- */
type DayBoundaryFixture = {
  cases: {
    id: string;
    input: { date: { year: number; month: number; day: number }; time: { hour: number; minute: number }; dayBoundary?: string };
    engine: { solar: string; hourBranch: string; ganzhi: { day: string; hour: string } };
    reference: { lunarTypescript: { dayInGanZhiExact: string; dayInGanZhiExact2: string }; lunarLite: { daily: string; hourly: string } };
  }[];
};

const dayBoundary: DayBoundaryFixture = JSON.parse(
  readFileSync(new URL('../../fixtures/calendar/day-boundary.json', import.meta.url), 'utf8'),
);

/* ---------- fixtures/calendar/timezone-dst.json ---------- */
type TimezoneDstFixture = {
  cases: { tz: string; iso: string; expectedOffsetMinutes: number; engineOffsetMinutes: number; match: boolean; note: string }[];
};

const timezoneDst: TimezoneDstFixture = JSON.parse(
  readFileSync(new URL('../../fixtures/calendar/timezone-dst.json', import.meta.url), 'utf8'),
);

describe('P2-6 換日邊界（day boundary）', () => {
  for (const c of dayBoundary.cases) {
    it(`${c.id}：日柱等於有效曆日之獨立日柱`, () => {
      const [y, m, d] = c.engine.solar.split('-').map(Number);
      const independent = Solar.fromYmd(y, m, d).getLunar().getDayInGanZhiExact();
      expect(`${c.engine.ganzhi.day}`, `${c.id} 日柱應為 ${c.engine.solar}`).toBe(lunarLiteToId(independent));
    });
  }

  it('zi-hour 慣例：23:00 起算次日（對齊 lunar-typescript Exact）', () => {
    const ziHour = dayBoundary.cases.find(c => c.id === 'zi-hour-23-taipei')!;
    expect(ziHour.input.dayBoundary).toBe('zi-hour');
    expect(ziHour.engine.ganzhi.day).toBe(lunarLiteToId(ziHour.reference.lunarTypescript.dayInGanZhiExact));
    expect(ziHour.engine.ganzhi.day).not.toBe(lunarLiteToId(ziHour.reference.lunarTypescript.dayInGanZhiExact2));
    expect(ziHour.engine.solar).toBe('2000-01-02');
  });

  it('midnight 慣例：23:00 仍屬當日（對齊 Exact2 / lunar-lite）', () => {
    const midnight = dayBoundary.cases.find(c => c.id === 'midnight-23-taipei')!;
    expect(midnight.input.dayBoundary).toBe('midnight');
    expect(midnight.engine.ganzhi.day).toBe(lunarLiteToId(midnight.reference.lunarTypescript.dayInGanZhiExact2));
    expect(midnight.engine.ganzhi.day).toBe(lunarLiteToId(midnight.reference.lunarLite.daily));
    expect(midnight.engine.solar).toBe('2000-01-01');
  });

  it('真太陽時跨日：向後回捲與向前推進', () => {
    const back = dayBoundary.cases.find(c => c.id === 'true-solar-rollover-back')!;
    const forward = dayBoundary.cases.find(c => c.id === 'true-solar-rollover-forward')!;
    expect(back.engine.solar).toBe('1999-12-31');
    expect(forward.engine.solar).toBe('2000-01-02');
  });
});

describe('P2-6 歷史時區 / DST fixture', () => {
  it('所有查證案例引擎偏移皆相符', () => {
    expect(timezoneDst.cases.length).toBeGreaterThanOrEqual(8);
    for (const c of timezoneDst.cases) {
      expect(c.match, `${c.tz} ${c.iso}: ${c.note}`).toBe(true);
      expect(c.engineOffsetMinutes).toBe(c.expectedOffsetMinutes);
      expect(utcOffsetMinutes(new Date(c.iso), c.tz)).toBe(c.expectedOffsetMinutes);
    }
  });
});
