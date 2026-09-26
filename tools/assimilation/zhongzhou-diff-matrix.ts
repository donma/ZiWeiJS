#!/usr/bin/env tsx
/**
 * 中州 Diff Matrix（spec Post-Stability §13.1 / M5）
 *
 * 依 §13.1 之 12 個維度，逐維度並列：
 *   - ziweiCanonical：本庫 canonical 之實際輸出（實跑引擎，非描述）
 *   - ziweiZhongzhouProfile：本庫 school-zhongzhou profile 之實際輸出
 *   - iztroZhongzhou：iztro 2.6.1 `config({ algorithm: 'zhongzhou' })` 之實際輸出（MIT，僅比對行為）
 *   - fortel：未安裝、未執行 → 一律 null（不臆測、不引用未查證之敘述）
 *   - independentEvidence：本維度目前有無獨立古典依據（現階段全為空，見 classical-verification.md）
 *   - decision：research / variant-only / not-modeled
 *
 * 產出：research/assimilation/fortel/zhongzhou-diff.json
 * 用法：
 *   npm run assimilation:zhongzhou-diff
 *   npm run assimilation:zhongzhou-diff -- --check
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { calculate } from '../../src/reference-engine/engine.js';
import { getStarRegistryEntry, BRANCH_ZH } from '../../src/index.js';
import type { BranchId, ZiWeiBirthInput, ZiWeiChart } from '../../src/index.js';
import { iztroTimeIndex } from '../differential-runner/iztro-compare.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const { astro } = require('iztro');

const outDir = join(root, 'research/assimilation/fortel');
const outPath = join(outDir, 'zhongzhou-diff.json');
const checkOnly = process.argv.includes('--check');

const IZTRO_SRC = {
  soul: 'node_modules/iztro/lib/astro/astro.js:210-212',
  suiqian12: 'node_modules/iztro/lib/star/decorativeStar.js:193-211',
  tianshiTianshang: 'node_modules/iztro/lib/star/location.js:673-689',
  jiekong: 'node_modules/iztro/lib/star/adjectiveStar.js:57-68'
} as const;

interface Probe {
  id: string;
  solarDate: string;
  hour: number;
  gender: 'male' | 'female';
}

const PROBES: Probe[] = [
  { id: 'P1', solarDate: '1990-05-15', hour: 10, gender: 'male' },
  { id: 'P2', solarDate: '1984-02-03', hour: 23, gender: 'female' },
  { id: 'P3', solarDate: '2000-12-31', hour: 6, gender: 'male' }
];

interface IztroStar { name: string; mutagen?: string }
interface IztroPalace {
  name?: string;
  earthlyBranch?: string;
  majorStars?: IztroStar[];
  minorStars?: IztroStar[];
  adjectiveStars?: IztroStar[];
  suiqian12?: string;
  decadal?: { range?: [number, number] };
}
interface IztroChart {
  soul?: string;
  body?: string;
  fiveElementsClass?: string;
  palaces: IztroPalace[];
}

interface Side {
  soul: string | null;
  body: string | null;
  bureau: string | null;
  suiqian12ByBranch: string[];
  tianshi: string | null;
  tianshang: string | null;
  jiekongLike: string[];
  kongwangLike: string[];
  mutagenForStem: Record<string, string> | null;
  majorRanges: Array<[number, number]>;
  placedStars: string[];
}

function ourChart(probe: Probe, profile: string): ZiWeiChart {
  const input: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: Number(probe.solarDate.slice(0, 4)), month: Number(probe.solarDate.slice(5, 7)), day: Number(probe.solarDate.slice(8, 10)) },
    time: { hour: probe.hour, minute: 0 },
    timezone: 'Asia/Taipei',
    sexForCalculation: probe.gender
  };
  return calculate(input, { profile }) as ZiWeiChart;
}

const BRANCH_ORDER: BranchId[] = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
const BRANCH_ZH_TO_ID = new Map<string, BranchId>(BRANCH_ORDER.map(b => [BRANCH_ZH[b], b]));
const MUTAGEN_ID: Record<string, string> = { '禄': 'lu', '祿': 'lu', '權': 'quan', '科': 'ke', '忌': 'ji' };

function starName(starId: string): string {
  return getStarRegistryEntry(starId)?.name['zh-TW'] ?? starId;
}

function ourSide(chart: ZiWeiChart): Side {
  const branchOf = (palaceId: string) => chart.chart.palaces.find(p => p.id === palaceId)?.branch;
  const placed = Object.values(chart.chart.stars).map(s => s.star.name['zh-TW'] ?? s.starId).sort();
  const starsByName = new Map<string, string>();
  for (const s of Object.values(chart.chart.stars)) starsByName.set(s.star.name['zh-TW'] ?? s.starId, s.palaceId);

  const sihua: Record<string, string> = {};
  for (const tr of chart.chart.transformations) {
    if (tr.sourceScope !== 'natal') continue;
    const name = chart.chart.stars[tr.targetStarId]?.star.name['zh-TW'] ?? tr.targetStarId;
    sihua[tr.type] = name;
  }

  const findPalace = (name: string): string | null => {
    const p = starsByName.get(name);
    if (!p) return null;
    return branchOf(p) ?? null;
  };

  return {
    soul: chart.chart.natal.masterStar ? starName(chart.chart.natal.masterStar) : null,
    body: chart.chart.natal.bodyStar ? starName(chart.chart.natal.bodyStar) : null,
    bureau: chart.birthContext.bureauName['zh-TW'] ?? null,
    suiqian12ByBranch: [],
    tianshi: findPalace('天使'),
    tianshang: findPalace('天傷'),
    jiekongLike: starsByName.has('截空') ? ['截空'] : [],
    kongwangLike: ['旬空', '空亡'].filter(n => starsByName.has(n)),
    mutagenForStem: Object.keys(sihua).length ? sihua : null,
    majorRanges: [...chart.periods.major].sort((a, b) => a.fromAge - b.fromAge).slice(0, 3).map(p => [p.fromAge, p.toAge] as [number, number]),
    placedStars: placed
  };
}

function iztroSide(probe: Probe, algorithm: 'default' | 'zhongzhou', cycleNames: string[]): Side {
  astro.config({ algorithm });
  const chart = astro.bySolar(probe.solarDate, iztroTimeIndex(probe.hour), probe.gender, true, 'zh-TW') as unknown as IztroChart;

  const byBranch = new Map<string, string>();
  const mutagens: Record<string, string> = {};
  const placed: string[] = [];
  const majorRanges: Array<[number, number]> = [];
  let tianshi: string | null = null;
  let tianshang: string | null = null;
  const jiekongLike: string[] = [];
  const kongwangLike: string[] = [];

  for (const p of chart.palaces) {
    const branch = BRANCH_ZH_TO_ID.get(p.earthlyBranch ?? '') ?? (p.earthlyBranch as BranchId);
    if (p.suiqian12) byBranch.set(branch, p.suiqian12);
    if (p.decadal?.range) majorRanges.push([p.decadal.range[0], p.decadal.range[1]]);
    for (const s of [...(p.majorStars ?? []), ...(p.minorStars ?? []), ...(p.adjectiveStars ?? [])]) {
      placed.push(s.name);
      if (s.mutagen) mutagens[MUTAGEN_ID[s.mutagen.slice(0, 1)] ?? s.mutagen] = s.name;
      if (s.name === '天傷') tianshang = branch;
      if (s.name === '天使') tianshi = branch;
      if (s.name === '截空' || s.name === '截路') jiekongLike.push(s.name);
      if (s.name === '空亡' || s.name === '旬空') kongwangLike.push(s.name);
    }
  }

  return {
    soul: chart.soul ?? null,
    body: chart.body ?? null,
    bureau: chart.fiveElementsClass ?? null,
    suiqian12ByBranch: BRANCH_ORDER.map(b => byBranch.get(b) ?? '').filter(Boolean),
    tianshi,
    tianshang,
    jiekongLike: [...new Set(jiekongLike)].sort(),
    kongwangLike: [...new Set(kongwangLike)].sort(),
    mutagenForStem: Object.keys(mutagens).length ? mutagens : null,
    majorRanges: majorRanges.sort((a, b) => a[0] - b[0]).slice(0, 3),
    placedStars: [...new Set(placed)].sort()
  };
}

function cycleNames(): string[] {
  const file = join(root, 'tables/cycles/suiqian.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as { entries: Array<{ name: Record<string, string> }> };
  return data.entries.map(e => e.name['zh-TW'] ?? '');
}

const cycles = cycleNames();

const probes = PROBES.map(p => {
  const canonical = ourSide(ourChart(p, 'canonical'));
  const zhongzhou = ourSide(ourChart(p, 'school-zhongzhou'));
  const iztroDefault = iztroSide(p, 'default', cycles);
  const iztroZz = iztroSide(p, 'zhongzhou', cycles);
  return {
    probeId: p.id,
    input: { solarDate: p.solarDate, hour: p.hour, gender: p.gender },
    ziweiCanonical: canonical,
    ziweiZhongzhouProfile: zhongzhou,
    iztroDefault,
    iztroZhongzhou: iztroZz
  };
});

const pick = <T>(fn: (s: Side) => T) => probes.map(p => fn(p.ziweiCanonical));
const pickIztro = <T>(fn: (s: Side) => T) => probes.map(p => fn(p.iztroZhongzhou));

function differs(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

const zzSuiqian = pickIztro(s => s.suiqian12ByBranch);
const defSuiqian = probes.map(p => p.iztroDefault.suiqian12ByBranch);
const suiqianNameDiff = (() => {
  const zz = new Set(zzSuiqian.flat());
  const def = new Set(defSuiqian.flat());
  return {
    onlyInZhongzhou: [...zz].filter(n => !def.has(n)).sort(),
    onlyInDefault: [...def].filter(n => !zz.has(n)).sort(),
    differsFromDefault: differs(zzSuiqian, defSuiqian)
  };
})();

const starDiff = probes.map(p => {
  const ours = new Set(p.ziweiCanonical.placedStars);
  const theirs = new Set(p.iztroZhongzhou.placedStars);
  return {
    probeId: p.probeId,
    ziweiCount: ours.size,
    iztroZhongzhouCount: theirs.size,
    onlyInZiwei: [...ours].filter(n => !theirs.has(n)).sort(),
    onlyInIztroZhongzhou: [...theirs].filter(n => !ours.has(n)).sort()
  };
});

const dimensions = [
  {
    dimension: 'soul',
    label: '命主',
    ziweiCanonical: { modeled: true, by: 'chart.chart.natal.masterStar', values: pick(s => s.soul) },
    ziweiZhongzhouProfile: { values: probes.map(p => p.ziweiZhongzhouProfile.soul) },
    iztroZhongzhou: { modeled: true, source: IZTRO_SRC.soul, values: pickIztro(s => s.soul) },
    fortel: null,
    independentEvidence: ['EVD.IZTRO.ZHONGZHOU.MASTER_STAR', 'EVD.SHUNSHI.SOUL_STAR_METHODS'],
    agreement: differs(pick(s => s.soul), pickIztro(s => s.soul)) ? 'differs' : 'matches',
    decision: 'variant',
    note: '已實作變體規則 ZW.CALC.PALACE.MASTER.V_ZHONGZHOU.001（依生年支取命主）並於 school-zhongzhou 啟用；與 iztro 中州演算法完全一致。'
  },
  {
    dimension: 'body',
    label: '身主',
    ziweiCanonical: { modeled: true, by: 'chart.chart.natal.bodyStar', values: pick(s => s.body) },
    ziweiZhongzhouProfile: { values: probes.map(p => p.ziweiZhongzhouProfile.body) },
    iztroZhongzhou: { modeled: true, source: 'node_modules/iztro/lib/astro/astro.js:226', values: pickIztro(s => s.body) },
    fortel: null,
    independentEvidence: [],
    agreement: differs(pick(s => s.body), pickIztro(s => s.body)) ? 'differs' : 'matches',
    decision: 'research',
    note: 'iztro 兩種 algorithm 之身主皆取年支（原始碼僅命主有中州分支）；本庫身主實作與其一致與否見 agreement。'
  },
  {
    dimension: 'tianshi-tianshang',
    label: '天使 / 天傷',
    ziweiCanonical: { modeled: true, values: pick(s => ({ tianshi: s.tianshi, tianshang: s.tianshang })) },
    ziweiZhongzhouProfile: { values: probes.map(p => ({ tianshi: p.ziweiZhongzhouProfile.tianshi, tianshang: p.ziweiZhongzhouProfile.tianshang })) },
    iztroZhongzhou: {
      modeled: true,
      source: IZTRO_SRC.tianshiTianshang,
      values: pickIztro(s => ({ tianshi: s.tianshi, tianshang: s.tianshang })),
      defaultAlgorithmValues: probes.map(p => ({ tianshi: p.iztroDefault.tianshi, tianshang: p.iztroDefault.tianshang }))
    },
    fortel: null,
    independentEvidence: ['EVD.IZTRO.ZHONGZHOU.TIANSHI_TIANSHANG', 'EVD.SHUNSHI.TIANSHI_TIANSHANG'],
    agreement: differs(pick(s => `${s.tianshi}/${s.tianshang}`), pickIztro(s => `${s.tianshi}/${s.tianshang}`)) ? 'differs' : 'matches',
    decision: 'variant',
    note: '已實作變體規則 ZW.CALC.STAR.FIXED.V_ZHONGZHOU.001（陰男陽女天傷天使對調）並於 school-zhongzhou 啟用；與 iztro 中州演算法完全一致。'
  },
  {
    dimension: 'kui-yue',
    label: '魁鉞',
    ziweiCanonical: { modeled: true, values: pick(s => s.placedStars.filter(n => n === '天魁' || n === '天鉞')) },
    ziweiZhongzhouProfile: { values: probes.map(p => p.ziweiZhongzhouProfile.placedStars.filter(n => n === '天魁' || n === '天鉞')) },
    iztroZhongzhou: { modeled: true, values: pickIztro(s => s.placedStars.filter(n => n === '天魁' || n === '天鉞')) },
    fortel: null,
    independentEvidence: [],
    agreement: 'unknown',
    decision: 'research',
    note: '僅比對「是否存在」；安法（年干）差異未在本次 probe 中顯現，需專門案例與中州派來源。'
  },
  {
    dimension: 'jiekong-xunkong',
    label: '截空 / 旬空',
    ziweiCanonical: {
      modeled: 'partial',
      values: pick(s => ({ jiekongLike: s.jiekongLike, kongwangLike: s.kongwangLike })),
      note: 'registry 已登錄截空／旬空，但落盤規則尚未 canonical（見 Research Queue）。'
    },
    ziweiZhongzhouProfile: { values: probes.map(p => ({ jiekongLike: p.ziweiZhongzhouProfile.jiekongLike, kongwangLike: p.ziweiZhongzhouProfile.kongwangLike })) },
    iztroZhongzhou: {
      modeled: true,
      source: IZTRO_SRC.jiekong,
      values: pickIztro(s => ({ jiekongLike: s.jiekongLike, kongwangLike: s.kongwangLike })),
      defaultAlgorithmValues: probes.map(p => ({ jiekongLike: p.iztroDefault.jiekongLike, kongwangLike: p.iztroDefault.kongwangLike }))
    },
    fortel: null,
    independentEvidence: [],
    agreement: 'not-modeled',
    decision: 'research',
    note: 'iztro 中州派不安截路／空亡，改安截空（並加劫殺／大耗等），名稱與範圍與通用派不同（spec §37 已列同名異義）。'
  },
  {
    dimension: 'suiqian-12',
    label: '歲前十二神名稱',
    ziweiCanonical: {
      modeled: 'catalog-only',
      values: cycles,
      note: 'tables/cycles/suiqian.json 已登錄名稱，尚未落盤（無 placement rule）。'
    },
    ziweiZhongzhouProfile: { values: cycles },
    iztroZhongzhou: {
      modeled: true,
      source: IZTRO_SRC.suiqian12,
      values: zzSuiqian,
      defaultAlgorithmValues: defSuiqian,
      differsFromDefault: suiqianNameDiff.differsFromDefault,
      nameSetDiff: { onlyInZhongzhou: suiqianNameDiff.onlyInZhongzhou, onlyInDefault: suiqianNameDiff.onlyInDefault }
    },
    fortel: null,
    independentEvidence: [],
    agreement: 'unknown',
    decision: 'research',
    note: 'iztro 中州派之第 11 位名稱（大耗 ↔ 歲破）與通用派不同；本庫名稱表需明確標注流派後方可落盤。'
  },
  {
    dimension: 'sihua-table',
    label: '四化表',
    ziweiCanonical: { modeled: true, by: 'ZW.CALC.SIHUA.TABLE.001', values: pick(s => s.mutagenForStem) },
    ziweiZhongzhouProfile: {
      by: 'ZW.CALC.SIHUA.TABLE.V001',
      values: probes.map(p => p.ziweiZhongzhouProfile.mutagenForStem),
      differsFromCanonical: differs(pick(s => s.mutagenForStem), probes.map(p => p.ziweiZhongzhouProfile.mutagenForStem))
    },
    iztroZhongzhou: { modeled: true, source: 'node_modules/iztro/lib/astro/astro.js:83-112', values: pickIztro(s => s.mutagenForStem) },
    fortel: null,
    independentEvidence: [],
    agreement: differs(pick(s => s.mutagenForStem), pickIztro(s => s.mutagenForStem)) ? 'differs' : 'matches',
    decision: 'variant-only',
    note: '本庫已有中州派四化表 variant（庚干）；iztro 之 algorithm 是否切換四化表以實測為準。'
  },
  {
    dimension: 'star-existence',
    label: '星曜存在 / 不存在',
    ziweiCanonical: { modeled: true, by: 'chart.chart.stars（canonical 落盤）', values: starDiff.map(d => ({ probeId: d.probeId, count: d.ziweiCount })) },
    ziweiZhongzhouProfile: { values: starDiff.map(d => ({ probeId: d.probeId, count: d.ziweiCount })) },
    iztroZhongzhou: { modeled: true, values: starDiff.map(d => ({ probeId: d.probeId, count: d.iztroZhongzhouCount })) },
    fortel: null,
    independentEvidence: [],
    agreement: starDiff.some(d => d.onlyInZiwei.length || d.onlyInIztroZhongzhou.length) ? 'differs' : 'matches',
    decision: 'research',
    note: '僅作 Gap Detector：列出單側存在之星名（禁止字面自動合併，須走 alias registry / spec §22）。',
    interpretation: {
      onlyInZiweiAreCycleDeities:
        'onlyInZiwei 幾乎全為年系／將系十二神（歲建、將星、亡神…）——本庫將其視為星曜，iztro 另以 suiqian12 / jiangqian12 欄位暴露，屬呈現方式差異，非真實缺星。',
      onlyInIztroZhongzhou:
        'iztro 中州額外落 天巫／天才／天壽 與 劫殺。前三者本庫已完成 negative finding（查無古典依據，見 research/assimilation/classical-verification.md）；「劫殺」與本庫「劫煞」需 Alias Audit（禁自動合併）。',
      yearJie: 'iztro 之「年解」即本庫 canonical「解神」（aliases 含年解），屬名稱對齊問題。'
    },
    diff: starDiff
  },
  {
    dimension: 'brightness',
    label: '廟旺',
    ziweiCanonical: { modeled: 'partial', by: 'tables/dignity/brightness.json', values: [] },
    ziweiZhongzhouProfile: { values: [] },
    iztroZhongzhou: { modeled: true, source: 'node_modules/iztro/lib/astro/astro.js:83-112 (brightness config)', values: [] },
    fortel: null,
    independentEvidence: [],
    agreement: 'unknown',
    decision: 'research',
    note: '本庫廟旺表尚未整表核對（variant catalog 已列）；iztro 之 brightness 表屬實作來源，需古典依據。'
  },
  {
    dimension: 'leap-month',
    label: '閏月',
    ziweiCanonical: { modeled: true, by: 'profile.leapMonthPolicy', values: ['same-as-normal'] },
    ziweiZhongzhouProfile: { values: ['same-as-normal'] },
    iztroZhongzhou: { modeled: true, source: 'iztro config.algorithm', values: [] },
    fortel: null,
    independentEvidence: [],
    agreement: 'unknown',
    decision: 'research',
    note: '本庫 leapMonthPolicy 之 split / mid-month / next-month 尚未實作（見 profile gap audit）。'
  },
  {
    dimension: 'major-period',
    label: '大限',
    ziweiCanonical: { modeled: true, values: pick(s => s.majorRanges) },
    ziweiZhongzhouProfile: { values: probes.map(p => p.ziweiZhongzhouProfile.majorRanges) },
    iztroZhongzhou: { modeled: true, values: pickIztro(s => s.majorRanges) },
    fortel: null,
    independentEvidence: [],
    agreement: differs(pick(s => s.majorRanges), pickIztro(s => s.majorRanges)) ? 'needs-review' : 'matches',
    decision: 'research',
    note: '僅比對前三個大限範圍（起迄虛歲），未比對起運與童限細節。'
  },
  {
    dimension: 'dynamic-stars',
    label: '流曜',
    ziweiCanonical: { modeled: 'partial', by: 'period plan (流曜 candidate)', values: [] },
    ziweiZhongzhouProfile: { values: [] },
    iztroZhongzhou: { modeled: true, source: 'iztro horoscope()', values: [] },
    fortel: null,
    independentEvidence: [],
    agreement: 'not-probed',
    decision: 'research',
    note: '本次 probe 未帶 targetDate，故不比較流曜；動態流曜需先取得古典依據（spec §9）。'
  }
];

const report = {
  matrixVersion: '1.0.0',
  generatedBy: 'tools/assimilation/zhongzhou-diff-matrix.ts',
  specRef: 'ai-guide/ZiWeiJS-Post-Stability-External-Strength-Assimilation-SPEC-v1.md §13.1 / M5',
  method:
    '全部數值皆為實跑輸出：本庫 calculate()（canonical 與 school-zhongzhou 兩個 profile）' +
    '與 iztro 2.6.1 astro.bySolar()（algorithm=default / zhongzhou）。未執行之來源（fortel）一律 null，不臆測。',
  external: {
    iztro: { version: '2.6.1', license: 'MIT', usage: 'differential oracle（僅比對行為，未複製程式碼）' },
    fortel: { available: false, reason: '未安裝、未執行；僅存在 capability-inventory 快照，不得作為數值來源。' }
  },
  probes: PROBES.map(p => ({ id: p.id, solarDate: p.solarDate, hour: p.hour, gender: p.gender, timezone: 'Asia/Taipei' })),
  dimensions,
  decisions: {
    research: dimensions.filter(d => d.decision === 'research').length,
    variantOnly: dimensions.filter(d => d.decision === 'variant-only').length,
    note: 'decision=research：需獨立古典／中州派來源方可升級為 variant rule；本矩陣不改變任何 canonical 規則。'
  },
  probeResults: probes
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (checkOnly) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('zhongzhou diff matrix FAILED — research/assimilation/fortel/zhongzhou-diff.json drift');
    process.exit(1);
  }
  console.log(`zhongzhou diff matrix OK — ${dimensions.length} dimensions, ${probes.length} probes, no drift`);
  process.exit(0);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, serialized, 'utf8');
console.log(`zhongzhou diff matrix written — ${dimensions.length} dimensions × ${probes.length} probes`);
for (const d of dimensions) console.log(`  ${d.dimension}: ${d.agreement} / ${d.decision}`);
