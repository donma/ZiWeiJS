import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Candidate Checklist（spec §49）
 *
 * 驗證候選清單的機械可證條件，並確認 registry 與現實一致：
 *   - 知識型候選（star / rule / pattern / variant / period）必有 researchId
 *   - 非 research 狀態必有 Owner decision（AI 不得自填）
 *   - 已落地之 star 候選標記 accepted 並附獨立證據
 * 漂移檢查由 `npm run assimilation:candidate-checklist:check`（verify + CI）負責。
 */
describe('assimilation candidate checklist', () => {
  const report = JSON.parse(readFileSync('research/assimilation/candidate-checklist.json', 'utf8'));
  const entries: Array<Record<string, any>> = report.entries;

  it('涵蓋全部候選，且無 enforced failure', () => {
    expect(entries.length).toBe(19);
    expect(report.totals.failures).toBe(0);
    expect(report.totals.candidates).toBe(entries.length);
  });

  it('每筆候選皆具備 §49 檢查項', () => {
    const keys = [
      'gapStatement', 'benefitStatement', 'noDuplicateCapability', 'stableId', 'schema', 'rule',
      'sourceRoute', 'evidenceRoute', 'test', 'externalComparison', 'initialStatusResearch', 'ownerReview'
    ];
    for (const e of entries) {
      expect(Object.keys(e.checks).sort()).toEqual([...keys].sort());
      expect(e.checks.gapStatement).toBe(true);
      expect(e.checks.benefitStatement).toBe(true);
      expect(e.checks.stableId).toBe(true);
      expect(e.checks.externalComparison).toBe(true);
      expect(e.checks.initialStatusResearch).toBe(true);
    }
  });

  it('知識型候選皆有 researchId；軟體能力型標記 n/a', () => {
    const knowledge = new Set(['star', 'rule', 'pattern', 'variant', 'period']);
    for (const e of entries) {
      if (knowledge.has(e.type)) {
        expect(e.checks.rule, e.candidateId).not.toBe('n/a');
      } else {
        expect(e.checks.rule, e.candidateId).toBe('n/a');
        expect(e.checks.sourceRoute, e.candidateId).toBe('n/a');
      }
    }
  });

  it('已落地之 canonical 星曜候選為 accepted 且附獨立證據', () => {
    for (const id of ['ASM.STAR.TAIFU', 'ASM.STAR.FENGGAO', 'ASM.STAR.JIESHEN']) {
      const e = entries.find(x => x.candidateId === id)!;
      expect(e.status, id).toBe('accepted');
      expect(e.checks.evidenceRoute, id).toBe(true);
      expect(e.checks.ownerReview, id).toBe('advisory');
    }
  });

  it('研究中之候選 ownerReview 一律 pending（不得自稱已核准）', () => {
    for (const e of entries.filter(x => x.status === 'research')) {
      expect(e.checks.ownerReview, e.candidateId).toBe('pending');
    }
  });

  it('報告自我聲明 advisory 不可由 AI 宣告通過', () => {
    expect(report.note).toContain('advisory');
    expect(report.note).toContain('不得由 AI 代為宣告通過');
  });
});
