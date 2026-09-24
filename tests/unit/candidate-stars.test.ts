import { describe, it, expect } from 'vitest';
import {
  calculate, listRules, listStarRegistry, BRANCHES,
  candidateAuxStars, placeTaiFu, placeFengGao, placeJieShen,
  xiaoXianStartBranch, xiaoXianDirection, xiaoXianBranchAtAge, xiaoXianSequence,
  TAIFU_FENGGAO_RULE_ID, JIESHEN_RULE_ID, XIAOXIAN_RULE_ID
} from '../../src/index.js';
import type { BranchId, ZiWeiBirthInput } from '../../src/index.js';
import { plannedRuleIds } from '../../src/rule-engine/execution-plan.js';
import { registerAllExecutors, listExecutorNames } from '../../src/rule-engine/register-executors.js';

/**
 * Candidate 星曜 / 小限（Post-Stability Phase B/C）。
 *
 * 依據：《紫微斗數全書》卷二安星訣（SRC.QUANSHU.WIKISOURCE）
 *   - 台輔：由午宮起子，順數至本生時
 *   - 封誥：由寅宮起子，順數至本生時
 *   - 解神（年解）：由戌宮起子，逆數至生年太歲
 *   - 小限：寅午戌起辰、申子辰起戌、巳酉丑起未、亥卯未起丑；不論陰陽，男順女逆
 *
 * 護欄：三顆星與小限皆為 candidate，不得出現在 canonical 盤面／執行計畫中。
 */

const hourBranchAt = (index: number): BranchId => BRANCHES[index] as BranchId;

/** 口訣展開：由 startBranch 起子時，順行 */
function forwardFrom(start: BranchId, count: number): BranchId {
  const i = BRANCHES.indexOf(start);
  return BRANCHES[(i + count) % 12] as BranchId;
}

/** 口訣展開：由 startBranch 起子，逆行 */
function backwardFrom(start: BranchId, count: number): BranchId {
  const i = BRANCHES.indexOf(start);
  return BRANCHES[(((i - count) % 12) + 12) % 12] as BranchId;
}

describe('candidate 星曜安法（全書卷二口訣）', () => {
  it('台輔：午宮起子時順數，十二時辰逐一相符', () => {
    for (let h = 0; h < 12; h++) {
      const hb = hourBranchAt(h);
      expect(placeTaiFu(hb), `時支 ${hb}`).toBe(forwardFrom('wu', h));
    }
  });

  it('封誥：寅宮起子時順數，十二時辰逐一相符', () => {
    for (let h = 0; h < 12; h++) {
      const hb = hourBranchAt(h);
      expect(placeFengGao(hb), `時支 ${hb}`).toBe(forwardFrom('yin', h));
    }
  });

  it('解神（年解）：戌宮起子逆數至生年太歲，十二年支逐一相符', () => {
    for (let y = 0; y < 12; y++) {
      const yb = BRANCHES[y] as BranchId;
      expect(placeJieShen(yb), `年支 ${yb}`).toBe(backwardFrom('xu', y));
    }
  });

  it('台輔／封誥 為位移關係（固定相差 8 宮）', () => {
    for (let h = 0; h < 12; h++) {
      const hb = hourBranchAt(h);
      const tai = BRANCHES.indexOf(placeTaiFu(hb));
      const feng = BRANCHES.indexOf(placeFengGao(hb));
      // 台輔起午(6)、封誥起寅(2) → 封誥恆在台輔逆時針 4 宮（即 +8）
      expect(((feng - tai) % 12 + 12) % 12).toBe(8);
    }
  });

  it('candidateAuxStars 回傳三顆星並附口訣與規則來源', () => {
    const out = candidateAuxStars({ hourBranch: 'wu', yearBranch: 'wu' });
    expect(out.map(p => p.starId)).toEqual([
      'ZW.STAR.AUX.TAIFU', 'ZW.STAR.AUX.FENGGAO', 'ZW.STAR.AUX.JIESHEN'
    ]);
    expect(out.find(p => p.starId === 'ZW.STAR.AUX.TAIFU')!.branch).toBe('zi');
    expect(out.find(p => p.starId === 'ZW.STAR.AUX.FENGGAO')!.branch).toBe('shen');
    expect(out.find(p => p.starId === 'ZW.STAR.AUX.JIESHEN')!.branch).toBe('chen');
    for (const p of out) expect(p.formula.length).toBeGreaterThan(0);
  });
});

