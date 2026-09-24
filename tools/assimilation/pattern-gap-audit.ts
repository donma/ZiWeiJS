#!/usr/bin/env tsx
/**
 * Pattern Gap Audit（spec Post-Stability §5 / §19）
 *
 * 產出 research/assimilation/pattern-gap.json：
 *   - ZiWeiJS 已實作 pattern 規則
 *   - 古典格局 backlog（全書）之 equivalent / research / rejected 分佈
 *   - 外部資料集外部格局名稱（若存在 external-pattern-names.json）之 matched / unmatched
 *
 * 用法：
 *   npm run assimilation:pattern-gap            # 產生報告
 *   npm run assimilation:pattern-gap -- --check # 檢查報告未漂移
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPatternGapReport, runPatternGapChecks } from './pattern-gap-checks.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outPath = join(root, 'research/assimilation/pattern-gap.json');
const checkOnly = process.argv.includes('--check');

const report = buildPatternGapReport();
const serialized = `${JSON.stringify(report, null, 2)}\n`;
const failures = runPatternGapChecks(report);

if (failures.length) {
  for (const f of failures) console.error(`pattern-gap FAILED — ${f}`);
  process.exit(1);
}

if (checkOnly) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('pattern-gap audit FAILED — research/assimilation/pattern-gap.json drift');
    process.exit(1);
  }
  console.log(
    `pattern-gap audit OK — ${report.ziweiPatternRules.length} pattern rules, ` +
    `${report.classicalBacklog.entries} backlog entries, ${report.external.unmatched.length} external unmatched`
  );
  process.exit(0);
}

writeFileSync(outPath, serialized, 'utf8');
console.log(
  `pattern-gap audit written — ${report.ziweiPatternRules.length} pattern rules, ` +
  `${report.classicalBacklog.entries} backlog entries, ${report.external.unmatched.length} external unmatched`
);
