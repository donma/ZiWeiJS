#!/usr/bin/env tsx
/**
 * Differential Fixture Generator（spec §P1-5）
 *
 * 將外部排盤系統（iztro）的結果「存檔」成 fixtures/differential/<source>/<name>.json，
 * 讓 CI 不需安裝外部套件也能比對；live 比對仍由 tests/differential/iztro.test.ts 負責。
 *
 * 用法：npx tsx tools/fixture-generator/differential.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculate } from '../../src/reference-engine/engine.js';
import type { ZiWeiBirthInput } from '../../src/core/types.js';
import {
  compareIztro, snapshotEngine, snapshotIztro, profileForCase, iztroTimeIndex
} from '../differential-runner/iztro-compare.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const { astro } = require('iztro');

const IZTRO_VERSION = '2.6.1';

const solar = (y: number, m: number, d: number, h: number, sex: 'male' | 'female'): ZiWeiBirthInput => ({
  calendarType: 'solar', date: { year: y, month: m, day: d }, time: { hour: h },
  timezone: 'Asia/Taipei', sexForCalculation: sex
});

const CASES: Array<{ name: string; input: ZiWeiBirthInput }> = [
  { name: 'geng-wu-male', input: solar(1990, 5, 15, 10, 'male') },
  { name: 'gui-you-female', input: solar(1993, 7, 7, 14, 'female') },
  { name: 'wu-chen-female', input: solar(2000, 8, 16, 4, 'female') },
  { name: 'yi-chou-female', input: solar(1985, 11, 20, 14, 'female') },
  { name: 'wu-wu-female', input: solar(1978, 12, 25, 6, 'female') },
  { name: 'yi-hai-male', input: solar(1995, 8, 8, 8, 'male') },
  { name: 'ren-yin-male', input: solar(1962, 3, 3, 0, 'male') },
  { name: 'geng-zi-female-latezi', input: solar(2020, 2, 29, 23, 'female') },
  { name: 'jia-zi-female', input: solar(1984, 2, 2, 23, 'female') },
  { name: 'geng-chen-male', input: solar(2000, 1, 1, 0, 'male') },
  { name: 'bing-yin-male', input: solar(1986, 4, 4, 6, 'male') },
  { name: 'xin-wei-male', input: solar(1991, 6, 6, 12, 'male') }
];

const outDir = join(root, 'fixtures/differential/iztro');
mkdirSync(outDir, { recursive: true });

let written = 0;
const problems: string[] = [];

for (const c of CASES) {
  const { profile, dayBoundaryVariance } = profileForCase(c.input);
  const chart = calculate(c.input, { profile });
  const engine = snapshotEngine(chart);

  const hour = c.input.time?.hour ?? 12;
  const gender = c.input.sexForCalculation === 'female' ? 'female' : 'male';
  const a = astro.bySolar(
    `${c.input.date.year}-${c.input.date.month}-${c.input.date.day}`,
    iztroTimeIndex(hour), gender, true, 'zh-TW'
  ) as never;
  const iztro = snapshotIztro(a);

  // 存檔前先自我確認：不符者不得寫入
  const rows = compareIztro(engine, iztro, { dayBoundaryVariance });
  const bad = rows.filter(r => r.status === 'needs-review');
  if (bad.length > 0 && !dayBoundaryVariance) {
    problems.push(`${c.name}: ${bad.map(r => `${r.field} bible=${r.bible} iztro=${r.external}`).join('; ')}`);
    continue;
  }

  const fixture = {
    name: c.name,
    input: c.input,
    profile,
    source: { id: 'SRC.IZTRO', version: IZTRO_VERSION, package: 'iztro' },
    note: dayBoundaryVariance
      ? 'iztro 預設 dayDivide=forward（晚子時算次日）；本筆以 traditional-zi profile 對齊。'
      : 'iztro 預設換日政策與 canonical 相同。',
    expected: {
      lifePalaceBranch: iztro.lifePalaceBranch,
      bodyPalaceBranch: iztro.bodyPalaceBranch,
      bureauName: iztro.bureauName,
      stars: iztro.stars,
      dignity: iztro.dignity,
      sihua: iztro.sihua
    }
  };
  writeFileSync(join(outDir, `${c.name}.json`), JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  written++;
}

if (problems.length > 0) {
  console.error(`differential fixture generation FAILED — ${problems.length} case(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`differential fixtures written: ${written} -> fixtures/differential/iztro/`);
