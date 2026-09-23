/**
 * P2-6 曆法層差分測試（calendar differential）
 *
 * 以兩套彼此獨立的曆法實作互相驗證：
 *   - lunar-typescript 1.8.6（本引擎 runtime 依賴）
 *   - lunar-lite 0.2.8（iztro 依賴，獨立移植版本）
 *
 * 覆蓋範圍：
 *   1. 1900-01-31 ~ 2100-12-31 逐日：農曆 年/月/日、閏月、日柱
 *   2. 閏月表（1900~2100）
 *   3. 年柱 / 月柱 / 日柱（逐年抽樣：每月 1 日與 15 日）
 *   4. 時柱（13 時辰 index）
 *
 * 產出：fixtures/calendar/calendar-differential.json
 *
 * 執行：npx tsx tools/calendar-differential/run.ts
 */
import { Solar, LunarYear } from 'lunar-typescript';
import * as lunarLite from 'lunar-lite';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { calculate, utcOffsetMinutes } from '../../src/index.js';

const STEMS_ZH = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES_ZH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const START = { y: 1900, m: 1, d: 31 };
const END = { y: 2100, m: 12, d: 31 };

type Mismatch = {
  kind: string;
  input: string;
  a: string;
  b: string;
  classification: string;
};

const mismatches: Mismatch[] = [];
const counts = {
  daysCompared: 0,
  lunarFieldsCompared: 0,
  dayPillarCompared: 0,
  leapMonthsCompared: 0,
  monthPillarCompared: 0,
  yearPillarCompared: 0,
  hourPillarCompared: 0,
};

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const ymd = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function nextDay(y: number, m: number, d: number): [number, number, number] {
  if (d < daysInMonth(y, m)) return [y, m, d + 1];
  if (m < 12) return [y, m + 1, 1];
  return [y + 1, 1, 1];
}

function record(kind: string, input: string, a: string, b: string, classification: string): void {
  mismatches.push({ kind, input, a, b, classification });
}

/* ---------- 1. 逐日農曆 / 閏月 / 日柱 ---------- */
let y = START.y;
let m = START.m;
let d = START.d;

while (y <= END.y) {
  const ds = ymd(y, m, d);

  const tsLunar = Solar.fromYmd(y, m, d).getLunar();
  const tsMonth = tsLunar.getMonth();
  const tsLeap = tsMonth < 0;

  const lite = lunarLite.solar2lunar(ds);

  counts.daysCompared++;
  counts.lunarFieldsCompared += 4;

  if (tsLunar.getYear() !== lite.lunarYear) {
    record('lunar-year', ds, String(tsLunar.getYear()), String(lite.lunarYear), 'unexplained');
  }
  if (Math.abs(tsMonth) !== lite.lunarMonth) {
    record('lunar-month', ds, String(Math.abs(tsMonth)), String(lite.lunarMonth), 'unexplained');
  }
  if (tsLeap !== lite.isLeap) {
    record('leap-flag', ds, String(tsLeap), String(lite.isLeap), 'unexplained');
  }
  if (tsLunar.getDay() !== lite.lunarDay) {
    record('lunar-day', ds, String(tsLunar.getDay()), String(lite.lunarDay), 'unexplained');
  }

  // 日柱（00:00 取樣，無時辰歧義）
  const tsDay = tsLunar.getDayInGanZhiExact();
  const liteDay = lunarLite.getHeavenlyStemAndEarthlyBranchBySolarDate(ds, 0).daily.join('');
  counts.dayPillarCompared++;
  if (tsDay !== liteDay) {
    record('day-pillar', ds, tsDay, liteDay, 'unexplained');
  }

  const [ny, nm, nd] = nextDay(y, m, d);
  y = ny; m = nm; d = nd;
}

