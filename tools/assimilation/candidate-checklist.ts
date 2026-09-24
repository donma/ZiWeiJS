#!/usr/bin/env tsx
/**
 * Candidate Checklist（spec §49：Candidate 進入 Repo 前檢查）
 *
 * 把 §49 的 12 項檢查「機械化」為可重複執行的報告，避免候選靠印象升級：
 *
 *   有 Gap 說明 / 有增益說明 / 無現有重複能力 / 有 stable ID / 有 Schema / 有 Rule /
 *   有 Source route / 有 Evidence route / 有 Test / 有 external comparison /
 *   初始狀態為 research / Owner review
 *
 * 判準分兩級：
 *   - enforced：可機械證明者（缺 stable ID、缺 gap/benefit、researchId 不可解析、
 *     status 非 research 卻無 decision、status=research 卻有 decision）→ 直接 fail。
 *   - advisory：需 Owner 判斷者（重複能力、test、owner review 實質內容）→ 只記錄狀態。
 *
 * 產出：research/assimilation/candidate-checklist.json
 * 用法：
 *   npm run assimilation:candidate-checklist
 *   npm run assimilation:candidate-checklist -- --check
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRules, listResearch, listStarRegistry } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const assimDir = join(root, 'research/assimilation');
const outPath = join(assimDir, 'candidate-checklist.json');
const checkOnly = process.argv.includes('--check');

interface Candidate {
  candidateId: string;
  type: string;
  title?: string;
  externalRefs?: Array<{ project: string; version?: string }>;
  ziweiGap: 'missing' | 'partial' | 'none';
  benefit: string[];
  status: 'research' | 'candidate' | 'accepted' | 'rejected';
  independentEvidence?: string[];
  researchId?: string;
  decision?: string | null;
  notes?: string;
}

/** 需 Rule / Source / Evidence route 之知識型候選（其餘為軟體能力，route 為 n/a） */
const KNOWLEDGE_TYPES = new Set(['star', 'rule', 'pattern', 'variant', 'period']);

/** candidate type → 目標 schema（無對應者為 n/a） */
const SCHEMA_BY_TYPE: Record<string, string | null> = {
  star: 'schemas/star.schema.json',
  rule: 'schemas/rule.schema.json',
  pattern: 'schemas/pattern.schema.json',
  variant: 'schemas/rule.schema.json',
  period: 'schemas/rule.schema.json',
  query: null,
  property: null,
  metadata: null,
  product: null,
  tool: null
};

const rules = new Map(listRules().map(r => [r.ruleId, r]));
const research = new Map(listResearch().map(r => [r.researchId, r]));
const registryNames = new Set(
  listStarRegistry().flatMap(s => Object.values(s.name ?? {})).map(n => n.replace(/\s+/g, ''))
);

const projects = JSON.parse(readFileSync(join(assimDir, 'external-projects.json'), 'utf8')) as {
  projects: Array<{ project: string; dir: string }>;
};

interface Entry {
  candidateId: string;
  project: string;
  type: string;
  status: string;
  checks: Record<string, boolean | string>;
  advisory: string[];
  failures: string[];
}

const entries: Entry[] = [];
const failures: string[] = [];

