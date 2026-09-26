#!/usr/bin/env tsx
/**
 * Evidence Independence Validator (spec 0.6 §33 / §34)
 *
 * 驗證依賴 2× Tier 3 的 canonical 規則，其來源必須屬於「不同的 independenceGroup」，
 * 防止兩個同源網頁轉錄（例如同屬 quanshu-wikisource-family）被誤算為兩個獨立 Tier 3。
 *
 * 用法：npm run validate:evidence-independence
 */
import { listRules, listSources } from '../../src/index.js';
import type { Source } from '../../src/index.js';

interface Failure {
  ruleId: string;
  reason: string;
}

const rules = listRules();
const sources = listSources();
const sourceById = new Map<string, Source>(sources.map(s => [s.sourceId, s]));

const failures: Failure[] = [];
const ENGINE_CONTRACT_SOURCES = new Set(['SRC.SPEC.ENGINE']);

for (const rule of rules) {
  if (rule.status !== 'canonical') continue;

  const refs = rule.sourceRefs ?? [];
  if (refs.some(s => ENGINE_CONTRACT_SOURCES.has(s))) continue;

  const hasTier12 = refs.some(s => {
    const t = sourceById.get(s)?.tier;
    return t !== undefined && t <= 2;
  });

  // 若已有 Tier 1 或 Tier 2，已滿足古典依據門檻
  if (hasTier12) continue;

  // 僅依賴 Tier 3 來源者，必須有 ≥2 個互為獨立的 independenceGroup
  const tier3Sources = refs
    .map(s => sourceById.get(s))
    .filter((s): s is Source => s !== undefined && s.tier === 3);

  const groups = new Set<string>();
  for (const src of tier3Sources) {
    const rawSrc = src as unknown as { independenceGroup?: string };
    const grp = rawSrc.independenceGroup ?? src.sourceId;
    groups.add(grp);
  }

  if (groups.size < 2) {
    failures.push({
      ruleId: rule.ruleId,
      reason: `依賴 Tier 3 但獨立群組不足 2 個 (現有: ${[...groups].join(', ') || '無'})`
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

console.log(`evidence independence OK — validated canonical rules across distinct source independence groups`);
process.exit(0);
