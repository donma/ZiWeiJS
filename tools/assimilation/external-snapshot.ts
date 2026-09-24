#!/usr/bin/env tsx
/**
 * External Project Snapshot（spec Post-Stability §1 / §40）
 *
 * 抓取外部研究對象的真實 metadata（license / default branch / HEAD commit），
 * 寫入 research/assimilation/<project>/snapshot.json。
 *
 * 禁止捏造 commit / license；此工具需要網路，故不納入 `npm run verify`，
 * 只由 `npm run assimilation:snapshot` 手動執行並提交結果。
 *
 * 用法：
 *   npm run assimilation:snapshot             # 抓取並寫入
 *   npm run assimilation:snapshot -- --check  # 重抓比對（忽略 capturedAt）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const configPath = join(root, 'research/assimilation/external-projects.json');
const checkOnly = process.argv.includes('--check');

interface ProjectConfig {
  project: string;
  repo: string;
  dir: string;
  areasUsed: string[];
}

interface RepoMeta {
  license: { spdx_id?: string | null } | null;
  default_branch: string;
  archived: boolean;
  stargazers_count: number;
}

const config = JSON.parse(readFileSync(configPath, 'utf8')) as { projects: ProjectConfig[] };
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { devDependencies?: Record<string, string> };

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'ZiWeiJS-assimilation-snapshot', accept: 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return (await res.json()) as T;
}

const failures: string[] = [];
let written = 0;

for (const p of config.projects) {
  let meta: RepoMeta;
  let commit: { sha: string; commit: { committer: { date: string } } };
  try {
    meta = await ghJson<RepoMeta>(`https://api.github.com/repos/${p.repo}`);
    const commits = await ghJson<Array<{ sha: string; commit: { committer: { date: string } } }>>(
      `https://api.github.com/repos/${p.repo}/commits?per_page=1`
    );
    commit = commits[0];
  } catch (err) {
    failures.push(`${p.project}: ${(err as Error).message}`);
    continue;
  }

  const snapshot = {
    $schema: '../../../schemas/external-snapshot.schema.json',
    project: p.project,
    repo: p.repo,
    url: `https://github.com/${p.repo}`,
    license: meta.license?.spdx_id ?? 'UNKNOWN',
    defaultBranch: meta.default_branch,
    commit: commit.sha,
    commitDate: commit.commit.committer.date,
    packageVersion: pkg.devDependencies?.[p.project === 'fortel' ? 'fortel-ziweidoushu' : p.project] ?? null,
    stars: meta.stargazers_count,
    archived: meta.archived,
    capturedAt: new Date().toISOString().slice(0, 10),
    capturedBy: 'tools/assimilation/external-snapshot.ts',
    areasUsed: p.areasUsed
  };

  const dir = join(root, 'research/assimilation', p.dir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'snapshot.json');

  if (checkOnly) {
    if (!existsSync(file)) {
      failures.push(`${p.project}: snapshot.json missing`);
      continue;
    }
    const existing = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    for (const key of ['project', 'repo', 'license', 'commit', 'defaultBranch'] as const) {
      if (existing[key] !== (snapshot as Record<string, unknown>)[key]) {
        failures.push(`${p.project}: ${key} drift (stored=${String(existing[key])} live=${String(snapshot[key])})`);
      }
    }
    continue;
  }

  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  written++;
}

if (failures.length > 0) {
  console.error(`assimilation snapshot FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(checkOnly
  ? `assimilation snapshot check OK — ${config.projects.length} projects match stored snapshot`
  : `assimilation snapshot written — ${written} projects`);