for (const proj of projects.projects) {
  const rel = `research/assimilation/${proj.dir}/candidates.json`;
  if (!existsSync(join(root, rel))) continue;
  const data = JSON.parse(readFileSync(join(root, rel), 'utf8')) as { candidates: Candidate[] };

  for (const c of data.candidates) {
    const item = c.researchId ? research.get(c.researchId) : undefined;
    const entryFailures: string[] = [];
    const advisory: string[] = [];

    const stableId = /^ASM\.[A-Z0-9._]+$/.test(c.candidateId);
    const gapStatement = c.ziweiGap !== 'none' || Boolean(c.notes && c.notes.trim() !== '');
    const benefitStatement = c.benefit.length > 0;
    const externalComparison = (c.externalRefs ?? []).length > 0;
    const needsResearchRoute = KNOWLEDGE_TYPES.has(c.type);
    const schemaTarget = SCHEMA_BY_TYPE[c.type] ?? null;
    const schema = schemaTarget ? existsSync(join(root, schemaTarget)) : 'n/a';
    const ruleRoute = needsResearchRoute ? Boolean(item) && (item?.relatedRules ?? []).length > 0 : 'n/a';
    const sourceRoute = !needsResearchRoute ? 'n/a' : ruleRoute === true && (item?.relatedRules ?? []).every(id => {
      const rule = rules.get(id);
      return Boolean(rule && (rule.sourceRefs ?? []).length > 0);
    });
    const evidenceRoute = !needsResearchRoute
      ? 'n/a'
      : (c.independentEvidence ?? []).length > 0 || (item?.evidence ?? []).length > 0;
    const initialStatusResearch = c.status === 'research' ? (c.decision ?? null) === null : Boolean(c.decision);

    // 重複能力：star 型候選之 zh 名稱不得已存在於 star registry（機械可證部分）
    let noDuplicate: boolean | string = 'advisory';
    if (c.type === 'star' && c.status === 'accepted') {
      noDuplicate = 'n/a (已落地)';
    } else if (c.type === 'star') {
      const names = Object.values((c as unknown as { name?: Record<string, string> }).name ?? {});
      const title = c.title ?? '';
      const hit = names.find(n => registryNames.has(n.replace(/\s+/g, '')))
        ?? (registryNames.has(title.replace(/\s+/g, '')) ? title : undefined);
      noDuplicate = hit ? false : true;
      if (hit) entryFailures.push(`${c.candidateId}: star 名稱已存在於 registry（${hit}）→ 應改為 variant/alias 或標明重複`);
    } else {
      advisory.push('重複能力無法機械證明：需 Owner 於 review 時對照既有模組');
    }

    if (!stableId) entryFailures.push(`${c.candidateId}: stable ID 格式不符（ASM.*）`);
    if (!gapStatement) entryFailures.push(`${c.candidateId}: 缺 Gap 說明`);
    if (!benefitStatement) entryFailures.push(`${c.candidateId}: 缺增益說明`);
    if (!externalComparison) entryFailures.push(`${c.candidateId}: 缺 external comparison（externalRefs 為空）`);
    if (c.researchId && !item) entryFailures.push(`${c.candidateId}: researchId 不可解析（${c.researchId}）`);
    if (needsResearchRoute && !c.researchId) entryFailures.push(`${c.candidateId}: 知識型候選缺 researchId（無 Source/Evidence route）`);
    if (!initialStatusResearch) entryFailures.push(`${c.candidateId}: status=${c.status} 與 decision=${c.decision ?? 'null'} 不一致`);
    if (c.status !== 'research') advisory.push('非 research 狀態：Owner review 實質內容需人工確認');
    if (evidenceRoute === false) advisory.push('Evidence route 目前為空：升級前必須補 Evidence');

    entries.push({
      candidateId: c.candidateId,
      project: proj.project,
      type: c.type,
      status: c.status,
      checks: {
        gapStatement,
        benefitStatement,
        noDuplicateCapability: noDuplicate,
        stableId,
        schema,
        rule: ruleRoute,
        sourceRoute,
        evidenceRoute,
        test: c.status === 'research' ? 'n/a (status=research)' : 'advisory',
        externalComparison,
        initialStatusResearch,
        ownerReview: c.status === 'research' ? 'pending' : 'advisory'
      },
      advisory,
      failures: entryFailures
    });
    failures.push(...entryFailures);
  }
}

entries.sort((a, b) => a.candidateId.localeCompare(b.candidateId));

const report = {
  checklistVersion: '1.0.0',
  generatedBy: 'tools/assimilation/candidate-checklist.ts',
  specRef: 'ai-guide/ZiWeiJS-Post-Stability-External-Strength-Assimilation-SPEC-v1.md §49',
  note:
    '本報告只做機械可證的檢查；「無現有重複能力 / Test / Owner review」屬 Owner 判斷，一律標為 advisory，' +
    '不得由 AI 代為宣告通過。任何候選之初始狀態必須為 research。',
  totals: {
    candidates: entries.length,
    research: entries.filter(e => e.status === 'research').length,
    nonResearch: entries.filter(e => e.status !== 'research').length,
    failures: failures.length
  },
  entries
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (failures.length) {
  for (const f of failures) console.error(`candidate-checklist FAILED — ${f}`);
  process.exit(1);
}

if (checkOnly) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('candidate-checklist FAILED — research/assimilation/candidate-checklist.json drift');
    process.exit(1);
  }
  console.log(`candidate-checklist OK — ${entries.length} candidates, 0 enforced failures, no drift`);
  process.exit(0);
}

writeFileSync(outPath, serialized, 'utf8');
console.log(`candidate-checklist written — ${entries.length} candidates, 0 enforced failures`);
