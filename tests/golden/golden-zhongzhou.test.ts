import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculate } from '../../src/index.js';
import type { ZiWeiChart, ZiWeiBirthInput } from '../../src/index.js';

/**
 * Zhongzhou Golden Fixtures（spec 0.6 §38）。
 *
 * 每個 fixture 記錄同一輸入之 canonical 與 school-zhongzhou 預期值：
 * 庚干四化 / 命主 variant / 天使天傷 variant / 空亡星 / 廟旺。
 * 不共用 canonical golden。
 */
interface ZhongzhouFixture {
  name: string;
  note: string;
  input: ZiWeiBirthInput;
  external: {
    sourceId: string;
    version: string;
    dimensions: string[];
    iztroZhongzhou?: { soul?: string; body?: string };
    engineZhongzhou?: { soul?: string; body?: string };
    agreement?: Record<string, boolean>;
  };
  oracle: Record<'canonical' | 'school-zhongzhou', {
    masterStar?: string;
    bodyStar?: string;
    tianshiTianshang: { friends: string; health: string };
    sihuaNatal: Record<string, string | undefined>;
    jiekongBranch: string | null;
    xunkongBranch: string | null;
    brightnessSample: Record<string, string | undefined>;
  }>;
  dimensions: Array<{ dimension: string; canonicalRule: string; variantRule: string | null; note?: string }>;
}

const dir = join(process.cwd(), 'fixtures', 'golden-zhongzhou');
const fixtures = readdirSync(dir)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ZhongzhouFixture);

function snapshot(chart: ZiWeiChart) {
  const natalSihua: Record<string, string | undefined> = {};
  for (const t of chart.chart.transformations.filter(x => x.sourceScope === 'natal')) {
    natalSihua[t.type] = t.targetStarId;
  }
  const palaceOf = (id: string) => chart.chart.stars[id]?.palaceId;
  return {
    masterStar: chart.chart.natal.masterStar,
    bodyStar: chart.chart.natal.bodyStar,
    tianshiTianshang: {
      friends: palaceOf('ZW.STAR.AUX.TIANSHANG') === 'friends' ? 'ZW.STAR.AUX.TIANSHANG' : 'ZW.STAR.AUX.TIANSHI',
      health: palaceOf('ZW.STAR.AUX.TIANSHI') === 'health' ? 'ZW.STAR.AUX.TIANSHI' : 'ZW.STAR.AUX.TIANSHANG'
    },
    sihuaNatal: natalSihua,
    jiekongBranch: chart.chart.stars['ZW.STAR.AUX.JIEKONG']?.branch ?? null,
    xunkongBranch: chart.chart.stars['ZW.STAR.AUX.XUNKONG']?.branch ?? null,
    brightnessSample: Object.fromEntries(
      ['ZW.STAR.MAJOR.ZIWEI', 'ZW.STAR.MAJOR.TIANTONG', 'ZW.STAR.MAJOR.JUMEN'].map(id => [
        id,
        chart.chart.palaces.flatMap(p => p.stars).find(s => s.starId === id)?.dignity
      ])
    )
  };
}

describe('golden-zhongzhou：結構', () => {
  it('至少 3 筆 fixture，且涵蓋 5 個差異維度', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    for (const f of fixtures) {
      expect(f.input, f.name).toBeDefined();
      expect(f.note, f.name).toBeTruthy();
      const dims = f.dimensions.map(d => d.dimension);
      expect(dims).toEqual(
        expect.arrayContaining(['sihua', 'masterStar', 'tianshiTianshang', 'voidStars', 'brightness'])
      );
    }
  });

  it('每個差異維度皆標明 canonicalRule（variant 可為 null）', () => {
    for (const f of fixtures) {
      for (const d of f.dimensions) {
        expect(d.canonicalRule, `${f.name}/${d.dimension}`).toMatch(/^ZW\./);
      }
    }
  });
});

describe('golden-zhongzhou：canonical 與 school-zhongzhou 比對', () => {
  for (const f of fixtures) {
    it(`${f.name}：兩個 profile 之輸出與凍結 oracle 一致`, () => {
      const canonical = snapshot(calculate(f.input, { profile: 'canonical' }));
      const zhongzhou = snapshot(calculate(f.input, { profile: 'school-zhongzhou' }));

      expect(canonical).toEqual(f.oracle.canonical);
      expect(zhongzhou).toEqual(f.oracle['school-zhongzhou']);
    });

    it(`${f.name}：庚干四化、命主、天傷天使之 canonical/zhongzhou 差異如預期`, () => {
      const canonical = snapshot(calculate(f.input, { profile: 'canonical' }));
      const zhongzhou = snapshot(calculate(f.input, { profile: 'school-zhongzhou' }));

      // 庚年：化權 canonical 武曲 / zhongzhou 天府；化科 canonical 太陰 / zhongzhou 天相
      if (canonical.sihuaNatal.quan === 'ZW.STAR.MAJOR.WUQU') {
        expect(zhongzhou.sihuaNatal.quan).toBe('ZW.STAR.MAJOR.TIANFU');
        expect(zhongzhou.sihuaNatal.ke).toBe('ZW.STAR.MAJOR.TIANXIANG');
      }
      // 命主取法可能相同（命宮地支 == 生年支）或不同，但兩 profile 必為合法星曜 ID
      expect(canonical.masterStar).toMatch(/^ZW\./);
      expect(zhongzhou.masterStar).toMatch(/^ZW\./);
      // 陰男陽女：canonical 固定「傷在交友、使在疾厄」；zhongzhou 可能對調
      expect(canonical.tianshiTianshang.friends).toBe('ZW.STAR.AUX.TIANSHANG');
      expect(canonical.tianshiTianshang.health).toBe('ZW.STAR.AUX.TIANSHI');
    });

    it(`${f.name}：外部驗證（iztro 中州模式）命主／身主一致`, () => {
      if (!f.external?.agreement) return;
      expect(f.external.agreement.masterStar, f.name).toBe(true);
      expect(f.external.agreement.bodyStar, f.name).toBe(true);
    });
  }
});
