import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * spec 2nd §P0-4：核心排盤 / 限運程式碼中不得殘留 new Date() / Date.now()
 * 作為運算結果的 fallback。
 *
 * 核心範圍：src/（排除 tracer，Tracer.toJSON 的 timestamp 屬中繼資料不影響結果）。
 */

function scan(dir: string, bad: Array<{ file: string; line: number; text: string }>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      scan(full, bad);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      // tracer 可用 Date 記錄條目時間戳
      if (full.replace(/\\/g, '/').includes('/trace/')) continue;
      const lines = readFileSync(full, 'utf8').split('\n');
      lines.forEach((l, idx) => {
        // 註解中的說明文字除外
        const code = l.replace(/\/\/.*$/, '');
        // 排除無引數的 new Date() 即 Date.now() 等「當前時間 fallback」；
        // 具體參數的 new Date(...) 用於固定時間點（如時區計算、每月天數計算）屬合法演算法
        if (/new\s+Date\s*\(\s*\)/.test(code)) {
          bad.push({ file: full, line: idx + 1, text: l.trim() });
        }
        if (/Date\.now\s*\(/.test(code)) {
          bad.push({ file: full, line: idx + 1, text: l.trim() });
        }
      });
    }
  }
}

describe('P0-4 核心 engine 無 new Date fallback', () => {
  it('src/ 運算核心無 new Date() / Date.now()', () => {
    const bad: Array<{ file: string; line: number; text: string }> = [];
    scan(new URL('../../src', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), bad);
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });
});
