import { describe, it, expect } from 'vitest';
import { listProfiles, listResearch } from '../../src/index.js';
import { buildProfileGapReport, runProfileGapChecks } from '../../tools/profiles/checks.js';

/**
 * Profile Gap Audit（spec Post-Stability §5 / Phase E）。
 *
 * 目的：schema 宣告的 profile 欄位 / enum 值，必須與 runtime 實作分開記錄，
 * 不得讓 `_reserved` 或未實作的 enum 被當成可用功能（spec 2nd §P0-8）。
 */
const { failures, stats } = runProfileGapChecks();
const report = buildProfileGapReport();

describe('profile gap: 結構與治理', () => {
  it('audit 通過所有檢查（profile 清單一致、override 可解析、未實作值有研究項）', () => {
    expect(failures).toEqual([]);
  });

  it('報告涵蓋所有 registry profile', () => {
    expect(report.profiles.map(p => p.profileId).sort()).toEqual(listProfiles().map(p => p.profileId).sort());
    expect(stats.profiles).toBe(listProfiles().length);
  });

  it('所有 profile 皆已宣告 dayBoundary / yearBoundaryPolicy / leapMonthPolicy', () => {
    for (const p of report.profiles) {
      expect(p.fieldsSet, p.profileId).toEqual(expect.arrayContaining(['dayBoundary', 'leapMonthPolicy']));
    }
  });

  it('未實作的 enum 值一律附 gap 與可解析的 Research ID', () => {
    const researchIds = new Set(listResearch().map(r => r.researchId));
    expect(report.unimplementedValues.length).toBeGreaterThan(0);
    for (const n of report.unimplementedValues) {
      expect(n.gap, `${n.field}=${n.value}`).toBeTruthy();
      if (n.researchId) expect(researchIds.has(n.researchId), n.researchId).toBe(true);
    }
  });

  it('標記 runtimeConsumed 的欄位必須有消費位置或預設值說明', () => {
    for (const f of report.fields.filter(x => x.runtimeConsumed)) {
      expect(f.consumedBy, f.field).toBeTruthy();
    }
  });

  it('中州派 profile 之 variant 覆寫確實存在（Phase E 現況基線）', () => {
    const zz = listProfiles().find(p => p.profileId === 'school-zhongzhou')!;
    expect(Object.keys(zz.ruleOverrides ?? {})).toEqual(
      expect.arrayContaining(['ZW.CALC.SIHUA.TABLE.001', 'ZW.CALC.SIHUA.NATAL.001'])
    );
    // 其餘中州派特徵（廟旺表、互涉/飛化用法）尚未以 variant 表達 → 見 RSH.PROFILE.ZHONGZHOU
    expect(listResearch().some(r => r.researchId === 'RSH.PROFILE.ZHONGZHOU')).toBe(true);
  });
});
