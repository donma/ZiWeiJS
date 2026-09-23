import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import { snapshotEngine, compareIztro, profileForCase } from '../../tools/differential-runner/iztro-compare.js';
import type { IztroSnapshot } from '../../tools/differential-runner/iztro-compare.js';

/**
 * P1-5 Differential Fixtures（spec §12）
 *
 * 以「存檔的外部來源結果」比對，CI 不需安裝外部套件。
 * known variant → 需分類；unknown mismatch → fail。
 */
interface DiffFixture {
  name: string;
  input: ZiWeiBirthInput;
  profile: string;
  source: { id: string; version: string; package?: string };
  note: string;
  expected: {
    lifePalaceBranch: string;
    bodyPalaceBranch: string;
    bureauName: string;
    stars: Record<string, string>;
    dignity: Record<string, string>;
    sihua: Record<string, string>;
  };
}

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    // iztro-period 為限運差分 fixture，形狀不同，由 tests/differential/iztro-period.test.ts 驗證
    if (entry === 'iztro-period') continue;
    if (statSync(p).isDirectory()) out.push(...collect(p));
    else if (entry.endsWith('.json')) out.push(p);
  }
  return out;
}

const files = collect(join(process.cwd(), 'fixtures', 'differential'));
const fixtures = files.map(f => JSON.parse(readFileSync(f, 'utf8')) as DiffFixture);

describe('P1-5 differential fixtures — 結構', () => {
  it('至少 10 筆，且每筆載明外部來源與版本', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    for (const f of fixtures) {
      expect(f.input, f.name).toBeDefined();
      expect(f.expected, f.name).toBeDefined();
      expect(f.source?.id, f.name).toMatch(/^SRC\./);
      expect(f.source?.version, f.name).toBeTruthy();
      expect(f.note, f.name).toBeTruthy();
    }
  });

  it('期望值不得為空骨架', () => {
    for (const f of fixtures) {
      expect(f.expected.lifePalaceBranch, f.name).toBeTruthy();
      expect(f.expected.bodyPalaceBranch, f.name).toBeTruthy();
      expect(f.expected.bureauName, f.name).toBeTruthy();
      expect(Object.keys(f.expected.stars).length, f.name).toBeGreaterThan(20);
      expect(Object.keys(f.expected.sihua).length, f.name).toBe(4);
    }
  });
});

describe('P1-5 differential fixtures — 引擎 vs 存檔外部結果', () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const profile = f.profile || profileForCase(f.input).profile;
      const chart = calculate(f.input, { profile });
      const engine = snapshotEngine(chart);

      const stored: IztroSnapshot = {
        lifePalaceBranch: f.expected.lifePalaceBranch,
        bodyPalaceBranch: f.expected.bodyPalaceBranch,
        bureauName: f.expected.bureauName,
        stars: f.expected.stars,
        dignity: f.expected.dignity,
        sihua: f.expected.sihua
      };

      const { dayBoundaryVariance } = profileForCase(f.input);
      const rows = compareIztro(engine, stored, { dayBoundaryVariance });
      const bad = rows.filter(r => r.status === 'needs-review');

      // 所有差異都必須帶分類（known variant → report）
      for (const r of bad) {
        expect(r.classification, `${f.name} ${r.field} 缺分類`).toBeTruthy();
      }
      // unknown mismatch（bug 分類）→ fail
      expect(bad.filter(r => r.classification === 'bug').map(r => `${r.field}: ${r.bible} vs ${r.external}`)).toEqual([]);
      // 吻合數不得過低
      expect(rows.filter(r => r.status === 'match').length).toBeGreaterThanOrEqual(30);
    });
  }
});
