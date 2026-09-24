/**
 * Assimilation catalog checks（供 CLI 與測試共用，spec §25 精神）
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { listRules, listEvidence, listResearch } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

export interface CatalogResult {
  failures: string[];
  stats: {
    cycles: number;
    cycleEntries: number;
    aliases: number;
    candidates: number;
    rejections: number;
    snapshots: number;
  };
}

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

function validateWith(schemaRel: string, dataRel: string, failures: string[]): void {
  const schema = readJson(schemaRel) as Record<string, unknown>;
  const data = readJson(dataRel);
  // 每次以獨立 Ajv 編譯，避免同一 $id 重複加入同一實例
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validate(data)) {
    for (const e of validate.errors ?? []) {
      failures.push(`${dataRel}: ${e.instancePath || '/'} ${e.message}`);
    }
  }
}

export function runCatalogChecks(): CatalogResult {
  const failures: string[] = [];
  const ruleIds = new Set(listRules().map(r => r.ruleId));
  const evidenceIds = new Set(listEvidence().map(e => e.evidenceId));
  const researchIds = new Set(listResearch().map(r => r.researchId));

  /* ---------- 1. cycles ---------- */
  const cycleDir = join(root, 'tables/cycles');
  const cycleFiles = existsSync(cycleDir) ? readdirSync(cycleDir).filter(f => f.endsWith('.json')) : [];
  let cycleEntries = 0;
  const cycleEntityIds = new Set<string>();
  for (const f of cycleFiles) {
    const rel = `tables/cycles/${f}`;
    validateWith('schemas/cycle.schema.json', rel, failures);
    const data = readJson(rel) as {
      cycleId: string;
      placementRuleId?: string;
      evidenceRefs?: string[];
      entries: Array<{ key: string; index: number; starId?: string | null }>;
    };
    cycleEntries += data.entries.length;
    if (data.placementRuleId && !ruleIds.has(data.placementRuleId)) {
      failures.push(`${rel}: placementRuleId not found: ${data.placementRuleId}`);
    }
    for (const e of data.evidenceRefs ?? []) {
      if (!evidenceIds.has(e)) failures.push(`${rel}: evidenceRef not found: ${e}`);
    }
    const seenIndex = new Set<number>();
    for (const e of data.entries) {
      // 每個 entry 都有穩定的 cycle entity id；若同時對應 star registry entry 則兩者皆可解析
      cycleEntityIds.add(`ZW.CYCLE.${data.cycleId.toUpperCase()}.${e.key.toUpperCase()}`);
      if (e.starId) cycleEntityIds.add(e.starId);
      if (seenIndex.has(e.index)) failures.push(`${rel}: duplicate index ${e.index}`);
      seenIndex.add(e.index);
    }
  }
  // index 需連續 0..n-1
  for (const f of cycleFiles) {
    const data = readJson(`tables/cycles/${f}`) as { entries: Array<{ index: number }> };
    const idx = [...data.entries.map(e => e.index)].sort((a, b) => a - b);
    for (let i = 0; i < idx.length; i++) {
      if (idx[i] !== i) {
        failures.push(`tables/cycles/${f}: index not contiguous at ${i}`);
        break;
      }
    }
  }

  /* ---------- 2. aliases ---------- */
  const starIds = new Set(
    (readJson('tables/stars/registry.json') as { stars: Array<{ id: string }> }).stars.map(s => s.id)
  );
  const knownEntityIds = new Set([...starIds, ...cycleEntityIds]);
  validateWith('schemas/star-aliases.schema.json', 'tables/stars/aliases.json', failures);
  const aliases = (readJson('tables/stars/aliases.json') as {
    entries: Array<{ alias: string; starId?: string | null; candidates?: string[] }>;
  }).entries;
  const aliasSeen = new Set<string>();
  for (const a of aliases) {
    if (aliasSeen.has(a.alias)) failures.push(`aliases: duplicate alias ${a.alias}`);
    aliasSeen.add(a.alias);
    if (a.starId && !knownEntityIds.has(a.starId)) failures.push(`aliases: starId not found ${a.starId}`);
    for (const c of a.candidates ?? []) {
      if (!knownEntityIds.has(c)) failures.push(`aliases: candidate not found ${c} (${a.alias})`);
    }
  }

  /* ---------- 3. candidates / rejections / snapshots ---------- */
  const assimDir = join(root, 'research/assimilation');
  const projectConfig = readJson('research/assimilation/external-projects.json') as {
    projects: Array<{ project: string; dir: string }>;
  };
  const knownProjects = new Set(projectConfig.projects.map(p => p.project));

  let candidatesCount = 0;
  let snapshots = 0;
  for (const dir of readdirSync(assimDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const candRel = `research/assimilation/${dir.name}/candidates.json`;
    if (existsSync(join(root, candRel))) {
      validateWith('schemas/assimilation-candidate.schema.json', candRel, failures);
      const data = readJson(candRel) as {
        candidates: Array<{ candidateId: string; researchId?: string; externalRefs?: Array<{ project: string }> }>;
      };
      for (const c of data.candidates) {
        candidatesCount++;
        if (c.researchId && !researchIds.has(c.researchId)) {
          failures.push(`${candRel}: researchId not found ${c.researchId}`);
        }
        for (const ref of c.externalRefs ?? []) {
          if (!knownProjects.has(ref.project) && ref.project !== 'external') {
            failures.push(`${candRel}: unknown external project ${ref.project}`);
          }
        }
      }
    }
    const snapRel = `research/assimilation/${dir.name}/snapshot.json`;
    if (existsSync(join(root, snapRel))) {
      validateWith('schemas/external-snapshot.schema.json', snapRel, failures);
      const snap = readJson(snapRel) as { project: string; commit: string; license: string };
      snapshots++;
      if (!knownProjects.has(snap.project)) failures.push(`${snapRel}: project not in external-projects.json`);
      if (!snap.commit || snap.commit.length < 7) failures.push(`${snapRel}: commit looks invalid`);
      if (!snap.license) failures.push(`${snapRel}: license missing`);
    }
  }

  validateWith('schemas/assimilation-rejection.schema.json', 'research/assimilation/rejections.json', failures);
  const rejections = (readJson('research/assimilation/rejections.json') as {
    rejections: Array<{ id: string }>;
  }).rejections;
  const rejSeen = new Set<string>();
  for (const r of rejections) {
    if (rejSeen.has(r.id)) failures.push(`rejections: duplicate id ${r.id}`);
    rejSeen.add(r.id);
  }

  return {
    failures,
    stats: {
      cycles: cycleFiles.length,
      cycleEntries,
      aliases: aliases.length,
      candidates: candidatesCount,
      rejections: rejections.length,
      snapshots
    }
  };
}
