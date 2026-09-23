import { describe, it, expect } from 'vitest';
import { ziweiPalaceIndex, branchFromPalaceIndex } from '../../src/index.js';

/**
 * 起紫微星訣回歸測試。
 *
 * 依據《紫微斗數全書》安紫微諸星訣：
 *   六五四三二，酉午亥辰丑，局數除日數，商數宮前走；
 *   若見數無餘，便要起虎口，日數小於局，還直宮中守。
 *
 * 本檔以「原典口訣」與「原典算例」為獨立期望值來源，
 * 不使用與實作相同的公式重算，避免自我實現預言。
 */
describe('安紫微諸星訣: 五星局初一之定位（口訣「六五四三二，酉午亥辰丑」）', () => {
  const verse: Array<[number, string, string]> = [
    [6, 'you', '火六局 初一 → 酉'],
    [5, 'wu', '土五局 初一 → 午'],
    [4, 'hai', '金四局 初一 → 亥'],
    [3, 'chen', '木三局 初一 → 辰'],
    [2, 'chou', '水二局 初一 → 丑']
  ];

  for (const [bureau, branch, label] of verse) {
    it(label, () => {
      expect(branchFromPalaceIndex(ziweiPalaceIndex(bureau, 1))).toBe(branch);
    });
  }
});

describe('安紫微諸星訣: 原典三算例', () => {
  it('例一：木三局 27 日 → 戌', () => {
    // 27 ÷ 3 可整除，商 9，自寅進 9 格
    expect(branchFromPalaceIndex(ziweiPalaceIndex(3, 27))).toBe('xu');
  });

  it('例二：火六局 13 日 → 亥', () => {
    // 13 需加 5 始能整除 6，商 3；加數 5 為奇，自寅進 3 格後逆回 5 宮
    expect(branchFromPalaceIndex(ziweiPalaceIndex(6, 13))).toBe('hai');
  });

  it('例三：土五局 6 日 → 未', () => {
    // 6 需加 4 始能整除 5，商 2；加數 4 為偶，自寅進 2 格後順行 4 格
    expect(branchFromPalaceIndex(ziweiPalaceIndex(5, 6))).toBe('wei');
  });
});

describe('安紫微諸星訣: 水二局 30 日完整定位表', () => {
  // 坊間通行的水二局紫微定位表（以地支表示，初一至三十）
  const SHUI2_TABLE = [
    'chou', 'yin', 'yin', 'mao', 'mao', 'chen', 'chen', 'si', 'si', 'wu',
    'wu', 'wei', 'wei', 'shen', 'shen', 'you', 'you', 'xu', 'xu', 'hai',
    'hai', 'zi', 'zi', 'chou', 'chou', 'yin', 'yin', 'mao', 'mao', 'chen'
  ];

  it('30 日逐日吻合', () => {
    const got = SHUI2_TABLE.map((_, i) => branchFromPalaceIndex(ziweiPalaceIndex(2, i + 1)));
    expect(got).toEqual(SHUI2_TABLE);
  });
});

describe('安紫微諸星訣: 結構性質', () => {
  it('宮位序恆為 0..11', () => {
    for (const bureau of [2, 3, 4, 5, 6]) {
      for (let day = 1; day <= 30; day++) {
        const idx = ziweiPalaceIndex(bureau, day);
        expect(Number.isInteger(idx), `bureau ${bureau} day ${day}`).toBe(true);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(12);
      }
    }
  });

  it('口訣「六五四三二」之局數皆對應合法地支', () => {
    for (const bureau of [2, 3, 4, 5, 6]) {
      expect(branchFromPalaceIndex(ziweiPalaceIndex(bureau, 1))).toMatch(/^[a-z]+$/);
    }
  });
});
