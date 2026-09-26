import { getProfile, getRule } from '../rule-engine/registry.js';
import type { Profile } from '../core/types.js';

export interface ProfileDiffEntry {
  dimension: string;
  canonicalRule: string;
  variantRule: string;
  sourceRefs: string[];
  evidenceRefs: string[];
  description?: string;
}

export interface ProfileExplanation {
  profileId: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  diffs: ProfileDiffEntry[];
  policies: {
    timeConvention?: string;
    dayBoundary?: string;
    leapMonthPolicy?: string;
    monthBoundaryPolicy?: string;
    yearBoundaryPolicy?: string;
  };
}

/**
 * Profile 差異說明 API（spec 0.6 §39）。
 *
 * 清楚解釋某 profile 相對 canonical 的具體差異（ruleOverrides 與 policies），
 * 讓使用者與 Expert UI 清楚知道 Profile 改了哪些規則。
 */
export function explainProfile(profileId: string): ProfileExplanation {
  const p: Profile = getProfile(profileId);
  const diffs: ProfileDiffEntry[] = [];

  for (const [canonId, variantId] of Object.entries(p.ruleOverrides ?? {})) {
    try {
      const vRule = getRule(variantId);
      let dimension = 'rule-override';
      if (canonId.includes('SIHUA')) dimension = 'sihua';
      else if (canonId.includes('MASTER')) dimension = 'masterStar';
      else if (canonId.includes('FIXED')) dimension = 'tianshiTianshang';
      else if (canonId.includes('CHANGSHENG')) dimension = 'changshengDirection';
      else if (canonId.includes('YEARSTEM')) dimension = 'auxStar';

      diffs.push({
        dimension,
        canonicalRule: canonId,
        variantRule: variantId,
        sourceRefs: vRule.sourceRefs ?? [],
        evidenceRefs: vRule.evidenceRefs ?? [],
        description: vRule.description?.['zh-TW']
      });
    } catch {
      diffs.push({
        dimension: 'rule-override',
        canonicalRule: canonId,
        variantRule: variantId,
        sourceRefs: [],
        evidenceRefs: []
      });
    }
  }

  return {
    profileId: p.profileId,
    name: p.name,
    description: p.description,
    diffs,
    policies: {
      timeConvention: p.timeConvention,
      dayBoundary: p.dayBoundary,
      leapMonthPolicy: p.leapMonthPolicy,
      monthBoundaryPolicy: p.monthBoundaryPolicy,
      yearBoundaryPolicy: p.yearBoundaryPolicy
    }
  };
}
