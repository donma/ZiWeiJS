import type { PalaceId, BranchId, StarPlacement, Palace } from '../core/types.js';
import { branchIndex, branchAt, PALACE_IDS } from '../core/constants.js';

export type RelationKind =
  | 'same-palace'
  | 'opposite'
  | 'san-fang-si-zheng'
  | 'jia'
  | 'gong'
  | 'hui-zhao'
  | 'chong'
  | 'adjacent'
  | 'star-group';

export interface RelationContext {
  palaces: Palace[];
  branchToPalace: Map<BranchId, Palace>;
}

export function buildRelationContext(palaces: Palace[]): RelationContext {
  const branchToPalace = new Map<BranchId, Palace>();
  for (const p of palaces) branchToPalace.set(p.branch, p);
  return { palaces, branchToPalace };
}

export function palaceByBranch(ctx: RelationContext, branch: BranchId): Palace | undefined {
  return ctx.branchToPalace.get(branch);
}

export function palaceById(ctx: RelationContext, id: PalaceId): Palace | undefined {
  return ctx.palaces.find(p => p.id === id);
}

export function oppositeBranchOf(branch: BranchId): BranchId {
  return branchAt(branchIndex(branch) + 6);
}

export function trineBranches(branch: BranchId): [BranchId, BranchId] {
  const i = branchIndex(branch);
  return [branchAt(i + 4), branchAt(i + 8)];
}

export function adjacentBranches(branch: BranchId): [BranchId, BranchId] {
  const i = branchIndex(branch);
  return [branchAt(i + 1), branchAt(i - 1)];
}

export function sanFangSiZhengBranches(branch: BranchId): BranchId[] {
  const [t1, t2] = trineBranches(branch);
  return [branch, oppositeBranchOf(branch), t1, t2];
}

export function starsInBranches(palaces: Palace[], branches: BranchId[]): StarPlacement[] {
  const set = new Set(branches);
  const out: StarPlacement[] = [];
  for (const p of palaces) {
    if (set.has(p.branch)) out.push(...p.stars);
  }
  return out;
}

export function relatedPalaces(
  ctx: RelationContext,
  relation: RelationKind,
  base: Palace
): Palace[] {
  switch (relation) {
    case 'same-palace':
      return [base];
    case 'opposite':
    case 'chong': {
      const p = ctx.branchToPalace.get(oppositeBranchOf(base.branch));
      return p ? [p] : [];
    }
    case 'jia':
    case 'adjacent': {
      const [a, b] = adjacentBranches(base.branch);
      return [ctx.branchToPalace.get(a), ctx.branchToPalace.get(b)]
        .filter((p): p is Palace => !!p);
    }
    case 'gong':
    case 'hui-zhao': {
      const [t1, t2] = trineBranches(base.branch);
      return [ctx.branchToPalace.get(t1), ctx.branchToPalace.get(t2)]
        .filter((p): p is Palace => !!p);
    }
    case 'san-fang-si-zheng': {
      const branches = sanFangSiZhengBranches(base.branch);
      return branches.map(b => ctx.branchToPalace.get(b)).filter((p): p is Palace => !!p);
    }
    default:
      return [];
  }
}

export function relationStarIds(
  ctx: RelationContext,
  relation: RelationKind,
  base: Palace
): Set<string> {
  const palaces = relatedPalaces(ctx, relation, base);
  const ids = new Set<string>();
  for (const p of palaces) for (const s of p.stars) ids.add(s.starId);
  return ids;
}

export const MAJOR_MALEFIC_IDS = [
  'ZW.STAR.MALEFIC.QINGYANG',
  'ZW.STAR.MALEFIC.TUOLUO',
  'ZW.STAR.AUX.HUOLING',
  'ZW.STAR.AUX.LINGXING',
  'ZW.STAR.MALEFIC.DIKONG',
  'ZW.STAR.MALEFIC.DIJIE'
];

export function resolveStarGroup(group: string | string[]): string[] {
  if (Array.isArray(group)) return group;
  switch (group) {
    case 'major-malefic':
      return MAJOR_MALEFIC_IDS;
    case 'major-14':
      return [
        'ZW.STAR.MAJOR.ZIWEI', 'ZW.STAR.MAJOR.TIANJI', 'ZW.STAR.MAJOR.TAIYANG',
        'ZW.STAR.MAJOR.WUQU', 'ZW.STAR.MAJOR.TIANTONG', 'ZW.STAR.MAJOR.LIANZHEN',
        'ZW.STAR.MAJOR.TIANFU', 'ZW.STAR.MAJOR.TAIYIN', 'ZW.STAR.MAJOR.TANLANG',
        'ZW.STAR.MAJOR.JUMEN', 'ZW.STAR.MAJOR.TIANXIANG', 'ZW.STAR.MAJOR.TIANLIANG',
        'ZW.STAR.MAJOR.QISHA', 'ZW.STAR.MAJOR.POJUN'
      ];
    case 'aux-assist':
      return ['ZW.STAR.AUX.ZUOFU', 'ZW.STAR.AUX.YOUBI'];
    case 'literary':
      return ['ZW.STAR.AUX.WENCHANG', 'ZW.STAR.AUX.WENQU'];
    case 'nobleman':
      return ['ZW.STAR.AUX.TIANKUI', 'ZW.STAR.AUX.TIANYUE'];
    case 'peach':
      return ['ZW.STAR.AUX.HONGLUAN', 'ZW.STAR.AUX.TIANXI', 'ZW.STAR.AUX.TIANYAO', 'ZW.STAR.AUX.XIANCHI', 'ZW.STAR.AUX.MUYU'];
    default:
      return [];
  }
}

export { PALACE_IDS };
