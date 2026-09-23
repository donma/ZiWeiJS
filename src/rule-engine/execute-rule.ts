import type { EngineContext } from '../executors/context.js';
import type { Rule } from '../core/types.js';
import { ZiWeiError } from '../core/errors.js';
import { getRule, resolveRuleForProfile } from './registry.js';
import { getExecutor, normalizeOutcomes } from './executor-registry.js';
import { registerAllExecutors } from './register-executors.js';
import type { PlanEntry } from './execution-plan.js';

/**
 * 執行單一規則（spec §P0-1）。
 *
 * 流程：
 *   ruleId → Rule Registry → resolveRuleForProfile() → 確認 status
 *          → 取得 logic.executor → 執行 → Trace 自動寫入
 *
 * Trace 的 ruleId / ruleVersion / profile / sourceRefs / evidenceRefs
 * 一律取自 Rule Registry；executor 只提供 inputs / result / note / status。
 */
export function executeRule(ruleId: string, ctx: EngineContext): void {
  registerAllExecutors();

  // 1. 取得 canonical 規則（不存在即 RULE_NOT_FOUND）
  getRule(ruleId);

  // 2. 依 profile 解析實際應執行之規則（可能為 variant）
  const rule: Rule = resolveRuleForProfile(ruleId, ctx.profile);
  const isVariant = rule.ruleId !== ruleId;

  // 3. status 檢查：deprecated / undetermined 不得執行
  if (rule.status === 'deprecated' || rule.status === 'undetermined') {
    record(ctx, rule, {
      result: null,
      status: 'skipped',
      reason: `RULE_STATUS_${rule.status.toUpperCase()}`
    });
    return;
  }

  // 4. 必須有可執行邏輯
  const executorName = rule.logic?.executor;
  if (!executorName) {
    record(ctx, rule, { result: null, status: 'skipped', reason: 'RULE_NOT_EXECUTABLE' });
    return;
  }

  // 5. executor 必須已註冊
  const fn = getExecutor(executorName);

  // 6. 執行
  let raw: unknown;
  try {
    raw = fn(ctx, rule.logic?.params);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    record(ctx, rule, { result: null, status: 'error', reason: err });
    throw e;
  }

  const outcomes = normalizeOutcomes(raw as never);
  if (outcomes.length === 0) {
    record(ctx, rule, { result: null, status: 'skipped', reason: 'EXECUTOR_RETURNED_NOTHING' });
    return;
  }

  for (const o of outcomes) {
    record(ctx, rule, {
      inputs: o.inputs,
      result: o.result,
      note: o.note,
      status: o.status ?? (isVariant ? 'variant' : 'executed'),
      reason: o.reason
    });
  }
}

function record(
  ctx: EngineContext,
  rule: Rule,
  outcome: {
    inputs?: Record<string, unknown>;
    result: unknown;
    status: 'executed' | 'skipped' | 'unavailable' | 'variant' | 'error';
    reason?: string;
    note?: string;
  }
): void {
  ctx.tracer.record({
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    profile: ctx.profile.profileId,
    sourceRefs: rule.sourceRefs ?? [],
    evidenceRefs: rule.evidenceRefs ?? [],
    inputs: outcome.inputs,
    result: outcome.result,
    status: outcome.status,
    reason: outcome.reason,
    note: outcome.note
  });
}

/** 依計畫依序執行 */
export function executePlan(plan: PlanEntry[], ctx: EngineContext): void {
  for (const entry of plan) {
    executeRule(entry.ruleId, ctx);
  }
}

/** 取得規則的溯源資訊（spec §29 Rule Provenance） */
export interface Provenance {
  ruleId: string;
  ruleVersion: string;
  profile: string;
  sourceRefs: string[];
  evidenceRefs: string[];
}

export function provenanceFor(ruleId: string, profileId: string, overrides?: Record<string, string>): Provenance {
  const canonicalId = ruleId;
  const effectiveId = overrides?.[canonicalId] ?? canonicalId;
  const rule = getRule(effectiveId);
  if (!rule) {
    throw new ZiWeiError('REFERENCE_NOT_FOUND', `Rule not found: ${effectiveId}`, { ruleId: effectiveId });
  }
  return {
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    profile: profileId,
    sourceRefs: rule.sourceRefs ?? [],
    evidenceRefs: rule.evidenceRefs ?? []
  };
}
