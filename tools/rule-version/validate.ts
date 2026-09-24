#!/usr/bin/env tsx
/**
 * Rule Version Gate V2（spec 3rd §4 / §P0-11 / §7）
 *
 * 目的：確保「同一個 Rule Version 代表同一個可重現行為」。
 *
 * 檢查：
 *   1. 每條規則都有 changeLog
 *   2. changeLog[0].version === rule.ruleVersion（最新紀錄即當前版本）
 *   3. changeLog 版本嚴格遞減（新 → 舊）
 *   4. 若含 behavior-change，最新一筆 behavior-change 的版本必須等於 ruleVersion
 *      （行為改了卻沒升版 → fail）
 *
 * 用法：npm run validate:versions
 */
import { listRules } from '../../src/index.js';

interface ChangeLogEntry {
  version: string;
  type: string;
  date?: string;
  note?: string;
}

function compareVersion(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const failures: string[] = [];
const rules = listRules();

for (const r of rules) {
  const log = ((r as unknown as { changeLog?: ChangeLogEntry[] }).changeLog) ?? [];
  if (log.length === 0) {
    failures.push(`${r.ruleId}: missing changeLog`);
    continue;
  }
  if (log[0].version !== r.ruleVersion) {
    failures.push(`${r.ruleId}: ruleVersion ${r.ruleVersion} != latest changeLog ${log[0].version}`);
  }
  for (let i = 1; i < log.length; i++) {
    if (compareVersion(log[i - 1].version, log[i].version) <= 0) {
      failures.push(
        `${r.ruleId}: changeLog versions not strictly descending (${log.map(l => l.version).join(' > ')})`
      );
      break;
    }
  }
  const behavior = log.filter(l => l.type === 'behavior-change');
  if (behavior.length > 0 && behavior[0].version !== r.ruleVersion) {
    failures.push(
      `${r.ruleId}: behavior changed but ruleVersion ${r.ruleVersion} != latest behavior-change ${behavior[0].version}`
    );
  }
}

if (failures.length === 0) {
  console.log(`rule-version OK — ${rules.length} rules, 0 failed`);
  process.exit(0);
}

console.error(`rule-version FAILED — ${failures.length} issue(s):`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
