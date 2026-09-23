import type {
  ZiWeiBirthInput, Profile, BureauId, BranchId, Rule,
  Palace, StarPlacement, Transformation, MajorPeriod, PeriodInfo, TargetDate
} from '../core/types.js';
import type { Tracer } from '../trace/tracer.js';
import type { NormalizedBirth } from '../calendar/calendar-engine.js';

export interface EngineContext {
  input: ZiWeiBirthInput;
  normalized: NormalizedBirth;
  profile: Profile;
  tracer: Tracer;
  /** 本次計算之目標日期（未提供時為 undefined → 不計算任何限運） */
  targetDate?: TargetDate;

  sexForCalculation: 'male' | 'female' | 'unknown';
  yinYang: 'yang' | 'yin';
  /** 性別未知時為 undetermined —— 不得猜方向（spec §27） */
  direction: 'forward' | 'backward' | 'undetermined';

  lifePalaceBranch: BranchId;
  bodyPalaceBranch: BranchId;
  /** 紫微星系定盤基準（由 ZW.CALC.STAR.ZIWEI.001 寫入） */
  ziweiBranch?: BranchId;
  palaces: Palace[];
  bureau: BureauId;
  bureauNumber: number;

  placements: Map<string, StarPlacement>;
  transformations: Transformation[];

  majorPeriods: MajorPeriod[];
  /** 有 targetDate 時，目標年齡所落之大限（不得以 majorPeriods[0] 代替） */
  activeMajorPeriod?: MajorPeriod;
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
