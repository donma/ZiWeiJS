#!/usr/bin/env tsx
/**
 * Bible Coverage Report（spec §30 / §19）
 *
 *   npm run coverage:bible            # 輸出覆蓋率報告
 *   npm run coverage:bible -- --json  # 機器可讀
 *   npm run coverage:bible -- --update-readme
 *
 * README 中以下標記區塊會由本工具自動填入，請勿手寫數字：
 *   <!-- STATS:BEGIN --> ... <!-- STATS:END -->
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listRules, listSources, listEvidence, listPatterns, listInterpretationRules,
  SCHEMA_VERSION, BIBLE_VERSION, ENGINE_VERSION
} from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

/* ---------- rules ---------- */
const rules = listRules();
const byStatus = (s: string) => rules.filter(r => r.status === s).length;
const canonical = rules.filter(r => r.status === 'canonical');

const sourceIds = new Set(listSources().map(s => s.sourceId));
const evidenceIds = new Set(listEvidence().map(e => String(e.evidenceId)));
const tierOf = new Map(listSources().map(s => [s.sourceId, s.tier]));

const withSource = canonical.filter(r => (r.sourceRefs ?? []).length > 0 && (r.sourceRefs ?? []).every(ref => sourceIds.has(ref)));
const withEvidence = canonical.filter(r => (r.evidenceRefs ?? []).length > 0 && (r.evidenceRefs ?? []).every(ref => evidenceIds.has(ref)));
const withTier123 = canonical.filter(r => (r.sourceRefs ?? []).some(ref => (tierOf.get(ref) ?? 9) <= 3));

const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 1000) / 10);

/* ---------- stars ---------- */
interface StarEntry { id: string; status: string }
const starRegistry = JSON.parse(readFileSync(join(root, 'tables/stars/registry.json'), 'utf8')) as { stars: StarEntry[] };
const stars = starRegistry.stars;
const starsPlaced = stars.filter(s => s.status !== 'deprecated').length;

/* ---------- fixtures ---------- */
function countJson(dir: string): number {
  let n = 0;
  const walk = (d: string): void => {
    let entries: string[];
    try { entries = readdirSync(join(root, d)); } catch { return; }
    for (const e of entries) {
      const rel = join(d, e);
      let isDir = false;
      try { isDir = readdirSync(join(root, rel)).length >= 0; } catch { isDir = false; }
      if (isDir) walk(rel);
      else if (e.endsWith('.json')) n++;
    }
  };
  walk(dir);
  return n;
}
const goldenCases = countJson('fixtures/golden');
const differentialFixtures = countJson('fixtures/differential');

