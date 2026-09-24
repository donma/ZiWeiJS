/**
 * Pollution / isolation checks（spec §6 / §44 / §52「最終不得出現」）
 *
 * 這是硬性防線，不是風格建議。檢查：
 *   1. `src/` 不得 import 任何外部排盤套件（iztro / fortel / cdestiny / ziwei-* …）
 *   2. `src/` 不得存在 `vendor/`，亦不得 import 任何 `node_modules` 路徑
 *   3. `package.json` 的 `dependencies` 不得出現外部排盤套件（只能存在 devDependencies 作 oracle）
 *   4. GPL-3.0（ziwei-chart）與授權不明（ziwei-doushu-simple）不得成為任何 dependency
 *   5. 農曆／陽曆換算集中於既有模組（`lunar-typescript` 之 import 僅允許於既定 allowlist）
 *
 * 與 `npm run validate:integrity`（`tools/integrity-validator/checks.ts`）及
 * `tests/integrity/no-external-deps.test.ts` 共用同一份實作。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface PollutionFailure {
  check: string;
  detail: string;
}

export interface PollutionResult {
  failures: PollutionFailure[];
  stats: {
    srcFiles: number;
    forbiddenImports: number;
    calendarImporters: string[];
  };
}

/** 外部排盤／命理實作：一律不得成為 runtime dependency，也不得被 src/ import */
const FORBIDDEN_PATTERN = /(iztro|fortel|cdestiny|ziwei[-_]?chart|ziwei[-_]?doushu|ziweidoushu)/i;

/** GPL / 授權不明：連 devDependency 都不允許（避免誤用） */
const NEVER_DEPENDABLE = /(ziwei[-_]?chart|ziwei[-_]?doushu[-_]?simple)/i;

/** 允許直接使用 lunar-typescript 的模組（曆法換算集中管理） */
const CALENDAR_IMPORTERS = [
  'src/calendar/calendar-engine.ts',
  'src/period-engine/period-engine.ts',
  'src/period-engine/period-target.ts'
];

function listTsFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(full, base));
    else if (entry.name.endsWith('.ts')) out.push(full.slice(base.length + 1).replace(/\\/g, '/'));
  }
  return out;
}

function importSpecifiers(source: string): string[] {
  const out: string[] = [];
  const patterns = [
    /(?:^|\n)\s*import[^'"\n]*from\s*['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) out.push(m[1]);
  }
  return out;
}

/** 是否為外部排盤套件或 vendor / node_modules 路徑（供測試直接驗證判準） */
export function isForbiddenSpecifier(spec: string): boolean {
  if (FORBIDDEN_PATTERN.test(spec)) return true;
  if (spec.includes('node_modules')) return true;
  if (spec.startsWith('..') && spec.includes('vendor')) return true;
  return false;
}

export function runPollutionChecks(root: string): PollutionResult {
  const failures: PollutionFailure[] = [];
  const fail = (detail: string) => failures.push({ check: 'pollution', detail });

  /* 1 + 2：src/ import 檢查 */
  const srcDir = join(root, 'src');
  const files = listTsFiles(srcDir);
  let forbiddenImports = 0;

  if (existsSync(join(srcDir, 'vendor'))) {
    fail('src/vendor 不得存在（spec §6：禁止 vendored 外部實作）');
  }

  for (const rel of files) {
    const source = readFileSync(join(srcDir, rel), 'utf8');
    for (const spec of importSpecifiers(source)) {
      if (FORBIDDEN_PATTERN.test(spec)) {
        forbiddenImports += 1;
        fail(`src/${rel}: 不得 import 外部排盤套件（${spec}）`);
      }
      if (isForbiddenSpecifier(spec) && !FORBIDDEN_PATTERN.test(spec)) {
        forbiddenImports += 1;
        fail(`src/${rel}: 不得 import vendor / node_modules 路徑（${spec}）`);
      }
    }
  }

  /* 3 + 4：package.json dependency 檢查 */
  const pkgPath = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    if (FORBIDDEN_PATTERN.test(name)) fail(`package.json: 外部排盤套件不得為 runtime dependency（${name}）`);
  }
  for (const name of Object.keys(pkg.devDependencies ?? {})) {
    if (NEVER_DEPENDABLE.test(name)) {
      fail(`package.json: GPL-3.0 / 授權不明之專案不得成為任何 dependency（${name}）`);
    }
  }

  /* 5：曆法換算集中 */
  const calendarImporters = files.filter(rel => {
    const source = readFileSync(join(srcDir, rel), 'utf8');
    return importSpecifiers(source).some(s => s === 'lunar-typescript');
  }).map(rel => `src/${rel}`).sort();

  for (const importer of calendarImporters) {
    if (!CALENDAR_IMPORTERS.includes(importer)) {
      fail(`${importer}: 新增 lunar-typescript 使用點需先確認不與既有曆法模組重複（spec §44）`);
    }
  }
  for (const allowed of CALENDAR_IMPORTERS) {
    if (!calendarImporters.includes(allowed)) {
      fail(`${allowed}: 預期之曆法模組已不再使用 lunar-typescript（allowlist 需同步）`);
    }
  }

  return {
    failures,
    stats: { srcFiles: files.length, forbiddenImports, calendarImporters }
  };
}
