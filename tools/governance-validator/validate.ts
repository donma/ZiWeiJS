#!/usr/bin/env tsx
/**
 * Governance Validator（spec §8 Canonical Evidence Gate / §31 / §32）
 *
 * canonical 新標準：
 *   - ≥1 sourceRef，且必須是 Tier 1–3（或工程契約來源 SRC.SPEC.ENGINE）
 *   - ≥1 evidenceRef
 *   - 建議：1 個 Tier 1/2，或 2 個獨立 Tier 3
 *   - changeLog 版本必須與 ruleVersion 一致
 *
 * 並且：
 *   - sourceRef / evidenceRef / evidence.sourceId / variantOf 必須可解析
 *   - AI 不得作為來源
 *   - variant 規則必須宣告 variantOf
 *   - 不得有 canonical 規則指向已 deprecated 的 variantOf
 *
 * 用法：npm run validate:governance
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listRules, listSources, listEvidence, getSource } from '../../src/index.js';
import type { Rule, Source } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

interface Failure { check: string; detail: string; }
const failures: Failure[] = [];
const fail = (check: string, detail: string) => failures.push({ check, detail });

const rules = listRules();
const sources = listSources();
const evidence = listEvidence();

const sourceById = new Map<string, Source>(sources.map(s => [s.sourceId, s]));
const evidenceById = new Map(evidence.map(e => [String(e.evidenceId), e as unknown as { evidenceId: string; sourceId: string; type: string }]));
const ruleById = new Map<string, Rule>(rules.map(r => [r.ruleId, r]));

const AI_PATTERN = /chatgpt|openai|claude|gemini|\bai\b/i;
/** 工程契約類規則可使用的非命理來源 */
const ENGINE_CONTRACT_SOURCES = new Set(['SRC.SPEC.ENGINE']);

/* ---------- 1. 來源不得為 AI ---------- */
for (const s of sources) {
  const text = `${s.title ?? ''} ${s.author ?? ''}`;
  if (AI_PATTERN.test(text)) fail('source is not AI', `${s.sourceId}: ${s.title}`);
}

/* ---------- 2. 參照可解析 ---------- */
for (const r of rules) {
  for (const ref of r.sourceRefs ?? []) {
    if (!sourceById.has(ref)) fail('sourceRef resolvable', `${r.ruleId} -> ${ref}`);
  }
  for (const ref of r.evidenceRefs ?? []) {
    if (!evidenceById.has(ref)) fail('evidenceRef resolvable', `${r.ruleId} -> ${ref}`);
  }
  if (r.variantOf && !ruleById.has(r.variantOf)) fail('variantOf resolvable', `${r.ruleId} -> ${r.variantOf}`);
}
for (const e of evidenceById.values()) {
  if (!sourceById.has(e.sourceId)) fail('evidence source resolvable', `${e.evidenceId} -> ${e.sourceId}`);
}

/* ---------- 3. Canonical Evidence Gate ---------- */
function tierOf(sourceId: string): number | undefined {
  return sourceById.get(sourceId)?.tier;
}

for (const r of rules) {
  if (r.status !== 'canonical') continue;

  const refs = r.sourceRefs ?? [];
  const evRefs = r.evidenceRefs ?? [];

  if (refs.length === 0) fail('canonical has sourceRef', r.ruleId);
  if (evRefs.length === 0) fail('canonical has evidenceRef', r.ruleId);

  const tiers = refs.map(tierOf).filter((t): t is number => typeof t === 'number');
  const isEngineContract = refs.some(s => ENGINE_CONTRACT_SOURCES.has(s));

  const hasTier12 = refs.some(s => {
    const t = tierOf(s);
    return t !== undefined && t <= 2;
  });
  const distinctTier3 = new Set(refs.filter(s => tierOf(s) === 3)).size;

  if (!isEngineContract) {
    const tooWeak = tiers.length === 0 || tiers.every(t => t > 3);
    if (tooWeak) fail('canonical source tier 1-3', `${r.ruleId} (tiers: ${tiers.join(',') || 'none'})`);
    if (!hasTier12 && distinctTier3 < 2) {
      fail('canonical evidence strength (Tier1/2 or 2x Tier3)', `${r.ruleId} (tiers: ${tiers.join(',') || 'none'})`);
    }
    if (refs.some(s => ENGINE_CONTRACT_SOURCES.has(s))) {
      fail('engine-contract source not used for divination rules', r.ruleId);
    }
  }

  // evidence 必須支持本規則（type 不得為 conflicts）
  for (const ref of evRefs) {
    const e = evidenceById.get(ref);
    if (!e) continue;
    if (e.type === 'conflicts') {
      fail('canonical evidence must not be conflicts-only', `${r.ruleId} -> ${ref}`);
    }
  }
}

