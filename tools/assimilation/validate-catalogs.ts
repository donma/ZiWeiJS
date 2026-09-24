#!/usr/bin/env tsx
/**
 * Assimilation Catalog Validator（spec Post-Stability Phase A）
 *
 * 驗證新增的 catalog 與治理資料：
 *   - tables/cycles/*.json（schema、placementRuleId、starId、evidenceRefs、index 連續）
 *   - tables/stars/aliases.json（schema、candidate / starId 可解析）
 *   - research/assimilation/<project>/candidates.json（schema、researchId 存在、外部專案存在）
 *   - research/assimilation/rejections.json（schema、ID 唯一）
 *   - research/assimilation/<project>/snapshot.json（schema）
 *
 * 用法：npm run validate:catalogs
 */
import { runCatalogChecks } from './checks.js';

const { failures, stats } = runCatalogChecks();

if (failures.length === 0) {
  console.log(
    `catalogs OK — ${stats.cycles} cycles (${stats.cycleEntries} entries), ${stats.aliases} aliases, ` +
    `${stats.candidates} candidates, ${stats.rejections} rejections, ${stats.snapshots} snapshots`
  );
  process.exit(0);
}

console.error(`catalogs FAILED — ${failures.length} problem(s):`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
