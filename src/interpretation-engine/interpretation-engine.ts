import type { EngineContext } from '../executors/context.js';
import type { InterpretationHit, Domain, LocalizedText } from '../core/types.js';
import { evalDsl } from '../rule-engine/dsl.js';
import { listInterpretationRules, listPatterns } from '../rule-engine/registry.js';
import type { PatternResult } from '../core/types.js';
import { buildRelationContext } from '../relation-engine/relation-engine.js';

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
  const matchedIds = new Set<string>();
  const ruleMap = new Map<string, InterpretationRule>();
  for (const r of rules) ruleMap.set(r.ruleId, r);

  for (const rule of rules) {
    let matched = false;
    try {
      matched = evalDsl(rule.conditions as Record<string, unknown>, { engine: ctx });
    } catch {
      matched = false;
    }
    if (!matched) continue;
    matchedIds.add(rule.ruleId);
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

  // 衝突與覆蓋解析：只計算雙方都命中的情況
  // def.overrides = 本規則覆蓋哪些規則；def.conflictsWith = 與哪些規則衝突
  for (const h of hits) {
    const def = ruleMap.get(h.ruleId);
    if (!def) continue;

    for (const otherId of def.overrides ?? []) {
      if (otherId === h.ruleId || !matchedIds.has(otherId)) continue;
      const other = hits.find(x => x.ruleId === otherId)!;
      if (!other.overriddenBy.includes(h.ruleId)) other.overriddenBy.push(h.ruleId);
      h.overridesList = h.overridesList ?? [];
      if (!h.overridesList.includes(otherId)) h.overridesList.push(otherId);
    }

    for (const otherId of def.conflictsWith ?? []) {
      if (otherId === h.ruleId || !matchedIds.has(otherId)) continue;
      const other = hits.find(x => x.ruleId === otherId)!;
      if (!h.conflictsWith.includes(otherId)) h.conflictsWith.push(otherId);
      if (!other.conflictsWith.includes(h.ruleId)) other.conflictsWith.push(h.ruleId);
    }
  }

  // 未被任何規則覆蓋者，不應留在 overriddenBy
  for (const h of hits) {
    h.overriddenBy = [...new Set(h.overriddenBy)];
  }

  // 被覆蓋的命中降低有效強度（保留可解釋性，不移除）
  for (const h of hits) {
    if (h.overriddenBy.length > 0) {
      h.effectiveStrength = Math.round(h.strength * 0.5 * 100) / 100;
    } else {
      h.effectiveStrength = h.strength;
    }
  }

  return hits;
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
    for (const cond of pat.required ?? []) {
      const ok = safeEval(cond, ctx);
      if (ok) matched.push(JSON.stringify(cond));
      else failed.push(JSON.stringify(cond));
    }
    const matchedEnhancers: string[] = [];
    for (const cond of pat.enhancers ?? []) {
      if (safeEval(cond, ctx)) matchedEnhancers.push(JSON.stringify(cond));
    }
    const matchedBreakers: string[] = [];
    for (const cond of pat.breakers ?? []) {
      if (safeEval(cond, ctx)) matchedBreakers.push(JSON.stringify(cond));
    }

    const total = (pat.required ?? []).length;
    const okCount = matched.length;
    let status: PatternResult['status'];
    if (total === 0) status = 'insufficient';
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
  return results;
}

function safeEval(cond: Record<string, unknown>, ctx: EngineContext): boolean {
  try {
    return evalDsl(cond, { engine: ctx });
  } catch {
    return false;
  }
}
