#!/usr/bin/env tsx
/**
 * Pattern Research Backlog Validator（spec Post-Stability Phase G）
 *
 * 用法：npm run validate:patterns
 */
import { runPatternBacklogChecks } from './checks.js';

const { failures, stats } = runPatternBacklogChecks();

if (failures.length === 0) {
  console.log(
    `patterns OK — ${stats.entries} backlog entries ` +
    `(implemented ${stats.implemented} / equivalent ${stats.equivalent} / ` +
    `research ${stats.research} / rejected ${stats.rejected})`
  );
  process.exit(0);
}

console.error(`patterns FAILED — ${failures.length} problem(s):`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
