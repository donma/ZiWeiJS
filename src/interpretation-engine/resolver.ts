import type { InterpretationHit, InterpretationStatus } from '../core/types.js';

/**
 * 解讀衝突 / 覆蓋解析（spec §P0-6）。
 *
 * 流程：
 *   raw hits → apply overrides → resolve conflicts → apply supports → sort priority → resolved hits
 *
 * 不使用單一總分：只標記每筆命中的狀態與相互關係，保留可解釋性。
 *   - active      ：可用於 Narrative
 *   - overridden  ：被其他命中覆蓋（仍保留，並降有效強度）
 *   - conflicted  ：與其他命中互相衝突
 */
export interface InterpretationRuleLike {
  ruleId: string;
  overrides?: string[];
  conflictsWith?: string[];
  supports?: string[];
}

export function resolveInterpretationHits(
  rawHits: InterpretationHit[],
  ruleMap: Map<string, InterpretationRuleLike>
): InterpretationHit[] {
  const hits = rawHits.map(h => ({
    ...h,
    overriddenBy: [...h.overriddenBy],
    conflictsWith: [...h.conflictsWith],
    supportedBy: [...(h.supportedBy ?? [])]
  }));
  const matchedIds = new Set(hits.map(h => h.ruleId));
  const byId = new Map(hits.map(h => [h.ruleId, h]));

  // 1. apply overrides（def.overrides = 本規則覆蓋哪些規則）
  for (const h of hits) {
    const def = ruleMap.get(h.ruleId);
    if (!def) continue;
    for (const otherId of def.overrides ?? []) {
      if (otherId === h.ruleId || !matchedIds.has(otherId)) continue;
      const other = byId.get(otherId)!;
      if (!other.overriddenBy.includes(h.ruleId)) other.overriddenBy.push(h.ruleId);
      h.overridesList = h.overridesList ?? [];
      if (!h.overridesList.includes(otherId)) h.overridesList.push(otherId);
    }
  }

  // 2. resolve conflicts（雙向對稱）
  for (const h of hits) {
    const def = ruleMap.get(h.ruleId);
    if (!def) continue;
    for (const otherId of def.conflictsWith ?? []) {
      if (otherId === h.ruleId || !matchedIds.has(otherId)) continue;
      const other = byId.get(otherId)!;
      if (!h.conflictsWith.includes(otherId)) h.conflictsWith.push(otherId);
      if (!other.conflictsWith.includes(h.ruleId)) other.conflictsWith.push(h.ruleId);
    }
  }

  // 3. apply supports（雙向對稱）
  for (const h of hits) {
    const def = ruleMap.get(h.ruleId);
    if (!def) continue;
    for (const otherId of def.supports ?? []) {
      if (otherId === h.ruleId || !matchedIds.has(otherId)) continue;
      const other = byId.get(otherId)!;
      if (!h.supportedBy!.includes(otherId)) h.supportedBy!.push(otherId);
      if (!other.supportedBy!.includes(h.ruleId)) other.supportedBy!.push(h.ruleId);
    }
  }

  // 4. 狀態判定 + 有效強度（不產生單一總分）
  for (const h of hits) {
    h.overriddenBy = [...new Set(h.overriddenBy)];
    h.conflictsWith = [...new Set(h.conflictsWith)];
    h.supportedBy = [...new Set(h.supportedBy!)];

    let status: InterpretationStatus = 'active';
    if (h.overriddenBy.length > 0) status = 'overridden';
    else if (h.conflictsWith.length > 0) status = 'conflicted';
    h.status = status;

    if (status === 'overridden') h.effectiveStrength = round2(h.strength * 0.5);
    else if (status === 'conflicted') h.effectiveStrength = round2(h.strength * 0.75);
    else h.effectiveStrength = h.strength;
  }

  // 5. sort priority（同優先度再比有效強度）
  hits.sort((a, b) => b.priority - a.priority || (b.effectiveStrength ?? 0) - (a.effectiveStrength ?? 0));
  return hits;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 僅 active 的命中（Narrative 預設輸入） */
export function activeHits(hits: InterpretationHit[]): InterpretationHit[] {
  return hits.filter(h => (h.status ?? 'active') === 'active');
}
