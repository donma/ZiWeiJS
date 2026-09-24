#!/usr/bin/env tsx
/**
 * Profile Gap Audit（spec Post-Stability §5 / Phase E）
 *
 * 用法：
 *   npm run profiles:gap            產生報告
 *   npm run profiles:gap -- --check 檢查報告未漂移
 */
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProfileGapReport, runProfileGapChecks } from './profile-gap-checks.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outPath = join(root, 'research/profiles/profile-gap.json');
const checkOnly = process.argv.includes('--check');

const { failures, stats } = runProfileGapChecks();
if (failures.length > 0) {
  console.error(`profile gap FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

const serialized = `${JSON.stringify(buildProfileGapReport(), null, 2)}\n`;

if (checkOnly) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('profile gap FAILED — research/profiles/profile-gap.json drift');
    process.exit(1);
  }
  console.log(
    `profile gap OK — ${stats.profiles} profiles, ${stats.declaredFields} declared fields ` +
    `(${stats.runtimeConsumed} runtime-consumed), ${stats.unimplementedValues} unimplemented values`
  );
  process.exit(0);
}

mkdirSync(join(root, 'research/profiles'), { recursive: true });
writeFileSync(outPath, serialized, 'utf8');console.log(
  `profile gap written — ${stats.profiles} profiles, ${stats.runtimeConsumed}/${stats.declaredFields} fields runtime-consumed, ` +
  `${stats.unimplementedValues} unimplemented values`
);
