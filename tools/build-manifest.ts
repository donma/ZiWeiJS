#!/usr/bin/env tsx
/**
 * Build / Release Manifest（spec 3rd §P2-5）
 *
 * 產出 dist/bible-manifest.json，讓第三方知道 bundle 實際內含哪些
 * Bible / Engine / Schema 版本、有哪些 Rule 與各自版本、有哪些 Profile。
 *
 * 用法：npm run manifest
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRules, listProfiles, BIBLE_VERSION, SCHEMA_VERSION, ENGINE_VERSION } from '../src/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));

const rules: Record<string, string> = {};
for (const r of listRules()) {
  rules[r.ruleId] = r.ruleVersion;
}

const sorted = Object.fromEntries(
  Object.entries(rules).sort(([a], [b]) => a.localeCompare(b))
);

const manifest = {
  generatedBy: 'tools/build-manifest.ts',
  bibleVersion: BIBLE_VERSION,
  engineVersion: ENGINE_VERSION,
  schemaVersion: SCHEMA_VERSION,
  profiles: listProfiles().map(p => ({
    profileId: p.profileId,
    yearBoundaryPolicy: p.yearBoundaryPolicy ?? 'lunar-new-year',
    dayBoundary: p.dayBoundary,
    leapMonthPolicy: p.leapMonthPolicy,
    timeConvention: p.timeConvention,
    ruleOverrides: p.ruleOverrides ?? {}
  })),
  rules: sorted
};

const outPath = join(root, 'dist/bible-manifest.json');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`wrote dist/bible-manifest.json — bible ${BIBLE_VERSION} / schema ${SCHEMA_VERSION} / engine ${ENGINE_VERSION}`);
console.log(`  ${Object.keys(sorted).length} rules, ${manifest.profiles.length} profiles`);
