#!/usr/bin/env node
/**
 * Fixture Generator
 *
 * 用途：
 *   1. 由現有引擎輸出產生 golden fixture（首次建立或規則變更後更新）
 *   2. 產生 differential fixture 骨架
 *
 * 用法：
 *   node tools/fixture-generator/generate.mjs golden --input "1990-05-15T10:30|male|Asia/Taipei"
 *   node tools/fixture-generator/generate.mjs golden --file cases.txt
 *   node tools/fixture-generator/generate.mjs differential --year 1990 --month 5 --day 15 --hour 10 --sex male
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const mode = args[0];

function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
}

function runEngine(input) {
  const script = `
import { calculate } from './src/reference-engine/engine.ts';
const input = ${JSON.stringify(input)};
const c = calculate(input);
const out = {
  lifePalaceBranch: c.chart.natal.lifePalaceBranch,
  bodyPalaceBranch: c.chart.natal.bodyPalaceBranch,
  bureau: c.birthContext.bureau,
  direction: c.birthContext.direction,
  lunar: c.calendar.lunar,
  ganzhiYear: c.calendar.ganzhi.year.stem + '-' + c.calendar.ganzhi.year.branch,
  stars: Object.fromEntries(Object.entries(c.chart.stars).map(([k, v]) => [k, v.branch])),
  sihua: Object.fromEntries(c.chart.transformations.filter(t => t.sourceScope === 'natal').map(t => [t.type, t.targetStarId])),
  patterns: c.chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced').map(p => p.patternId)
};
console.log(JSON.stringify(out));
`;
  const tmp = join(root, '.fixture-gen.tmp.ts');
  writeFileSync(tmp, script, 'utf8');
  try {
    const raw = execSync(`npx tsx "${tmp}"`, { cwd: root, encoding: 'utf8' });
    return JSON.parse(raw.trim().split('\n').pop());
  } finally {
    try { execSync(`node -e "require('fs').unlinkSync(${JSON.stringify(tmp)})"`, { stdio: 'ignore' }); } catch { /* ignore */ }
  }
}

function parseInput(str) {
  const [dt, sex, tz] = str.split('|');
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):?(\d{2})?)?$/);
  if (!m) throw new Error(`Cannot parse input: ${str}`);
  return {
    calendarType: 'solar',
    date: { year: +m[1], month: +m[2], day: +m[3] },
    time: m[4] !== undefined ? { hour: +m[4], minute: m[5] ? +m[5] : 0 } : undefined,
    timezone: tz || 'Asia/Taipei',
    sexForCalculation: sex || 'male'
  };
}

if (mode === 'golden') {
  const dir = join(root, 'fixtures/golden');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const inputs = [];
  const single = flag('input');
  if (single) inputs.push(single);
  const file = flag('file');
  if (file) {
    for (const line of readFileSync(resolve(file), 'utf8').split('\n')) {
      const t = line.trim();
      if (t && !t.startsWith('#')) inputs.push(t);
    }
  }
  if (inputs.length === 0) {
    console.error('No input given. Use --input "YYYY-MM-DDThh:mm|sex|tz" or --file cases.txt');
    process.exit(1);
  }
  for (const raw of inputs) {
    const input = parseInput(raw);
    const result = runEngine(input);
    const name = `${input.date.year}-${String(input.date.month).padStart(2, '0')}-${String(input.date.day).padStart(2, '0')}-${input.sexForCalculation}`;
    const fixture = {
      name: `golden-${name}`,
      input,
      expect: {
        lunar: result.lunar,
        'ganzhi.year': result.ganzhiYear,
        lifePalaceBranch: result.lifePalaceBranch,
        bodyPalaceBranch: result.bodyPalaceBranch,
        bureau: result.bureau,
        stars: result.stars,
        'sihua.natal': result.sihua
      },
      note: `由 fixture-generator 產生（direction=${result.direction}）；若要作為驗證基準請人工覆核。`
    };
    const outPath = join(dir, `case-${name}.json`);
    writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
    console.log('wrote', outPath);
  }
} else if (mode === 'differential') {
  const dir = join(root, 'fixtures/differential');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const input = {
    calendarType: 'solar',
    date: { year: +flag('year', 1990), month: +flag('month', 5), day: +flag('day', 15) },
    time: { hour: +flag('hour', 10), minute: +flag('minute', 30) },
    timezone: flag('timezone', 'Asia/Taipei'),
    sexForCalculation: flag('sex', 'male')
  };
  const result = runEngine(input);
  const fixture = {
    name: `diff-${input.date.year}-${input.date.month}-${input.date.day}`,
    input,
    bible: {
      lifePalaceBranch: result.lifePalaceBranch,
      bodyPalaceBranch: result.bodyPalaceBranch,
      bureau: result.bureau,
      stars: result.stars,
      sihua: result.sihua
    },
    external: {
      sourceA: { name: '', values: {} },
      sourceB: { name: '', values: {} }
    },
    note: '填入外部來源值後執行 tests/differential 驗證。差異不直接判錯，需分類為流派/曆法/時間基準/換日/閏月差異或 Bug。'
  };
  const outPath = join(dir, fixture.name + '.json');
  writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  console.log('wrote', outPath);
} else {
  console.log(`fixture-generator

用法:
  node tools/fixture-generator/generate.mjs golden --input "1990-05-15T10:30|male|Asia/Taipei"
  node tools/fixture-generator/generate.mjs golden --file cases.txt
  node tools/fixture-generator/generate.mjs differential --year 1990 --month 5 --day 15 --hour 10 --sex male`);
}
