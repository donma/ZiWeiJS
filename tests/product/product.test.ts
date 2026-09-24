import { describe, it, expect } from 'vitest';
import { calculate, ZiWei, QueryApi, canonicalJson, fingerprint } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * Product Layer（spec Post-Stability Phase I）。
 *
 * 護欄：唯讀組合層 —— 不新增命理規則、不修改傳入的 chart、輸出決定性。
 */
const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

const OTHER: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1985, month: 11, day: 20 },
  time: { hour: 14 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'female'
};

describe('product: snapshot / fingerprint', () => {
  const chart = calculate(INPUT);

  it('snapshot 為決定性（同盤兩次相同）且含 14 主星', () => {
    const a = ZiWei.Product.snapshot(chart);
    const b = ZiWei.Product.snapshot(chart);
    expect(a).toEqual(b);
    expect(a.majors.length).toBe(14);
    expect(a.fingerprint).toBe(fingerprint({
      bibleVersion: a.bibleVersion,
      schemaVersion: a.schemaVersion,
      profile: a.profile,
      lifePalaceBranch: a.lifePalaceBranch,
      bodyPalaceBranch: a.bodyPalaceBranch,
      bureau: a.bureau,
      majors: a.majors,
      patterns: a.patterns,
      natalTransformations: a.natalTransformations
    }));
  });

  it('不同盤 → 不同指紋', () => {
    const a = ZiWei.Product.snapshot(chart);
    const b = ZiWei.Product.snapshot(calculate(OTHER));
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('canonicalJson 對物件鍵序不敏感', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('Product 為唯讀：呼叫後 chart 內容不變', () => {
    const before = canonicalJson(chart);
    ZiWei.Product.snapshot(chart);
    ZiWei.Product.sharePayload(chart);
    ZiWei.Product.retrieve(chart, { kind: 'palace', palaceId: 'life' });
    expect(canonicalJson(chart)).toBe(before);
  });
});

describe('product: trend（逐年限運時間軸）', () => {
  const chart = calculate(INPUT);

  it('涵蓋指定年份、虛歲遞增、含大限與流年', () => {
    const points = ZiWei.Product.trend(chart, { fromYear: 2024, toYear: 2028 });
    expect(points.map(p => p.year)).toEqual([2024, 2025, 2026, 2027, 2028]);
    const ages = points.map(p => p.age!);
    for (let i = 1; i < ages.length; i++) expect(ages[i]).toBe(ages[i - 1] + 1);
    for (const p of points) {
      expect(p.yearPeriod?.branch).toBeTruthy();
      expect(p.major?.fromAge).toBeLessThanOrEqual(p.age!);
    }
  });

  it('有目標日期的年份必附小限（canonical 輸出）', () => {
    const points = ZiWei.Product.trend(chart, { fromYear: 2026, toYear: 2026 });
    expect(points[0].xiaoxian?.age).toBe(points[0].age);
    expect(points[0].xiaoxian?.branch).toBeTruthy();
  });

  it('範圍守衛：反向或過大範圍丟錯', () => {
    expect(() => ZiWei.Product.trend(chart, { fromYear: 2030, toYear: 2020 })).toThrow();
    expect(() => ZiWei.Product.trend(chart, { fromYear: 1900, toYear: 2200 })).toThrow();
  });
});

describe('product: retrieve / share / match', () => {
  const chart = calculate(INPUT);

  it('retrieve 與 QueryApi 結果一致（薄封裝，不新增演算法）', () => {
    expect(ZiWei.Product.retrieve(chart, { kind: 'palace', palaceId: 'life' }))
      .toEqual(QueryApi.palace(chart, 'life'));
    expect(ZiWei.Product.retrieve(chart, { kind: 'starsOfPalace', palaceId: 'life' }))
      .toEqual(QueryApi.starsOfPalace(chart, 'life'));
    expect(ZiWei.Product.retrieve(chart, { kind: 'sanFangSiZheng', palaceId: 'life' }))
      .toEqual(QueryApi.sanFangSiZheng(chart, 'life'));
    const natal = ZiWei.Product.retrieve(chart, { kind: 'transformations', scope: 'natal' });
    expect(Array.isArray(natal)).toBe(true);
    expect((natal as unknown[]).length).toBeGreaterThan(0);
  });

  it('sharePayload 預設不含出生資料；明確要求才包含', () => {
    const safe = ZiWei.Product.sharePayload(chart);
    expect(safe.input).toBeUndefined();
    expect(safe.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(safe.snapshot.majors.length).toBe(14);

    const full = ZiWei.Product.sharePayload(chart, { includeInput: true });
    expect(full.input).toEqual(chart.input);
    expect(full.fingerprint).toBe(safe.fingerprint);
  });

  it('match 只列舉共同事實（無吉凶評分）', () => {
    const same = ZiWei.Product.match(chart, chart);
    expect(same.sameLifePalaceBranch).toBe(true);
    expect(same.sameBureau).toBe(true);
    expect(same.sharedMajorStars.length).toBe(14);
    expect(same.sharedPatterns.length).toBe(
      ZiWei.Product.snapshot(chart).patterns.length
    );

    const diff = ZiWei.Product.match(chart, calculate(OTHER));
    expect(diff.fingerprintA).not.toBe(diff.fingerprintB);
    expect(Object.keys(diff).sort()).toEqual([
      'fingerprintA', 'fingerprintB', 'sameBureau', 'sameLifePalaceBranch',
      'sharedMajorStars', 'sharedNatalSihuaTargets', 'sharedPatterns'
    ]);
    // 無任何「吉凶分數」欄位（Match 僅列舉事實）
    expect(Object.keys(diff).some(k => /score|rating|fortune|good|bad/i.test(k))).toBe(false);
  });

  it('Product 層暴露的成員僅為唯讀組合函式', () => {
    expect(Object.keys(ZiWei.Product).sort()).toEqual([
      'canonicalJson', 'fingerprint', 'match', 'retrieve', 'sharePayload', 'snapshot', 'trend'
    ]);
  });
});
