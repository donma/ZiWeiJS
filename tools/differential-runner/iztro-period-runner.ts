#!/usr/bin/env tsx
/**
 * Period Differential Runner — iztro 限運對照 CLI（spec 2nd §P0-9）
 *
 * 比對五層限運（大限 / 流年 / 流月 / 流日 / 流時）之
 * 干支、限運命宮位置、四化。
 *
 * 差異不得直接判 bug，也不得直接判 iztro 正確，必須分類。
 * 禁止 unclassified 進入通過狀態。
 *
 * 用法：
 *   npx tsx tools/differential-runner/iztro-period-runner.ts
 *   npx tsx tools/differential-runner/iztro-period-runner.ts --json out.json
 *   npx tsx tools/differential-runner/iztro-period-runner.ts --write-fixtures
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { calculate } from '../../src/reference-engine/engine.js';
import type { ZiWeiBirthInput, TargetDate } from '../../src/index.js';
import { comparePeriodWithIztro, type IztroHoroscopeLike, type PeriodDiffRow } from './iztro-period-compare.js';
import { iztroTimeIndex } from './iztro-compare.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const { astro } = require('iztro');

interface PeriodCase {
  id: string;
  input: ZiWeiBirthInput;
  target: TargetDate;
}

const cases: PeriodCase[] = [
  {
    id: 'natal-1990-target-2026',
    input: { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10, minute: 30 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' },
    target: { year: 2026, month: 9, day: 23, hour: 14 }
  },
  {
    id: 'female-1985-target-2026',
    input: { calendarType: 'solar', date: { year: 1985, month: 11, day: 20 }, time: { hour: 14 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' },
    target: { year: 2026, month: 3, day: 19, hour: 6 }
  },
  {
    id: 'leap-month-target-2025',
    input: { calendarType: 'solar', date: { year: 1992, month: 3, day: 9 }, time: { hour: 6 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' },
    target: { year: 2025, month: 8, day: 5, hour: 10 }
  },
  {
    id: 'year-only-target',
    input: { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' },
    target: { year: 2035 }
  },
  {
    id: 'late-zi-23',
    input: { calendarType: 'solar', date: { year: 2000, month: 8, day: 16 }, time: { hour: 23 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' },
    target: { year: 2026, month: 9, day: 23, hour: 23 }
  }
];

const IZTRO_SEX: Record<string, string> = { male: '男', female: '女' };

function iztroHoroscope(c: PeriodCase): IztroHoroscopeLike | null {
  const hour = c.input.time?.hour;
  if (hour === undefined) return null;
  const sex = IZTRO_SEX[c.input.sexForCalculation ?? 'male'];
  if (!sex) return null;
  try {
    const astrolabe = astro.bySolar(
      c.input.date.year + '-' + c.input.date.month + '-' + c.input.date.day,
      iztroTimeIndex(hour),
      sex as never,
      true,
      'zh-TW'
    );
    const t = c.target;
    const stamp = t.hour !== undefined
      ? `${t.year}-${t.month ?? 1}-${t.day ?? 15} ${t.hour}:00`
      : `${t.year}-${t.month ?? 6}-${t.day ?? 15}`;
    return astrolabe.horoscope(stamp) as unknown as IztroHoroscopeLike;
  } catch {
    return null;
  }
}

function expectedScopesFor(target: TargetDate): Array<'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly'> {
  if (target.hour !== undefined) return ['decadal', 'yearly', 'monthly', 'daily', 'hourly'];
  if (target.day !== undefined) return ['decadal', 'yearly', 'monthly', 'daily'];
  if (target.month !== undefined) return ['decadal', 'yearly', 'monthly'];
  return ['decadal', 'yearly'];
}

interface CaseReport {
  id: string;
  input: ZiWeiBirthInput;
  target: TargetDate;
  expectedScopes: Array<'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly'>;
  rows: PeriodDiffRow[];
  externalError?: string;
}

const reports: CaseReport[] = [];
for (const c of cases) {
  const chart = calculate(c.input, { targetDate: c.target });
  const h = iztroHoroscope(c);
  if (!h) {
    reports.push({
      id: c.id,
      input: c.input,
      target: c.target,
      expectedScopes: expectedScopesFor(c.target),
      rows: [],
      externalError: 'iztro horoscope unavailable'
    });
    continue;
  }
  reports.push({
    id: c.id,
    input: c.input,
    target: c.target,
    expectedScopes: expectedScopesFor(c.target),
    rows: comparePeriodWithIztro(chart, h, { targetHour: c.target.hour })
  });
}

const allRows = reports.flatMap(r => r.rows);
const matched = allRows.filter(r => r.status === 'match').length;
const review = allRows.filter(r => r.status === 'needs-review');
const byClass = review.reduce<Record<string, number>>((acc, r) => {
  const k = r.classification ?? 'unclassified';
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

/* ---------- Variance Registry（spec 3rd §P1-5） ---------- */
interface VarianceEntry {
  varianceId: string;
  scope: string;
  field: string;
  ruleId: string;
  classification: string;
  condition?: string;
  rationale?: string;
  researchId?: string;
  acceptedByOwner?: boolean;
}

