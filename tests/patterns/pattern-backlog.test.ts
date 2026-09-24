import { describe, it, expect } from 'vitest';
import { listPatterns } from '../../src/index.js';
import { runPatternBacklogChecks, readPatternBacklog } from '../../tools/patterns/checks.js';

/**
 * Pattern Research Backlog（spec Post-Stability Phase G）。
 *
 * 原則：不追數量。每條格局必須有古典原文（quote + sourceId），
 * 且未實作者一律掛 Research ID；不得「假研究、真實作」。
 */
const { failures, stats } = runPatternBacklogChecks();
const backlog = readPatternBacklog();

describe('pattern backlog: 結構與治理', () => {
  it('backlog 通過所有檢查', () => {
    expect(failures).toEqual([]);
  });

  it('每條都有非空古典原文與可解析來源', () => {
    for (const e of backlog.entries) {
      expect(e.quote.trim(), e.patternKey).not.toBe('');
      expect(e.sourceId, e.patternKey).toMatch(/^SRC\./);
    }
  });

  it('research 條目一律掛 Research ID，且不得指向既有 pattern 規則', () => {
    for (const e of backlog.entries.filter(x => x.status === 'research')) {
      expect(e.researchId, e.patternKey).toBeTruthy();
      expect(e.relatedRuleId ?? null, e.patternKey).toBeNull();
    }
  });

  it('implemented / equivalent 條目必須指向真實存在的 pattern 規則', () => {
    const ids = new Set(listPatterns().map(p => p.ruleId));
    for (const e of backlog.entries.filter(x => x.status === 'implemented' || x.status === 'equivalent')) {
      expect(e.relatedRuleId, e.patternKey).toBeTruthy();
      expect(ids.has(e.relatedRuleId!), `${e.patternKey} -> ${e.relatedRuleId}`).toBe(true);
    }
  });

  it('rejected 條目必須說明理由（避免日後重複評估）', () => {
    for (const e of backlog.entries.filter(x => x.status === 'rejected')) {
      expect(e.note, e.patternKey).toBeTruthy();
    }
  });

  it('統計值與內容一致', () => {
    expect(stats.entries).toBe(backlog.entries.length);
    expect(stats.implemented + stats.equivalent + stats.research + stats.rejected).toBe(stats.entries);
  });

  it('既有 24 格局不得被 backlog 誤標為 research 而未經決策', () => {
    const patternIds = new Set(listPatterns().map(p => p.ruleId));
    const researchTargets = backlog.entries
      .filter(e => e.status === 'research')
      .map(e => e.relatedRuleId)
      .filter((x): x is string => !!x);
    expect(researchTargets.filter(id => patternIds.has(id))).toEqual([]);
  });
});
