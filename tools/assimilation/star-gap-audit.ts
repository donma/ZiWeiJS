#!/usr/bin/env tsx
/**
 * Star Gap Audit（spec Post-Stability §19 / §21）
 *
 * 將外部資料集的星曜名稱清單，與 ZiWeiJS Star / Cycle registry 比對，
 * 分類為 existing / alias / actual-missing-star / cycle-deity / year-deity /
 * stage / period-dynamic / school-only / duplicate / unknown。
 *
 * 目的：避免把 stage / cycle-deity / year-deity 誤判為「缺星」，
 * 也避免只靠字面自動合併。
 *
 * 外部名稱來源：research/assimilation/<project>/external-star-names.json（若存在）。
 * 用法：
 *   npm run assimilation:star-gap            # 產生報告
 *   npm run assimilation:star-gap -- --check # 檢查報告未漂移
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNameIndex, classifyExternalName, starRegistry, cycleRegistry, type Classification } from './normalize-name.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const assimDir = join(root, 'research/assimilation');
const checkOnly = process.argv.includes('--check');

interface ExternalNameFile {
  project: string;
  provenance: string;
  names: Array<{ name: string; source?: string }>;
}

const index = buildNameIndex();

const counts = {
  star: starRegistry.stars.filter(s => !s.entityKind || s.entityKind === 'star').length,
  stage: 0,
  cycleDeity: 0,
  yearDeity: 0
};
for (const c of cycleRegistry) {
  if (c.entityKind === 'stage') counts.stage += c.entries.length;
  if (c.entityKind === 'cycle-deity') counts.cycleDeity += c.entries.length;
  if (c.entityKind === 'year-deity') counts.yearDeity += c.entries.length;
}

const results: Array<Classification & { seenIn: string[]; decision: string | null }> = [];

for (const entry of readdirSync(assimDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = join(assimDir, entry.name, 'external-star-names.json');
  if (!existsSync(file)) continue;
  const data = JSON.parse(readFileSync(file, 'utf8')) as ExternalNameFile;
  for (const n of data.names) {
    const c = classifyExternalName(n.name, index);
    results.push({
      ...c,
      seenIn: [data.project],
      decision: c.status === 'actual-missing-star' ? 'research' : c.status === 'existing' ? null : 'classify'
    });
  }
}

const report = {
  generatedBy: 'tools/assimilation/star-gap-audit.ts',
  note: '外部名稱只作 Gap Detector，不作為 canonical；actual-missing-star 一律先進 Research Queue。',
  ziweiCounts: counts,
  totalExternalNames: results.length,
  results
};

const outPath = join(assimDir, 'star-gap.json');
const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (checkOnly) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('star-gap audit FAILED — research/assimilation/star-gap.json drift');
    process.exit(1);
  }
  console.log(`star-gap audit OK — ${results.length} external names classified, no drift`);
  process.exit(0);
}

writeFileSync(outPath, serialized, 'utf8');

const byStatus = results.reduce<Record<string, number>>((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1;
  return acc;
}, {});
console.log(`star-gap audit written — ${results.length} external names`);
console.log('status', JSON.stringify(byStatus));
