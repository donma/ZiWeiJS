#!/usr/bin/env tsx
/**
 * Differential Runner — iztro 對照 CLI
 *
 * 逐欄比對本引擎與 iztro（Tier 3 實作來源）。
 * 差異不直接判錯，一律標記 needs-review 並附分類欄位，
 * 待人工審視後歸類為：流派差異 / 曆法差異 / 時間基準差異 / 換日差異 / 閏月差異 / Bug / 外部來源錯誤。
 *
 * 用法:
 *   npx tsx tools/differential-runner/iztro-runner.ts                     # 內建案例 + golden fixtures
 *   npx tsx tools/differential-runner/iztro-runner.ts --year 1990 --month 5 --day 15 --hour 10 --sex male
 *   npx tsx tools/differential-runner/iztro-runner.ts --json out.json     # 輸出機器可讀報告
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { calculate } from '../../src/reference-engine/engine.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import {
  compareIztro, snapshotEngine, snapshotIztro, summarize,
  profileForCase, iztroTimeIndex, IZTRO_CASES
} from './iztro-compare.js';
import { DIFFERENTIAL_CLASS_ZH } from '../../src/ai/research.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const { astro } = require('iztro');

function loadFixtureCases(): Array<ZiWeiBirthInput & { __fixture?: string }> {
  const dir = join(root, 'fixtures', 'golden');
  const out: Array<ZiWeiBirthInput & { __fixture?: string }> = [];
  let names: string[] = [];
  try { names = readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return out; }
  for (const f of names) {
    try {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const inp = j.input as ZiWeiBirthInput | undefined;
      if (!inp || inp.calendarType !== 'solar') continue;
      out.push({ ...inp, __fixture: f });
    } catch { /* 略過無法解析者 */ }
  }
  return out;
}

function caseKey(c: ZiWeiBirthInput): string {
  return `${c.date.year}-${c.date.month}-${c.date.day}-${c.time?.hour ?? 12}-${c.sexForCalculation}`;
}

function allCases(): Array<ZiWeiBirthInput & { __fixture?: string }> {
  const seen = new Set<string>();
  const merged: Array<ZiWeiBirthInput & { __fixture?: string }> = [];
  for (const c of [...IZTRO_CASES, ...loadFixtureCases()]) {
    const k = caseKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(c);
  }
  return merged;
}

const args = process.argv.slice(2);
const flag = (n: string, d?: string): string | undefined => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : d;
};

let cases = allCases();
if (flag('year')) {
  cases = [{
    calendarType: 'solar',
    date: { year: +flag('year', '1990')!, month: +flag('month', '1')!, day: +flag('day', '1')! },
    time: { hour: +flag('hour', '12')! },
    timezone: 'Asia/Taipei',
    sexForCalculation: flag('sex', 'male') as 'male' | 'female'
  }];
}

const report: unknown[] = [];
let totals = { total: 0, match: 0, review: 0, empty: 0 };

for (const input of cases) {
  const { profile, dayBoundaryVariance } = profileForCase(input);
  const engineInput = { ...input };
  delete (engineInput as { __fixture?: string }).__fixture;

  const chart = calculate(engineInput, { profile });
  const engine = snapshotEngine(chart);

  const hour = input.time?.hour ?? 12;
  const dateStr = `${input.date.year}-${input.date.month}-${input.date.day}`;
  const gender = input.sexForCalculation === 'female' ? 'female' : 'male';
  const a = astro.bySolar(dateStr, iztroTimeIndex(hour), gender, true, 'zh-TW');
  const iztro = snapshotIztro(a as never);

  const rows = compareIztro(engine, iztro, { dayBoundaryVariance });
  const s = summarize(rows);
  totals = {
    total: totals.total + s.total,
    match: totals.match + s.match,
    review: totals.review + s.review,
    empty: totals.empty + s.empty
  };

  const label = `${dateStr} ${hour}時 ${gender} [${profile}]${input.__fixture ? ' (' + input.__fixture + ')' : ''}`;
  console.log(`\n=== ${label} ===`);
  console.log(`  match ${s.match} / needs-review ${s.review} / empty ${s.empty}`);
  for (const r of rows.filter(x => x.status === 'needs-review')) {
    const zh = DIFFERENTIAL_CLASS_ZH[r.classification as keyof typeof DIFFERENTIAL_CLASS_ZH] ?? r.classification;
    console.log(`    x ${r.field}: bible=${r.bible ?? '-'} iztro=${r.external ?? '-'}  [${zh}]`);
  }
  report.push({ input, profile, rows, summary: s });
}

console.log('\n========================================');
console.log(`cases: ${cases.length} | rows: ${totals.total}`);
console.log(`match: ${totals.match} (${(totals.match / totals.total * 100).toFixed(1)}%)`);
console.log(`needs-review: ${totals.review} (${(totals.review / totals.total * 100).toFixed(1)}%)`);
console.log(`empty: ${totals.empty}`);
console.log('========================================');

const jsonOut = flag('json');
if (jsonOut) {
  writeFileSync(join(root, jsonOut), JSON.stringify({ generatedAt: new Date().toISOString(), cases: report }, null, 2), 'utf8');
  console.log(`\nwrote ${jsonOut}`);
}
