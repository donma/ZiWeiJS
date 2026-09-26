import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * 中州 Diff Matrix（spec Post-Stability §13.1 / M5）
 *
 * 驗證產物結構與「不臆測」原則：
 *   - 12 個維度齊備、每維度皆有 ziweiCanonical / iztroZhongzhou / fortel / independentEvidence / decision
 *   - fortel 一律 null（未安裝未執行）；independentEvidence 一律空（現階段無獨立古典依據）
 *   - 實測結果與 iztro 原始碼引用一致（命主年支、天使天傷對調、歲前十二神第 11 位名稱）
 * 漂移檢查由 `npm run assimilation:zhongzhou-diff:check`（verify + CI）負責。
 */
describe('zhongzhou diff matrix', () => {
  const matrix = JSON.parse(readFileSync('research/assimilation/fortel/zhongzhou-diff.json', 'utf8'));
  const dims: Array<Record<string, unknown>> = matrix.dimensions;

  it('涵蓋 §13.1 全部 12 個維度', () => {
    expect(dims.length).toBe(12);
    const expected = [
      'soul', 'body', 'tianshi-tianshang', 'kui-yue', 'jiekong-xunkong', 'suiqian-12',
      'sihua-table', 'star-existence', 'brightness', 'leap-month', 'major-period', 'dynamic-stars'
    ];
    expect(dims.map(d => d.dimension)).toEqual(expected);
  });

  it('每個維度都不得臆測外部來源', () => {
    for (const d of dims) {
      expect(d.fortel).toBeNull();
      expect(['research', 'variant', 'variant-only']).toContain(d.decision);
    }
  });

  it('命主：實測與 iztro 中州（年支查命主）不同，並附原始碼引用', () => {
    const soul = dims.find(d => d.dimension === 'soul')!;
    expect((soul.iztroZhongzhou as { source: string }).source).toContain('lib/astro/astro.js');
    expect(soul.agreement).toBe('differs');
  });

  it('天使／天傷：iztro 中州在 P2 對調，通用派與本庫一致', () => {
    const d = dims.find(x => x.dimension === 'tianshi-tianshang')!;
    const zz = d.iztroZhongzhou as { values: Array<{ tianshi: string; tianshang: string }>; defaultAlgorithmValues: Array<{ tianshi: string; tianshang: string }> };
    const ours = (d.ziweiCanonical as { values: Array<{ tianshi: string; tianshang: string }> }).values;
    expect(ours.length).toBe(3);
    expect(zz.values[1]).not.toEqual(zz.defaultAlgorithmValues[1]);
    expect(zz.defaultAlgorithmValues[1]).toEqual(ours[1]);
  });

  it('歲前十二神：iztro 中州名稱集與通用派不同（大耗 ↔ 歲破）', () => {
    const d = dims.find(x => x.dimension === 'suiqian-12')!;
    const zz = d.iztroZhongzhou as {
      differsFromDefault: boolean;
      nameSetDiff: { onlyInZhongzhou: string[]; onlyInDefault: string[] };
    };
    expect(zz.differsFromDefault).toBe(true);
    expect(zz.nameSetDiff.onlyInZhongzhou).toContain('歲破');
    expect(zz.nameSetDiff.onlyInDefault).toContain('大耗');
  });

  it('星曜存在：缺口只作 Gap Detector，並附年系十二神之呈現差異說明', () => {
    const d = dims.find(x => x.dimension === 'star-existence')!;
    const interp = d.interpretation as Record<string, string>;
    expect(interp.onlyInZiweiAreCycleDeities).toContain('非真實缺星');
    expect(interp.onlyInIztroZhongzhou).toContain('negative finding');
    for (const diff of d.diff as Array<{ onlyInIztroZhongzhou: string[] }>) {
      expect(diff.onlyInIztroZhongzhou).toContain('年解');
    }
  });

  it('方法聲明：全部數值為實跑，且未複製外部程式碼', () => {
    expect(matrix.method).toContain('實跑');
    expect(matrix.external.iztro.usage).toContain('僅比對行為');
    expect(matrix.external.fortel.available).toBe(false);
  });
});
