import { describe, it, expect } from 'vitest';
import {
  calculate, listRules, listStarRegistry, listSources, BRANCHES, ZiWei,
  candidateAuxStars, placeTaiFu, placeFengGao, placeJieShen,
  xiaoXianStartBranch, xiaoXianDirection, xiaoXianBranchAtAge, xiaoXianSequence, xiaoXianForTarget,
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
 * 護欄：台輔／封誥／解神 自 0.5.0 起為 canonical（Owner 2026-09-24 批准）並進入本命盤；
 *       小限仍為 candidate，不得進入任何執行計畫或 canonical 限運輸出。
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

describe('candidate 小限（目標日期綁定，升 canonical 前之必要修正）', () => {
  it('xiaoXianForTarget：性別未知不猜方向', () => {
    const r = xiaoXianForTarget({
      birthLunarYear: 1990, targetLunarYear: 2026, yearBranch: 'wu', sex: 'unknown'
    });
    expect(r.reason).toBe('UNKNOWN_SEX_FOR_CALCULATION');
    expect(r.branch).toBeUndefined();
  });

  it('xiaoXianForTarget：虛歲 = 目標農曆年 − 生年農曆年 + 1，並以該歲定位', () => {
    const r = xiaoXianForTarget({
      birthLunarYear: 1990, targetLunarYear: 2026, yearBranch: 'wu', sex: 'male'
    });
    expect(r.age).toBe(37);
    expect(r.branch).toBe(xiaoXianBranchAtAge('wu', 'male', 37));
    expect(r.ruleId).toBe(XIAOXIAN_RULE_ID);
  });

  it('ZiWei.Candidate.xiaoXian.forTarget：與目標年綁定（不同目標年 → 不同虛歲／宮位）', () => {
    const input: ZiWeiBirthInput = {
      calendarType: 'solar', date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'male'
    };
    const chart = calculate(input);
    const a = ZiWei.Candidate.xiaoXian.forTarget(chart, { year: 2026 });
    const b = ZiWei.Candidate.xiaoXian.forTarget(chart, { year: 2030 });
    expect(a.age).toBeDefined();
    expect(b.age).toBe((a.age ?? 0) + 4);
    expect(a.branch).toBe(xiaoXianBranchAtAge(chart.calendar.ganzhi.year.branch, 'male', a.age!));
    expect(b.branch).toBe(xiaoXianBranchAtAge(chart.calendar.ganzhi.year.branch, 'male', b.age!));
  });

  it('性別未知之命盤：forTarget 回報 reason，不產生宮位', () => {
    const input: ZiWeiBirthInput = {
      calendarType: 'solar', date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'unknown'
    };
    const chart = calculate(input);
    const r = ZiWei.Candidate.xiaoXian.forTarget(chart, { year: 2026 });
    expect(r.reason).toBe('UNKNOWN_SEX_FOR_CALCULATION');
    expect(r.branch).toBeUndefined();
  });
});

describe('補充星曜治理：canonical（台輔／封誥／解神）與 candidate（小限）', () => {
  const SUPPLEMENTARY_STAR_RULES = [TAIFU_FENGGAO_RULE_ID, JIESHEN_RULE_ID];
  const SUPPLEMENTARY_STARS = ['ZW.STAR.AUX.TAIFU', 'ZW.STAR.AUX.FENGGAO', 'ZW.STAR.AUX.JIESHEN'];

  it('台輔／封誥／解神 規則為 canonical 且 stage=natal（2026-09-24 Owner 批准）', () => {
    for (const id of SUPPLEMENTARY_STAR_RULES) {
      const rule = listRules().find(r => r.ruleId === id);
      expect(rule, id).toBeDefined();
      expect(rule!.status).toBe('canonical');
      expect(rule!.logic.stage).toBe('natal');
      expect(rule!.ruleVersion).toBe('1.0');
      expect(rule!.changeLog?.[0].type).toBe('behavior-change');
    }
  });

  it('台輔／封誥／解神 進 natal 執行計畫（正式併入本命盤）', () => {
    const planned = new Set(plannedRuleIds());
    for (const id of SUPPLEMENTARY_STAR_RULES) expect(planned.has(id), id).toBe(true);
  });

  it('canonical 規則證據強度（Tier1/2 或 2×獨立 Tier3）', () => {
    const tiers = new Map(listSources().map(s => [s.sourceId, s.tier]));
    for (const id of [...SUPPLEMENTARY_STAR_RULES, XIAOXIAN_RULE_ID]) {
      const rule = listRules().find(r => r.ruleId === id)!;
      const refs = rule.sourceRefs ?? [];
      const hasTier12 = refs.some(s => (tiers.get(s) ?? 99) <= 2);
      const distinctTier3 = new Set(refs.filter(s => tiers.get(s) === 3)).size;
      expect(hasTier12 || distinctTier3 >= 2, `${id}: refs=${refs.join(',')}`).toBe(true);
    }
  });

  it('補充星曜 executors 已註冊', () => {
    registerAllExecutors();
    const names = new Set(listExecutorNames());
    for (const n of ['calcAuxTaiFuFengGao', 'calcAuxJieShen', 'calcCandidateXiaoXian']) {
      expect(names.has(n), n).toBe(true);
    }
  });

  it('小限仍為 candidate 且不進任何執行計畫', () => {
    const rule = listRules().find(r => r.ruleId === XIAOXIAN_RULE_ID)!;
    expect(rule.status).toBe('candidate');
    expect(rule.logic.stage).toBe('on-demand');
    expect(plannedRuleIds()).not.toContain(XIAOXIAN_RULE_ID);
  });

  it('星曜 registry 三筆為 canonical, entityKind=star, 具兩份獨立來源', () => {
    const reg = listStarRegistry();
    for (const id of SUPPLEMENTARY_STARS) {
      const s = reg.find(x => x.id === id);
      expect(s, id).toBeDefined();
      expect(s!.status).toBe('canonical');
      expect(s!.entityKind ?? 'star').toBe('star');
      expect(s!.sources ?? []).toEqual(
        expect.arrayContaining(['SRC.QUANSHU.WIKISOURCE', 'SRC.QUANSHU.DIANCANG'])
      );
    }
  });

  it('canonical 盤面出現台輔／封誥／解神，且位置與安星口訣一致', () => {
    const input: ZiWeiBirthInput = {
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 12 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'male'
    };
    const chart = calculate(input);
    const placed = Object.keys(chart.chart.stars);
    for (const id of SUPPLEMENTARY_STARS) expect(placed, id).toContain(id);

    const expected = candidateAuxStars({
      hourBranch: chart.calendar.hourBranch,
      yearBranch: chart.calendar.ganzhi.year.branch
    });
    for (const e of expected) {
      expect(chart.chart.stars[e.starId].branch, e.starId).toBe(e.branch);
    }
  });
});
