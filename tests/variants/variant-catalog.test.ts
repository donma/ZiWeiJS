import { describe, it, expect } from 'vitest';
import { listProfiles, listRules } from '../../src/index.js';
import {
  runVariantCatalogChecks, readVariantCatalog, SPEC_DIMENSIONS
} from '../../tools/variants/checks.js';

/**
 * Variant Research Catalog（spec Post-Stability Phase F）。
 *
 * 目的：把「流派差異維度」變成可驗證的資料 —— 每個維度必須說清楚
 * 目前是否已建模（profile 欄位 / ruleOverrides variant），未建模者一律附 Research ID。
 */
const { failures, stats } = runVariantCatalogChecks();
const catalog = readVariantCatalog();

describe('variant catalog: 結構與治理', () => {
  it('catalog 通過所有檢查（schema、參照、機制一致性）', () => {
    expect(failures).toEqual([]);
  });

  it('spec §26 之 14 個維度全數涵蓋（集合相等）', () => {
    const ids = catalog.dimensions.map(d => d.dimensionId).sort();
    expect(ids).toEqual([...SPEC_DIMENSIONS].sort());
  });

  it('每個維度都有 zh-TW 名稱與 externalObservation（不得空殼）', () => {
    for (const d of catalog.dimensions) {
      expect(d.name?.['zh-TW'], d.dimensionId).toBeTruthy();
      expect(d.externalObservation, d.dimensionId).toBeTruthy();
    }
  });

  it('status=modeled 的維度必須有機制（profile 欄位或 variant）', () => {
    for (const d of catalog.dimensions.filter(x => x.status === 'modeled')) {
      expect(d.mechanism, d.dimensionId).not.toBe('none');
    }
  });

  it('未建模 / research 維度一律附 Research ID（不得只是口頭差異）', () => {
    const bad = catalog.dimensions
      .filter(d => d.status === 'not-modeled' || d.status === 'research')
      .filter(d => (d.researchIds ?? []).length === 0)
      .map(d => d.dimensionId);
    expect(bad).toEqual([]);
  });

  it('status=modeled 且以 variant 建模者，至少有一個 profile 實際選用該 variant', () => {
    const profiles = listProfiles();
    const bad: string[] = [];
    for (const d of catalog.dimensions) {
      if (d.status !== 'modeled') continue;
      if (d.mechanism !== 'rule-variant' && d.mechanism !== 'both') continue;
      const selected = profiles.some(p =>
        Object.entries(p.ruleOverrides ?? {}).some(([, variant]) => (d.variants ?? []).includes(variant))
      );
      if (!selected) bad.push(d.dimensionId);
    }
    expect(bad).toEqual([]);
  });
});

describe('variant catalog: 既有 variant 規則清單', () => {
  it('所有被引用的 variant 規則皆存在、status=variant、且 variantOf 可解析', () => {
    const byId = new Map(listRules().map(r => [r.ruleId, r]));
    const referenced = new Set(catalog.dimensions.flatMap(d => d.variants ?? []));
    expect(referenced.size).toBeGreaterThanOrEqual(5);
    for (const v of referenced) {
      const rule = byId.get(v);
      expect(rule, v).toBeDefined();
      expect(rule!.status, v).toBe('variant');
      expect(rule!.variantOf, v).toBeTruthy();
      expect(byId.has(rule!.variantOf!), `${v} -> ${rule!.variantOf}`).toBe(true);
    }
  });

  it('不在 spec 清單的既有 variant 也必須登錄（避免黑數）', () => {
    const extras = catalog.existingVariantsNotInSpecList ?? [];
    expect(extras.length).toBeGreaterThanOrEqual(2);
    const byId = new Map(listRules().map(r => [r.ruleId, r]));
    const allVariants = listRules().filter(r => r.status === 'variant').map(r => r.ruleId);
    const listed = new Set([
      ...catalog.dimensions.flatMap(d => d.variants ?? []),
      ...extras.map(e => e.variantRuleId)
    ]);
    expect(allVariants.filter(v => !listed.has(v))).toEqual([]);
  });

  it('統計值與 catalog 內容一致', () => {
    expect(stats.dimensions).toBe(catalog.dimensions.length);
    expect(stats.modeled + stats.partiallyModeled + stats.notModeled).toBe(stats.dimensions);
  });
});
