import type { EngineContext } from './context.js';
import type { BranchId, StarPlacement, Star, StemId } from '../core/types.js';
import { branchAt, branchIndex, stemIndex, STEMS } from '../core/constants.js';
import {
  calcZiweiPosition, ziweiSeriesOffsets, tianfuBase, tianfuSeriesOffsets
} from './palace-executors.js';
import starRegistry from '../../tables/stars/registry.json' with { type: 'json' };
import auxTables from '../../tables/stars/aux-tables.json' with { type: 'json' };
import nayinTable from '../../tables/stems/nayin.json' with { type: 'json' };
import changshengTable from '../../tables/dignity/changsheng.json' with { type: 'json' };
import sihuaTable from '../../tables/transformations/sihua.json' with { type: 'json' };

const starIndex = new Map<string, Star>();
for (const s of (starRegistry as { stars: Star[] }).stars) {
  starIndex.set(s.id, s as Star);
}

export function getStar(id: string): Star {
  const s = starIndex.get(id);
  if (!s) {
    return {
      id,
      category: 'minor',
      tier: 'research',
      name: { 'zh-TW': id },
      status: 'undetermined',
      sources: [],
      tags: []
    };
  }
  return s;
}

export function listStars(): Star[] {
  return [...starIndex.values()];
}

export function placeStar(ctx: EngineContext, starId: string, branch: BranchId, ruleId: string): StarPlacement {
  const palace = ctx.palaces.find(p => p.branch === branch);
  if (!palace) throw new Error(`No palace at branch ${branch}`);
  const placement: StarPlacement = {
    starId,
    star: getStar(starId),
    palaceId: palace.id,
    branch,
    certainty: 'high',
    ruleId,
    ruleVersion: '1.0'
  };
  ctx.placements.set(starId, placement);
  palace.stars.push(placement);
  const cat = placement.star.category;
  if (cat === 'major') palace.majorStars.push(placement);
  else if (cat === 'malefic') palace.maleficStars.push(placement);
  else if (cat === 'aux') palace.auxStars.push(placement);
  else palace.minorStars.push(placement);
  return placement;
}

export function calcBureau(ctx: EngineContext): void {
  const useYear = false;
  const life = ctx.palaces.find(p => p.isLifePalace)!;
  const gz = useYear ? ctx.normalized.ganzhi.year : life.ganzhi;
  const key = `${gz.stem}-${gz.branch}`;
  const wuxing = (nayinTable.nayin as Record<string, string>)[key];
  const bureau = (nayinTable.wuxingToBureau as Record<string, string>)[wuxing] as typeof ctx.bureau;
  ctx.bureau = bureau;
  const numMap: Record<string, number> = { shui2: 2, mu3: 3, jin4: 4, tu5: 5, huo6: 6 };
  ctx.bureauNumber = numMap[bureau];
  ctx.tracer.record({
    ruleId: 'ZW.CALC.BUREAU.NAYIN.001',
    inputs: { lifePalaceGanzhi: key, nayin: wuxing },
    result: bureau,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU'],
    evidenceRefs: ['EVD.QUANSHU.WUXINGJU']
  });
}

export function calcMajors(ctx: EngineContext): void {
  const ziweiBranch = calcZiweiPosition(ctx);
  const ziweiOffsets = ziweiSeriesOffsets();
  for (const [starId, offset] of Object.entries(ziweiOffsets)) {
    const b = branchAt(branchIndex(ziweiBranch) + offset);
    placeStar(ctx, starId, b, 'ZW.CALC.STAR.ZIWEI_SERIES.001');
  }
  const tfBase = tianfuBase(ziweiBranch);
  const tfOffsets = tianfuSeriesOffsets();
  for (const [starId, offset] of Object.entries(tfOffsets)) {
    const b = branchAt(branchIndex(tfBase) + offset);
    placeStar(ctx, starId, b, 'ZW.CALC.STAR.TIANFU_SERIES.001');
  }
  ctx.tracer.record({
    ruleId: 'ZW.CALC.STAR.ZIWEI_SERIES.001',
    inputs: { ziweiBranch },
    result: [...ctx.placements.values()].filter(p => p.star.category === 'major').map(p => `${p.starId}@${p.branch}`),
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU'],
    evidenceRefs: ['EVD.QUANSHU.ZIWEIXI']
  });
}

