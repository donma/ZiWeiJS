#!/usr/bin/env tsx
/**
 * Integrity Validator CLI（spec §25 / §31 Bible Quality Gate）
 *
 * 實作在 checks.ts，與 tests/integrity/integrity.test.ts 共用同一份邏輯，
 * 避免「gate 過了但測試沒過」或反之的分歧。
 *
 * 用法：npm run validate:integrity
 */
import { runIntegrityChecks } from './checks.js';

const { failures, stats } = runIntegrityChecks();

if (failures.length === 0) {
  console.log(`integrity OK — ${stats.rules} rules, ${stats.stars} stars, ${stats.sources} sources, ${stats.evidence} evidence, ${stats.executors} executors`);
  console.log(`execution plan: natal ${stats.natalPlan} / period ${stats.periodPlan}`);
  console.log(`isolation: src ${stats.srcFiles} files, 0 forbidden import, calendar importers ${stats.calendarImporters}`);
  process.exit(0);
}

const grouped = new Map<string, string[]>();
for (const f of failures) {
  (grouped.get(f.check) ?? grouped.set(f.check, []).get(f.check)!).push(f.detail);
}
console.error(`integrity FAILED — ${failures.length} problem(s)`);
for (const [check, details] of grouped) {
  console.error(`\n[${check}] ${details.length}`);
  for (const d of details.slice(0, 12)) console.error(`  - ${d}`);
  if (details.length > 12) console.error(`  ... and ${details.length - 12} more`);
}
process.exit(1);
