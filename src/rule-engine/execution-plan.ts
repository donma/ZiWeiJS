import { listRules } from './registry.js';
import type { Rule } from '../core/types.js';

/**
 * 執行計畫（spec §P0-1 Engine Execution Plan / 0.71 §31–§32）。
 *
 * 計畫由 Rule Registry 依 `logic.stage` + `logic.order` 產生。
 *
 * 0.71 §31 P0 lifecycle：
 *   - stage='on-demand' 的 candidate 規則（動態流曜 ZW.CALC.PERIOD.STAR.*）
 *     不進 NATAL / PERIOD 預設計畫；僅能由 ZiWei.Experimental.* 明確執行，
 *     且 trace status 一律標 `candidate`（execute-rule.ts §32）。
 *   - natal stage 中現存的 candidate 規則（aux-groups / truesolar）屬
 *     Hardening P0-1 遺留：其輸出之星曜在 registry 為 canonical，
 *     預設計畫仍執行但 trace 標 `candidate`，避免沉默移除 canonical 星曜。
 *     待 Owner 覆核升級或降級後可再調整。
 */
export type ExecutionStage = 'natal' | 'period' | 'variant' | 'on-demand' | 'analysis' | 'unplanned';

export interface PlanEntry {
  ruleId: string;
  executor: string;
  order: number;
}

function buildPlan(stage: ExecutionStage): PlanEntry[] {
  const rules = listRules().filter((r: Rule) =>
    r.logic?.stage === stage &&
    !!r.logic?.executor &&
    r.status !== 'deprecated' &&
    r.status !== 'undetermined'
  );
  return rules
    .map((r: Rule) => ({
      ruleId: r.ruleId,
      executor: r.logic.executor as string,
      order: typeof r.logic.order === 'number' ? r.logic.order : Number.MAX_SAFE_INTEGER
    }))
    .sort((a, b) => a.order - b.order || a.ruleId.localeCompare(b.ruleId));
}

/** 本命盤計算順序（規則驅動；candidate natal 規則仍執行但 trace 標 candidate） */
export const NATAL_EXECUTION_PLAN: PlanEntry[] = buildPlan('natal');

/** 限運計算順序（需 targetDate；動態流曜 candidate 已改 stage='on-demand'，不在此計畫） */
export const PERIOD_EXECUTION_PLAN: PlanEntry[] = buildPlan('period');

/** on-demand 計畫（Experimental API 用；candidate 動態流曜唯一正確的執行路徑） */
export const ON_DEMAND_EXECUTION_PLAN: PlanEntry[] = buildPlan('on-demand');

/** 全部計畫中的 ruleId（供 integrity validator 檢查孤兒規則） */
export function plannedRuleIds(): string[] {
  return [...NATAL_EXECUTION_PLAN, ...PERIOD_EXECUTION_PLAN].map(p => p.ruleId);
}

export function planFor(stage: ExecutionStage): PlanEntry[] {
  return buildPlan(stage);
}