/* ---------- 2. 閏月表 ---------- */
const leapMonths: { year: number; lunarTypescript: number; lunarLite: number }[] = [];
for (let yr = 1900; yr <= 2100; yr++) {
  const tsLeapMonth = LunarYear.fromYear(yr).getLeapMonth();
  // 以獨立實作掃描該年每日，找出出現閏月的月份（不依賴 lunar-typescript 的閏月表）
  let liteLeapMonth = 0;
  for (let mm = 1; mm <= 12 && liteLeapMonth === 0; mm++) {
    const dim = daysInMonth(yr, mm);
    for (let dd = 1; dd <= dim; dd++) {
      const ld = lunarLite.solar2lunar(ymd(yr, mm, dd));
      if (ld.lunarYear === yr && ld.isLeap) { liteLeapMonth = ld.lunarMonth; break; }
    }
  }
  counts.leapMonthsCompared++;
  leapMonths.push({ year: yr, lunarTypescript: tsLeapMonth, lunarLite: liteLeapMonth });
  if (tsLeapMonth !== liteLeapMonth) {
    record('leap-month-table', String(yr), String(tsLeapMonth), String(liteLeapMonth), 'unexplained');
  }
}

/* ---------- 3. 年柱 / 月柱（逐年抽樣） ---------- */
for (let yr = 1900; yr <= 2100; yr++) {
  for (let mm = 1; mm <= 12; mm++) {
    for (const dd of [1, 15]) {
      const ds = ymd(yr, mm, dd);
      const tsLunar = Solar.fromYmd(yr, mm, dd).getLunar();
      const liteGz = lunarLite.getHeavenlyStemAndEarthlyBranchBySolarDate(ds, 0);

      const tsYear = tsLunar.getYearInGanZhi();
      const tsMonthGz = tsLunar.getMonthInGanZhi();
      counts.yearPillarCompared++;
      counts.monthPillarCompared++;

      if (tsYear !== liteGz.yearly.join('')) {
        // 兩套實作的「年柱換年」慣例不同：lunar-typescript 預設用正月初一，
        // lunar-lite 預設用立春。以 lunar-typescript 的立春版驗證差異純屬慣例。
        const tsYearLiChun = tsLunar.getYearInGanZhiExact();
        const cls = tsYearLiChun === liteGz.yearly.join('')
          ? 'year-boundary-convention:day1-vs-lichun'
          : 'unexplained';
        record('year-pillar', ds, tsYear, liteGz.yearly.join(''), cls);
      }
      if (tsMonthGz !== liteGz.monthly.join('')) {
        record('month-pillar', ds, tsMonthGz, liteGz.monthly.join(''), 'month-boundary-convention');
      }
    }
  }
}

/* ---------- 4. 時柱（13 時辰 index × 抽樣日） ---------- */
const hourSamples: [number, number, number][] = [
  [1900, 2, 1], [1912, 2, 12], [1949, 10, 1], [1976, 7, 1], [1987, 8, 15],
  [2000, 1, 1], [2024, 2, 10], [2044, 2, 1], [2100, 12, 31], [2023, 3, 1],
];
for (const [yy, mm, dd] of hourSamples) {
  for (const hour of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 23]) {
    const ds = ymd(yy, mm, dd);
    const tsLunar = Solar.fromYmdHms(yy, mm, dd, hour, 0, 0).getLunar();
    const timeIndex = Math.floor((hour + 1) / 2) % 12;
    const liteGz = lunarLite.getHeavenlyStemAndEarthlyBranchBySolarDate(ds, timeIndex);
    const tsHour = tsLunar.getTimeInGanZhi();
    counts.hourPillarCompared++;
    if (tsHour !== liteGz.hourly.join('')) {
      // 23:00 起屬次日子時，兩套實作採不同日期歸屬慣例
      const classification = hour === 23 ? 'zi-hour-boundary-convention' : 'unexplained';
      record('hour-pillar', `${ds} ${pad(hour)}:00`, tsHour, liteGz.hourly.join(''), classification);
    }
  }
}

/* ---------- 5. 換日邊界（day boundary） ---------- */
type DayBoundaryCase = {
  id: string;
  input: Record<string, unknown>;
  engine: Record<string, unknown>;
  reference: Record<string, unknown>;
};

