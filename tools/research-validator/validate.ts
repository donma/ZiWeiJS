#!/usr/bin/env tsx
/**
 * Research Queue Governance Validator（Final §7 / §P1-4）
 *
 * 檢查：
 *   1. Research ID 唯一
 *   2. relatedRules 若有標註，所參照的規則全數存在
 *   3. evidence 若有標註，所參照的證據全數存在
 *   4. status === 'resolved' 則 resolution 非空且 ownerReviewRequired === false
 *   5. status === 'candidate' 則 ownerReviewRequired === true
 *
 * 用法：npm run validate:research
 */
import { listResearch } from '../../src/ai/research-registry.js';
import { listRules, listEvidence } from '../../src/rule-engine/registry.js';

const failures: string[] = [];
const items = listResearch();
const ruleIds = new Set(listRules().map(r => r.ruleId));
const evidenceIds = new Set(listEvidence().map(e => e.evidenceId));

// 1. ID 唯一
const ids = new Set<string>();
for (const item of items) {
  if (ids.has(item.researchId)) {
    failures.push(`Duplicate researchId: ${item.researchId}`);
  }
  ids.add(item.researchId);
}

// 2. 參照與狀態規則
for (const item of items) {
  // relatedRules
  for (const rId of item.relatedRules ?? []) {
    if (!ruleIds.has(rId)) {
      failures.push(`${item.researchId}: relatedRule not found "${rId}"`);
    }
  }

  // evidence
  for (const eId of item.evidence ?? []) {
    if (!evidenceIds.has(eId)) {
      failures.push(`${item.researchId}: evidence not found "${eId}"`);
    }
  }

  // resolved 規則
  if (item.status === 'resolved') {
    if (!item.resolution || item.resolution.trim().length === 0) {
      failures.push(`${item.researchId}: status is resolved but resolution is empty`);
    }
    if (item.ownerReviewRequired !== false) {
      failures.push(`${item.researchId}: status is resolved but ownerReviewRequired is not false`);
    }
  }

  // candidate 規則
  if (item.status === 'candidate') {
    if (item.ownerReviewRequired !== true) {
      failures.push(`${item.researchId}: status is candidate but ownerReviewRequired is not true`);
    }
  }
}

if (failures.length === 0) {
  console.log(`research governance OK — ${items.length} research items validated`);
  process.exit(0);
}

console.error(`research governance FAILED — ${failures.length} problem(s):`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
