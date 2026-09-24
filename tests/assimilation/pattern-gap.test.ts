import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPatternGapReport, runPatternGapChecks } from '../../tools/assimilation/pattern-gap-checks.js';

/**
 * Pattern Gap Audit（spec Post-Stability §5 / §19）
 *
 * 與 `npm run assimilation:pattern-gap:check` 共用同一份實作。
 * 重點：外部格局名稱只能作 Gap Detector；未追蹤者必須 fail，已實作者必須指向真實規則。
 */
describe('pattern gap audit', () => {
  const report = buildPatternGapReport();

  it('檢查全數通過', () => {
    expect(runPatternGapChecks(report)).toEqual([]);
  });

  it('ZiWeiJS pattern 規則皆為 ZW.PAT.* 且不重複', () => {
    expect(report.ziweiPatternRules.length).toBeGreaterThan(0);
    expect(new Set(report.ziweiPatternRules).size).toBe(report.ziweiPatternRules.length);
    for (const id of report.ziweiPatternRules) expect(id).toMatch(/^ZW\.PAT\./);
  });

  it('backlog 中 equivalent 一律指向既有 pattern 規則', () => {
    for (const e of report.classicalBacklog.equivalentToExisting) {
      expect(report.ziweiPatternRules).toContain(e.ruleId);
    }
  });

  it('backlog research 一律有可解析之 researchId', () => {
    for (const r of report.classicalBacklog.unresolvedResearch) {
      expect(r.researchId).toMatch(/^RSH\./);
    }
  });

  it('外部名稱若存在，未匹配者一律標記 decision=research 且已被 backlog 追蹤', () => {
    for (const u of report.external.unmatched) {
      expect(u.decision).toBe('research');
    }
    for (const f of report.external.files) {
      expect(f.names).toBeGreaterThan(0);
    }
  });

  it('報告輸出一致（無漂移）', () => {
    const onDisk = readFileSync('research/assimilation/pattern-gap.json', 'utf8');
    expect(onDisk).toBe(`${JSON.stringify(report, null, 2)}\n`);
  });
});
