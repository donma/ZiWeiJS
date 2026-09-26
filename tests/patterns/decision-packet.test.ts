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

  it('readiness 分佈：9 landed / 0 needs-definition / 1 needs-collation / 0 needs-owner-scope / 1 rejected', () => {
    expect(packet.totals).toMatchObject({
      entries: 11,
      'ready-for-owner-review': 0,
      'needs-definition': 0,
      'needs-collation': 1,
      'needs-owner-scope': 0,
      'needs-review': 0,
      landed: 9,
      rejected: 1
    });
    const sum = Object.entries(packet.totals)
      .filter(([k]) => k !== 'entries')
      .reduce((acc, [, v]) => acc + (v as number), 0);
    expect(sum).toBe(11);
  });

  it('Owner 已批准／授權之五條 implemented 格局：landed + relatedRuleId + 不再提議規則', () => {
    const implemented: Array<[string, string]> = [
      ['PAT.DUIMIAN_CHAODOU', 'ZW.PAT.DUIMIAN_CHAODOU.001'],
      ['PAT.JIANWENWU', 'ZW.PAT.JIANWENWU.001'],
      ['PAT.SHIZHONG_YINYU', 'ZW.PAT.SHIZHONG_YINYU.001'],
      ['PAT.ZUOYOU_CHAOYUAN', 'ZW.PAT.ZUOYOU_CHAOYUAN.001'],
      ['PAT.KEQUANLU_ZHU', 'ZW.PAT.KEQUANLU_ZHU.001']
    ];
    for (const [key, ruleId] of implemented) {
      const e = entries.find(x => x.patternKey === key)!;
      expect(e, key).toBeTruthy();
      expect(e.readiness, key).toBe('landed');
      expect(e.status, key).toBe('implemented');
      expect(e.relatedRuleId, key).toBe(ruleId);
      expect(e.proposedRuleId, key).toBeNull();
      expect(e.requiredArtifacts, key).toEqual([]);
    }
  });

  it('文星朝命格以 equivalent 結案：指向既有 ZW.PAT.WENGUI.001、不另立重複規則', () => {
    const e = entries.find(x => x.patternKey === 'PAT.WENXING_CHAOMING')!;
    expect(e).toBeTruthy();
    expect(e.readiness).toBe('landed');
    expect(e.status).toBe('equivalent');
    expect(e.relatedRuleId).toBe('ZW.PAT.WENGUI.001');
    expect(e.proposedRuleId).toBeNull();
    expect(e.requiredArtifacts).toEqual([]);
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
