import type { EngineContext } from '../executors/context.js';
import type { InterpretationHit, Domain, LocalizedText } from '../core/types.js';
import { evalDsl } from '../rule-engine/dsl.js';
import { listInterpretationRules, listPatterns } from '../rule-engine/registry.js';
import type { PatternResult } from '../core/types.js';
import { buildRelationContext } from '../relation-engine/relation-engine.js';
import { resolveInterpretationHits } from './resolver.js';
import type { InterpretationRuleLike } from './resolver.js';

export interface InterpretationRule {
  ruleId: string;
  ruleVersion: string;
  status: string;
  domain: Domain;
  name?: LocalizedText;
  conditions?: Record<string, unknown>;
  tendency: string;
  strength: number;
  confidence: number;
  priority: number;
  supports: string[];
  conflictsWith: string[];
  overrides: string[];
  evidence: string[];
  sourceRefs: string[];
  text?: LocalizedText;
}

export function runInterpretation(ctx: EngineContext): InterpretationHit[] {
  const rules = listInterpretationRules() as unknown as InterpretationRule[];
  const hits: InterpretationHit[] = [];
  const ruleMap = new Map<string, InterpretationRule>();
  for (const r of rules) ruleMap.set(r.ruleId, r);

  for (const rule of rules) {
    let matched: boolean;
    try {
      matched = evalDsl(rule.conditions as Record<string, unknown>, { engine: ctx });
    } catch (e) {
      // DSL 錯誤 = 規則無法執行，不得靜默視為「不成立」（spec §P0-5 / §28）
      recordDslError(ctx, rule.ruleId, rule.ruleVersion, rule.sourceRefs, rule.evidence, e);
      continue;
    }
    if (!matched) continue;
    hits.push({
      ruleId: rule.ruleId,
      domain: rule.domain,
      tendency: rule.tendency,
      strength: rule.strength ?? 0.5,
      confidence: rule.confidence ?? 0.5,
      priority: rule.priority ?? 50,
      text: rule.text,
      supports: rule.supports ?? [],
      conflictsWith: rule.conflictsWith ?? [],
      overriddenBy: []
    });
  }

  // 衝突與覆蓋解析（spec §P0-6）：委由 resolver 處理，不產生單一總分
  const resolved = resolveInterpretationHits(hits, ruleMap);
  ctx.interpretationHits = resolved;
  return resolved;
}

export function groupByDomain(hits: InterpretationHit[]): Record<string, InterpretationHit[]> {
  const out: Record<string, InterpretationHit[]> = {};
  for (const h of hits) {
    (out[h.domain] ??= []).push(h);
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => b.priority - a.priority || b.strength - a.strength);
  }
  return out;
}

interface PatternRuleDef {
  ruleId: string;
  ruleVersion: string;
  status: string;
  name: LocalizedText;
  required?: Array<Record<string, unknown>>;
  enhancers?: Array<Record<string, unknown>>;
  breakers?: Array<Record<string, unknown>>;
  text?: LocalizedText;
}

export function runPatterns(ctx: EngineContext): PatternResult[] {
  const patterns = listPatterns() as unknown as PatternRuleDef[];
  const results: PatternResult[] = [];
  void buildRelationContext;

  for (const pat of patterns) {
    const matched: string[] = [];
    const failed: string[] = [];
    let errored = false;
    for (const cond of pat.required ?? []) {
      try {
        if (evalDsl(cond, { engine: ctx })) matched.push(JSON.stringify(cond));
        else failed.push(JSON.stringify(cond));
      } catch (e) {
        errored = true;
        recordDslError(ctx, pat.ruleId, pat.ruleVersion, undefined, undefined, e);
      }
    }
    const matchedEnhancers: string[] = [];
    for (const cond of pat.enhancers ?? []) {
      try {
        if (evalDsl(cond, { engine: ctx })) matchedEnhancers.push(JSON.stringify(cond));
      } catch (e) {
        errored = true;
        recordDslError(ctx, pat.ruleId, pat.ruleVersion, undefined, undefined, e);
      }
    }
    const matchedBreakers: string[] = [];
    for (const cond of pat.breakers ?? []) {
      try {
        if (evalDsl(cond, { engine: ctx })) matchedBreakers.push(JSON.stringify(cond));
      } catch (e) {
        errored = true;
        recordDslError(ctx, pat.ruleId, pat.ruleVersion, undefined, undefined, e);
      }
    }

    const total = (pat.required ?? []).length;
    const okCount = matched.length;
    let status: PatternResult['status'];
    if (errored) status = 'insufficient';
    else if (total === 0) status = 'insufficient';
    else if (okCount === 0) status = 'insufficient';
    else if (okCount < total) status = 'partial';
    else if (matchedBreakers.length > 0) status = 'broken';
    else if (matchedEnhancers.length > 0) status = 'enhanced';
    else status = 'complete';
    if (pat.status === 'variant' || pat.status === 'research') status = 'variant-only';

    results.push({
      patternId: pat.ruleId,
      name: pat.name,
      status,
      score: total > 0 ? okCount / total : 0,
      matchedConditions: matched,
      failedConditions: failed,
      breakers: matchedBreakers,
      enhancers: matchedEnhancers,
      profile: ctx.profile.profileId,
      ruleId: pat.ruleId
    });
  }
  // 供 DSL `pattern` operator 查詢真實格局結果（spec §P0-5）
  ctx.patternResults = results;
  return results;
}

/** 將 DSL 執行錯誤寫入 trace（status=error），而非靜默丟棄 */
function recordDslError(
  ctx: EngineContext,
  ruleId: string,
  ruleVersion: string | undefined,
  sourceRefs: string[] | undefined,
  evidenceRefs: string[] | undefined,
  e: unknown
): void {
  ctx.tracer.record({
    ruleId,
    ruleVersion,
    profile: ctx.profile.profileId,
    sourceRefs: sourceRefs ?? [],
    evidenceRefs: evidenceRefs ?? [],
    result: null,
    status: 'error',
    reason: e instanceof Error ? e.message : String(e)
  });
}
