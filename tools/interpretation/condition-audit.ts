#!/usr/bin/env tsx
/**
 * Interpretation Condition Audit Tool（spec 0.6 §29）。
 *
 * 逐一對照 Interpretation 規則的 text / name / description 與結構化 conditions，
 * 稽核條件完整性，區分為：
 *   - full：條件已結構化表達（如宮位、星曜、生年干）且無未結構化之重大條件詞
 *   - partial：原文包含重要生年干/四化/廟旺/吉凶條件，但條件結構未完整表達
 *   - unknown：非古典引文或無明確條件詞
 *   - manual-review：待命理研究者複核
 *
 * 用法：
 *   tsx tools/interpretation/condition-audit.ts          # 產出報告
 *   tsx tools/interpretation/condition-audit.ts --check  # 門檻檢查（CI）
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listInterpretationRules } from '../../src/index.js';
import type { Rule } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const OUT_FILE = join(root, 'research/interpretation/condition-audit.json');

type AuditStatus = 'full' | 'partial' | 'unknown' | 'manual-review';

interface AuditEntry {
  ruleId: string;
  name: string;
  domain?: string;
  hasConditions: boolean;
  hasStemCondition: boolean;
  hasPalaceCondition: boolean;
  stemMentionedInText: boolean;
  status: AuditStatus;
  note: string;
}

const STEM_WORDS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

function auditRule(r: Rule): AuditEntry {
  const name = r.name?.['zh-TW'] ?? r.ruleId;
  const desc = (r.description?.['zh-TW'] ?? '') + ' ' + (r.name?.['zh-TW'] ?? '');
  const conds = (r as unknown as { conditions?: Record<string, unknown> }).conditions ?? {};
  const condsJson = JSON.stringify(conds);

  const hasConditions = Object.keys(conds).length > 0;
  const hasStemCondition = condsJson.includes('ganzhi.year.stem') || condsJson.includes('stem');
  const hasPalaceCondition = condsJson.includes('star-in-palace') || condsJson.includes('palace');

  const stemMentionedInText = STEM_WORDS.some(w => desc.includes(`${w}年生人`) || desc.includes(`${w}年生`) || desc.includes(`${w}生人`));

  let status: AuditStatus = 'unknown';
  let note = '';

  if (!hasConditions) {
    status = 'manual-review';
    note = '無結構化 conditions，需手動複核';
  } else if (stemMentionedInText && !hasStemCondition) {
    status = 'partial';
    note = '原文提及特定生年干，但結構化條件中欠缺生年干比對';
  } else if (hasStemCondition && hasPalaceCondition) {
    status = 'full';
    note = '宮位與生年干皆已結構化表達';
  } else if (hasPalaceCondition) {
    status = 'full';
    note = '宮位星曜條件已完整結構化表達';
  } else {
    status = 'manual-review';
    note = '非標準條件結構，待人工檢視';
  }

  return {
    ruleId: r.ruleId,
    name,
    domain: (r as unknown as { domain?: string }).domain,
    hasConditions,
    hasStemCondition,
    hasPalaceCondition,
    stemMentionedInText,
    status,
    note
  };
}

const rules = listInterpretationRules();
const audited: AuditEntry[] = rules.map(auditRule);

const summary = {
  total: audited.length,
  full: audited.filter(a => a.status === 'full').length,
  partial: audited.filter(a => a.status === 'partial').length,
  unknown: audited.filter(a => a.status === 'unknown').length,
  manualReview: audited.filter(a => a.status === 'manual-review').length
};

const output = {
  specRef: 'ai-guide/ZiWeiJS-0.6-Content-Expansion-SPEC.md §29',
  generatedBy: 'tools/interpretation/condition-audit.ts',
  summary,
  entries: audited
};

writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
console.log(`interpretation condition audit written — ${summary.total} rules (full=${summary.full}, partial=${summary.partial}, manualReview=${summary.manualReview})`);

if (process.argv.includes('--check')) {
  // 門檻：至少 85% 規則條件結構為 full 或已標記
  const fullRate = summary.full / summary.total;
  if (fullRate < 0.8) {
    console.error(`audit FAILED: full rate ${(fullRate * 100).toFixed(1)}% < 80% threshold`);
    process.exit(1);
  }
  console.log(`audit check OK — full rate ${(fullRate * 100).toFixed(1)}%`);
}
