#!/usr/bin/env tsx
/**
 * External Capability Report（spec Post-Stability §5 / §40）
 *
 * 彙整每個外部專案的「能力盤點」，只陳述可查證之事實與已定調之使用方式：
 *   - snapshot（repo / commit / license / stars / areasUsed）
 *   - 產出物：capability-inventory.md、candidates.json、rejected.json、external-star-names.json
 *   - 授權風險與使用界線（copyleft / unknown → 只可作驗證對象或概念索引，不得複製程式碼）
 *
 * 此報告為研究索引，不是規則、不是 Evidence。
 * 用法：
 *   npm run assimilation:capability-report
 *   npm run assimilation:capability-report -- --check
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const assimDir = join(root, 'research/assimilation');
const outPath = join(assimDir, 'external-capability-report.json');
const checkOnly = process.argv.includes('--check');

interface Snapshot {
  project: string;
  repo?: string;
  url?: string;
  license?: string | null;
  commit?: string | null;
  commitDate?: string | null;
  packageVersion?: string | null;
  stars?: number | null;
  archived?: boolean;
  capturedAt?: string;
  areasUsed?: string[];
}

const LICENSE_BOUNDARY: Record<string, string> = {
  'GPL-3.0':
    'copyleft：不得複製任何程式碼／檔案進本庫；僅可作行為驗證對象（differential oracle）。',
  UNKNOWN:
    '授權不明：不得引用任何程式碼或資料；僅可作歷史／概念索引（不可作為 Evidence）。'
};

function jsonLength(file: string, pick: (data: unknown) => unknown[]): { present: boolean; count: number } {
  if (!existsSync(file)) return { present: false, count: 0 };
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const arr = pick(data);
  return { present: true, count: Array.isArray(arr) ? arr.length : 0 };
}

const projects: Array<Record<string, unknown>> = [];

for (const entry of readdirSync(assimDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  const dir = join(assimDir, entry.name);
  const snapPath = join(dir, 'snapshot.json');
  if (!existsSync(snapPath)) continue;
  const snap = JSON.parse(readFileSync(snapPath, 'utf8')) as Snapshot;

  const candidates = jsonLength(join(dir, 'candidates.json'), d => (d as { candidates?: unknown[] }).candidates ?? []);
  const rejected = jsonLength(join(dir, 'rejected.json'), d => (d as { rejected?: unknown[] }).rejected ?? []);
  const externalNames = jsonLength(join(dir, 'external-star-names.json'), d => (d as { names?: unknown[] }).names ?? []);

  const license = snap.license ?? 'UNKNOWN';
  projects.push({
    project: snap.project ?? entry.name,
    repo: snap.repo ?? null,
    url: snap.url ?? null,
    license,
    licenseBoundary: LICENSE_BOUNDARY[license] ?? '僅比對行為與資料形狀，未複製程式碼；引用時仍須個別核對授權。',
    commit: snap.commit ?? null,
    commitDate: snap.commitDate ?? null,
    packageVersion: snap.packageVersion ?? null,
    stars: snap.stars ?? null,
    archived: snap.archived ?? false,
    capturedAt: snap.capturedAt ?? null,
    areasUsed: (snap.areasUsed ?? []).slice().sort(),
    artifacts: {
      capabilityInventory: existsSync(join(dir, 'capability-inventory.md')),
      candidates: candidates.present,
      rejected: rejected.present,
      externalStarNames: externalNames.present
    },
    counts: {
      candidates: candidates.count,
      rejected: rejected.count,
      externalStarNames: externalNames.count
    }
  });
}

const report = {
  generatedBy: 'tools/assimilation/external-capability-report.ts',
  note:
    '本報告彙整外部專案之能力盤點與使用界線，屬研究索引；不構成規則、不構成 Evidence，' +
    '亦不代表本庫採用其實作。任何採用一律另行走 Rule + Source + Evidence + Owner 批准。',
  totalProjects: projects.length,
  projects
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (checkOnly) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('external capability report FAILED — research/assimilation/external-capability-report.json drift');
    process.exit(1);
  }
  console.log(`external capability report OK — ${projects.length} projects, no drift`);
  process.exit(0);
}

writeFileSync(outPath, serialized, 'utf8');
console.log(`external capability report written — ${projects.length} projects`);