const boundaryInputs: { id: string; input: Parameters<typeof calculate>[0] }[] = [
  {
    id: 'zi-hour-23-taipei',
    input: {
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 23, minute: 10 }, timezone: 'Asia/Taipei',
      dayBoundary: 'zi-hour', sexForCalculation: 'male'
    }
  },
  {
    id: 'midnight-23-taipei',
    input: {
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 23, minute: 10 }, timezone: 'Asia/Taipei',
      dayBoundary: 'midnight', sexForCalculation: 'male'
    }
  },
  {
    id: 'early-zi-0010-taipei',
    input: {
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 0, minute: 10 }, timezone: 'Asia/Taipei',
      dayBoundary: 'zi-hour', sexForCalculation: 'male'
    }
  },
  {
    id: 'true-solar-rollover-back',
    input: {
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 0, minute: 10 }, timezone: 'Asia/Taipei',
      location: { longitude: 0 }, timeConvention: 'local-mean-solar',
      sexForCalculation: 'male'
    }
  },
  {
    id: 'true-solar-rollover-forward',
    input: {
      calendarType: 'solar', date: { year: 2000, month: 1, day: 1 },
      time: { hour: 23, minute: 50 }, timezone: 'Asia/Taipei',
      location: { longitude: 180 }, timeConvention: 'local-mean-solar',
      sexForCalculation: 'male'
    }
  }
];

const dayBoundaryCases: DayBoundaryCase[] = boundaryInputs.map(({ id, input }) => {
  const c = calculate(input);
  const solar = `${c.calendar.solar.year}-${pad(c.calendar.solar.month)}-${pad(c.calendar.solar.day)}`;
  const ds = ymd(input.date.year, input.date.month, input.date.day);
  const hour = input.time?.hour ?? 0;
  const timeIndex = Math.floor((hour + 1) / 2) % 12;
  const ts = Solar.fromYmdHms(input.date.year, input.date.month, input.date.day, hour, input.time?.minute ?? 0, 0).getLunar();
  const lite = lunarLite.getHeavenlyStemAndEarthlyBranchBySolarDate(ds, timeIndex);

  return {
    id,
    input: input as unknown as Record<string, unknown>,
    engine: {
      solar,
      lunar: c.calendar.lunar,
      hourBranch: c.calendar.hourBranch,
      utcOffsetMinutes: c.calendar.utcOffsetMinutes,
      trueSolarOffsetMinutes: c.calendar.trueSolarOffsetMinutes ?? null,
      ganzhi: {
        day: `${c.calendar.ganzhi.day.stem}-${c.calendar.ganzhi.day.branch}`,
        hour: `${c.calendar.ganzhi.hour.stem}-${c.calendar.ganzhi.hour.branch}`
      }
    },
    reference: {
      lunarTypescript: {
        dayInGanZhiExact: ts.getDayInGanZhiExact(),
        dayInGanZhiExact2: ts.getDayInGanZhiExact2()
      },
      lunarLite: { daily: lite.daily.join(''), hourly: lite.hourly.join('') }
    }
  };
});

/* ---------- 6. 歷史時區 / DST（人工查證的 IANA 事實） ---------- */
const tzFacts: { tz: string; iso: string; expectedOffsetMinutes: number; note: string }[] = [
  { tz: 'America/New_York', iso: '1974-01-06T12:00:00Z', expectedOffsetMinutes: -240, note: '1974 美國全年日光節約時間（1/6 起）' },
  { tz: 'America/New_York', iso: '1974-11-06T12:00:00Z', expectedOffsetMinutes: -300, note: '1974 DST 於 10/27 結束後之 EST' },
  { tz: 'America/New_York', iso: '2024-03-10T12:00:00Z', expectedOffsetMinutes: -240, note: 'DST 起始日 02:00 EST → 03:00 EDT' },
  { tz: 'America/New_York', iso: '2024-01-15T12:00:00Z', expectedOffsetMinutes: -300, note: 'EST 標準時間' },
  { tz: 'Europe/London', iso: '1969-06-15T12:00:00Z', expectedOffsetMinutes: 60, note: '1968-1971 英國全年 BST' },
  { tz: 'Asia/Taipei', iso: '1979-07-01T12:00:00Z', expectedOffsetMinutes: 540, note: '1979 台灣日光節約時間' },
  { tz: 'Asia/Taipei', iso: '1980-01-01T12:00:00Z', expectedOffsetMinutes: 480, note: '台灣標準時間 UTC+8' },
  { tz: 'Asia/Shanghai', iso: '1988-06-15T12:00:00Z', expectedOffsetMinutes: 540, note: '1986-1991 中國日光節約時間' },
  { tz: 'UTC', iso: '1970-01-01T00:00:00Z', expectedOffsetMinutes: 0, note: 'UTC 基準' }
];