describe('candidate 小限（全書卷二安小限訣）', () => {
  it('起宮：寅午戌起辰、申子辰起戌、巳酉丑起未、亥卯未起丑', () => {
    for (const b of ['yin', 'wu', 'xu'] as BranchId[]) expect(xiaoXianStartBranch(b)).toBe('chen');
    for (const b of ['shen', 'zi', 'chen'] as BranchId[]) expect(xiaoXianStartBranch(b)).toBe('xu');
    for (const b of ['si', 'you', 'chou'] as BranchId[]) expect(xiaoXianStartBranch(b)).toBe('wei');
    for (const b of ['hai', 'mao', 'wei'] as BranchId[]) expect(xiaoXianStartBranch(b)).toBe('chou');
  });

  it('方向：不論陰陽，男順女逆', () => {
    expect(xiaoXianDirection('male')).toBe(1);
    expect(xiaoXianDirection('female')).toBe(-1);
  });

  it('男命自起宮順行、女命自起宮逆行', () => {
    const male = xiaoXianSequence('wu', 'male', 1, 12).map(x => x.branch);
    expect(male).toEqual(BRANCHES.map((_, i) => forwardFrom('chen', i)));
    const female = xiaoXianSequence('wu', 'female', 1, 12).map(x => x.branch);
    expect(female).toEqual(BRANCHES.map((_, i) => backwardFrom('chen', i)));
    expect(male[0]).toBe('chen');
    expect(female[0]).toBe('chen');
  });

  it('虛歲 1 起且必須為正整數', () => {
    expect(xiaoXianBranchAtAge('zi', 'male', 1)).toBe('xu');
    expect(() => xiaoXianBranchAtAge('zi', 'male', 0)).toThrow();
    expect(() => xiaoXianBranchAtAge('zi', 'male', 1.5)).toThrow();
  });

  it('十二歲回歸起宮（一輪十二宮）', () => {
    for (const yb of BRANCHES as BranchId[]) {
      const seq = xiaoXianSequence(yb, 'male', 1, 13);
      expect(seq[12].branch, `年支 ${yb}`).toBe(seq[0].branch);
    }
  });
});

describe('candidate 治理護欄', () => {
  const candidateRuleIds = [TAIFU_FENGGAO_RULE_ID, JIESHEN_RULE_ID, XIAOXIAN_RULE_ID];

  it('三條 candidate 規則存在、status=candidate 且 stage=on-demand', () => {
    for (const id of candidateRuleIds) {
      const rule = listRules().find(r => r.ruleId === id);
      expect(rule, id).toBeDefined();
      expect(rule!.status).toBe('candidate');
      expect(rule!.logic.stage).toBe('on-demand');
      expect(rule!.sourceRefs ?? []).toContain('SRC.QUANSHU.WIKISOURCE');
    }
  });

  it('candidate 規則不進任何執行計畫（natal / period 皆無）', () => {
    const planned = new Set(plannedRuleIds());
    for (const id of candidateRuleIds) expect(planned.has(id), id).toBe(false);
  });

  it('candidate executors 已註冊（規則可被 on-demand 執行）', () => {
    registerAllExecutors();
    const names = new Set(listExecutorNames());
    for (const n of ['calcCandidateByHour', 'calcCandidateByYearBranch', 'calcCandidateXiaoXian']) {
      expect(names.has(n), n).toBe(true);
    }
  });

  it('星曜 registry 三筆為 candidate，且不得為 canonical', () => {
    const reg = listStarRegistry();
    for (const id of ['ZW.STAR.AUX.TAIFU', 'ZW.STAR.AUX.FENGGAO', 'ZW.STAR.AUX.JIESHEN']) {
      const s = reg.find(x => x.id === id);
      expect(s, id).toBeDefined();
      expect(s!.status).toBe('candidate');
      expect(s!.entityKind ?? 'star').toBe('star');
    }
  });

  it('canonical 盤面不得出現 candidate 星曜（未經 Owner 批准）', () => {
    const input: ZiWeiBirthInput = {
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 12 },
      sexForCalculation: 'male'
    };
    const chart = calculate(input);
    const placed = Object.keys(chart.chart.stars);
    for (const id of ['ZW.STAR.AUX.TAIFU', 'ZW.STAR.AUX.FENGGAO', 'ZW.STAR.AUX.JIESHEN']) {
      expect(placed, id).not.toContain(id);
    }
  });
});
