import type { EngineContext } from './context.js';
import type { ExecutorOutcome } from '../rule-engine/executor-registry.js';
import { effectiveRuleId, variantPatchFor } from './context.js';
import type { BranchId, StarPlacement, Star, StemId } from '../core/types.js';
import { provenanceFor } from '../rule-engine/execute-rule.js';
import { branchAt, branchIndex, stemIndex, STEMS } from '../core/constants.js';
import {
  ziweiSeriesOffsets, tianfuBase, tianfuSeriesOffsets
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
  const prov = provenanceFor(ruleId, ctx.profile.profileId, ctx.profile.ruleOverrides);
  const placement: StarPlacement = {
    starId,
    star: getStar(starId),
    palaceId: palace.id,
    branch,
    certainty: 'high',
    ruleId: prov.ruleId,
    ruleVersion: prov.ruleVersion,
    provenance: prov
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

export function calcBureau(ctx: EngineContext): ExecutorOutcome {
  const CANON = 'ZW.CALC.BUREAU.NAYIN.001';
  const patch = variantPatchFor(ctx, CANON) as { useYearGanzhi?: boolean } | undefined;
  const life = ctx.palaces.find(p => p.isLifePalace)!;
  const gz = patch?.useYearGanzhi ? ctx.normalized.ganzhi.year : life.ganzhi;
  const key = `${gz.stem}-${gz.branch}`;
  const wuxing = (nayinTable.nayin as Record<string, string>)[key];
  const bureau = (nayinTable.wuxingToBureau as Record<string, string>)[wuxing] as typeof ctx.bureau;
  ctx.bureau = bureau;
  const numMap: Record<string, number> = { shui2: 2, mu3: 3, jin4: 4, tu5: 5, huo6: 6 };
  ctx.bureauNumber = numMap[bureau];
  return {
    inputs: { lifePalaceGanzhi: key, nayin: wuxing },
    result: bureau
  };
}

export function calcZiweiSeries(ctx: EngineContext): ExecutorOutcome {
  const ziweiBranch = ctx.ziweiBranch!;
  const offsets = ziweiSeriesOffsets();
  const placed: string[] = [];
  for (const [starId, offset] of Object.entries(offsets)) {
    const b = branchAt(branchIndex(ziweiBranch) + offset);
    placeStar(ctx, starId, b, 'ZW.CALC.STAR.ZIWEI_SERIES.001');
    placed.push(`${starId}@${b}`);
  }
  return { inputs: { ziweiBranch }, result: placed };
}

export function calcTianfuSeries(ctx: EngineContext): ExecutorOutcome {
  const ziweiBranch = ctx.ziweiBranch!;
  const tfBase = tianfuBase(ziweiBranch);
  const tfOffsets = tianfuSeriesOffsets();
  const placed: string[] = [];
  for (const [starId, offset] of Object.entries(tfOffsets)) {
    const b = branchAt(branchIndex(tfBase) + offset);
    placeStar(ctx, starId, b, 'ZW.CALC.STAR.TIANFU_SERIES.001');
    placed.push(`${starId}@${b}`);
  }
  return { inputs: { ziweiBranch, tianfuBranch: tfBase }, result: placed };
}

export function calcAuxByMonth(ctx: EngineContext): ExecutorOutcome {
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
  return { inputs: { lunarMonth: month }, result: 'aux-by-month placed' };
}

export function calcAuxByHour(ctx: EngineContext): ExecutorOutcome {
  const hbIdx = branchIndex(ctx.normalized.hourBranch);
  const table = auxTables.byHourBranch as unknown as Record<string, { startBranch: string; direction: number }>;
  const ruleId = 'ZW.CALC.STAR.CHANGQU.001';
  for (const [starId, cfg] of Object.entries(table)) {
    if (starId === 'note' || typeof cfg !== 'object' || !cfg.startBranch) continue;
    const start = branchIndex(cfg.startBranch as BranchId);
    const b = branchAt(start + cfg.direction * hbIdx);
    placeStar(ctx, starId, b, ruleId);
  }
  return { inputs: { hourBranch: ctx.normalized.hourBranch }, result: 'aux-by-hour placed' };
}

export function calcAuxByYearStem(ctx: EngineContext): ExecutorOutcome {
  const CANON = 'ZW.CALC.STAR.YEARSTEM_AUX.001';
  const stem = ctx.normalized.ganzhi.year.stem;
  const table = auxTables.byYearStem as unknown as Record<string, Record<string, number>>;
  const ruleId = effectiveRuleId(ctx, CANON);
  const patch = variantPatchFor(ctx, CANON) as Record<string, Record<string, number>> | undefined;
  const starIds = [
    'ZW.STAR.AUX.LUCUN', 'ZW.STAR.MALEFIC.QINGYANG', 'ZW.STAR.MALEFIC.TUOLUO',
    'ZW.STAR.AUX.TIANKUI', 'ZW.STAR.AUX.TIANYUE'
  ];
  const applied: string[] = [];
  for (const starId of starIds) {
    const row = table[starId];
    if (!row || typeof row !== 'object') continue;
    const patchRow = patch?.[starId];
    const idx = patchRow?.[stem] !== undefined ? patchRow[stem] : row[stem];
    if (idx === undefined) continue;
    const b = branchAt(idx);
    placeStar(ctx, starId, b, ruleId);
    applied.push(`${starId}:${b}`);
    if (starId === 'ZW.STAR.AUX.LUCUN') ctx.lucunBranch = b;
  }
  return {
    inputs: { yearStem: stem, variantOf: CANON, variantPatched: patch ? Object.keys(patch) : [] },
    result: applied,
    status: patch ? 'variant' : 'executed',
    note: patch ? `依 profile 覆寫變體（variant of ${CANON}）` : undefined
  };
}

function yearBranchGroup(branch: BranchId): string {
  const groups = (auxTables.byYearBranch as { groups: Record<string, number[]> }).groups;
  const idx = branchIndex(branch);
  for (const [name, arr] of Object.entries(groups)) {
    if (arr.includes(idx)) return name;
  }
  return 'yin-wu-xu';
}

export function calcAuxByYearBranch(ctx: EngineContext): ExecutorOutcome {
  const yearBranch = ctx.normalized.ganzhi.year.branch;
  const ybIdx = branchIndex(yearBranch);
  const group = yearBranchGroup(yearBranch);
  const table = auxTables.byYearBranch as Record<string, unknown>;
  const ruleId = 'ZW.CALC.STAR.YEARBRANCH_AUX.001';
  const hbIdx = branchIndex(ctx.normalized.hourBranch);

  const hlCanon = 'ZW.CALC.STAR.YEARBRANCH_AUX.001';
  const hlPatch = variantPatchFor(ctx, hlCanon) as Record<string, Record<string, number>> | undefined;
  const fireLing = ['ZW.STAR.AUX.HUOLING', 'ZW.STAR.AUX.LINGXING'];
  for (const starId of fireLing) {
    const cfg = table[starId] as Record<string, unknown> | undefined;
    if (!cfg) continue;
    const patched = hlPatch?.[starId]?.[group];
    const start = patched !== undefined ? patched : (cfg[group] as number | undefined);
    if (start === undefined) continue;
    placeStar(ctx, starId, branchAt(start + hbIdx), effectiveRuleId(ctx, hlCanon));
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

  return { inputs: { yearBranch, group }, result: 'year-branch aux placed' };
}

export function calcAuxByMonth2(ctx: EngineContext): ExecutorOutcome {
  const month = ctx.normalized.lunar.month;
  const table = (auxTables as unknown as { byLunarMonth2?: Record<string, { startBranch: string; direction: number }> }).byLunarMonth2 ?? {};
  const ruleId = 'ZW.CALC.STAR.BYMONTH2.001';
  for (const [starId, cfg] of Object.entries(table)) {
    if (!cfg.startBranch) continue;
    const start = branchIndex(cfg.startBranch as BranchId);
    const b = branchAt(start + cfg.direction * (month - 1));
    placeStar(ctx, starId, b, ruleId);
  }
  // 陰煞：正月起寅，每月進二宮
  const yinsha = branchAt(2 + ((month - 1) * 2) % 12);
  placeStar(ctx, 'ZW.STAR.AUX.YINSHA', yinsha, ruleId);
  return { inputs: { lunarMonth: month }, result: 'aux-by-month2 placed' };
}

export function calcAuxByYearStem2(ctx: EngineContext): ExecutorOutcome {
  const stem = ctx.normalized.ganzhi.year.stem;
  const table = (auxTables as unknown as { byYearStem2?: Record<string, Record<string, number>> }).byYearStem2 ?? {};
  const ruleId = 'ZW.CALC.STAR.BYYEARSTEM2.001';
  for (const [starId, row] of Object.entries(table)) {
    const idx = row[stem];
    if (idx === undefined) continue;
    placeStar(ctx, starId, branchAt(idx), ruleId);
  }
  return { inputs: { yearStem: stem }, result: 'year-stem2 aux placed' };
}

export function calcAuxByDay(ctx: EngineContext): ExecutorOutcome {
  const day = ctx.normalized.lunar.day;
  const table = (auxTables as unknown as { byDayBranch?: Record<string, { base: string; direction: number }> }).byDayBranch ?? {};
  const ruleId = 'ZW.CALC.STAR.BYDAY.001';
  for (const [starId, cfg] of Object.entries(table)) {
    if (!cfg.base) continue;
    const basePlacement = ctx.placements.get(cfg.base);
    if (!basePlacement) continue;
    const b = branchAt(branchIndex(basePlacement.branch) + cfg.direction * (day - 1));
    placeStar(ctx, starId, b, ruleId);
  }
  return { inputs: { lunarDay: day }, result: 'aux-by-day placed' };
}

export function calcAuxByDayHour(ctx: EngineContext): ExecutorOutcome {
  const day = ctx.normalized.lunar.day;
  const table = (auxTables as unknown as { byDayHour?: Record<string, { base: string; dayDirection: number; offset: number }> }).byDayHour ?? {};
  const ruleId = 'ZW.CALC.STAR.BYDAYHOUR.001';
  for (const [starId, cfg] of Object.entries(table)) {
    if (!cfg.base) continue;
    const basePlacement = ctx.placements.get(cfg.base);
    if (!basePlacement) continue;
    const b = branchAt(branchIndex(basePlacement.branch) + cfg.dayDirection * (day - 1) + cfg.offset);
    placeStar(ctx, starId, b, ruleId);
  }
  return { inputs: { lunarDay: day }, result: 'aux-by-day-hour placed' };
}

export function calcAuxSpecial(ctx: EngineContext): ExecutorOutcome {
  const yearBranch = ctx.normalized.ganzhi.year.branch;
  const ybIdx = branchIndex(yearBranch);
  const group = yearBranchGroup(yearBranch);
  const table = auxTables.byMonthSpecial as Record<string, Record<string, number> | { formula?: string; note?: string }>;
  const ruleId = 'ZW.CALC.STAR.SPECIAL_AUX.001';
  const yearStem = ctx.normalized.ganzhi.year.stem;
  const voidTable = (auxTables as unknown as { byYearStemVoid?: Record<string, unknown> }).byYearStemVoid ?? {};

  // 截空 / 天空 / 天乙（年干）
  for (const starId of ['ZW.STAR.AUX.JIEKONG', 'ZW.STAR.AUX.TIANKONG', 'ZW.STAR.AUX.TIANYI']) {
    const row = voidTable[starId] as Record<string, number> | undefined;
    if (row && row[yearStem] !== undefined) {
      placeStar(ctx, starId, branchAt(row[yearStem]), ruleId);
    }
  }

  // 旬空：年柱干支所在旬的兩個空亡地支
  // 干支差值 d = (branch - stem) mod 12 → 旬空 = (10+d, 11+d)
  const stemIdx = STEMS.indexOf(yearStem);
  const d = ((branchIndex(yearBranch) - stemIdx) % 12 + 12) % 12;
  placeStar(ctx, 'ZW.STAR.AUX.XUNKONG', branchAt(10 + d), ruleId);

  // 蜚廉
  const feilian = (table['ZW.STAR.AUX.FEILIAN'] as Record<string, number>)?.[group];
  if (feilian !== undefined) placeStar(ctx, 'ZW.STAR.AUX.FEILIAN', branchAt(feilian), ruleId);

  // 息神：年支後一宮
  placeStar(ctx, 'ZW.STAR.AUX.XIUSHEN', branchAt(ybIdx + 1), ruleId);

  // 天德/月德：以月支查（簡化表）
  const monthBranchIdx = branchIndex(ctx.normalized.ganzhi.month.branch);
  const TIANDE = [9, 0, 11, 2, 9, 4, 9, 6, 9, 8, 9, 10];
  const YUEDE = [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  placeStar(ctx, 'ZW.STAR.AUX.TIANDE', branchAt(TIANDE[monthBranchIdx]), ruleId);
  placeStar(ctx, 'ZW.STAR.AUX.YUEDE', branchAt(YUEDE[monthBranchIdx]), ruleId);

  // 天月：以月支查（疾厄相關）
  const TIANYUE2 = [10, 5, 4, 1, 1, 9, 1, 8, 6, 3, 11, 7];
  placeStar(ctx, 'ZW.STAR.AUX.TIANYUE2', branchAt(TIANYUE2[monthBranchIdx]), ruleId);

  // 指背：年支對宮
  placeStar(ctx, 'ZW.STAR.AUX.ZHIFU', branchAt(ybIdx + 6), ruleId);

  return { inputs: { yearStem, yearBranch }, result: 'special aux placed' };
}

export function calcPeriodStars(ctx: EngineContext): ExecutorOutcome {
  const ybIdx = branchIndex(ctx.normalized.ganzhi.year.branch);
  const ruleId = 'ZW.CALC.STAR.PERIOD12.001';
  // 歲建諸星：歲建在太歲宮，其餘順行 12 宮
  const SUIJIAN: string[] = [
    'ZW.STAR.PERIOD.SUIJIAN', 'ZW.STAR.PERIOD.HUIQI', 'ZW.STAR.PERIOD.SANGMEN2',
    'ZW.STAR.PERIOD.GUANSUO', 'ZW.STAR.PERIOD.GUANFU2', 'ZW.STAR.PERIOD.XIAOHAO2',
    'ZW.STAR.PERIOD.DAHAO2', 'ZW.STAR.PERIOD.LONDE', 'ZW.STAR.PERIOD.BAIHU2',
    'ZW.STAR.PERIOD.FUDE', 'ZW.STAR.PERIOD.DIAOKE2', 'ZW.STAR.PERIOD.BINGFU2'
  ];
  for (let i = 0; i < 12; i++) {
    placeStar(ctx, SUIJIAN[i], branchAt(ybIdx + i), ruleId);
  }
  // 將前諸星：將星在三合局中宮（寅午戌在午/申子辰在子/巳酉丑在酉/亥卯未在卯），其餘順行
  const groupCenter: Record<string, number> = { 'yin-wu-xu': 6, 'shen-zi-chen': 0, 'si-you-chou': 9, 'hai-mao-wei': 3 };
  const group = yearBranchGroup(yearBranchOf(ctx));
  const jxBase = groupCenter[group] ?? 0;
  const JIANGQIAN: string[] = [
    'ZW.STAR.INTERIM.JIANGXING', 'ZW.STAR.INTERIM.PANAN', 'ZW.STAR.INTERIM.SUIYI',
    'ZW.STAR.INTERIM.XISHEN', 'ZW.STAR.INTERIM.HUAGAI2', 'ZW.STAR.INTERIM.JIESHA2',
    'ZW.STAR.INTERIM.ZAISHA', 'ZW.STAR.INTERIM.TIANSHA', 'ZW.STAR.INTERIM.ZHIBEI2',
    'ZW.STAR.INTERIM.XIANCHI2', 'ZW.STAR.INTERIM.YUESHA', 'ZW.STAR.INTERIM.WANGSHEN2'
  ];
  for (let i = 0; i < 12; i++) {
    placeStar(ctx, JIANGQIAN[i], branchAt(jxBase + i), ruleId);
  }
  return { inputs: { yearBranch: ctx.normalized.ganzhi.year.branch, group }, result: 'period & interim stars placed' };
}

function yearBranchOf(ctx: EngineContext): BranchId {
  return ctx.normalized.ganzhi.year.branch;
}

export function calcFixedStars(ctx: EngineContext): ExecutorOutcome {
  const CANON = 'ZW.CALC.STAR.FIXED.001';
  const ruleId = effectiveRuleId(ctx, CANON);
  const patch = variantPatchFor(ctx, CANON) as { swapForYinMaleYangFemale?: boolean } | undefined;

  // 中州派等流派：凡陽男陰女依常規（天傷在奴僕/交友，天使在疾厄）；
  // 若為陰男陽女，則天傷居疾厄、天使居奴僕（對調）。
  let friendsStar = 'ZW.STAR.AUX.TIANSHANG';
  let healthStar = 'ZW.STAR.AUX.TIANSHI';
  if (patch?.swapForYinMaleYangFemale) {
    const yinyangIdx = branchIndex(ctx.normalized.ganzhi.year.branch) % 2; // 0=陽 (zi=0, yin=2...), 1=陰 (chou=1, mao=3...)
    const genderIdx = ctx.sexForCalculation === 'female' ? 1 : 0;
    const sameYinyang = yinyangIdx === genderIdx; // 陽男 (0===0) 或 陰女 (1===1)
    if (!sameYinyang) {
      friendsStar = 'ZW.STAR.AUX.TIANSHI';
      healthStar = 'ZW.STAR.AUX.TIANSHANG';
    }
  }

  const friendsPalace = ctx.palaces.find(p => p.id === 'friends');
  const healthPalace = ctx.palaces.find(p => p.id === 'health');
  if (friendsPalace) placeStar(ctx, friendsStar, friendsPalace.branch, ruleId);
  if (healthPalace) placeStar(ctx, healthStar, healthPalace.branch, ruleId);

  return { inputs: { friendsStar, healthStar }, result: 'fixed stars placed' };
}

export function calcChangSheng(ctx: EngineContext): ExecutorOutcome {
  const CANON = 'ZW.CALC.STAR.CHANGSHENG12.001';
  const patch = variantPatchFor(ctx, CANON) as { directionBasis?: 'sex-only' } | undefined;

  // 長生十二神順逆依性別決定，性別未知時不得猜測（spec §27）
  if (ctx.direction === 'undetermined') {
    return {
      inputs: { bureau: ctx.bureau },
      result: null,
      status: 'unavailable',
      reason: 'UNKNOWN_SEX_FOR_CALCULATION'
    };
  }

  // 方向判據：
  // canonical: 陽男陰女順、陰男陽女逆（ctx.direction）
  // variant (ZW.CALC.STAR.CHANGSHENG12.V_SEX_DIRECTION.001):《全書》卷二原文「男命順數、女命逆數」（不論陰陽）
  const dir = patch?.directionBasis === 'sex-only'
    ? (ctx.sexForCalculation === 'male' ? 1 : -1)
    : (ctx.direction === 'forward' ? 1 : -1);

  const startBranch = (changshengTable.startBranch as Record<string, string>)[ctx.bureau];
  const startIdx = branchIndex(startBranch as BranchId);
  const stages = changshengTable.stages as string[];
  for (const palace of ctx.palaces) {
    const offset = ((branchIndex(palace.branch) - startIdx) * dir) % 12;
    const idx = ((offset % 12) + 12) % 12;
    palace.changsheng = stages[idx] as typeof palace.changsheng;
  }
  return {
    inputs: { bureau: ctx.bureau, startBranch, direction: patch?.directionBasis === 'sex-only' ? (ctx.sexForCalculation === 'male' ? 'forward' : 'backward') : ctx.direction, directionBasis: patch?.directionBasis ?? 'yinyang' },
    result: ctx.palaces.map(p => `${p.id}:${p.changsheng}`)
  };
}

export function calcBoshi(ctx: EngineContext): ExecutorOutcome | void {
  if (!ctx.lucunBranch) return;
  const startIdx = branchIndex(ctx.lucunBranch);
  const stages = (changshengTable.boshi12 as { stages: string[] }).stages;
  for (const palace of ctx.palaces) {
    const offset = ((branchIndex(palace.branch) - startIdx) % 12 + 12) % 12;
    palace.boshi = stages[offset];
  }
  return {
    inputs: { lucunBranch: ctx.lucunBranch },
    result: ctx.palaces.map(p => `${p.id}:${p.boshi}`)
  };
}

export interface SihuaResult {
  type: 'lu' | 'quan' | 'ke' | 'ji';
  starId: string;
}

export function sihuaForStem(
  stem: StemId,
  patch?: Record<string, Partial<Record<'lu' | 'quan' | 'ke' | 'ji', string>>>
): SihuaResult[] {
  const row = (sihuaTable.canonical as Record<string, Record<string, string>>)[stem];
  const patched = patch?.[stem];
  return (['lu', 'quan', 'ke', 'ji'] as const).map(t => ({
    type: t,
    starId: patched?.[t] ?? row[t]
  }));
}
