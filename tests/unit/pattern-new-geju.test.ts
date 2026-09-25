import { describe, it, expect } from 'vitest';
import { calculate, listPatterns, getStarRegistryEntry } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import { runPatterns } from '../../src/interpretation-engine/interpretation-engine.js';
import { buildTestContext } from '../helpers/context.js';

/**
 * M7 首批格局實作（Owner 於 2026-09-24 批准）
 *
 * 四條 canonical 格局：對面朝斗／兼文武／石中隱玉／左右朝垣。
 * 全部案例皆為實跑，含「正案例」與「不得誤判」的負案例；
 * 其中兼文武格使用 DSL `palace:'body'`（身宮）以符合原文「文曲武曲在身命」。
 */
const mk = (year: number, month: number, day: number, hour: number, sex: 'male' | 'female'): ZiWeiBirthInput => ({
  calendarType: 'solar',
  date: { year, month, day },
  time: { hour, minute: 0 },
  timezone: 'Asia/Taipei',
  sexForCalculation: sex
});

const statusOf = (input: ZiWeiBirthInput, patternId: string) => {
  const chart = calculate(input);
  const pat = chart.chart.patterns.find(p => p.patternId === patternId);
  return { chart, pat };
};

describe('M7 格局：對面朝斗格（ZW.PAT.DUIMIAN_CHAODOU.001）', () => {
  const input = mk(1950, 1, 5, 0, 'male');
  const { chart, pat } = statusOf(input, 'ZW.PAT.DUIMIAN_CHAODOU.001');

  it('命宮在子／午且祿存在遷移 → 命中（complete 或 enhanced）', () => {
    expect(['complete', 'enhanced']).toContain(pat?.status);
    expect(['zi', 'wu']).toContain(chart.chart.natal.lifePalaceBranch);
    const travelPalace = chart.chart.palaces.find(p => p.id === 'travel')!;
    expect(travelPalace.stars.some(s => s.starId === 'ZW.STAR.AUX.LUCUN')).toBe(true);
  });

  it('命宮不在子／午 → 不得命中（insufficient）', () => {
    let checked = 0;
    for (const hour of [6, 8, 10, 12, 14]) {
      const c = calculate(mk(1950, 1, 15, hour, 'male'));
      if (['zi', 'wu'].includes(c.chart.natal.lifePalaceBranch)) continue;
      const p = c.chart.patterns.find(x => x.patternId === 'ZW.PAT.DUIMIAN_CHAODOU.001');
      expect(p?.status, `hour=${hour}`).toBe('insufficient');
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('M7 格局：兼文武格（ZW.PAT.JIANWENWU.001）', () => {
  const input = mk(1950, 5, 5, 8, 'male');
  const { chart, pat } = statusOf(input, 'ZW.PAT.JIANWENWU.001');

  it('文曲武曲同在身宮（非命宮）→ 命中（證明 DSL palace:"body" 生效）', () => {
    expect(pat?.status).toBe('complete');
    const bodyBranch = chart.chart.natal.bodyPalaceBranch;
    const inBody = (id: string) => Object.values(chart.chart.stars).some(s => s.starId === id && s.branch === bodyBranch);
    const inLife = (id: string) => Object.values(chart.chart.stars).some(s => s.starId === id && s.palaceId === chart.chart.natal.lifePalace);
    expect(inBody('ZW.STAR.MAJOR.WUQU')).toBe(true);
    expect(inBody('ZW.STAR.AUX.WENQU')).toBe(true);
    expect(inLife('ZW.STAR.MAJOR.WUQU')).toBe(false);
  });

  it('命宮見七殺／破軍 → 破格（合成 fixture：注入武曲＋文曲＋七殺於命宮）', () => {
    // 實盤中「文武同宮且命宮見殺破」極罕見（21,600 盤掃描未出現），故以合成 fixture 驗證破格語意
    const ctx = buildTestContext();
    const lifePalace = ctx.engine.palaces.find(p => p.isLifePalace)!;
    const template = ctx.engine.palaces.flatMap(p => p.stars)[0];
    const inject = (starId: string) => {
      const entry = getStarRegistryEntry(starId)!;
      lifePalace.stars.push({
        ...template,
        starId,
        star: entry,
        palaceId: lifePalace.id,
        branch: lifePalace.branch
      });
    };
    inject('ZW.STAR.MAJOR.WUQU');
    inject('ZW.STAR.AUX.WENQU');
    inject('ZW.STAR.MAJOR.QISHA');

    const results = runPatterns(ctx.engine);
    const pat = results.find(r => r.patternId === 'ZW.PAT.JIANWENWU.001');
    expect(pat?.status).toBe('broken');
    expect(pat!.breakers.length).toBeGreaterThan(0);
    expect(pat!.failedConditions).toEqual([]);
  });
});

describe('M7 格局：石中隱玉格（ZW.PAT.SHIZHONG_YINYU.001）', () => {
  it('命在子／午、巨門同宮、三方羊陀火鈴 → broken，且列出破格條件', () => {
    const { chart, pat } = statusOf(mk(1950, 3, 25, 6, 'male'), 'ZW.PAT.SHIZHONG_YINYU.001');
    expect(pat?.status).toBe('broken');
    expect(pat?.breakers.length).toBeGreaterThan(0);
    expect(['zi', 'wu']).toContain(chart.chart.natal.lifePalaceBranch);
    const lifePalace = chart.chart.palaces.find(p => p.id === chart.chart.natal.lifePalace)!;
    expect(lifePalace.stars.some(s => s.starId === 'ZW.STAR.MAJOR.JUMEN')).toBe(true);
  });

  it('三方科祿 → enhanced', () => {
    const { pat } = statusOf(mk(1951, 1, 5, 12, 'female'), 'ZW.PAT.SHIZHONG_YINYU.001');
    expect(pat?.status).toBe('enhanced');
    expect(pat?.enhancers.length).toBeGreaterThan(0);
  });

  it('巨門在子／午但命宮不在子／午 → 不得命中', () => {
    const { chart, pat } = statusOf(mk(1950, 1, 15, 6, 'male'), 'ZW.PAT.SHIZHONG_YINYU.001');
    expect(['zi', 'wu']).not.toContain(chart.chart.natal.lifePalaceBranch);
    expect(pat?.status).toBe('insufficient');
  });
});

describe('M7 格局：左右朝垣格（ZW.PAT.ZUOYOU_CHAOYUAN.001）', () => {
  it('左輔右弼在三方四正（非同在命宮）→ 命中', () => {
    const { chart, pat } = statusOf(mk(1950, 1, 5, 8, 'male'), 'ZW.PAT.ZUOYOU_CHAOYUAN.001');
    expect(['complete', 'enhanced']).toContain(pat?.status);
    const lifeBranch = chart.chart.natal.lifePalaceBranch;
    const lifePalace = chart.chart.palaces.find(p => p.id === chart.chart.natal.lifePalace)!;
    const bothInLife = ['ZW.STAR.AUX.ZUOFU', 'ZW.STAR.AUX.YOUBI'].every(id => lifePalace.stars.some(s => s.starId === id));
    expect(bothInLife).toBe(false);
    expect(lifeBranch).toBeTruthy();
  });

  it('左輔右弼同在命宮 → 不得判為完整（partial；與君臣慶會路線區辨）', () => {
    const { chart, pat } = statusOf(mk(1950, 5, 25, 20, 'male'), 'ZW.PAT.ZUOYOU_CHAOYUAN.001');
    const lifePalace = chart.chart.palaces.find(p => p.id === chart.chart.natal.lifePalace)!;
    for (const id of ['ZW.STAR.AUX.ZUOFU', 'ZW.STAR.AUX.YOUBI']) {
      expect(lifePalace.stars.some(s => s.starId === id), id).toBe(true);
    }
    expect(pat?.status).toBe('partial');
    expect(pat?.failedConditions.length).toBeGreaterThan(0);
  });
});

describe('M7 續批格局：科權祿主格（ZW.PAT.KEQUANLU_ZHU.001，Owner 2026-09-25 概括授權）', () => {
  const CYCLE = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
  const clusterOf = (branch: string) => {
    const i = CYCLE.indexOf(branch);
    return new Set([branch, CYCLE[(i + 6) % 12], CYCLE[(i + 4) % 12], CYCLE[(i + 8) % 12]]);
  };

  it('三化（祿／權／科）皆入命宮三方四正 → 命中', () => {
    const { chart, pat } = statusOf(mk(1984, 2, 3, 0, 'male'), 'ZW.PAT.KEQUANLU_ZHU.001');
    expect(['complete', 'enhanced']).toContain(pat?.status);
    const lifeBranch = chart.chart.natal.lifePalaceBranch;
    const cluster = clusterOf(lifeBranch);
    const hits = new Set<string>();
    for (const p of chart.chart.palaces) {
      if (!cluster.has(p.branch)) continue;
      for (const t of p.transformations) {
        if (t.sourceScope === 'natal' && ['lu', 'quan', 'ke'].includes(t.type)) hits.add(t.type);
      }
    }
    expect([...hits].sort()).toEqual(['ke', 'lu', 'quan']);
  });

  it('僅化祿入命宮三方四正、化權科皆不合格 → partial（不得誤判為命中）', () => {
    const { chart, pat } = statusOf(mk(1984, 1, 1, 0, 'male'), 'ZW.PAT.KEQUANLU_ZHU.001');
    expect(pat?.status).toBe('partial');
    expect(pat?.matchedConditions.length).toBe(1);
    expect(pat?.failedConditions.some(c => c.includes('"transform":"ke"'))).toBe(true);
    expect(pat?.failedConditions.some(c => c.includes('"transform":"quan"'))).toBe(true);
    const lifePalace = chart.chart.palaces.find(p => p.isLifePalace)!;
    expect(lifePalace.branch).toBeTruthy();
  });
});

describe('M7 格局：治理狀態', () => {
  const ids = [
    'ZW.PAT.DUIMIAN_CHAODOU.001',
    'ZW.PAT.JIANWENWU.001',
    'ZW.PAT.SHIZHONG_YINYU.001',
    'ZW.PAT.ZUOYOU_CHAOYUAN.001',
    'ZW.PAT.KEQUANLU_ZHU.001'
  ];

  it('五條皆為 canonical，且具 sourceRefs 與 evidenceRefs', () => {
    const patterns = listPatterns() as unknown as Array<{ ruleId: string; status: string; sourceRefs?: string[]; evidenceRefs?: string[] }>;
    expect(patterns.length).toBe(29);
    for (const id of ids) {
      const p = patterns.find(x => x.ruleId === id);
      expect(p, id).toBeTruthy();
      expect(p!.status, id).toBe('canonical');
      expect(p!.sourceRefs?.length, id).toBeGreaterThan(0);
      expect(p!.evidenceRefs?.length, id).toBeGreaterThan(0);
    }
  });
});
