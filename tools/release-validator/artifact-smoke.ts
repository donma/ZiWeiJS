#!/usr/bin/env tsx
/**
 * Release Artifact Smoke Test（Final §5）
 *
 * 驗證 build 產物本身可被第三方使用，而不只是「build 程序成功」：
 *   - dist 產物存在
 *   - ESM bundle 可 import 並實際排一張最小命盤
 *   - 版本常數與 manifest 一致
 *   - manifest 的 rules / profiles 數量與 Registry 一致
 *
 * 用法：npm run release:smoke:artifacts（需先 npm run build）
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  listRules, listProfiles, BIBLE_VERSION, SCHEMA_VERSION, ENGINE_VERSION
} from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = join(root, 'dist');

const failures: string[] = [];
const requireFile = (rel: string) => {
  if (!existsSync(join(root, rel))) failures.push(`missing artifact: ${rel}`);
};

/* ---------- 1. 產物存在 ---------- */
for (const rel of [
  'dist/ziwei-bible.esm.js',
  'dist/ziwei-bible.browser.js',
  'dist/ziwei-bible.d.ts',
  'dist/ziwei-bible-demo.html',
  'dist/bible-manifest.json'
]) {
  requireFile(rel);
}

if (failures.length > 0) {
  console.error(`release artifact smoke FAILED — ${failures.length} missing artifact(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

/* ---------- 2. ESM smoke ---------- */
const esm = await import(pathToFileURL(join(dist, 'ziwei-bible.esm.js')).href);
const ZiWei = esm.default;
if (!ZiWei || typeof ZiWei.calculate !== 'function') {
  failures.push('dist/ziwei-bible.esm.js default export has no calculate()');
} else {
  const chart = ZiWei.calculate({
    calendarType: 'solar',
    date: { year: 1990, month: 5, day: 15 },
    time: { hour: 10 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  });
  if (chart.schemaVersion !== SCHEMA_VERSION) {
    failures.push(`ESM chart.schemaVersion ${chart.schemaVersion} !== ${SCHEMA_VERSION}`);
  }
  if (chart.generatedWith.engineVersion !== ENGINE_VERSION) {
    failures.push(`ESM chart.engineVersion ${chart.generatedWith.engineVersion} !== ${ENGINE_VERSION}`);
  }
  if (chart.generatedWith.bibleVersion !== BIBLE_VERSION) {
    failures.push(`ESM chart.bibleVersion ${chart.generatedWith.bibleVersion} !== ${BIBLE_VERSION}`);
  }
}

/* ---------- 3. Manifest smoke ---------- */
const manifest = JSON.parse(readFileSync(join(dist, 'bible-manifest.json'), 'utf8')) as {
  bibleVersion: string;
  engineVersion: string;
  schemaVersion: string;
  rules: Record<string, string>;
  profiles: Array<{ profileId: string }>;
};
if (manifest.bibleVersion !== BIBLE_VERSION) failures.push(`manifest.bibleVersion ${manifest.bibleVersion} !== ${BIBLE_VERSION}`);
if (manifest.engineVersion !== ENGINE_VERSION) failures.push(`manifest.engineVersion ${manifest.engineVersion} !== ${ENGINE_VERSION}`);
if (manifest.schemaVersion !== SCHEMA_VERSION) failures.push(`manifest.schemaVersion ${manifest.schemaVersion} !== ${SCHEMA_VERSION}`);

const ruleCount = Object.keys(manifest.rules ?? {}).length;
if (ruleCount !== listRules().length) {
  failures.push(`manifest rules ${ruleCount} !== listRules() ${listRules().length}`);
}
if ((manifest.profiles ?? []).length !== listProfiles().length) {
  failures.push(`manifest profiles ${(manifest.profiles ?? []).length} !== listProfiles() ${listProfiles().length}`);
}

if (failures.length > 0) {
  console.error(`release artifact smoke FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`release artifact smoke OK — 5 artifacts, ESM calculate OK, manifest ${ruleCount} rules / ${manifest.profiles.length} profiles (bible ${BIBLE_VERSION} / schema ${SCHEMA_VERSION} / engine ${ENGINE_VERSION})`);
