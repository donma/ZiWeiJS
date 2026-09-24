import type { EngineContext } from '../executors/context.js';
import type { Rule, Provenance } from '../core/types.js';
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
    status: 'executed' | 'skipped' | 'unavailable' | 'variant' | 'candidate' | 'error';
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

/** 取得規則的溯源資訊（spec §29 / 3rd §P1-7） */
export type { Provenance } from '../core/types.js';

export function provenanceFor(ruleId: string, profileId: string, overrides?: Record<string, string>): Provenance {
  const canonicalId = ruleId;
  const effectiveId = overrides?.[canonicalId] ?? canonicalId;
  let rule: Rule | undefined;
  try {
    rule = getRule(effectiveId);
  } catch {
    try {
      rule = getRule(canonicalId);
    } catch {
      // 若規則仍無法查得，回傳最低合法 Provenance，不使整體排盤崩潰
      return {
        ruleId,
        ruleVersion: '1.0',
        profile: profileId,
        sourceRefs: [],
        evidenceRefs: []
      };
    }
  }
  return {
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    profile: profileId,
    sourceRefs: rule.sourceRefs ?? [],
    evidenceRefs: rule.evidenceRefs ?? []
  };
}

/**
 * 將 provenance 注入所有輸出物件（spec 3rd §P1-7）。
 * 由 Rule Engine 統一執行，executor 不得自行硬寫 ruleVersion。
 */
export function stampProvenance(ctx: EngineContext): void {
  const stamp = (ruleId: string | undefined): Provenance | undefined => {
    if (!ruleId) return undefined;
    try {
      return provenanceFor(ruleId, ctx.profile.profileId, ctx.profile.ruleOverrides);
    } catch {
      return undefined;
    }
  };

  for (const placement of ctx.placements.values()) {
    if (placement.provenance) continue;
    const p = stamp(placement.ruleId);
    if (p) {
      placement.provenance = p;
      placement.ruleVersion = p.ruleVersion;
    }
  }

  for (const tr of ctx.transformations) {
    if (tr.provenance) continue;
    const p = stamp(tr.ruleId);
    if (p) tr.provenance = p;
  }

  for (const info of [ctx.activeMajorPeriod, ctx.yearPeriod, ctx.monthPeriod, ctx.dayPeriod, ctx.hourPeriod]) {
    if (!info || info.provenance) continue;
    const ruleId = info.scope === 'year' ? 'ZW.CALC.PERIOD.LIUNIAN.001'
      : info.scope === 'month' ? 'ZW.CALC.PERIOD.LIUYUE.001'
      : info.scope === 'day' ? 'ZW.CALC.PERIOD.LIURI.001'
      : info.scope === 'hour' ? 'ZW.CALC.PERIOD.LIUSHI.001'
      : 'ZW.CALC.PERIOD.DAXIAN.001';
    const p = stamp(ruleId);
    if (p) info.provenance = p;
  }

  for (const pt of ctx.patternResults ?? []) {
    if (pt.provenance) continue;
    const p = stamp(pt.ruleId ?? pt.patternId);
    if (p) pt.provenance = p;
  }

  for (const hit of ctx.interpretationHits ?? []) {
    if (hit.provenance) continue;
    const p = stamp(hit.ruleId);
    if (p) hit.provenance = p;
  }
}
