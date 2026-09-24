import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { calculate, supplementaryAuxStars } from '../../src/index.js';
import type { BranchId, TargetDate, ZiWeiBirthInput } from '../../src/index.js';
import { IZTRO_CASES, iztroTimeIndex, profileForCase } from '../../tools/differential-runner/iztro-compare.js';

/**
 * 補充星曜 differential：與 SRC.IZTRO（實作觀點，Tier 3）交叉比對。
 *
 * 比對對象（三者自 0.5.0 起為 canonical，規則見 rules/calculation/stars/aux-taifu-fenggao-jieshen.json）：
 *   - 台輔（iztro `台輔`）
 *   - 封誥（iztro `封誥`）
 *   - 解神（本引擎採《全書》年解；iztro 之 `年解` 為同一安法）
 * 註：iztro 另有 `解神`（月解），與本引擎解神不同義，故不納入比對。
 *
 * 案例來源：IZTRO_CASES + `fixtures/golden/*.json`（僅陽曆且時辰已知者），
 * 以擴大外部驗證廣度（spec §52「External validation 更廣」）。
 * 注意：iztro 為實作而非權威，本測試只證明「兩實作一致」，不構成 canonical 依據。
 */
const require = createRequire(import.meta.url);
const { astro } = require('iztro') as {
  astro: { bySolar(date: string, timeIndex: number, gender: string, fixLeap: boolean, locale: string): unknown };
};

