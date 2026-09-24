import { describe, it, expect } from 'vitest';
import { calculate, toContext, listEvidence, listSources, getStarRegistryEntry, t } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * AI Context 精準化（spec §52「AI Context 更精準」）
 *
 * 驗證 `toContext()` 不再漏掉：命主／身主、小限、目標當下大限、日／時限、
 * 以及可追溯的 sourceIds / evidenceIds（原本 evidenceIds 恆為空）。
 */
const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 0 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('AI context: 命主／身主', () => {
  const chart = calculate(INPUT, { trace: true });
  const ctx = toContext(chart);

  it('命主與身主皆以 zh 名稱呈現，且與 star registry 一致', () => {
    expect(ctx.lifeMaster).toBe(t(getStarRegistryEntry(chart.chart.natal.masterStar!)!.name));
    expect(ctx.bodyMaster).toBe(t(getStarRegistryEntry(chart.chart.natal.bodyStar!)!.name));
  });
});

describe('AI context: 限運（含小限與目標當下大限）', () => {
  const target = { year: 2026, month: 9, day: 24, hour: 12 };
  const chart = calculate(INPUT, { trace: true, targetDate: target });
  const ctx = toContext(chart);

  it('小限以 canonical 輸出呈現（虛歲、地支、宮名）', () => {
    expect(chart.periods.xiaoxian).toBeTruthy();
    const palace = chart.chart.palaces.find(p => p.id === chart.periods.xiaoxian!.palaceId)!;
    expect(ctx.periods.xiaoxian).toEqual({
      age: chart.periods.xiaoxian!.age,
      branch: chart.periods.xiaoxian!.branch,
      palace: t(palace.name)
    });
  });

  it('目標當下大限與日／時限皆存在，且年／月為干支中文字', () => {
    expect(ctx.periods.activeMajor?.age).toBe(chart.periods.active?.age);
    expect(ctx.periods.day).toBeTruthy();
    expect(ctx.periods.hour).toBeTruthy();
    expect(ctx.periods.year).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
  });

  it('無 targetDate 時不得臆測限運', () => {
    const natal = toContext(calculate(INPUT, { trace: true }));
    expect(natal.periods.year).toBeUndefined();
    expect(natal.periods.xiaoxian).toBeUndefined();
    expect(natal.periods.activeMajor).toBeUndefined();
    expect(natal.certainty.xiaoxian).toBe('unavailable');
  });
});

describe('AI context: 可追溯性（sourceIds / evidenceIds）', () => {
  const chart = calculate(INPUT, { trace: true, targetDate: { year: 2026, month: 9, day: 24, hour: 12 } });
  const ctx = toContext(chart);

  it('sourceIds / evidenceIds 非空，且全部可解析', () => {
    const knownSources = new Set(listSources().map(s => s.sourceId));
    const knownEvidence = new Set(listEvidence().map(e => e.evidenceId));
    expect(ctx.sourceIds.length).toBeGreaterThan(0);
    expect(ctx.evidenceIds.length).toBeGreaterThan(0);
    for (const s of ctx.sourceIds) expect(knownSources.has(s), s).toBe(true);
    for (const e of ctx.evidenceIds) expect(knownEvidence.has(e), e).toBe(true);
  });

  it('ruleIds 為排序後唯一值（可重現）', () => {
    expect(new Set(ctx.ruleIds).size).toBe(ctx.ruleIds.length);
    expect(ctx.ruleIds).toEqual([...ctx.ruleIds].sort());
  });

  it('同一輸入之 context 完全決定性', () => {
    const again = toContext(calculate(INPUT, { trace: true, targetDate: { year: 2026, month: 9, day: 24, hour: 12 } }));
    expect(JSON.stringify(again)).toBe(JSON.stringify(ctx));
  });
});
