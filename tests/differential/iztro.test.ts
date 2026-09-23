import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { calculate, DIFFERENTIAL_CLASS_ZH } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import {
  compareIztro, snapshotEngine, snapshotIztro, summarize,
  profileForCase, iztroTimeIndex, IZTRO_CASES
} from '../../tools/differential-runner/iztro-compare.js';

const require = createRequire(import.meta.url);
const { astro } = require('iztro') as {
  astro: { bySolar(date: string, timeIndex: number, gender: string, fixLeap: boolean, locale: string): unknown };
};

/** 每個案例中「外部來源可比對」的欄位數（命身宮 2 + 五行局 1 + 星曜 35 + 四化 4） */
const MIN_MATCH_PER_CASE = 30;

/** 全體案例的非空欄位吻合率下限 */
const MIN_MATCH_RATE = 0.75;

interface CaseResult {
  input: ZiWeiBirthInput;
  rows: ReturnType<typeof compareIztro>;
}

function runCase(input: ZiWeiBirthInput): CaseResult {
  const { profile, dayBoundaryVariance } = profileForCase(input);
  const chart = calculate(input, { profile });
  const engine = snapshotEngine(chart);

  const hour = input.time?.hour ?? 12;
  const dateStr = `${input.date.year}-${input.date.month}-${input.date.day}`;
  const gender = input.sexForCalculation === 'female' ? 'female' : 'male';
  const a = astro.bySolar(dateStr, iztroTimeIndex(hour), gender, true, 'zh-TW');
  const iztro = snapshotIztro(a as never);

  return { input, rows: compareIztro(engine, iztro, { dayBoundaryVariance }) };
}

const results = IZTRO_CASES.map(runCase);

describe('differential: iztro 對照', () => {
  it('案例集涵蓋 ≥ 7 組、且每組欄位數一致', () => {
    expect(results.length).toBeGreaterThanOrEqual(7);
    const widths = new Set(results.map(r => r.rows.length));
    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeGreaterThanOrEqual(40);
  });

  it('命宮／身宮／五行局 與 iztro 完全一致（布星共識）', () => {
    for (const { input, rows } of results) {
      const label = `${input.date.year}-${input.date.month}-${input.date.day} ${input.time?.hour}時`;
      for (const field of ['命宮', '身宮', '五行局']) {
        const row = rows.find(r => r.field === field)!;
        expect(row.bible, `${label} ${field}`).toBe(row.external);
      }
    }
  });

  it('十四主星 與 iztro 完全一致', () => {
    for (const { input, rows } of results) {
      const label = `${input.date.year}-${input.date.month}-${input.date.day} ${input.time?.hour}時`;
      const majors = rows.filter(r => r.field.startsWith('MAJOR.'));
      expect(majors.length).toBe(14);
      for (const r of majors) {
        expect(r.bible, `${label} ${r.field}`).toBe(r.external);
      }
    }
  });

  it('無未分類差異，且所有差異皆屬 spec §29.2 分類', () => {
    const allowed = new Set(Object.keys(DIFFERENTIAL_CLASS_ZH));
    for (const { input, rows } of results) {
      const label = `${input.date.year}-${input.date.month}-${input.date.day}`;
      for (const r of rows.filter(x => x.status === 'needs-review')) {
        expect(r.classification, `${label} ${r.field} 缺分類`).toBeTruthy();
        expect(allowed.has(r.classification!), `${label} ${r.field} 非法分類`).toBe(true);
        expect(r.classification).not.toBe('unclassified');
      }
    }
  });

  it('目前無任何需人工檢視的差異（不得為 bug 分類）', () => {
    const bugs: string[] = [];
    for (const { input, rows } of results) {
      const label = `${input.date.year}-${input.date.month}-${input.date.day}`;
      for (const r of rows) {
        if (r.status === 'needs-review' && r.classification === 'bug') bugs.push(`${label} ${r.field}`);
      }
    }
    expect(bugs).toEqual([]);
  });

  it('每案例吻合欄位數 ≥ 門檻', () => {
    for (const { input, rows } of results) {
      const label = `${input.date.year}-${input.date.month}-${input.date.day}`;
      const s = summarize(rows);
      expect(s.match, `${label} 吻合數過低`).toBeGreaterThanOrEqual(MIN_MATCH_PER_CASE);
    }
  });

  it('整體非空欄位吻合率 ≥ 門檻', () => {
    let match = 0;
    let nonEmpty = 0;
    for (const { rows } of results) {
      for (const r of rows) {
        if (r.status === 'empty') continue;
        nonEmpty++;
        if (r.status === 'match') match++;
      }
    }
    const rate = match / nonEmpty;
    expect(rate).toBeGreaterThanOrEqual(MIN_MATCH_RATE);
    expect(match).toBe(nonEmpty);
  });

  it('晚子時案例以傳統子初換日 profile 對齊，差異歸類為換日差異', () => {
    const lateCases = results.filter(r => r.input.time?.hour === 23);
    expect(lateCases.length).toBeGreaterThan(0);
    for (const { rows } of lateCases) {
      for (const r of rows.filter(x => x.status === 'needs-review')) {
        expect(r.classification).toBe('day-boundary-variance');
      }
    }
  });
});
