import type {
  ZiWeiBirthInput, Profile, BureauId, BranchId, Rule,
  Palace, StarPlacement, Transformation, MajorPeriod, PeriodInfo
} from '../core/types.js';
import type { Tracer } from '../trace/tracer.js';
import type { NormalizedBirth } from '../calendar/calendar-engine.js';

export interface EngineContext {
  input: ZiWeiBirthInput;
  normalized: NormalizedBirth;
  profile: Profile;
  tracer: Tracer;

  sexForCalculation: 'male' | 'female' | 'unknown';
  yinYang: 'yang' | 'yin';
  direction: 'forward' | 'backward';

  lifePalaceBranch: BranchId;
  bodyPalaceBranch: BranchId;
  palaces: Palace[];
  bureau: BureauId;
  bureauNumber: number;

  placements: Map<string, StarPlacement>;
  transformations: Transformation[];

  majorPeriods: MajorPeriod[];
  yearPeriod?: PeriodInfo;
  monthPeriod?: PeriodInfo;
  dayPeriod?: PeriodInfo;
  hourPeriod?: PeriodInfo;

  masterStar?: string;
  bodyStar?: string;

  lucunBranch?: BranchId;

  /** canonical ruleId → 依 profile.ruleOverrides 解析後實際使用的 Rule（可能為 variant） */
  activeRules: Map<string, Rule>;
}

/**
 * 取得某 canonical 規則在當前 profile 下實際使用的規則。
 * 若 profile 未覆寫，回傳 canonical 本身。
 */
export function activeRule(ctx: EngineContext, canonicalRuleId: string): Rule | undefined {
  return ctx.activeRules.get(canonicalRuleId);
}

/**
 * 取得 variantPatch（profile 選用 variant 時生效）。
 * 形如 { "ZW.STAR.AUX.TIANYUE": { "xin": 5 } } 或 { "shui2": {...} }
 */
export function variantPatchFor(ctx: EngineContext, canonicalRuleId: string): Record<string, unknown> | undefined {
  const rule = ctx.activeRules.get(canonicalRuleId);
  if (!rule) return undefined;
  const patch = rule.logic?.params?.variantPatch as Record<string, unknown> | undefined;
  return patch;
}

/** 實際使用的規則 ID（用於 trace） */
export function effectiveRuleId(ctx: EngineContext, canonicalRuleId: string): string {
  return ctx.activeRules.get(canonicalRuleId)?.ruleId ?? canonicalRuleId;
}
