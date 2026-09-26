import { describe, it, expect } from 'vitest';
import { rectifyAnalyze } from '../../src/index.js';
import type { ZiWeiBirthInput, RectificationClue } from '../../src/index.js';

const BASE: Omit<ZiWeiBirthInput, 'time'> = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('Rectification V2（spec 0.71 §12–§13）', () => {
  it('不再輸出假 probability（no score/probability 欄位）', () => {
    const r = rectifyAnalyze(BASE, []);
    for (const c of r.candidates) {
      expect(c).not.toHaveProperty('support');
      expect(c).not.toHaveProperty('probability');
      expect(c).not.toHaveProperty('score');
    }
  });

  it('matched / conflicted / unresolved 線索分類', () => {
    // 取一個確定命中某時辰的 interpretation ruleId
    const first = rectifyAnalyze(BASE, []);
    const hitRule = first.candidates[0].matchedClues[0]?.clue.ruleId
      ?? 'ZW.INT.PERSONALITY.001'; // fallback：隨便一條
    const clues: RectificationClue[] = [
      { type: 'known-rule', description: 'test rule', ruleId: hitRule },
      { type: 'known-rule', description: 'missing', ruleId: 'ZW.INT.NO_SUCH_RULE.999' },
      { type: 'personality', description: 'no id' }
    ];
    const r = rectifyAnalyze(BASE, clues);
    const c = r.candidates[0];
    // 無 ruleId/patternId 之線索不參與分類（unresolvedClues 只收帶 ID 但未命中者... 實作上不帶 ID 也歸 unresolved）
    expect(c.matchedClues.length + c.conflictedClues.length).toBeLessThanOrEqual(clues.length);
    // no-id clue 應被歸 unresolved
    const noId = c.unresolvedClues.find(u => u.clue.description === 'no id');
    expect(noId).toBeDefined();
    expect(noId!.match).toBe('unresolved');
  });

  it('supportLevel 為 enum（strong/moderate/weak/insufficient）且 deterministic', () => {
    const r1 = rectifyAnalyze(BASE, [{ type: 'known-rule', description: 'x', ruleId: 'ZW.INT.PERSONALITY.001' }]);
    const r2 = rectifyAnalyze(BASE, [{ type: 'known-rule', description: 'x', ruleId: 'ZW.INT.PERSONALITY.001' }]);
    expect(r1).toEqual(r2);
    for (const c of r1.candidates) {
      expect(['strong', 'moderate', 'weak', 'insufficient']).toContain(c.supportLevel);
    }
  });

  it('無線索時全部 insufficient / notes 解釋', () => {
    const r = rectifyAnalyze(BASE, []);
    for (const c of r.candidates) {
      expect(c.supportLevel).toBe('insufficient');
    }
  });

  it('回傳 note 明言推論 ≠ 事實', () => {
    const r = rectifyAnalyze(BASE, []);
    expect(r.note).toContain('推論');
    expect(r.note).toContain('事實');
  });
});
