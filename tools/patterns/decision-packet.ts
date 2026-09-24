#!/usr/bin/env tsx
/**
 * Pattern Decision Packet（spec M7「先品質，再數量」／§42 Evidence 分層）
 *
 * 把 `research/patterns/pattern-backlog.json` 轉成一份**可直接交給 Owner 決策**的包：
 *   - 逐條列出原文定義句（機械切出「詩曰」之前的定義語）與 gap
 *   - 依 gap 文字機械分類 readiness（不新增判斷）：
 *     landed / rejected / ready-for-owner-review / needs-collation / needs-owner-scope /
 *     needs-definition / needs-review（definitionClause 為機械切出之散文定義；無者標 poem-or-gap）
 *   - 列出實作前必須備齊的 artifacts（ruleId / Source+Evidence / tests / plan coverage）
 *   - `ownerDecision` 一律 null：AI 不得代為決定，亦不得自行實作 canonical
 *
 * 產出：research/patterns/pattern-decision-packet.json
 * 用法：
 *   npm run patterns:packet
 *   npm run patterns:packet -- --check
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outPath = join(root, 'research/patterns/pattern-decision-packet.json');
const checkOnly = process.argv.includes('--check');

interface BacklogEntry {
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

const backlog = JSON.parse(readFileSync(join(root, 'research/patterns/pattern-backlog.json'), 'utf8')) as {
  backlogVersion: string;
  entries: BacklogEntry[];
};

type Readiness =
  | 'landed'
  | 'rejected'
  | 'ready-for-owner-review'
  | 'needs-collation'
  | 'needs-owner-scope'
  | 'needs-definition'
  | 'needs-review';

/** 依 gap / note 文字機械分類（不新增命理判斷） */
function classify(e: BacklogEntry): Readiness {
  if (e.status === 'implemented' || e.status === 'equivalent') return 'landed';
  if (e.status === 'rejected') return 'rejected';
  const text = `${e.gap ?? ''}${e.note ?? ''}`;
  if (/殘缺|脫誤|校勘/.test(text)) return 'needs-collation';
  if (/體系|Owner 決策/.test(text)) return 'needs-owner-scope';
  if (/定義明確|有明確定義|優先研究/.test(text)) return 'ready-for-owner-review';
  if (/定義不足|無一句式定義|需先確定|需先/.test(text)) return 'needs-definition';
  return 'needs-review';
}

/** 機械切出「詩曰」之前的定義語；無定義標記（是也／在／逢／同宮／三方）則 null */
function definitionClause(quote: string): string | null {
  const idx = quote.search(/[诗詩]曰/);
  const head = (idx >= 0 ? quote.slice(0, idx) : quote).trim();
  const cleaned = head.replace(/^论|^論/, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.startsWith('===')) return null;
  if (!/是也|在|逢|同宮|同宫|三方/.test(cleaned)) return null;
  return cleaned;
}

const READINESS_ORDER: Readiness[] = [
  'ready-for-owner-review',
  'needs-definition',
  'needs-collation',
  'needs-owner-scope',
  'needs-review',
  'landed',
  'rejected'
];

const entries = backlog.entries
  .map(e => {
    const readiness = classify(e);
    return {
      patternKey: e.patternKey,
      name: e.name?.['zh-TW'] ?? e.patternKey,
      status: e.status,
      readiness,
      quote: e.quote,
      definitionClause: definitionClause(e.quote),
      definitionSource: definitionClause(e.quote) ? 'prose' : 'poem-or-gap',
      sourceId: e.sourceId,
      locator: e.locator ?? null,
      researchId: e.researchId ?? null,
      relatedRuleId: e.relatedRuleId ?? null,
      gap: e.gap ?? null,
      note: e.note ?? null,
      proposedRuleId: readiness === 'landed' || readiness === 'rejected' ? null : `ZW.PAT.${e.patternKey.replace(/^PAT\./, '')}.001`,
      requiredArtifacts:
        readiness === 'landed' || readiness === 'rejected'
          ? []
          : [
              'Source + Evidence（《全書》原文為 Tier1；須逐條 EVD）',
              'Rule（pattern stage、canonical 需 Owner 批准；不得由 AI 自行升級）',
              'Tests（unit + 至少一個 golden/negative case）',
              'Pattern Engine 條件覆蓋（避免與既有格局重疊）',
              'Differential / 影響評估（既有 24 格局輸出不得改變）'
            ],
      ownerDecision: null
    };
  })
  .sort((a, b) => {
    const ra = READINESS_ORDER.indexOf(a.readiness as Readiness);
    const rb = READINESS_ORDER.indexOf(b.readiness as Readiness);
    return ra - rb || a.patternKey.localeCompare(b.patternKey);
  });

const byReadiness = READINESS_ORDER.reduce<Record<string, number>>((acc, r) => {
  acc[r] = entries.filter(e => e.readiness === r).length;
  return acc;
}, {});

const report = {
  packetVersion: '1.0.0',
  generatedBy: 'tools/patterns/decision-packet.ts',
  specRef: 'ai-guide/ZiWeiJS-Post-Stability-External-Strength-Assimilation-SPEC-v1.md M7 / §42 / §49',
  backlogVersion: backlog.backlogVersion,
  note:
    '本包只整理既有 backlog（原文＋gap）供 Owner 決策：readiness 為文字機械分類，非命理判斷；' +
    'ownerDecision 一律 null。AI 不得自行實作或升級 canonical，亦不得以外部實作共識補足定義。',
  totals: { entries: entries.length, ...byReadiness },
  decisionGuide: {
    'ready-for-owner-review': '定義明確且有古典原文 → 可請 Owner 批准實作（批准後仍需 Source+Evidence+Tests）',
    'needs-definition': '原文僅詩曰或定義不明 → 先補來源或校勘，不得依詩意自行設計條件',
    'needs-collation': '原文疑似脫誤 → 需第二來源或校勘後再議',
    'needs-owner-scope': '屬體系性議題（如逐宮得地／失陷訣）→ 需 Owner 決定是否納入 Pattern Engine',
    'needs-review': '分類未定 → 人工複核',
    landed: '已實作或等價 → 不需動作',
    rejected: '已決議不採用 → 保留紀錄避免重複評估'
  },
  entries
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (checkOnly) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('pattern decision packet FAILED — research/patterns/pattern-decision-packet.json drift');
    process.exit(1);
  }
  console.log(`pattern decision packet OK — ${entries.length} entries, no drift`);
  process.exit(0);
}

writeFileSync(outPath, serialized, 'utf8');
console.log(`pattern decision packet written — ${entries.length} entries`);
console.log('readiness', JSON.stringify(byReadiness));