/* ---------- 4. variant 規則必須宣告 variantOf ---------- */
for (const r of rules) {
  if (r.status === 'variant' && !r.variantOf) {
    fail('variant rule declares variantOf', r.ruleId);
  }
  if (r.variantOf && ruleById.get(r.variantOf)?.status !== 'canonical') {
    fail('variantOf points to canonical', `${r.ruleId} -> ${r.variantOf}`);
  }
}

/* ---------- 5. deprecated 不得被引用 ---------- */
const deprecated = new Set(rules.filter(r => r.status === 'deprecated').map(r => r.ruleId));
for (const r of rules) {
  if (r.variantOf && deprecated.has(r.variantOf)) {
    fail('variantOf is not deprecated', `${r.ruleId} -> ${r.variantOf}`);
  }
}

/* ---------- 6. changeLog / ruleVersion 一致性 ---------- */
for (const r of rules) {
  const log = (r as unknown as { changeLog?: Array<{ version: string; type: string }> }).changeLog ?? [];
  if (log.length === 0) {
    fail('rule has changeLog', r.ruleId);
    continue;
  }
  if (log[0].version !== r.ruleVersion) {
    fail('ruleVersion matches latest changeLog', `${r.ruleId}: v${r.ruleVersion} vs ${log[0].version}`);
  }
}

/* ---------- 7. research / candidate 必須標記待補 ---------- */
for (const r of rules) {
  if (r.status === 'research' && (r.evidenceRefs ?? []).length === 0) {
    // 允許，但需在 changeLog 說明待補
    const log = (r as unknown as { changeLog?: Array<{ note?: string }> }).changeLog ?? [];
    if (!log.some(l => /待補|待考證|candidate|research/i.test(l.note ?? ''))) {
      fail('research rule notes pending evidence', r.ruleId);
    }
  }
}

/* ---------- 8. 統計 ---------- */
const canonical = rules.filter(r => r.status === 'canonical');
const canonicalWithEvidence = canonical.filter(r => (r.evidenceRefs ?? []).length > 0);
const coverage = canonical.length === 0 ? 100 : (canonicalWithEvidence.length / canonical.length) * 100;

const jsonOut = process.argv.includes('--json');
if (failures.length === 0) {
  console.log(`governance OK — canonical ${canonical.length}/${rules.length}, canonical evidence coverage ${coverage.toFixed(1)}%`);
  if (jsonOut) console.log(JSON.stringify({ canonical: canonical.length, total: rules.length, coverage }, null, 2));
  process.exit(0);
}

const grouped = new Map<string, string[]>();
for (const f of failures) {
  (grouped.get(f.check) ?? grouped.set(f.check, []).get(f.check)!).push(f.detail);
}
console.error(`governance FAILED — ${failures.length} problem(s)`);
for (const [check, details] of grouped) {
  console.error(`\n[${check}] ${details.length}`);
  for (const d of details.slice(0, 15)) console.error(`  - ${d}`);
  if (details.length > 15) console.error(`  ... and ${details.length - 15} more`);
}
process.exit(1);
