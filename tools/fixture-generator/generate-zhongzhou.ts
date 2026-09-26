#!/usr/bin/env tsx
/**
 * Zhongzhou Golden Fixtures 產生器（spec 0.6 §38）。
 *
 * 每個 fixture 記錄「同一輸入在 canonical 與 school-zhongzhou 兩個 profile 下的
 * 預期差異」，涵蓋維度：
 *   - sihua（庚干四化）
 *   - masterStar（命主：命宮地支 vs 生年支）
 *   - tianshiTianshang（天使天傷：陰男陽女對調）
 *   - voidStars（截空/旬空：canonical 與中州模式一致）
 *   - brightness（廟旺：尚未啟用中州表，兩 profile 一致）
 *
 * 外部驗證：命主/身主 以 iztro 2.6.1 `algorithm:'zhongzhou'` 實測比對；
 * 其餘維度為 engine golden（記錄 canonical ↔ zhongzhou 差異）。
 *
 * 用法：
 *   tsx tools/fixture-generator/generate-zhongzhou.ts          # 產生 fixtures/golden-zhongzhou
 *   tsx tools/fixture-generator/generate-zhongzhou.ts --check  # 重算並比對（CI）
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculate, getStarRegistryEntry } from '../../src/index.js';
import type { ZiWeiBirthInput, ZiWeiChart } from '../../src/index.js';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const OUT_DIR = join(root, 'fixtures/golden-zhongzhou');

const IZTRO_VERSION = (() => {
  try {
    const pkg = require('iztro/package.json') as { version: string };
    return pkg.version;
  } catch {
    return 'unavailable';
  }
})();

interface Case {
  name: string;
  note: string;
  input: ZiWeiBirthInput;
}

const CASES: Case[] = [
  {
    name: 'geng-wu-1990-male',
    note: '庚午年男：庚干四化差異（武曲化權/太陰化科 vs 天府化權/天相化科）；陽男不換天傷天使。',
    input: { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' }
  },
  {
    name: 'geng-wu-1990-female',
    note: '庚午年女：庚干四化差異 + 陽女（陰男陽女）→ 天傷天使對調；命主改依年支。',
    input: { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' }
  },
  {
    name: 'jia-zi-1984-female',
    note: '甲子年女：陽女 → 天傷天使對調；命主命宮（寅）與年支（子）不同。',
    input: { calendarType: 'solar', date: { year: 1984, month: 2, day: 2 }, time: { hour: 14 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' }
  },
  {
    name: 'yi-chou-1985-female',
    note: '乙丑年女：陰女不換天傷天使；命主以命宮地支為準（中州派改依年支）。',
    input: { calendarType: 'solar', date: { year: 1985, month: 11, day: 20 }, time: { hour: 14 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' }
  }
];

function starBranch(chart: ZiWeiChart, starId: string): string | null {
  const p = chart.chart.stars[starId];
  return p ? p.branch : null;
}

function palaceOfStar(chart: ZiWeiChart, starId: string): string | null {
  const p = chart.chart.stars[starId];
  return p ? p.palaceId : null;
}

function sihuaOf(chart: ZiWeiChart): Record<string, string | undefined> {
  const natal = chart.chart.transformations.filter(t => t.sourceScope === 'natal');
  const out: Record<string, string | undefined> = {};
  for (const t of natal) out[t.type] = t.targetStarId;
  return out;
}

function dignitySample(chart: ZiWeiChart): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const id of ['ZW.STAR.MAJOR.ZIWEI', 'ZW.STAR.MAJOR.TIANTONG', 'ZW.STAR.MAJOR.JUMEN']) {
    out[id] = chart.chart.palaces.flatMap(p => p.stars).find(s => s.starId === id)?.dignity;
  }
  return out;
}

function buildFixture(c: Case): Record<string, unknown> {
  const canonical = calculate(c.input, { profile: 'canonical' });
  const zhongzhou = calculate(c.input, { profile: 'school-zhongzhou' });

  const canonicalTianshi = {
    friends: palaceOfStar(canonical, 'ZW.STAR.AUX.TIANSHANG') === 'friends' ? 'ZW.STAR.AUX.TIANSHANG' : 'ZW.STAR.AUX.TIANSHI',
    health: palaceOfStar(canonical, 'ZW.STAR.AUX.TIANSHI') === 'health' ? 'ZW.STAR.AUX.TIANSHI' : 'ZW.STAR.AUX.TIANSHANG'
  };
  const zhongzhouTianshi = {
    friends: palaceOfStar(zhongzhou, 'ZW.STAR.AUX.TIANSHANG') === 'friends' ? 'ZW.STAR.AUX.TIANSHANG' : 'ZW.STAR.AUX.TIANSHI',
    health: palaceOfStar(zhongzhou, 'ZW.STAR.AUX.TIANSHI') === 'health' ? 'ZW.STAR.AUX.TIANSHI' : 'ZW.STAR.AUX.TIANSHANG'
  };

  // 外部驗證：iztro zhongzhou 模式之命主／身主
  const external: Record<string, unknown> = {
    sourceId: 'SRC.IZTRO',
    version: IZTRO_VERSION,
    dimensions: [],
    note: '命主／身主以 iztro algorithm=zhongzhou 實測比對；其餘維度為 engine golden（canonical ↔ zhongzhou 差異凍結）。'
  };
  try {
    const { astro } = require('iztro') as { astro: { config?: (o: unknown) => void; bySolar?: unknown } };
    if (astro && typeof astro.config === 'function') {
      (astro.config as (o: unknown) => void)({ algorithm: 'zhongzhou' });
      const a = (astro.bySolar as (d: string, t: number, g: string, f: boolean, l: string) => { soul?: string; body?: string })(
        `${c.input.date.year}-${c.input.date.month}-${c.input.date.day}`,
        c.input.time?.hour !== undefined ? Math.floor((c.input.time.hour + 1) / 2) % 12 : 0,
        c.input.sexForCalculation === 'female' ? 'female' : 'male',
        true,
        'zh-TW'
      );
      const nameOf = (id: string | undefined) => id ? getStarRegistryEntry(id)?.name['zh-TW'] : undefined;
      const extSoul = a.soul;
      const extBody = a.body;
      const ourSoul = nameOf(zhongzhou.chart.natal.masterStar);
      const ourBody = nameOf(zhongzhou.chart.natal.bodyStar);
      (external.dimensions as string[]).push('masterStar', 'bodyStar');
      external['iztroZhongzhou'] = { soul: extSoul, body: extBody };
      external['engineZhongzhou'] = { soul: ourSoul, body: ourBody };
      external['agreement'] = { masterStar: extSoul === ourSoul, bodyStar: extBody === ourBody };
      (astro.config as (o: unknown) => void)({ algorithm: 'default' });
    }
  } catch (e) {
    external['error'] = String(e);
  }

  return {
    generatedBy: 'tools/fixture-generator/generate-zhongzhou.ts',
    specRef: 'ai-guide/ZiWeiJS-0.6-Content-Expansion-SPEC.md §38',
    name: c.name,
    note: c.note,
    input: c.input,
    external,
    oracle: {
      canonical: {
        masterStar: canonical.chart.natal.masterStar,
        bodyStar: canonical.chart.natal.bodyStar,
        tianshiTianshang: canonicalTianshi,
        sihuaNatal: sihuaOf(canonical),
        jiekongBranch: starBranch(canonical, 'ZW.STAR.AUX.JIEKONG'),
        xunkongBranch: starBranch(canonical, 'ZW.STAR.AUX.XUNKONG'),
        brightnessSample: dignitySample(canonical)
      },
      'school-zhongzhou': {
        masterStar: zhongzhou.chart.natal.masterStar,
        bodyStar: zhongzhou.chart.natal.bodyStar,
        tianshiTianshang: zhongzhouTianshi,
        sihuaNatal: sihuaOf(zhongzhou),
        jiekongBranch: starBranch(zhongzhou, 'ZW.STAR.AUX.JIEKONG'),
        xunkongBranch: starBranch(zhongzhou, 'ZW.STAR.AUX.XUNKONG'),
        brightnessSample: dignitySample(zhongzhou)
      }
    },
    dimensions: [
      { dimension: 'sihua', canonicalRule: 'ZW.CALC.SIHUA.TABLE.001', variantRule: 'ZW.CALC.SIHUA.TABLE.V001' },
      { dimension: 'masterStar', canonicalRule: 'ZW.CALC.PALACE.MASTER.001', variantRule: 'ZW.CALC.PALACE.MASTER.V_ZHONGZHOU.001' },
      { dimension: 'tianshiTianshang', canonicalRule: 'ZW.CALC.STAR.FIXED.001', variantRule: 'ZW.CALC.STAR.FIXED.V_ZHONGZHOU.001' },
      { dimension: 'voidStars', canonicalRule: 'ZW.CALC.STAR.YEARSTEM_AUX.001', variantRule: null, note: 'canonical 已採截空＋旬空（與 iztro 中州模式一致），無 variant。' },
      { dimension: 'brightness', canonicalRule: 'ZW.CALC.DIGNITY.BRIGHTNESS.001', variantRule: null, note: '中州廟旺整表證據未足，未啟用 variant；兩 profile 目前一致。' }
    ]
  };
}

const check = process.argv.includes('--check');
mkdirSync(OUT_DIR, { recursive: true });

const generated = new Map<string, string>();
for (const c of CASES) {
  const fixture = buildFixture(c);
  generated.set(`${c.name}.json`, JSON.stringify(fixture, null, 2));
}

if (check) {
  let drift = 0;
  const existing = readdirSync(OUT_DIR).filter(f => f.endsWith('.json'));
  for (const f of existing) {
    if (!generated.has(f)) {
      console.error(`drift: extra fixture ${f}`);
      drift++;
      continue;
    }
    const disk = readFileSync(join(OUT_DIR, f), 'utf8');
    if (disk !== generated.get(f)) {
      console.error(`drift: ${f}`);
      drift++;
    }
  }
  for (const f of generated.keys()) {
    if (!existing.includes(f)) {
      console.error(`drift: missing fixture ${f}`);
      drift++;
    }
  }
  if (drift > 0) {
    console.error(`zhongzhou golden check FAILED — ${drift} drift(s)`);
    process.exit(1);
  }
  console.log(`zhongzhou golden check OK — ${generated.size} fixtures match stored oracle`);
  process.exit(0);
}

// 產生模式：清空並重寫
for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith('.json')) rmSync(join(OUT_DIR, f));
}
for (const [f, content] of generated) {
  writeFileSync(join(OUT_DIR, f), content, 'utf8');
}
console.log(`zhongzhou golden written — ${generated.size} fixtures`);