export function calcAuxByMonth(ctx: EngineContext): void {
  const month = ctx.normalized.lunar.month;
  const table = auxTables.byLunarMonth as unknown as Record<string, { startBranch: string; direction: number }>;
  const map: Record<string, string> = {
    'ZW.STAR.AUX.ZUOFU': 'ZW.CALC.STAR.ZUOFU_YOUBI.001',
    'ZW.STAR.AUX.YOUBI': 'ZW.CALC.STAR.ZUOFU_YOUBI.001',
    'ZW.STAR.AUX.TIANXING': 'ZW.CALC.STAR.ZUOFU_YOUBI.001',
    'ZW.STAR.AUX.TIANYAO': 'ZW.CALC.STAR.ZUOFU_YOUBI.001'
  };
  for (const [starId, cfg] of Object.entries(table)) {
    if (starId === 'note' || typeof cfg !== 'object' || !cfg.startBranch) continue;
    if (!map[starId]) continue;
    const start = branchIndex(cfg.startBranch as BranchId);
    const b = branchAt(start + cfg.direction * (month - 1));
    placeStar(ctx, starId, b, map[starId]);
  }
  ctx.tracer.record({
    ruleId: 'ZW.CALC.STAR.ZUOFU_YOUBI.001',
    inputs: { lunarMonth: month },
    result: 'aux-by-month placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcAuxByHour(ctx: EngineContext): void {
  const hbIdx = branchIndex(ctx.normalized.hourBranch);
  const table = auxTables.byHourBranch as unknown as Record<string, { startBranch: string; direction: number }>;
  const ruleId = 'ZW.CALC.STAR.CHANGQU.001';
  for (const [starId, cfg] of Object.entries(table)) {
    if (starId === 'note' || typeof cfg !== 'object' || !cfg.startBranch) continue;
    const start = branchIndex(cfg.startBranch as BranchId);
    const b = branchAt(start + cfg.direction * hbIdx);
    placeStar(ctx, starId, b, ruleId);
  }
  ctx.tracer.record({
    ruleId,
    inputs: { hourBranch: ctx.normalized.hourBranch },
    result: 'aux-by-hour placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcAuxByYearStem(ctx: EngineContext): void {
  const stem = ctx.normalized.ganzhi.year.stem;
  const table = auxTables.byYearStem as unknown as Record<string, Record<string, number>>;
  const ruleId = 'ZW.CALC.STAR.YEARSTEM_AUX.001';
  const starIds = [
    'ZW.STAR.AUX.LUCUN', 'ZW.STAR.MALEFIC.QINGYANG', 'ZW.STAR.MALEFIC.TUOLUO',
    'ZW.STAR.AUX.TIANKUI', 'ZW.STAR.AUX.TIANYUE'
  ];
  for (const starId of starIds) {
    const row = table[starId];
    if (!row || typeof row !== 'object') continue;
    const idx = row[stem];
    if (idx === undefined) continue;
    const b = branchAt(idx);
    placeStar(ctx, starId, b, ruleId);
    if (starId === 'ZW.STAR.AUX.LUCUN') ctx.lucunBranch = b;
  }
  ctx.tracer.record({
    ruleId,
    inputs: { yearStem: stem },
    result: 'year-stem aux placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

function yearBranchGroup(branch: BranchId): string {
  const groups = (auxTables.byYearBranch as { groups: Record<string, number[]> }).groups;
  const idx = branchIndex(branch);
  for (const [name, arr] of Object.entries(groups)) {
    if (arr.includes(idx)) return name;
  }
  return 'yin-wu-xu';
}

export function calcAuxByYearBranch(ctx: EngineContext): void {
  const yearBranch = ctx.normalized.ganzhi.year.branch;
  const ybIdx = branchIndex(yearBranch);
  const group = yearBranchGroup(yearBranch);
  const table = auxTables.byYearBranch as Record<string, unknown>;
  const ruleId = 'ZW.CALC.STAR.YEARBRANCH_AUX.001';
  const hbIdx = branchIndex(ctx.normalized.hourBranch);

  const fireLing = ['ZW.STAR.AUX.HUOLING', 'ZW.STAR.AUX.LINGXING'];
  for (const starId of fireLing) {
    const cfg = table[starId] as Record<string, unknown> | undefined;
    if (!cfg || cfg[group] === undefined) continue;
    const start = (cfg[group] as number);
    placeStar(ctx, starId, branchAt(start + hbIdx), ruleId);
  }

  const direct: Record<string, string> = {};
  for (const starId of [
    'ZW.STAR.AUX.TIANMA', 'ZW.STAR.AUX.GUCHEN', 'ZW.STAR.AUX.GUASU',
    'ZW.STAR.AUX.HUAGAI', 'ZW.STAR.AUX.XIANCHI', 'ZW.STAR.AUX.POSUI', 'ZW.STAR.AUX.JIESHA',
    'ZW.STAR.AUX.WANGSHEN'
  ]) {
    const cfg = table[starId] as Record<string, number> | undefined;
    if (cfg && cfg[group] !== undefined) direct[starId] = branchAt(cfg[group]) as string;
  }
  for (const [starId, b] of Object.entries(direct)) {
    placeStar(ctx, starId, b as BranchId, ruleId);
  }

  const hongluan = branchAt(3 - ybIdx);
  placeStar(ctx, 'ZW.STAR.AUX.HONGLUAN', hongluan, ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.TIANXI', branchAt(branchIndex(hongluan) + 6), ruleId);

  const tianku = branchAt(6 - ybIdx);
  placeStar(ctx, 'ZW.STAR.AUX.TIANKU', tianku, ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.TIANXU', branchAt(branchIndex(tianku) + 6), ruleId);

  placeStar(ctx, 'ZW.STAR.AUX.SANGMEN', branchAt(ybIdx + 2), ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.DIAOKE', branchAt(ybIdx - 2), ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.BAIHU', branchAt(8 - ybIdx), ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.DAHao', branchAt(ybIdx + 7), ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.XIAOHAO', branchAt(ybIdx + 6), ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.GUANFU', branchAt(ybIdx + 8), ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.SUISHEN', branchAt(ybIdx + 3), ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.BINGFU', branchAt(ybIdx - 1), ruleId);

  ctx.tracer.record({
    ruleId,
    inputs: { yearBranch, group },
    result: 'year-branch aux placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcAuxByMonth2(ctx: EngineContext): void {
  const month = ctx.normalized.lunar.month;
  const table = (auxTables as unknown as { byLunarMonth2?: Record<string, { startBranch: string; direction: number }> }).byLunarMonth2 ?? {};
  const ruleId = 'ZW.CALC.STAR.ZUOFU_YOUBI.001';
  for (const [starId, cfg] of Object.entries(table)) {
    if (!cfg.startBranch) continue;
    const start = branchIndex(cfg.startBranch as BranchId);
    const b = branchAt(start + cfg.direction * (month - 1));
    placeStar(ctx, starId, b, ruleId);
  }
  // 陰煞：正月起寅，每月進二宮
  const yinsha = branchAt(2 + ((month - 1) * 2) % 12);
  placeStar(ctx, 'ZW.STAR.AUX.YINSHA', yinsha, 'ZW.CALC.STAR.YEARBRANCH_AUX.001');
  ctx.tracer.record({
    ruleId,
    inputs: { lunarMonth: month },
    result: 'aux-by-month2 placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcAuxByYearStem2(ctx: EngineContext): void {
  const stem = ctx.normalized.ganzhi.year.stem;
  const table = (auxTables as unknown as { byYearStem2?: Record<string, Record<string, number>> }).byYearStem2 ?? {};
  const ruleId = 'ZW.CALC.STAR.YEARSTEM_AUX.001';
  for (const [starId, row] of Object.entries(table)) {
    const idx = row[stem];
    if (idx === undefined) continue;
    placeStar(ctx, starId, branchAt(idx), ruleId);
  }
  ctx.tracer.record({
    ruleId,
    inputs: { yearStem: stem },
    result: 'year-stem2 aux placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcAuxByDay(ctx: EngineContext): void {
  const day = ctx.normalized.lunar.day;
  const table = (auxTables as unknown as { byDayBranch?: Record<string, { base: string; direction: number }> }).byDayBranch ?? {};
  const ruleId = 'ZW.CALC.STAR.YEARBRANCH_AUX.001';
  for (const [starId, cfg] of Object.entries(table)) {
    if (!cfg.base) continue;
    const basePlacement = ctx.placements.get(cfg.base);
    if (!basePlacement) continue;
    const b = branchAt(branchIndex(basePlacement.branch) + cfg.direction * (day - 1));
    placeStar(ctx, starId, b, ruleId);
  }
  ctx.tracer.record({
    ruleId,
    inputs: { lunarDay: day },
    result: 'aux-by-day placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcAuxByDayHour(ctx: EngineContext): void {
  const day = ctx.normalized.lunar.day;
  const table = (auxTables as unknown as { byDayHour?: Record<string, { base: string; dayDirection: number; offset: number }> }).byDayHour ?? {};
  const ruleId = 'ZW.CALC.STAR.YEARBRANCH_AUX.001';
  for (const [starId, cfg] of Object.entries(table)) {
    if (!cfg.base) continue;
    const basePlacement = ctx.placements.get(cfg.base);
    if (!basePlacement) continue;
    const b = branchAt(branchIndex(basePlacement.branch) + cfg.dayDirection * (day - 1) + cfg.offset);
    placeStar(ctx, starId, b, ruleId);
  }
  ctx.tracer.record({
    ruleId,
    inputs: { lunarDay: day },
    result: 'aux-by-day-hour placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcFixedStars(ctx: EngineContext): void {
  const ruleId = 'ZW.STAR.FIXED.001';
  for (const [starId, cfg] of Object.entries(auxTables.fixed as unknown as Record<string, { palace: string }>)) {
    const palace = ctx.palaces.find(p => p.id === cfg.palace);
    if (palace) placeStar(ctx, starId, palace.branch, ruleId);
  }
  ctx.tracer.record({
    ruleId: 'ZW.CALC.STAR.FIXED.001',
    inputs: {},
    result: 'fixed stars placed',
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcChangSheng(ctx: EngineContext): void {
  const startBranch = (changshengTable.startBranch as Record<string, string>)[ctx.bureau];
  const startIdx = branchIndex(startBranch as BranchId);
  const dir = ctx.direction === 'forward' ? 1 : -1;
  const stages = changshengTable.stages as string[];
  for (const palace of ctx.palaces) {
    const offset = ((branchIndex(palace.branch) - startIdx) * dir) % 12;
    const idx = ((offset % 12) + 12) % 12;
    palace.changsheng = stages[idx] as typeof palace.changsheng;
  }
  ctx.tracer.record({
    ruleId: 'ZW.CALC.STAR.CHANGSHENG12.001',
    inputs: { bureau: ctx.bureau, startBranch, direction: ctx.direction },
    result: ctx.palaces.map(p => `${p.id}:${p.changsheng}`),
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcBoshi(ctx: EngineContext): void {
  if (!ctx.lucunBranch) return;
  const startIdx = branchIndex(ctx.lucunBranch);
  const stages = (changshengTable.boshi12 as { stages: string[] }).stages;
  for (const palace of ctx.palaces) {
    const offset = ((branchIndex(palace.branch) - startIdx) % 12 + 12) % 12;
    palace.boshi = stages[offset];
  }
  ctx.tracer.record({
    ruleId: 'ZW.CALC.STAR.BOSHI12.001',
    inputs: { lucunBranch: ctx.lucunBranch },
    result: ctx.palaces.map(p => `${p.id}:${p.boshi}`),
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export interface SihuaResult {
  type: 'lu' | 'quan' | 'ke' | 'ji';
  starId: string;
}

export function sihuaForStem(stem: StemId): SihuaResult[] {
  const row = (sihuaTable.canonical as Record<string, Record<string, string>>)[stem];
  return (['lu', 'quan', 'ke', 'ji'] as const).map(t => ({
    type: t,
    starId: row[t]
  }));
}
