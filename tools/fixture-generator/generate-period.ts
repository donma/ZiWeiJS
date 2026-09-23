#!/usr/bin/env tsx
/**
 * Period Golden Fixture Generator（spec 2nd §P2-3）
 *
 * 產生 fixtures/golden-period/ 限運 oracle：
 *   大限切換前後 / 農曆跨月 / 農曆跨年 / 閏月 / 流日初一 / 流日月底 /
 *   23:00 子時 / timezone / true-solar rollover
 *
 * Oracle 內容：targetDate / activeMajor / year / month / day / hour
 *
 * 用法：
 *   npx tsx tools/fixture-generator/generate-period.ts            # 產生
 *   npx tsx tools/fixture-generator/generate-period.ts --check    # 重算並比對（drift 即 fail）
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculate } from '../../src/reference-engine/engine.js';
import type { ZiWeiBirthInput, TargetDate, PeriodInfo, MajorPeriod } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = join(root, 'fixtures/golden-period');
const checkOnly = process.argv.includes('--check');

interface PeriodCase {
  name: string;
  input: ZiWeiBirthInput;
  target: TargetDate;
  note: string;
}

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

const CASES: PeriodCase[] = [
  {
    name: 'major-switch-before',
    input: base,
    target: { year: 2025, month: 9, day: 1 },  // 虛歲 36（大限 36-45 起點前一年內）
    note: '大限切換前（35 歲）'
  },
  {
    name: 'major-switch-after',
    input: base,
    target: { year: 2026, month: 9, day: 1 },  // 虛歲 37
    note: '大限切換後（36-45）'
  },
  {
    name: 'lunar-month-cross',
    input: base,
    target: { year: 2026, month: 2, day: 20 }, // 農曆正月
    note: 'Gregorian 2 月但農曆正月'
  },
  {
    name: 'lunar-year-cross',
    input: base,
    target: { year: 2026, month: 1, day: 5 },  // 立春後、春節前
    note: '農曆跨年邊界'
  },
  {
    name: 'leap-month',
    input: base,
    target: { year: 2025, month: 8, day: 5 },  // 農曆 2025 閏六月十二
    note: '閏月目標'
  },
  {
    name: 'day-first',
    input: base,
    target: { year: 2026, month: 3, day: 19 }, // 農曆二月初一
    note: '流日初一'
  },
  {
    name: 'day-last',
    input: base,
    target: { year: 2026, month: 4, day: 16 }, // 農曆二月廿九（月底）
    note: '流日月底'
  },
  {
    name: 'late-zi-23',
    input: { ...base, time: { hour: 23, minute: 30 } },
    target: { year: 2026, month: 9, day: 23, hour: 23 },
    note: '23:00 子時換日'
  },
  {
    name: 'timezone-ny',
    input: { ...base, timezone: 'America/New_York' },
    target: { year: 2026, month: 9, day: 23, hour: 14 },
    note: '非亞洲時區'
  },
  {
    name: 'true-solar-rollover',
    input: { ...base, time: { hour: 0, minute: 10 }, location: { longitude: 0 }, timeConvention: 'local-mean-solar' },
    target: { year: 2026, month: 9, day: 23 },
    note: '真太陽時跨日（本命）'
  }
];

function scopeOf(p: PeriodInfo | undefined) {
  if (!p) return null;
  return {
    branch: p.branch,
    stem: p.stem,
    ganzhi: p.ganzhi ?? null,
    palaceId: p.palaceId ?? null
  };
}

function majorOf(m: MajorPeriod | undefined) {
  if (!m) return null;
  return {
    fromAge: m.fromAge,
    toAge: m.toAge,
    branch: m.branch,
    stem: m.stem,
    palaceId: m.palaceId ?? null,
    ganzhi: m.ganzhi ?? null
  };
}

interface PeriodPayload {
  targetDate: TargetDate;
  activeMajor: unknown;
  year: unknown;
  month: unknown;
  day: unknown;
  hour: unknown;
}

const failures: Array<{ name: string; details: string[] }> = [];
let written = 0;

mkdirSync(outDir, { recursive: true });

for (const c of CASES) {
  const chart = calculate(c.input, { targetDate: c.target });
  const payload: PeriodPayload = {
    targetDate: c.target,
    activeMajor: chart.periods.active
      ? { age: chart.periods.active.age, major: majorOf(chart.periods.active.major), skipped: chart.periods.active.majorSkippedReason ?? null }
      : null,
    year: scopeOf(chart.periods.year),
    month: scopeOf(chart.periods.month),
    day: scopeOf(chart.periods.day),
    hour: scopeOf(chart.periods.hour)
  };

  const fixture = {
    generatedBy: 'tools/fixture-generator/generate-period.ts',
    name: c.name,
    note: c.note,
    input: c.input,
    oracle: payload
  };

  const file = join(outDir, `period-${c.name}.json`);
  if (checkOnly) {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      failures.push({ name: c.name, details: ['fixture file missing'] });
      continue;
    }
    const existing = JSON.parse(raw) as { oracle?: unknown };
    if (JSON.stringify(existing.oracle) !== JSON.stringify(payload)) {
      failures.push({ name: c.name, details: ['period oracle drift detected'] });
    }
    continue;
  }
  writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  written++;
}

if (failures.length > 0) {
  console.error(`period golden FAILED — ${failures.length} case(s):`);
  for (const f of failures) {
    console.error(`  ${f.name}`);
    for (const d of f.details) console.error(`    - ${d}`);
  }
  process.exit(1);
}

if (checkOnly) {
  console.log(`period golden check OK — ${CASES.length} fixtures re-calculated and match stored oracle (no drift)`);
} else {
  console.log(`period golden written: ${written} fixtures to fixtures/golden-period/`);
}
