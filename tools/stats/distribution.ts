#!/usr/bin/env tsx
/**
 * Distribution Report（spec Post-Stability Phase H / M8）
 *
 * 以固定間隔掃描 1900–2100 的陽曆日期，統計命盤分佈：
 *   - 五行局、命宮地支、星曜落宮頻率、廟旺分佈
 *   - 格局命中次數、certainty 分佈、小限覆蓋率
 *
 * 只做統計，不新增規則、不改 canonical。
 * 產出：research/stats/distribution.json
 * 用法：
 *   npm run stats:distribution
 *   npm run stats:distribution -- --check
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculate } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = join(root, 'research/stats');
const outPath = join(outDir, 'distribution.json');
const checkOnly = process.argv.includes('--check');

const START = Date.UTC(1900, 0, 1);
const END = Date.UTC(2100, 11, 31);
const DAY = 86_400_000;
const STEP_DAYS = 5;

interface Chartish {
  birthContext: { bureau: string };
  chart: {
    natal: { lifePalaceBranch: string; masterStar?: string; bodyStar?: string };
    palaces: Array<{ branch: string; stars: Array<{ starId: string; dignity?: string }> }>;
    patterns: Array<{ patternId: string; status: string }>;
  };
  periods: { major: unknown[]; xiaoxian?: unknown };
  certainty: Record<string, string>;
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function sortRecord(map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(map).sort()) out[key] = map[key];
  return out;
}

const bureaus: Record<string, number> = {};
const lifeBranches: Record<string, number> = {};
const starPalaceHits: Record<string, number> = {};
const dignities: Record<string, number> = {};
const patternHits: Record<string, number> = {};
const patternStatus: Record<string, number> = {};
const certaintyKeys: Record<string, number> = {};
const certaintyValues: Record<string, number> = {};

let charts = 0;
let xiaoxianCovered = 0;
let errors = 0;
const errorSamples: Array<{ date: string; targetYear: number; message: string }> = [];

for (let t = START; t <= END; t += STEP_DAYS * DAY) {
  const d = new Date(t);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  // 目標一律晚於出生：year+40，超出上限則夾到 2100（不得早於出生，engine 會 fail-close）
  const targetYear = Math.min(year + 40, 2100);
  try {
    const chart = calculate(
      {
        calendarType: 'solar',
        date: { year, month, day },
        time: { hour: 10, minute: 0 },
        timezone: 'Asia/Taipei',
        sexForCalculation: 'male'
      },
      { targetDate: { year: targetYear, month, day: Math.min(day, new Date(Date.UTC(targetYear, month, 0)).getUTCDate()), hour: 10 } }
    ) as unknown as Chartish;

    charts += 1;
    bump(bureaus, chart.birthContext.bureau);
    bump(lifeBranches, chart.chart.natal.lifePalaceBranch);
    if (chart.periods.xiaoxian) xiaoxianCovered += 1;

    for (const p of chart.chart.palaces) {
      for (const s of p.stars) {
        bump(starPalaceHits, s.starId);
        if (s.dignity) bump(dignities, s.dignity);
      }
    }
    for (const pat of chart.chart.patterns) {
      bump(patternHits, pat.patternId);
      bump(patternStatus, pat.status);
    }
    for (const [k, v] of Object.entries(chart.certainty)) {
      bump(certaintyKeys, k);
      bump(certaintyValues, v);
    }
  } catch (err) {
    errors += 1;
    if (errorSamples.length < 20) {
      errorSamples.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, targetYear, message: (err as Error).message });
    }
  }
}

const starTop = Object.entries(starPalaceHits)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 30)
  .map(([starId, placements]) => ({ starId, placements }));

const report = {
  reportVersion: '1.0.0',
  generatedBy: 'tools/stats/distribution.ts',
  note: '僅統計既有引擎輸出，不新增規則、不改 canonical；用於偵測極端分佈與覆蓋率缺口。',
  corpus: {
    from: '1900-01-01',
    to: '2100-12-31',
    stepDays: STEP_DAYS,
    time: '10:00',
    timezone: 'Asia/Taipei',
    sex: 'male',
    targetDate: 'birth +40 年（夾到 2100 上限）',
    charts,
    errors,
    errorSamples
  },
  bureauDistribution: sortRecord(bureaus),
  lifePalaceBranchDistribution: sortRecord(lifeBranches),
  starPlacementTotals: { distinctStars: Object.keys(starPalaceHits).length, top30: starTop },
  dignityDistribution: sortRecord(dignities),
  patternHits: sortRecord(patternHits),
  patternStatus: sortRecord(patternStatus),
  certainty: {
    keys: sortRecord(certaintyKeys),
    values: sortRecord(certaintyValues),
    xiaoxianCovered,
    xiaoxianCoverage: charts ? +(xiaoxianCovered / charts).toFixed(6) : 0
  }
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (checkOnly) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('distribution report FAILED — research/stats/distribution.json drift');
    process.exit(1);
  }
  console.log(`distribution report OK — ${charts} charts, ${Object.keys(starPalaceHits).length} distinct stars, no drift`);
  process.exit(0);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, serialized, 'utf8');
console.log(`distribution report written — ${charts} charts, errors=${errors}, distinct stars=${Object.keys(starPalaceHits).length}`);
console.log('bureaus', JSON.stringify(report.bureauDistribution));
console.log('xiaoxian coverage', report.certainty.xiaoxianCoverage);
