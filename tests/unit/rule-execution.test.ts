import { describe, it, expect } from 'vitest';
import { calculate, getRule, listRules, listProfiles } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import { calculate as calc } from '../../src/index.js';
import { getExecutor, hasExecutor, listExecutorNames } from '../../src/rule-engine/executor-registry.js';
import { NATAL_EXECUTION_PLAN, PERIOD_EXECUTION_PLAN, plannedRuleIds } from '../../src/rule-engine/execution-plan.js';
import { registerAllExecutors } from '../../src/rule-engine/register-executors.js';

const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

const TARGET = { year: 2020, month: 6, day: 10, hour: 14 };

registerAllExecutors();

describe('P0-1 Rule Execution Layer — 計畫由規則資料產生', () => {
  it('natal / period 計畫非空且依 order 遞增排序', () => {
    expect(NATAL_EXECUTION_PLAN.length).toBeGreaterThan(20);
    // 大限 / 流年 / 流月 / 流日 / 流時 / 小限（小限於 2026-09-24 Owner 批准升 canonical）
    // + 6 動態星曜（0.6 §15–§19：流魁鉞 / 流昌曲 / 流祿 / 流羊陀 / 流馬 / 流鸞喜）
    expect(PERIOD_EXECUTION_PLAN.length).toBe(12);
    const orders = NATAL_EXECUTION_PLAN.map(p => p.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it('計畫中的每個 executor 皆已註冊（0 unknown executor）', () => {
    const missing = [...NATAL_EXECUTION_PLAN, ...PERIOD_EXECUTION_PLAN]
      .filter(p => !hasExecutor(p.executor));
    expect(missing).toEqual([]);
  });

  it('所有規則 JSON 的 logic.executor 皆可解析', () => {
    registerAllExecutors();
    const missing = listRules()
      .filter(r => r.logic?.executor && !hasExecutor(r.logic.executor))
      .map(r => `${r.ruleId} -> ${r.logic.executor}`);
    expect(missing).toEqual([]);
  });

  it('計畫中不得有 deprecated / undetermined 規則', () => {
    const bad = plannedRuleIds().filter(id => {
      const s = getRule(id).status;
      return s === 'deprecated' || s === 'undetermined';
    });
    expect(bad).toEqual([]);
  });

  it('未註冊的 executor 查詢會拋 RULE_EXECUTOR_NOT_FOUND', () => {
    expect(() => getExecutor('no-such-executor')).toThrow(/RULE_EXECUTOR_NOT_FOUND|not registered/);
  });

  it('executor 註冊可重複呼叫而不重複註冊', () => {
    const before = listExecutorNames().length;
    registerAllExecutors();
    expect(listExecutorNames().length).toBe(before);
  });
});

describe('P0-1 Trace 中介資料由 Rule Registry 自動帶入', () => {
  it('本命盤 trace 的 ruleId / ruleVersion / sourceRefs / evidenceRefs 與規則 JSON 一致', () => {
    const chart = calculate(INPUT, { trace: true });
    const entry = chart.trace!.entries.find(e => e.ruleId === 'ZW.CALC.PALACE.LIFE.001')!;
    const rule = getRule('ZW.CALC.PALACE.LIFE.001');

    expect(entry).toBeDefined();
    expect(entry.ruleVersion).toBe(rule.ruleVersion);
    expect(entry.sourceRefs).toEqual(rule.sourceRefs);
    expect(entry.evidenceRefs).toEqual(rule.evidenceRefs);
    expect(entry.profile).toBe('canonical');
  });

  it('每筆 trace 都有 status', () => {
    const chart = calculate(INPUT, { trace: true, targetDate: TARGET });
    expect(chart.trace!.entries.length).toBeGreaterThan(30);
    expect(chart.trace!.entries.every(e => !!e.status)).toBe(true);
  });

  it('計畫中的規則皆出現於 trace', () => {
    const chart = calculate(INPUT, { trace: true, targetDate: TARGET });
    const seen = new Set(chart.trace!.entries.map(e => e.ruleId));
    const missing = [...NATAL_EXECUTION_PLAN, ...PERIOD_EXECUTION_PLAN]
      .map(p => p.ruleId)
      .filter(id => !seen.has(id));
    expect(missing).toEqual([]);
  });

  it('skipped 的規則帶有 reason', () => {
    const chart = calculate(INPUT, { trace: true });
    const skipped = chart.trace!.entries.filter(e => e.status === 'skipped');
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped.every(e => !!e.reason)).toBe(true);
  });
});

describe('P0-1 / P0-4 Profile 覆寫真的執行 variant 規則', () => {
  it('canonical profile 執行 canonical 規則', () => {
    const chart = calculate(INPUT, { trace: true });
    const ids = chart.trace!.entries.map(e => e.ruleId);
    expect(ids).toContain('ZW.CALC.SIHUA.NATAL.001');
    expect(ids).not.toContain('ZW.CALC.SIHUA.NATAL.V001');
  });

  it('school-zhongzhou profile 執行 variant 規則並標記 status=variant', () => {
    const chart = calculate(INPUT, { profile: 'school-zhongzhou', trace: true });
    const entry = chart.trace!.entries.find(e => e.ruleId === 'ZW.CALC.SIHUA.NATAL.V001');
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('variant');

    // canonical 規則本身不再被執行
    expect(chart.trace!.entries.some(e => e.ruleId === 'ZW.CALC.SIHUA.NATAL.001')).toBe(false);

    // variant 的溯源來自 variant 規則 JSON
    const variantRule = getRule('ZW.CALC.SIHUA.NATAL.V001');
    expect(entry!.sourceRefs).toEqual(variantRule.sourceRefs);
    expect(entry!.evidenceRefs).toEqual(variantRule.evidenceRefs);
  });

  it('profile 覆寫真的改變輸出（庚干四化）', () => {
    const canonical = calculate(INPUT);
    const zhongzhou = calculate(INPUT, { profile: 'school-zhongzhou' });
    const natal = (c: ReturnType<typeof calc>) =>
      c.chart.transformations.filter(t => t.sourceScope === 'natal').map(t => `${t.type}:${t.targetStarId}`).sort();
    expect(natal(zhongzhou)).not.toEqual(natal(canonical));
  });

  it('每個 profile 的 ruleOverrides 目標皆存在', () => {
    const bad: string[] = [];
    for (const p of listProfiles()) {
      for (const [canon, variant] of Object.entries(p.ruleOverrides ?? {})) {
        if (!listRules().some(r => r.ruleId === canon)) bad.push(`${p.profileId}: ${canon}`);
        if (!listRules().some(r => r.ruleId === variant)) bad.push(`${p.profileId}: ${variant}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('variant 規則本身不進執行計畫（只能經 profile 覆寫觸發）', () => {
    const planned = new Set(plannedRuleIds());
    const variants = listRules().filter(r => r.status === 'variant').map(r => r.ruleId);
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.filter(v => planned.has(v))).toEqual([]);
  });
});
