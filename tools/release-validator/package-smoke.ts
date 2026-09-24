#!/usr/bin/env tsx
/**
 * npm Package Consumer Smoke Test（Final §6）
 *
 * 產生真實 tarball（npm pack），解開到 node_modules 後以 bare specifier import，
 * 模擬第三方 consumer：確認 Node ESM import、exports、files 內容與 manifest 皆可用。
 *
 * 用法：npm run release:smoke:package（需先 npm run build）
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const smoke = join(root, 'node_modules', 'ziwei-bible-smoke');

const REQUIRED = [
  'package.json',
  'dist/ziwei-bible.esm.js',
  'dist/ziwei-bible.browser.js',
  'dist/ziwei-bible.d.ts',
  'dist/bible-manifest.json',
  'schemas/chart.schema.json',
  'rules/calculation/periods/periods.json',
  'profiles/canonical.json',
  'variants/registry.json'
];

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): string {
  return execFileSync(cmd, args, { cwd: opts.cwd ?? root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** npm 於 Windows 為 npm.cmd，需透過 shell 執行（Node 安全性限制） */
function runNpm(args: string[]): string {
  const quoted = args.map(a => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
  return execSync(`npm ${quoted}`, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const failures: string[] = [];
const tmp = mkdtempSync(join(tmpdir(), 'ziwei-pack-'));
let packedName: string | undefined;

try {
  /* ---------- 1. npm pack --json（含 files 清單） ---------- */
  const out = runNpm(['pack', '--json', '--pack-destination', tmp]);
  const parsed = JSON.parse(out) as Array<{ filename: string; files: Array<{ path: string }> }>;
  const pack = parsed[0];
  packedName = join(tmp, pack.filename);
  if (!existsSync(packedName)) throw new Error(`tarball not produced: ${packedName}`);

  const packedPaths = new Set(pack.files.map(f => f.path));
  for (const rel of REQUIRED) {
    if (!packedPaths.has(rel)) failures.push(`files[] missing ${rel}`);
  }

  /* ---------- 2. 解開到 node_modules 模擬 consumer 安裝 ---------- */
  rmSync(smoke, { recursive: true, force: true });
  mkdirSync(smoke, { recursive: true });
  run('tar', ['-xzf', packedName, '-C', smoke, '--strip-components=1']);

  /* ---------- 3. import 並排盤 ---------- */
  // 以非字面 specifier 載入，避免 tsc 於打包前解析不存在的模組
  const specifier = 'ziwei-bible-smoke';
  const mod = (await import(specifier)) as {
    default: {
      calculate(input: unknown): {
        schemaVersion?: unknown;
        chart?: { natal?: { lifePalaceBranch?: unknown } };
      };
      Rules?: { list?: unknown };
    };
  };
  const ZiWei = mod.default;
  if (!ZiWei || typeof ZiWei.calculate !== 'function') {
    failures.push('consumer import: default export has no calculate()');
  } else {
    const chart = ZiWei.calculate({
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'male'
    });
    if (typeof chart.schemaVersion !== 'string') failures.push('consumer chart missing schemaVersion');
    if (!chart.chart?.natal?.lifePalaceBranch) failures.push('consumer chart missing natal data');
    // rules / schemas 需能自 package 內解析
    if (typeof ZiWei.Rules?.list !== 'function') failures.push('consumer Rules.list unavailable');
  }

  /* ---------- 4. manifest 可用 ---------- */
  const manifest = JSON.parse(readFileSync(join(smoke, 'dist', 'bible-manifest.json'), 'utf8')) as {
    bibleVersion: string; rules: Record<string, string>; profiles: unknown[];
  };
  if (!manifest.bibleVersion) failures.push('packed manifest missing bibleVersion');
  if (Object.keys(manifest.rules ?? {}).length === 0) failures.push('packed manifest has no rules');
  if ((manifest.profiles ?? []).length === 0) failures.push('packed manifest has no profiles');
} catch (err) {
  failures.push(`exception: ${(err as Error).message}`);
} finally {
  rmSync(smoke, { recursive: true, force: true });
  rmSync(tmp, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`npm package smoke FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('npm package smoke OK — tarball packed, extracted, imported via bare specifier, calculate() executed');
