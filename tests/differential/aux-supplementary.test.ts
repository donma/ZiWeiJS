import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { calculate, supplementaryAuxStars } from '../../src/index.js';
import type { BranchId, TargetDate, ZiWeiBirthInput } from '../../src/index.js';
import { IZTRO_CASES, iztroTimeIndex, profileForCase } from '../../tools/differential-runner/iztro-compare.js';

/**
 * Candidate 星曜 differential：與 SRC.IZTRO（實作觀點，Tier 3）交叉比對。
 *
 * 僅比對兩者皆有明確依據者：
 *   - 台輔（iztro `台輔`）
 *   - 封誥（iztro `封誥`）
 *   - 解神（本引擎採《全書》年解；iztro 之 `年解` 為同一安法）
 * 註：iztro 另有 `解神`（月解），與本引擎 candidate 解神不同義，故不納入比對。
 *
 * 注意：iztro 為實作而非權威，本測試只證明「兩實作一致」，不構成 canonical 依據。
 */
const require = createRequire(import.meta.url);
const { astro } = require('iztro') as {
  astro: { bySolar(date: string, timeIndex: number, gender: string, fixLeap: boolean, locale: string): unknown };
};

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

for (const input of IZTRO_CASES) {
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
    expect(rows.length).toBe(IZTRO_CASES.length * 3);
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
    for (const input of IZTRO_CASES) {
      const { profile } = profileForCase(input);
      const hour = input.time?.hour ?? 12;
      const dateStr = `${input.date.year}-${input.date.month}-${input.date.day}`;
      const gender = input.sexForCalculation === 'female' ? 'female' : 'male';
      const a = astro.bySolar(dateStr, iztroTimeIndex(hour), gender, true, 'zh-TW') as {
        horoscope(target: string): { age?: { nominalAge?: number; earthlyBranch?: string } };
      };
      for (const target of ['2026-09-24', '2031-03-15']) {
        const chart = calculate(input, { targetDate: solarTarget(target), profile });
        const ours = chart.periods.xiaoxian;
        const ext = a.horoscope(target).age;
        const extBranch = ext?.earthlyBranch ? ZH_TO_BRANCH[ext.earthlyBranch] : undefined;
        const label = `${dateStr} ${hour}時 @${target}`;
        if (!ours) { mismatches.push(`${label}: bible 無小限`); continue; }
        if (ours.age !== ext?.nominalAge) {
          mismatches.push(`${label}: age bible=${ours.age} iztro=${ext?.nominalAge}`);
        }
        if (ours.branch !== extBranch) {
          mismatches.push(`${label}: branch bible=${ours.branch} iztro=${extBranch}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
