/**
 * Pattern Research Backlog checks（spec Post-Stability Phase G；供 CLI 與測試共用）
 *
 * 原則：格局只登錄有古典原文可引者，且未經 Owner 批准不得實作。
 * 驗證：
 *   - schema 合法、patternKey 唯一
 *   - sourceId 可解析
 *   - implemented / equivalent → relatedRuleId 必須是既有 pattern 或 interpretation 規則
 *   - research → 必須有 researchId（且該研究項存在）
 *   - rejected → 必須有 note 說明理由
 *   - research / rejected 不得同時指到既有 pattern 規則（避免「假研究、真實作」）
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { listPatterns, listInterpretationRules, listSources, listResearch } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const BACKLOG_REL = 'research/patterns/pattern-backlog.json';

export interface BacklogEntry {
  patternKey: string;
  name?: Record<string, string>;
  status: 'implemented' | 'equivalent' | 'research' | 'rejected';
  quote: string;
  sourceId: string;
  locator?: Record<string, string>;
  relatedRuleId?: string | null;
  researchId?: string | null;
  gap?: string | null;
  note?: string;
}

export interface PatternBacklog {
  backlogVersion: string;
  entries: BacklogEntry[];
}

export interface PatternBacklogResult {
  failures: string[];
  stats: {
    entries: number;
    implemented: number;
    equivalent: number;
    research: number;
    rejected: number;
  };
}

export function readPatternBacklog(): PatternBacklog {
  return JSON.parse(readFileSync(join(root, BACKLOG_REL), 'utf8')) as PatternBacklog;
}

export function runPatternBacklogChecks(): PatternBacklogResult {
  const failures: string[] = [];
  const backlog = readPatternBacklog();

  const schema = JSON.parse(readFileSync(join(root, 'schemas/pattern-backlog.schema.json'), 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validate(backlog)) {
    for (const e of validate.errors ?? []) {
      failures.push(`${BACKLOG_REL}: ${e.instancePath || '/'} ${e.message}`);
    }
  }

  const patternIds = new Set(listPatterns().map(p => p.ruleId));
  const interpretationIds = new Set(listInterpretationRules().map(p => p.ruleId));
  const sourceIds = new Set(listSources().map(s => s.sourceId));
  const researchIds = new Set(listResearch().map(r => r.researchId));

  const seen = new Set<string>();
  for (const e of backlog.entries) {
    const key = e.patternKey;
    if (seen.has(key)) failures.push(`duplicate patternKey: ${key}`);
    seen.add(key);

    if (!e.quote || e.quote.trim() === '') failures.push(`${key}: 必須有古典原文 quote`);
    if (!sourceIds.has(e.sourceId)) failures.push(`${key}: sourceId not found ${e.sourceId}`);

    if (e.status === 'implemented' || e.status === 'equivalent') {
      if (!e.relatedRuleId) {
        failures.push(`${key}: status=${e.status} 必須提供 relatedRuleId`);
      } else if (!patternIds.has(e.relatedRuleId) && !interpretationIds.has(e.relatedRuleId)) {
        failures.push(`${key}: relatedRuleId not a pattern/interpretation rule: ${e.relatedRuleId}`);
      }
    }

    if (e.status === 'research') {
      if (!e.researchId || !researchIds.has(e.researchId)) {
        failures.push(`${key}: status=research 必須有可解析之 researchId（${e.researchId ?? 'none'}）`);
      }
      if (e.relatedRuleId) {
        failures.push(`${key}: status=research 不得指向既有 pattern 規則（${e.relatedRuleId}）`);
      }
    }

    if (e.status === 'rejected' && !e.note) {
      failures.push(`${key}: status=rejected 必須有 note 說明理由`);
    }
  }

  const count = (s: BacklogEntry['status']) => backlog.entries.filter(e => e.status === s).length;
  return {
    failures,
    stats: {
      entries: backlog.entries.length,
      implemented: count('implemented'),
      equivalent: count('equivalent'),
      research: count('research'),
      rejected: count('rejected')
    }
  };
}
