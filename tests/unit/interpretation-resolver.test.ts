import { describe, it, expect } from 'vitest';
import { resolveInterpretationHits, activeHits } from '../../src/interpretation-engine/resolver.js';
import type { InterpretationRuleLike } from '../../src/interpretation-engine/resolver.js';
import type { InterpretationHit } from '../../src/core/types.js';

function hit(ruleId: string, over: Partial<InterpretationHit> = {}): InterpretationHit {
  return {
    ruleId,
    domain: 'personality',
    tendency: 'neutral',
    strength: 0.8,
    confidence: 0.8,
    priority: 50,
    supports: [],
    conflictsWith: [],
    overriddenBy: [],
    ...over
  };
}

function rules(list: InterpretationRuleLike[]): Map<string, InterpretationRuleLike> {
  return new Map(list.map(r => [r.ruleId, r]));
}

describe('P0-6 解讀衝突 / 覆蓋解析', () => {
  it('被覆蓋者標記 overridden、記錄 overriddenBy、降有效強度但不移除', () => {
    const raw = [hit('A'), hit('B', { strength: 0.6 })];
    const out = resolveInterpretationHits(raw, rules([{ ruleId: 'A', overrides: ['B'] }]));

    const a = out.find(h => h.ruleId === 'A')!;
    const b = out.find(h => h.ruleId === 'B')!;

    expect(out.length).toBe(2);              // 不移除
    expect(b.status).toBe('overridden');
    expect(b.overriddenBy).toEqual(['A']);
    expect(b.effectiveStrength).toBe(0.3);   // 0.6 * 0.5
    expect(a.status).toBe('active');
    expect(a.overridesList).toEqual(['B']);
  });

  it('衝突雙方對稱標記 conflicted', () => {
    const raw = [hit('A'), hit('B')];
    const out = resolveInterpretationHits(raw, rules([{ ruleId: 'A', conflictsWith: ['B'] }]));

    const a = out.find(h => h.ruleId === 'A')!;
    const b = out.find(h => h.ruleId === 'B')!;

    expect(a.status).toBe('conflicted');
    expect(b.status).toBe('conflicted');
    expect(a.conflictsWith).toEqual(['B']);
    expect(b.conflictsWith).toEqual(['A']);
    expect(a.effectiveStrength).toBe(0.6);   // 0.8 * 0.75
  });

  it('supports 記錄 supportedBy（雙向）', () => {
    const raw = [hit('A'), hit('B')];
    const out = resolveInterpretationHits(raw, rules([{ ruleId: 'A', supports: ['B'] }]));
    const a = out.find(h => h.ruleId === 'A')!;
    const b = out.find(h => h.ruleId === 'B')!;
    expect(a.supportedBy).toEqual(['B']);
    expect(b.supportedBy).toEqual(['A']);
  });

  it('覆蓋優先於衝突', () => {
    const raw = [hit('A'), hit('B')];
    const out = resolveInterpretationHits(
      raw,
      rules([{ ruleId: 'A', overrides: ['B'] }, { ruleId: 'B', conflictsWith: ['A'] }])
    );
    expect(out.find(h => h.ruleId === 'B')!.status).toBe('overridden');
  });

  it('只對「雙方都命中」的規則建立關係', () => {
    const raw = [hit('A')];
    const out = resolveInterpretationHits(raw, rules([{ ruleId: 'A', overrides: ['B'] }]));
    expect(out.find(h => h.ruleId === 'A')!.overridesList).toBeUndefined();
    expect(out.find(h => h.ruleId === 'A')!.status).toBe('active');
  });

  it('不以單一總分表達（不得出現 score / total 欄位）', () => {
    const out = resolveInterpretationHits([hit('A')], rules([]));
    expect(Object.keys(out[0])).not.toContain('score');
    expect(Object.keys(out[0])).not.toContain('total');
  });

  it('依 priority 排序，同優先度比有效強度', () => {
    const raw = [
      hit('low', { priority: 10 }),
      hit('high', { priority: 90 }),
      hit('midStrong', { priority: 50, strength: 0.9 }),
      hit('midWeak', { priority: 50, strength: 0.3 })
    ];
    const out = resolveInterpretationHits(raw, rules([]));
    expect(out.map(h => h.ruleId)).toEqual(['high', 'midStrong', 'midWeak', 'low']);
  });

  it('activeHits 只回傳 active', () => {
    const raw = [hit('A'), hit('B'), hit('C')];
    const out = resolveInterpretationHits(
      raw,
      rules([{ ruleId: 'A', overrides: ['B'] }, { ruleId: 'C', conflictsWith: ['A'] }])
    );
    expect(out.find(h => h.ruleId === 'B')!.status).toBe('overridden');
    // A 被 C 衝突 → conflicted；C → conflicted
    expect(activeHits(out).map(h => h.ruleId)).toEqual([]);
  });

  it('真實命盤：每筆 hit 皆有 status 與 effectiveStrength', async () => {
    const { calculate } = await import('../../src/index.js');
    const chart = calculate({
      calendarType: 'solar', date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 }, sexForCalculation: 'male'
    });
    const hits = chart.interpretation.hits;
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(['active', 'overridden', 'conflicted']).toContain(h.status);
      expect(typeof h.effectiveStrength).toBe('number');
    }
  });
});
