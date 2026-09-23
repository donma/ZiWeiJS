#!/usr/bin/env tsx
/**
 * Schema Validator（spec §P1-7 / §31）
 *
 * 以多組輸入（含 profile / targetDate / trace）實際排盤，
 * 驗證公開 JSON 契約是否符合 schemas/chart.schema.json。
 *
 * 用法：npm run validate:schemas
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { calculate, calculateSafe, listProfiles } from '../../src/index.js';
import type { ZiWeiBirthInput, CalculateOptions } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

const schema = JSON.parse(readFileSync(root + 'schemas/chart.schema.json', 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
const validate = ajv.compile(schema);

interface Case {
  name: string;
  input: ZiWeiBirthInput;
  options?: CalculateOptions;
}

const base = (year: number, month: number, day: number, hour: number, sex: 'male' | 'female' | 'unknown' = 'male'): ZiWeiBirthInput => ({
  calendarType: 'solar', date: { year, month, day }, time: { hour }, timezone: 'Asia/Taipei', sexForCalculation: sex
});

const cases: Case[] = [
  { name: 'natal only (no targetDate)', input: base(1990, 5, 15, 10) },
  { name: 'natal + trace', input: base(1990, 5, 15, 10), options: { trace: true } },
  { name: 'targetDate year only', input: base(1990, 5, 15, 10), options: { targetDate: { year: 2020 } } },
  { name: 'targetDate full + trace', input: base(1990, 5, 15, 10), options: { targetDate: { year: 2020, month: 6, day: 10, hour: 14 }, trace: true } },
  { name: 'late zi hour', input: base(2000, 8, 16, 23, 'female') },
  { name: 'lunar leap month input', input: { calendarType: 'lunar', date: { year: 1990, month: 5, day: 10, isLeapMonth: true }, time: { hour: 6 }, sexForCalculation: 'female' } },
  { name: 'true-solar', input: { ...base(1985, 11, 20, 14, 'female'), timeConvention: 'true-solar', location: { longitude: 121.5 } } },
  { name: 'unknown sex', input: base(1990, 5, 15, 10, 'unknown') },
  { name: 'overseas timezone', input: { ...base(1978, 12, 25, 6, 'female'), timezone: 'America/New_York' } },
  { name: 'profile school-zhongzhou', input: base(1990, 6, 6, 10), options: { profile: 'school-zhongzhou' } }
];

for (const p of listProfiles()) {
  if (['canonical', 'traditional-zi', 'true-solar', 'school-zhongzhou', 'school-ma-hu'].includes(p.profileId)) {
    cases.push({
      name: `profile ${p.profileId} + target`,
      input: { ...base(1990, 6, 6, 10), timeConvention: p.timeConvention, location: { longitude: 121.5 } },
      options: { profile: p.profileId, targetDate: { year: 2021, month: 3, day: 3, hour: 9 } }
    });
  }
}

let failed = 0;
for (const c of cases) {
  const res = calculateSafe(c.input, c.options);
  if (!res.ok) {
    console.error(`FAIL ${c.name}: calculate failed -> ${res.error.code} ${res.error.message}`);
    failed++;
    continue;
  }
  if (!validate(res.chart)) {
    console.error(`FAIL ${c.name}:`);
    for (const e of validate.errors ?? []) {
      console.error(`   ${e.instancePath || '/'} ${e.message}`);
    }
    failed++;
  }
}

// 錯誤情境也必須是結構化錯誤（不得丟出非 ZiWeiError）
const errorCases: Array<[string, ZiWeiBirthInput, CalculateOptions?]> = [
  ['missing time', { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, sexForCalculation: 'male' }],
  ['invalid target', base(1990, 5, 15, 10), { targetDate: { year: 2020, day: 3 } }],
  ['bad timezone', { ...base(1990, 5, 15, 10), timezone: 'Mars/Olympus' }]
];
for (const [name, input, options] of errorCases) {
  const res = calculateSafe(input, options);
  if (res.ok) {
    console.error(`FAIL error case "${name}": expected failure`);
    failed++;
  } else if (!res.error.code) {
    console.error(`FAIL error case "${name}": error without code`);
    failed++;
  }
}

// 確保 calculate 仍可被直接呼叫（非 Safe 版本）
calculate(base(1990, 5, 15, 10));

if (failed === 0) {
  console.log(`schema OK — chart.schema.json validated against ${cases.length} charts + ${errorCases.length} error cases`);
  process.exit(0);
}
console.error(`schema FAILED — ${failed} case(s)`);
process.exit(1);
