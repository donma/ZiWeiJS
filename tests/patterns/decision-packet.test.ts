import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Pattern Decision Packet（spec M7「先品質，再數量」）
 *
 * 驗證決策包忠實反映 backlog，且 AI 不得代為決策：
 *   - 11 條全數收錄、readiness 分佈與 backlog 一致
 *   - ready-for-owner-review 者必有古典定義句與 proposedRuleId
 *   - landed / rejected 不需 artifacts
 *   - ownerDecision 一律 null（Owner 專屬）
 * 漂移檢查由 `npm run patterns:packet:check`（verify + CI）負責。
 */
describe('pattern decision packet', () => {
  const packet = JSON.parse(readFileSync('research/patterns/pattern-decision-packet.json', 'utf8'));
  const backlog = JSON.parse(readFileSync('research/patterns/pattern-backlog.json', 'utf8'));
  const entries: Array<Record<string, any>> = packet.entries;

  it('涵蓋全部 backlog 條目', () => {
    expect(entries.length).toBe(backlog.entries.length);
    expect(entries.length).toBe(11);
    expect(entries.map(e => e.patternKey).sort()).toEqual(backlog.entries.map((e: { patternKey: string }) => e.patternKey).sort());
  });

  it('readiness 分佈：4 ready / 2 needs-definition / 1 needs-collation / 2 needs-owner-scope / 1 landed / 1 rejected', () => {
    expect(packet.totals).toMatchObject({
      entries: 11,
      'ready-for-owner-review': 4,
      'needs-definition': 2,
      'needs-collation': 1,
      'needs-owner-scope': 2,
      'needs-review': 0,
      landed: 1,
      rejected: 1
    });
  });

  it('ready-for-owner-review：有古典定義句與候選 ruleId', () => {
    const ready = entries.filter(e => e.readiness === 'ready-for-owner-review');
    expect(ready.length).toBeGreaterThan(0);
    for (const e of ready) {
      // 定義可來自散文定義句，或詩曰＋gap（如左右朝垣格）；兩者皆不得為空
      expect(e.definitionClause ?? e.gap, e.patternKey).toBeTruthy();
      expect(['prose', 'poem-or-gap'], e.patternKey).toContain(e.definitionSource);
      expect(e.proposedRuleId, e.patternKey).toBe(`ZW.PAT.${e.patternKey.replace(/^PAT\./, '')}.001`);
      expect(e.requiredArtifacts.length, e.patternKey).toBeGreaterThan(0);
    }
  });

  it('已實作 / 已拒絕者不需要 artifacts，也不提議新規則', () => {
    for (const e of entries.filter(x => x.readiness === 'landed' || x.readiness === 'rejected')) {
      expect(e.proposedRuleId, e.patternKey).toBeNull();
      expect(e.requiredArtifacts, e.patternKey).toEqual([]);
    }
  });

  it('ownerDecision 一律 null：AI 不得代為決定', () => {
    for (const e of entries) expect(e.ownerDecision, e.patternKey).toBeNull();
    expect(packet.note).toContain('不得自行實作或升級 canonical');
  });

  it('每條研究項皆可回溯（researchId 或已落地狀態）', () => {
    for (const e of entries) {
      if (e.status === 'research') expect(e.researchId, e.patternKey).toBeTruthy();
    }
  });
});