const varianceRegistry: VarianceEntry[] = (() => {
  try {
    const raw = readFileSync(join(root, 'variants/differential.json'), 'utf8');
    return (JSON.parse(raw) as { variances?: VarianceEntry[] }).variances ?? [];
  } catch {
    return [];
  }
})();

function varianceRegistryMatch(row: PeriodDiffRow): VarianceEntry | undefined {
  const fullField = `${row.scope}.${row.field}`;
  return varianceRegistry.find(v => {
    if (v.classification !== row.classification) return false;
    if (v.scope !== '*' && v.scope !== row.scope) return false;
    if (v.field.endsWith('.*')) {
      const prefix = v.field.slice(0, -2);
      return fullField.startsWith(`${prefix}.`) || fullField === prefix || row.field.startsWith(`${prefix}.`) || row.field === prefix;
    }
    return v.field === row.field || v.field === fullField;
  });
}

/* ---------- Gate（spec 3rd §P0-5） ---------- */
// 必須 fail：bug、unclassified、external-error
// 可以 pass：school/calendar/time-basis/day-boundary/leap-month variance
//           且必須在 Variance Registry 有登錄（否則 fail）
const HARD_FAIL = new Set(['bug', 'unclassified']);
const KNOWN_VARIANCE = new Set([
  'school-variance',
  'calendar-variance',
  'time-basis-variance',
  'day-boundary-variance',
  'leap-month-variance'
]);

const hardFails = review.filter(r => !r.classification || HARD_FAIL.has(r.classification));
const externalErrors = reports.filter(r => r.externalError);
const untracked = review.filter(r => {
  const cls = r.classification ?? 'unclassified';
  if (!KNOWN_VARIANCE.has(cls)) return false; // 已由 hardFails 處理
  return !varianceRegistryMatch(r);
});

console.log('=== Period Differential (iztro) ===');
for (const r of reports) {
  if (r.externalError) {
    console.log(`  ${r.id}: ${r.externalError}`);
    continue;
  }
  const m = r.rows.filter(x => x.status === 'match').length;
  console.log(`  ${r.id}: ${m}/${r.rows.length} match`);
  for (const row of r.rows.filter(x => x.status === 'needs-review')) {
    const tracked = varianceRegistryMatch(row);
    console.log(`    [${row.classification ?? 'unclassified'}${tracked ? ` ${tracked.varianceId}` : ' UNTRACKED'}] ${row.scope}.${row.field}: bible=${row.bible ?? '∅'} iztro=${row.external ?? '∅'}`);
  }
}
console.log(`\ntotal rows ${allRows.length}: match ${matched}, needs-review ${review.length}`);
console.log('classifications', JSON.stringify(byClass));

if (process.argv.includes('--journal')) {
  const idx = process.argv.indexOf('--journal');
  const out = process.argv[idx + 1] ?? join(root, 'period-differential.json');
  writeFileSync(out, `${JSON.stringify({ reports, summary: { total: allRows.length, matched, review: review.length, byClass } }, null, 2)}\n`, 'utf8');
  console.log(`written ${out}`);
}

if (process.argv.includes('--write-fixtures')) {
  const dir = join(root, 'fixtures/differential/iztro-period');
  mkdirSync(dir, { recursive: true });
  for (const r of reports) {
    writeFileSync(
      join(dir, `${r.id}.json`),
      `${JSON.stringify({
        id: r.id,
        input: r.input,
        target: r.target,
        expectedScopes: r.expectedScopes,
        external: { sourceId: 'SRC.IZTRO', version: '2.6.1' },
        rows: r.rows,
        externalError: r.externalError ?? null
      }, null, 2)}\n`,
      'utf8'
    );
  }
  console.log(`written fixtures to ${dir} (${reports.length} files)`);
}

let failed = false;
if (hardFails.length > 0) {
  console.error(`\nFAILED: ${hardFails.length} row(s) classified as bug / unclassified (禁止通過)`);
  for (const r of hardFails.slice(0, 20)) {
    console.error(`  ${r.scope}.${r.field}: bible=${r.bible ?? '∅'} iztro=${r.external ?? '∅'} [${r.classification ?? 'unclassified'}]`);
  }
  failed = true;
}
if (externalErrors.length > 0) {
  console.error(`\nFAILED: ${externalErrors.length} external error(s)（預設 fail，需 allowlist 才能忽略）`);
  for (const r of externalErrors) console.error(`  ${r.id}: ${r.externalError}`);
  failed = true;
}
if (untracked.length > 0) {
  console.error(`\nFAILED: ${untracked.length} variance row(s) 未登錄於 variants/differential.json`);
  for (const r of untracked.slice(0, 20)) {
    console.error(`  ${r.scope}.${r.field} [${r.classification}]`);
  }
  failed = true;
}

if (failed) process.exit(1);

console.log(`\nGATE PASS: ${matched} match / ${review.length} known-variance（全部已登錄於 variants/differential.json）`);