/** IZTRO_CASES + golden fixtures（陽曆、時辰已知），依日期去重 */
function allCases(): ZiWeiBirthInput[] {
  const out: ZiWeiBirthInput[] = [...IZTRO_CASES];
  const seen = new Set(out.map(c => `${c.date.year}-${c.date.month}-${c.date.day}-${c.time?.hour}-${c.sexForCalculation}`));
  const dir = join(process.cwd(), 'fixtures/golden');
  let names: string[] = [];
  try { names = readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return out; }
  for (const f of names) {
    try {
      const input = (JSON.parse(readFileSync(join(dir, f), 'utf8')).input ?? null) as ZiWeiBirthInput | null;
      if (!input || input.calendarType !== 'solar' || input.time?.hour === undefined) continue;
      const key = `${input.date.year}-${input.date.month}-${input.date.day}-${input.time.hour}-${input.sexForCalculation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(input);
    } catch { /* 略過無法解析者 */ }
  }
  return out;
}

const CASES = allCases();

/**
 * 可與 iztro 直接比對者：iztro ySolar() 不接受經度／真太陽時，
 * 故排除 	imeConvention !== 'civil' 或有 location（真太陽時）之案例；
 * 這些案例由 golden v2 的 oracle 負責驗證（見 fixtures/golden/golden-truesolar-rollforward.json）。
 */
const CIVIL_CASES = CASES.filter(input => {
  const { profile } = profileForCase(input);
  const chart = calculate(input, { profile });
  return chart.calendar.timeConvention === 'civil' && !input.location;
});

const ZH_TO_BRANCH: Record<string, BranchId> = {
  子: 'zi', 丑: 'chou', 寅: 'yin', 卯: 'mao', 辰: 'chen', 巳: 'si',
  午: 'wu', 未: 'wei', 申: 'shen', 酉: 'you', 戌: 'xu', 亥: 'hai'
};

function solarTarget(iso: string): TargetDate {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

interface IztroPalace {
  earthlyBranch: string;
  minorStars?: Array<{ name: string }>;
  adjectiveStars?: Array<{ name: string }>;
}

function iztroStarBranches(astrolabe: { palaces: IztroPalace[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of astrolabe.palaces) {
    const branch = ZH_TO_BRANCH[p.earthlyBranch] ?? p.earthlyBranch;
    for (const s of [...(p.minorStars ?? []), ...(p.adjectiveStars ?? [])]) {
      out[s.name] = branch;
    }
  }
  return out;
}

interface Row {
  label: string;
  star: string;
  bible: string;
  external: string;
  match: boolean;
}

const rows: Row[] = [];

for (const input of CIVIL_CASES) {
  const { profile } = profileForCase(input);
  const chart = calculate(input, { profile });
  const hourBranch = chart.calendar.hourBranch as BranchId;
  const yearBranch = chart.calendar.ganzhi.year.branch as BranchId;

  const ours: Record<string, string> = {};
  for (const p of supplementaryAuxStars({ hourBranch, yearBranch })) ours[p.starId] = p.branch;

  const hour = input.time?.hour ?? 12;
  const dateStr = `${input.date.year}-${input.date.month}-${input.date.day}`;
  const gender = input.sexForCalculation === 'female' ? 'female' : 'male';
  const a = astro.bySolar(dateStr, iztroTimeIndex(hour), gender, true, 'zh-TW') as { palaces: IztroPalace[] };
  const ext = iztroStarBranches(a);

  const label = `${dateStr} ${hour}時`;
  const pairs: Array<[string, string, string]> = [
    ['台輔', 'ZW.STAR.AUX.TAIFU', '台輔'],
    ['封誥', 'ZW.STAR.AUX.FENGGAO', '封誥'],
    ['年解', 'ZW.STAR.AUX.JIESHEN', '年解']
  ];
  for (const [star, oursId, extName] of pairs) {
    const bible = ours[oursId];
    const external = ext[extName];
    rows.push({ label, star, bible, external, match: bible === external });
  }
}

describe('differential: 補充星曜 / 小限 vs iztro', () => {
  it('三個星曜在全部案例皆取得外部值（無 empty）', () => {
    expect(rows.length).toBe(CIVIL_CASES.length * 3);
    expect(CIVIL_CASES.length).toBeGreaterThanOrEqual(25);
    expect(CASES.length).toBeGreaterThan(CIVIL_CASES.length);
    expect(rows.filter(r => !r.external)).toEqual([]);
  });

  it('台輔／封誥／年解 與 iztro 100% 一致', () => {
    const mismatches = rows.filter(r => !r.match);
    expect(
      mismatches.map(r => `${r.label} ${r.star}: bible=${r.bible} iztro=${r.external}`)
    ).toEqual([]);
  });

  it('小限（虛歲 + 宮位）與 iztro `horoscope().age` 100% 一致', () => {
    const mismatches: string[] = [];
    const targetErrors: string[] = [];
    let compared = 0;
    let missingExternalBranch = 0;
    for (const input of CIVIL_CASES) {
      const { profile } = profileForCase(input);
      const hour = input.time?.hour ?? 12;
      const dateStr = `${input.date.year}-${input.date.month}-${input.date.day}`;
      const gender = input.sexForCalculation === 'female' ? 'female' : 'male';
      const a = astro.bySolar(dateStr, iztroTimeIndex(hour), gender, true, 'zh-TW') as {
        horoscope(target: string): { age?: { nominalAge?: number; earthlyBranch?: string } };
      };
      for (const target of ['2026-09-24', '2031-03-15']) {
        const label = `${dateStr} ${hour}時 @${target}`;
        let chart;
        try {
          chart = calculate(input, { targetDate: solarTarget(target), profile });
        } catch (err) {
          // 目標早於出生（未來出生案例）：應為 fail-close 之具名錯誤，不得是其他例外
          const code = (err as { code?: string }).code;
          targetErrors.push(`${label}: ${code ?? (err as Error).message}`);
          continue;
        }
        const ours = chart.periods.xiaoxian;
        const ext = a.horoscope(target).age;
        const extBranch = ext?.earthlyBranch ? ZH_TO_BRANCH[ext.earthlyBranch] : undefined;
        compared += 1;
        if (!ours) { mismatches.push(`${label}: bible 無小限`); continue; }
        if (ours.age !== ext?.nominalAge) {
          mismatches.push(`${label}: age bible=${ours.age} iztro=${ext?.nominalAge}`);
        }
        // iztro 於極端虛歲（如 1900 年出生 @2026）可能不提供 branch；缺外部值時不比對（非不一致）
        if (extBranch !== undefined && ours.branch !== extBranch) {
          mismatches.push(`${label}: branch bible=${ours.branch} iztro=${extBranch}`);
        }
        if (extBranch === undefined) missingExternalBranch += 1;
      }
    }
    expect(compared).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
    expect(missingExternalBranch).toBeLessThan(compared);
    // 未來出生案例僅能因 fail-close 而略過（無其他例外）
    for (const e of targetErrors) expect(e).toContain('INVALID_TARGET_DATE');
  });
});
