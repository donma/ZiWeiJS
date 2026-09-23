#!/usr/bin/env tsx
/**
 * Integrity Validator（spec §25 / §31 Bible Quality Gate）
 *
 * 檢查項目：
 *   - Rule ID / Star ID / Source ID / Evidence ID 唯一
 *   - sourceRefs / evidenceRefs / variantOf / executor 全部可解析
 *   - canonical rule 有 source 與 evidence
 *   - canonical star 有 source
 *   - profile.ruleOverrides 的來源與目標皆存在
 *   - 所有規則資料的 DSL 符合 schemas/dsl.schema.json
 *   - 執行計畫中的 executor 皆已註冊（0 unknown executor）
 *   - 每條 calculation 規則都有 stage（0 unplanned）
 *
 * 用法：npm run validate:integrity
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import {
  listRules, listSources, listEvidence, listProfiles, getEvidence
} from '../../src/index.js';
import type { Rule } from '../../src/index.js';
import { listExecutorNames } from '../../src/rule-engine/executor-registry.js';
import { registerAllExecutors } from '../../src/rule-engine/register-executors.js';
import { NATAL_EXECUTION_PLAN, PERIOD_EXECUTION_PLAN } from '../../src/rule-engine/execution-plan.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

interface Failure { check: string; detail: string; }
const failures: Failure[] = [];
const fail = (check: string, detail: string) => failures.push({ check, detail });

registerAllExecutors();

/* ---------- 1. ID 唯一 ---------- */

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup];
}

const rules = listRules();
for (const d of duplicates(rules.map(r => r.ruleId))) fail('ruleId unique', d);
for (const d of duplicates(listSources().map(s => s.sourceId))) fail('sourceId unique', d);
const evidence = listEvidence();
for (const d of duplicates(evidence.map(e => `${e.evidenceId}`))) fail('evidenceId unique', d);
for (const d of duplicates(listProfiles().map(p => p.profileId))) fail('profileId unique', d);

/* ---------- 2. 參照可解析 ---------- */

const sourceIds = new Set(listSources().map(s => s.sourceId));
const evidenceIds = new Set(evidence.map(e => `${e.evidenceId}`));
const ruleIds = new Set(rules.map(r => r.ruleId));
const executorNames = new Set(listExecutorNames());

for (const r of rules) {
  for (const ref of r.sourceRefs ?? []) {
    if (!sourceIds.has(ref)) fail('sourceRef resolvable', `${r.ruleId} -> ${ref}`);
  }
  for (const ref of r.evidenceRefs ?? []) {
    if (!evidenceIds.has(ref)) fail('evidenceRef resolvable', `${r.ruleId} -> ${ref}`);
  }
  if (r.variantOf && !ruleIds.has(r.variantOf)) {
    fail('variantOf resolvable', `${r.ruleId} -> ${r.variantOf}`);
  }
  if (r.logic?.executor && !executorNames.has(r.logic.executor)) {
    fail('executor resolvable', `${r.ruleId} -> ${r.logic.executor}`);
  }
}

for (const e of evidence) {
  if (!sourceIds.has(`${e.sourceId}`)) {
    fail('evidence.sourceId resolvable', `${e.evidenceId} -> ${e.sourceId}`);
  }
}

for (const p of listProfiles()) {
  for (const [canon, variant] of Object.entries(p.ruleOverrides ?? {})) {
    if (!ruleIds.has(canon)) fail('profile override source resolvable', `${p.profileId} -> ${canon}`);
    if (!ruleIds.has(variant)) fail('profile override target resolvable', `${p.profileId} -> ${variant}`);
  }
}

/* ---------- 3. canonical 溯源要求 ---------- */

for (const r of rules) {
  if (r.status !== 'canonical') continue;
  if ((r.sourceRefs ?? []).length === 0) fail('canonical has sourceRef', r.ruleId);
  if ((r.evidenceRefs ?? []).length === 0) fail('canonical has evidenceRef', r.ruleId);
}

/* ---------- 4. 星曜 registry ---------- */

interface StarEntry {
  id: string; status: string; sources?: string[]; category?: string; name?: Record<string, string>;
}
const starRegistry = JSON.parse(readFileSync(join(root, 'tables/stars/registry.json'), 'utf8')) as { stars: StarEntry[] };
for (const d of duplicates(starRegistry.stars.map(s => s.id))) fail('starId unique', d);
const validCategories = new Set(['major', 'aux', 'malefic', 'minor', 'period', 'interim']);
const validStatuses = new Set(['canonical', 'variant', 'research', 'candidate', 'deprecated', 'undetermined']);