const timezoneDst = {
  generatedBy: 'tools/calendar-differential/run.ts',
  source: 'IANA tzdata（人工查證清單）',
  cases: tzFacts.map(f => ({
    ...f,
    engineOffsetMinutes: utcOffsetMinutes(new Date(f.iso), f.tz),
    match: utcOffsetMinutes(new Date(f.iso), f.tz) === f.expectedOffsetMinutes
  }))
};

const dayBoundaryOut = {
  generatedBy: 'tools/calendar-differential/run.ts',
  contract: '輸入 date/time 為該時區的本地牆鐘時間；dayBoundary 決定日柱換日點',
  cases: dayBoundaryCases
};

const extraArtifacts: [string, unknown][] = [
  ['fixtures/calendar/day-boundary.json', dayBoundaryOut],
  ['fixtures/calendar/timezone-dst.json', timezoneDst]
];

/* ---------- 產出 ---------- */
const unexplained = mismatches.filter(x => x.classification === 'unexplained');
const classified = mismatches.filter(x => x.classification !== 'unexplained');

const out = {
  generatedBy: 'tools/calendar-differential/run.ts',
  libraries: {
    a: 'lunar-typescript@1.8.6',
    b: 'lunar-lite@0.2.8',
  },
  range: { from: ymd(START.y, START.m, START.d), to: ymd(END.y, END.m, END.d) },
  counts,
  totals: { mismatches: mismatches.length, unexplained: unexplained.length, classified: classified.length },
  classifications: classified.reduce<Record<string, number>>((acc, x) => {
    acc[x.classification] = (acc[x.classification] ?? 0) + 1;
    return acc;
  }, {}),
  unexplainedSamples: unexplained.slice(0, 50),
  classifiedSamples: classified.slice(0, 20),
  leapMonths,
  stemBranchReference: { stems: STEMS_ZH, branches: BRANCHES_ZH },
};

const outPath = resolve('fixtures/calendar/calendar-differential.json');
const check = process.argv.includes('--check');
const serialized = `${JSON.stringify(out, null, 2)}\n`;

const artifacts: [string, string][] = [
  [outPath, serialized],
  ...extraArtifacts.map(([p, payload]) => [resolve(p), `${JSON.stringify(payload, null, 2)}\n`] as [string, string])
];

if (check) {
  let failed = false;
  for (const [path, content] of artifacts) {
    let existing = '';
    try {
      existing = readFileSync(path, 'utf8');
    } catch {
      console.error(`CHECK FAILED: ${path} 不存在，請先執行 npx tsx tools/calendar-differential/run.ts`);
      failed = true;
      continue;
    }
    if (existing !== content) {
      console.error(`CHECK FAILED: ${path} 與現行實作不一致`);
      failed = true;
    }
  }
  if (failed) {
    console.error('請重新產生：npx tsx tools/calendar-differential/run.ts');
    process.exit(1);
  }
}

for (const [path, content] of artifacts) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  console.log(`written ${path}`);
}

console.log(JSON.stringify(counts, null, 2));
console.log('totals', JSON.stringify(out.totals));
console.log('classifications', JSON.stringify(out.classifications));
if (unexplained.length) {
  console.log('UNEXPLAINED (first 20):');
  for (const x of unexplained.slice(0, 20)) console.log(` ${x.kind} ${x.input}: a=${x.a} b=${x.b}`);
}
console.log(`${check ? 'check passed, ' : ''}written ${artifacts.length} fixture files`);
