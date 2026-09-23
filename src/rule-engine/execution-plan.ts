import { listRules } from './registry.js';
import type { Rule } from '../core/types.js';

/**
 * 執行計畫（spec §P0-1 Engine Execution Plan）。
 *
 * 計畫不再硬寫函式呼叫，而是由 Rule Registry 依 `logic.stage` + `logic.order` 產生。
 * 修改規則 JSON（新增/移除/調整 stage 或 order）即改變 Engine 行為。
 */
export type ExecutionStage = 'natal' | 'period' | 'variant' | 'on-demand' | 'analysis' | 'unplanned';

export interface PlanEntry {
  ruleId: string;
  executor: string;
  order: number;
}

function buildPlan(stage: ExecutionStage): PlanEntry[] {
  const rules = listRules().filter((r: Rule) => r.logic?.stage === stage && !!r.logic?.executor);
  return rules
    .map((r: Rule) => ({
      ruleId: r.ruleId,
      executor: r.logic.executor as string,
      order: typeof r.logic.order === 'number' ? r.logic.order : Number.MAX_SAFE_INTEGER
    }))
    .sort((a, b) => a.order - b.order || a.ruleId.localeCompare(b.ruleId));
}

/** 本命盤計算順序（規則驅動） */
export const NATAL_EXECUTION_PLAN: PlanEntry[] = buildPlan('natal');

/** 限運計算順序（需 targetDate） */
export const PERIOD_EXECUTION_PLAN: PlanEntry[] = buildPlan('period');

/** 全部計畫中的 ruleId（供 integrity validator 檢查孤兒規則） */
export function plannedRuleIds(): string[] {
  return [...NATAL_EXECUTION_PLAN, ...PERIOD_EXECUTION_PLAN].map(p => p.ruleId);
}

export function planFor(stage: ExecutionStage): PlanEntry[] {
  return buildPlan(stage);
}
