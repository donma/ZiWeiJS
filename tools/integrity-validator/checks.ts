/**
 * Integrity checks（spec §25 / §31 Bible Quality Gate）
 *
 * 檢查項目（與 validate.ts CLI 共用同一份實作，確保測試與 gate 不分歧）：
 *   - Rule ID / Star ID / Source ID / Evidence ID / Profile ID 唯一
 *   - sourceRefs / evidenceRefs / variantOf / executor 全部可解析
 *   - canonical rule 有 source 與 evidence
 *   - canonical star 有 source（且 star schema 合法）
 *   - profile.ruleOverrides 的來源與目標皆存在
 *   - 所有規則資料的 DSL 符合 schemas/dsl.schema.json
 *   - 執行計畫中的 executor 皆已註冊（0 unknown executor）
 *   - 每條 calculation 規則都有 stage（0 unplanned）
 *   - canonical 規則的 ruleVersion 與 changeLog 最新版本一致
 *   - src/ 不得引入外部排盤套件 / vendor（spec §6 / §44；見 pollution.ts）
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import { listRules, listSources, listEvidence, listProfiles } from '../../src/index.js';
import { listExecutorNames } from '../../src/rule-engine/executor-registry.js';
import { registerAllExecutors } from '../../src/rule-engine/register-executors.js';
import { NATAL_EXECUTION_PLAN, PERIOD_EXECUTION_PLAN } from '../../src/rule-engine/execution-plan.js';
import { runPollutionChecks } from './pollution.js';

export interface IntegrityFailure {
  check: string;
  detail: string;
}

export interface IntegrityResult {
  failures: IntegrityFailure[];
  stats: {
    rules: number;
    stars: number;
    sources: number;
    evidence: number;
    profiles: number;
    executors: number;
    natalPlan: number;
    periodPlan: number;
    srcFiles: number;
    calendarImporters: number;
  };
}

export interface StarEntry {
  id: string; status: string; sources?: string[]; category?: string; name?: Record<string, string>;
}

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));

export function runIntegrityChecks(root: string = defaultRoot): IntegrityResult {
  const failures: IntegrityFailure[] = [];
  const fail = (check: string, detail: string) => failures.push({ check, detail });

  const ajvInstance = new Ajv({ allErrors: true, strict: false });
  registerAllExecutors();

  function duplicates(ids: string[]): string[] {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) dup.add(id);
      seen.add(id);
    }
    return [...dup];
  }

  /* ---------- 1. ID 唯一 ---------- */
  const rules = listRules();
  for (const d of duplicates(rules.map(r => r.ruleId))) fail('ruleId unique', d);
  const sources = listSources();
  for (const d of duplicates(sources.map(s => s.sourceId))) fail('sourceId unique', d);
  const evidence = listEvidence();
  for (const d of duplicates(evidence.map(e => `${e.evidenceId}`))) fail('evidenceId unique', d);
  const profiles = listProfiles();
  for (const d of duplicates(profiles.map(p => p.profileId))) fail('profileId unique', d);

  /* ---------- 2. 參照可解析 ---------- */
  const sourceIds = new Set(sources.map(s => s.sourceId));
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

  for (const p of profiles) {
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
  const starRegistry = JSON.parse(
    readFileSync(join(root, 'tables/stars/registry.json'), 'utf8')
  ) as { stars: StarEntry[] };
  const starSchema = JSON.parse(readFileSync(join(root, 'schemas/star.schema.json'), 'utf8'));
  const validateStar = ajvInstance.compile(starSchema);

  for (const d of duplicates(starRegistry.stars.map(s => s.id))) fail('starId unique', d);

  for (const s of starRegistry.stars) {
    const starId = s.id;
    if (!validateStar(s)) {
      fail('star schema valid', `${starId}: ${ajvInstance.errorsText(validateStar.errors)}`);
    }
    if (s.status === 'canonical' && (s.sources ?? []).length === 0) fail('canonical star has source', starId);
    for (const ref of s.sources ?? []) {
      if (!sourceIds.has(ref)) fail('star source resolvable', `${starId} -> ${ref}`);
    }
  }

  /* ---------- 5. DSL schema ---------- */
  const dslSchema = JSON.parse(readFileSync(join(root, 'schemas/dsl.schema.json'), 'utf8'));
  const validateDsl = ajvInstance.compile(dslSchema);

  function checkDslNodes(ruleId: string, label: string, nodes: unknown[] | undefined): void {
    for (const node of nodes ?? []) {
      if (!validateDsl(node)) {
        fail('dsl schema valid', `${ruleId}.${label}: ${ajvInstance.errorsText(validateDsl.errors)}`);
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
        fail('dsl schema valid', `${r.ruleId}.conditions: ${ajvInstance.errorsText(validateDsl.errors)}`);
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

  /* ---------- 8. pollution / isolation（spec §6 / §44 / §52） ---------- */
  const pollution = runPollutionChecks(root);
  failures.push(...pollution.failures);

  return {
    failures,
    stats: {
      rules: rules.length,
      stars: starRegistry.stars.length,
      sources: sourceIds.size,
      evidence: evidenceIds.size,
      profiles: profiles.length,
      executors: executorNames.size,
      natalPlan: NATAL_EXECUTION_PLAN.length,
      periodPlan: PERIOD_EXECUTION_PLAN.length,
      srcFiles: pollution.stats.srcFiles,
      calendarImporters: pollution.stats.calendarImporters.length
    }
  };
}
