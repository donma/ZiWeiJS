#!/usr/bin/env tsx
/**
 * Evidence Independence Validator V2（spec 0.71 §34–§35）
 *
 * 0.6 版本偏 Source-level（rule.sourceRefs → Source.independenceGroup）。
 * 0.71 升級為：
 *   rule.evidenceRefs → Evidence → Evidence.sourceId → Source.independenceGroup
 *
 * Canonical 若僅依賴 2× Tier 3：
 *   - 兩個 Tier 3 來源必須屬於不同的 independenceGroup
 *   - Tier 3 Source 缺 independenceGroup 時 strict FAIL（§35）
 *   - 不得用不同 sourceId 假裝獨立
 *
 * 檢查邏輯（規則層級）：
 *   - 收集 rule.evidenceRefs → Evidence → SourceId → tier
 *   - 若任一來源為 Tier 1/2 → 直接通過（不檢查 independenceGroup）
 *   - 若為 Engine Contract（SRC.SPEC.ENGINE）→ 跳過
 *   - 僅依賴 Tier 3 時，其來源的 independenceGroup 必須互異（≥2 組）
 *   - Tier 3 Source 缺 independenceGroup → strict FAIL（§35）
 */
import { listRules, listSources, listEvidence } from '../../src/index.js';
import type { Source } from '../../src/index.js';

interface Failure {
  ruleId: string;
  reason: string;
}

const rules = listRules();
const sources = listSources();
const evidence = listEvidence();
const sourceById = new Map<string, Source>(sources.map(s => [s.sourceId, s]));
const evidenceById = new Map<string, { sourceId: string }>(evidence.map(e => [e.evidenceId, e]));

const failures: Failure[] = [];
const ENGINE_CONTRACT_SOURCES = new Set(['SRC.SPEC.ENGINE']);

function tierOf(sourceId: string): number | undefined {
  return sourceById.get(sourceId)?.tier;
}

function independenceGroupOf(sourceId: string): string | undefined {
  const src = sourceById.get(sourceId);
  if (!src) return undefined;
  return (src as unknown as { independenceGroup?: string }).independenceGroup;
}

for (const rule of rules) {
  if (rule.status !== 'canonical') continue;

  // V2 核心：rule.evidenceRefs → Evidence → Evidence.sourceId，
  // 与 rule.sourceRefs 合并为「证据链支撑来源集合」（sourceRefs 声明了该规则
  // 的文献依据，evidenceRefs 给出条目级证据，两者共同构成支撑强度）。
  const effectiveIds = new Set<string>(rule.sourceRefs ?? []);
  for (const evRef of rule.evidenceRefs ?? []) {
    const ev = evidenceById.get(evRef);
    if (ev) effectiveIds.add(ev.sourceId);
  }

  if ([...effectiveIds].some(s => ENGINE_CONTRACT_SOURCES.has(s))) continue;

  const hasTier12 = [...effectiveIds].some(s => {
    const t = tierOf(s);
    return t !== undefined && t <= 2;
  });
  if (hasTier12) continue;

  // 僅依賴 Tier 3 來源者
  const tier3Sources = [...effectiveIds]
    .filter(s => tierOf(s) === 3)
    .map(s => sourceById.get(s)!)
    .filter(Boolean);

  const groups = new Set<string>();
  let hasMissingGroup = false;

  for (const src of tier3Sources) {
    const grp = independenceGroupOf(src.sourceId);
    if (!grp) {
      hasMissingGroup = true;
      failures.push({
        ruleId: rule.ruleId,
        reason: `Tier 3 來源 ${src.sourceId} 缺 independenceGroup（strict mode FAIL）`
      });
    } else {
      groups.add(grp);
    }
  }

  if (!hasMissingGroup && groups.size < 2) {
    failures.push({
      ruleId: rule.ruleId,
      reason: `依賴 Tier 3 但獨立群組不足 2 個（現有: ${[...groups].join(', ') || '無'}）`
    });
  }
}

if (failures.length > 0) {
  console.error(`evidence independence FAILED — ${failures.length} problem(s):`);
  for (const f of failures) {
    console.error(`  - ${f.ruleId}: ${f.reason}`);
  }
  process.exit(1);
}

console.log(`evidence independence OK — V2 (evidenceRefs → Evidence → Source.independenceGroup), ${rules.filter(r => r.status === 'canonical').length} canonical rules validated`);
process.exit(0);