for (const s of starRegistry.stars) {
  if (!s.name?.['zh-TW']) fail('star has zh-TW name', s.id);
  if (!s.category || !validCategories.has(s.category)) fail('star has valid category', `${s.id} -> ${s.category}`);
  if (!s.status || !validStatuses.has(s.status)) fail('star has valid status', `${s.id} -> ${s.status}`);
  if (s.status === 'canonical' && (s.sources ?? []).length === 0) fail('canonical star has source', s.id);
  for (const ref of s.sources ?? []) {
    if (!sourceIds.has(ref)) fail('star source resolvable', `${s.id} -> ${ref}`);
  }
}

/* ---------- 5. DSL schema ---------- */

const dslSchema = JSON.parse(readFileSync(join(root, 'schemas/dsl.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validateDsl = ajv.compile(dslSchema);

function checkDslNodes(ruleId: string, label: string, nodes: unknown[] | undefined): void {
  for (const node of nodes ?? []) {
    if (!validateDsl(node)) {
      fail('dsl schema valid', `${ruleId}.${label}: ${ajv.errorsText(validateDsl.errors)}`);
    }
  }
}

for (const r of rules) {
  const rAny = r as unknown as {
    conditions?: unknown;
    required?: unknown[]; enhancers?: unknown[]; breakers?: unknown[];
  };
  if (rAny.conditions !== undefined) {
    if (!validateDsl(rAny.conditions)) {
      fail('dsl schema valid', `${r.ruleId}.conditions: ${ajv.errorsText(validateDsl.errors)}`);
    }
  }
  checkDslNodes(r.ruleId, 'required', rAny.required);
  checkDslNodes(r.ruleId, 'enhancers', rAny.enhancers);
  checkDslNodes(r.ruleId, 'breakers', rAny.breakers);
}

/* ---------- 6. 執行計畫覆蓋 ---------- */

const planned = new Set([...NATAL_EXECUTION_PLAN, ...PERIOD_EXECUTION_PLAN].map(p => p.ruleId));
for (const entry of [...NATAL_EXECUTION_PLAN, ...PERIOD_EXECUTION_PLAN]) {
  if (!executorNames.has(entry.executor)) fail('planned executor registered', `${entry.ruleId} -> ${entry.executor}`);
  if (!ruleIds.has(entry.ruleId)) fail('planned rule exists', entry.ruleId);
}

const CALC_PREFIX = 'ZW.CALC.';
for (const r of rules) {
  if (!r.ruleId.startsWith(CALC_PREFIX)) continue;
  const stage = r.logic?.stage;
  if (!stage || stage === 'unplanned') {
    fail('calculation rule has stage', `${r.ruleId} (stage=${stage ?? 'undefined'})`);
  }
  if (stage === 'natal' || stage === 'period') {
    if (!planned.has(r.ruleId)) fail('stagable rule is in a plan', r.ruleId);
  }
  if (r.status === 'deprecated' && planned.has(r.ruleId)) {
    fail('no deprecated rule in plan', r.ruleId);
  }
}

/* ---------- 7. changeLog / ruleVersion ---------- */

for (const r of rules) {
  const log = (r as unknown as { changeLog?: Array<{ version: string; type: string }> }).changeLog ?? [];
  if (log.length === 0) fail('rule has changeLog', r.ruleId);
  if (r.status === 'canonical' && log.length > 0) {
    const latest = log[0].version;
    if (latest !== r.ruleVersion) {
      fail('ruleVersion matches latest changeLog', `${r.ruleId}: v${r.ruleVersion} vs changeLog ${latest}`);
    }
  }
}

/* ---------- 輸出 ---------- */

const total = rules.length;
if (failures.length === 0) {
  console.log(`integrity OK — ${total} rules, ${starRegistry.stars.length} stars, ${sourceIds.size} sources, ${evidenceIds.size} evidence, ${executorNames.size} executors`);
  console.log(`execution plan: natal ${NATAL_EXECUTION_PLAN.length} / period ${PERIOD_EXECUTION_PLAN.length}`);
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