/** 只計 *.test.ts，並回報 it() 宣告數（近似值：迴圈內宣告只算一次） */
function countTests(dir: string): { files: number; tests: number } {
  let files = 0;
  let tests = 0;
  const walk = (d: string): void => {
    let entries: string[];
    try { entries = readdirSync(join(root, d)); } catch { return; }
    for (const e of entries) {
      const rel = join(d, e);
      const abs = join(root, rel);
      let isDir = false;
      try { isDir = readdirSync(abs).length >= 0; } catch { isDir = false; }
      if (isDir) { walk(rel); continue; }
      if (!e.endsWith('.test.ts')) continue;
      files++;
      const src = readFileSync(abs, 'utf8');
      tests += (src.match(/^\s*it(\.each)?\(/gm) ?? []).length;
    }
  };
  walk(dir);
  return { files, tests };
}
const unit = countTests('tests');

/* ---------- report ---------- */
const report = {
  version: { bible: BIBLE_VERSION, schema: SCHEMA_VERSION, engine: ENGINE_VERSION },
  rules: {
    total: rules.length,
    canonical: byStatus('canonical'),
    candidate: byStatus('candidate'),
    variant: byStatus('variant'),
    research: byStatus('research'),
    deprecated: byStatus('deprecated'),
    undetermined: byStatus('undetermined')
  },
  coverage: {
    canonicalSourceCoverage: pct(withSource.length, canonical.length),
    canonicalEvidenceCoverage: pct(withEvidence.length, canonical.length),
    canonicalTier123Coverage: pct(withTier123.length, canonical.length)
  },
  stars: { total: stars.length, placed: starsPlaced, deprecated: stars.length - starsPlaced },
  patterns: listPatterns().length,
  interpretationRules: listInterpretationRules().length,
  interpretationDomains: new Set(
    listInterpretationRules().map(r => (r as unknown as { domain?: string }).domain).filter(Boolean)
  ).size,
  sources: listSources().length,
  evidence: listEvidence().length,
  goldenCases,
  differentialFixtures,
  tests: { files: unit.files, tests: unit.tests }
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const r = report;
  console.log('=== ZiWeiJS Bible Coverage ===');
  console.log(`version            : bible ${r.version.bible} / schema ${r.version.schema} / engine ${r.version.engine}`);
  console.log('');
  console.log(`Rules total        : ${r.rules.total}`);
  console.log(`  canonical        : ${r.rules.canonical}`);
  console.log(`  candidate        : ${r.rules.candidate}`);
  console.log(`  variant          : ${r.rules.variant}`);
  console.log(`  research         : ${r.rules.research}`);
  console.log(`  deprecated       : ${r.rules.deprecated}`);
  console.log('');
  console.log(`Canonical source coverage   : ${r.coverage.canonicalSourceCoverage}%`);
  console.log(`Canonical evidence coverage : ${r.coverage.canonicalEvidenceCoverage}%`);
  console.log(`Canonical Tier1-3 coverage  : ${r.coverage.canonicalTier123Coverage}%`);
  console.log('');
  console.log(`Stars              : ${r.stars.placed}/${r.stars.total} placed (deprecated ${r.stars.deprecated})`);
  console.log(`Patterns           : ${r.patterns}`);
  console.log(`Interpretation     : ${r.interpretationRules} rules / ${r.interpretationDomains} domains`);
  console.log(`Sources / Evidence : ${r.sources} / ${r.evidence}`);
  console.log(`Golden cases       : ${r.goldenCases}`);
  console.log(`Differential fx    : ${r.differentialFixtures}`);
  console.log(`Tests (it() 宣告) : ${r.tests.tests} in ${r.tests.files} files（迴圈展開後實際執行數見 npm test）`);
}

if (process.argv.includes('--update-readme')) {
  const readmePath = join(root, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const block = [
    '<!-- STATS:BEGIN (由 `npm run coverage:bible -- --update-readme` 產生，請勿手寫) -->',
    '| 項目 | 數量 |',
    '|---|---|',
    `| 規則總數 | ${report.rules.total} |`,
    `| canonical | ${report.rules.canonical} |`,
    `| candidate | ${report.rules.candidate} |`,
    `| variant | ${report.rules.variant} |`,
    `| research | ${report.rules.research} |`,
    `| Canonical source 覆蓋率 | ${report.coverage.canonicalSourceCoverage}% |`,
    `| Canonical evidence 覆蓋率 | ${report.coverage.canonicalEvidenceCoverage}% |`,
    `| 星曜（已安 / 總數）| ${report.stars.placed} / ${report.stars.total} |`,
    `| 格局 | ${report.patterns} |`,
    `| 解讀規則 | ${report.interpretationRules}（${report.interpretationDomains} domains）|`,
    `| 文獻 / 證據 | ${report.sources} / ${report.evidence} |`,
    `| Golden fixtures | ${report.goldenCases} |`,
    `| Differential fixtures | ${report.differentialFixtures} |`,
    `| Tests | ${report.tests.tests} it() / ${report.tests.files} files（靜態計數）|`,
    `| schemaVersion | ${report.version.schema} |`,
    '<!-- STATS:END -->'
  ].join('\n');

  const re = /<!-- STATS:BEGIN[\s\S]*?<!-- STATS:END -->/;
  if (re.test(readme)) {
    writeFileSync(readmePath, readme.replace(re, block), 'utf8');
    console.log('\nREADME stats block updated.');
  } else {
    console.log('\nREADME has no <!-- STATS:BEGIN --> block; skipped.');
  }
}
