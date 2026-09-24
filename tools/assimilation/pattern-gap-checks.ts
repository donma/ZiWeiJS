/**
 * Pattern Gap Audit checks（spec Post-Stability §5 / §19；供 CLI 與測試共用）
 *
 * 目的：把「格局」的缺口分成三條線，避免混為一談：
 *   1. 已實作：ZiWeiJS pattern 規則（唯一可作為 canonical 者）
 *   2. 古典待研究：research/patterns/pattern-backlog.json 內 status=research（有原文、有 researchId）
 *   3. 外部名稱：research/assimilation/<project>/external-pattern-names.json（若存在；只作 Gap Detector）
 *
 * 原則：
 *   - 外部名稱不得直接成為規則；未匹配之外部名稱一律標記 decision=research。
 *   - 未匹配之外部名稱必須已在古典 backlog 內被追蹤，否則視為漂移（fail）。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPatterns, listResearch } from '../../src/index.js';
import { readPatternBacklog } from '../patterns/checks.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ASSIM_DIR = 'research/assimilation';
const BACKLOG_REL = 'research/patterns/pattern-backlog.json';

export interface ExternalPatternName {
  name: string;
  source?: string;
}

export interface ExternalPatternFile {
  project: string;
  provenance?: string;
  names: ExternalPatternName[];
}

export interface PatternGapReport {
  generatedBy: string;
  note: string;
  ziweiPatternRules: string[];
  classicalBacklog: {
    entries: number;
    byStatus: Record<string, number>;
    equivalentToExisting: Array<{ patternKey: string; ruleId: string }>;
    unresolvedResearch: Array<{ patternKey: string; researchId: string; gap: string | null }>;
  };
  external: {
    files: Array<{ project: string; names: number }>;
    matched: Array<{ project: string; name: string; matchedBy: string }>;
    unmatched: Array<{ project: string; name: string; decision: string }>;
  };
  researchQueue: string[];
}

function normalize(name: string): string {
  return name.replace(/\s+/g, '').replace(/[（(].*?[)）]/g, '');
}

export function readExternalPatternFiles(): ExternalPatternFile[] {
  const dir = join(root, ASSIM_DIR);
  const out: ExternalPatternFile[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, 'external-pattern-names.json');
    if (!existsSync(file)) continue;
    const data = JSON.parse(readFileSync(file, 'utf8')) as ExternalPatternFile;
    out.push({ project: data.project ?? entry.name, provenance: data.provenance, names: data.names ?? [] });
  }
  return out;
}

export function buildPatternGapReport(): PatternGapReport {
  const patterns = listPatterns();
  const backlog = readPatternBacklog();
  const files = readExternalPatternFiles();

  const internalNames = new Map<string, string>();
  for (const p of patterns) {
    for (const value of Object.values(p.name ?? {})) internalNames.set(normalize(value), p.ruleId);
    internalNames.set(normalize(p.ruleId), p.ruleId);
  }

  const backlogByKey = new Map(backlog.entries.map(e => [e.patternKey, e]));
  const backlogNames = new Map<string, { patternKey: string; status: string; ruleId?: string | null }>();
  for (const e of backlog.entries) {
    backlogNames.set(normalize(e.patternKey), { patternKey: e.patternKey, status: e.status, ruleId: e.relatedRuleId });
    for (const value of Object.values(e.name ?? {})) {
      backlogNames.set(normalize(value), { patternKey: e.patternKey, status: e.status, ruleId: e.relatedRuleId });
    }
  }

  const matched: PatternGapReport['external']['matched'] = [];
  const unmatched: PatternGapReport['external']['unmatched'] = [];

  for (const file of files) {
    for (const n of file.names) {
      const key = normalize(n.name);
      const local = internalNames.get(key);
      if (local) {
        matched.push({ project: file.project, name: n.name, matchedBy: `rule:${local}` });
        continue;
      }
      const tracked = backlogNames.get(key);
      if (tracked) {
        matched.push({ project: file.project, name: n.name, matchedBy: `backlog:${tracked.patternKey}` });
        continue;
      }
      unmatched.push({ project: file.project, name: n.name, decision: 'research' });
    }
  }

  matched.sort((a, b) => (a.project + a.name).localeCompare(b.project + b.name));
  unmatched.sort((a, b) => (a.project + a.name).localeCompare(b.project + b.name));

  const byStatus: Record<string, number> = {};
  for (const e of backlog.entries) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;

  return {
    generatedBy: 'tools/assimilation/pattern-gap-audit.ts',
    note:
      '格局 Gap 僅作研究索引：外部名稱不得直接成為 canonical 規則；已實作者一律以 ZiWeiJS pattern 規則為準，' +
      '未實作者需先進入古典 backlog（原文 + Source + Evidence + researchId）並經 Owner 批准。',
    ziweiPatternRules: patterns.map(p => p.ruleId).sort(),
    classicalBacklog: {
      entries: backlog.entries.length,
      byStatus,
      equivalentToExisting: backlog.entries
        .filter(e => e.relatedRuleId)
        .map(e => ({ patternKey: e.patternKey, ruleId: e.relatedRuleId as string }))
        .sort((a, b) => a.patternKey.localeCompare(b.patternKey)),
      unresolvedResearch: backlog.entries
        .filter(e => e.status === 'research')
        .map(e => ({ patternKey: e.patternKey, researchId: e.researchId ?? '', gap: e.gap ?? null }))
        .sort((a, b) => a.patternKey.localeCompare(b.patternKey))
    },
    external: {
      files: files.map(f => ({ project: f.project, names: f.names.length })).sort((a, b) => a.project.localeCompare(b.project)),
      matched,
      unmatched
    },
    researchQueue: unmatched.map(u => u.name)
  };
}

export function runPatternGapChecks(report = buildPatternGapReport()): string[] {
  const failures: string[] = [];
  const backlog = readPatternBacklog();
  const researchIds = new Set(listResearch().map(r => r.researchId));
  const backtracked = new Set<string>();
  for (const e of backlog.entries) {
    backtracked.add(normalize(e.patternKey));
    for (const value of Object.values(e.name ?? {})) backtracked.add(normalize(value));
  }

  for (const u of report.external.unmatched) {
    if (!backtracked.has(normalize(u.name))) {
      failures.push(`外部格局名稱未被古典 backlog 追蹤：${u.project}/${u.name}`);
    }
  }

  for (const r of report.classicalBacklog.unresolvedResearch) {
    if (!r.researchId) failures.push(`backlog research 缺 researchId：${r.patternKey}`);
    else if (!researchIds.has(r.researchId)) failures.push(`backlog researchId 無法解析：${r.patternKey} → ${r.researchId}`);
  }

  for (const e of report.classicalBacklog.equivalentToExisting) {
    if (!report.ziweiPatternRules.includes(e.ruleId)) {
      failures.push(`backlog equivalent 指向不存在的 pattern 規則：${e.patternKey} → ${e.ruleId}`);
    }
  }

  return failures;
}
