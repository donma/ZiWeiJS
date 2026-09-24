#!/usr/bin/env tsx
/**
 * Variant Research Catalog Validator（spec Post-Stability Phase F）
 *
 * 用法：npm run validate:variants
 */
import { runVariantCatalogChecks } from './checks.js';

const { failures, stats } = runVariantCatalogChecks();

if (failures.length === 0) {
  console.log(
    `variants OK — ${stats.dimensions} dimensions ` +
    `(modeled ${stats.modeled} / partial ${stats.partiallyModeled} / not-modeled ${stats.notModeled}), ` +
    `${stats.variantsReferenced} variant rules referenced`
  );
  process.exit(0);
}

console.error(`variants FAILED — ${failures.length} problem(s):`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
