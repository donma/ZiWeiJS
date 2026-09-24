export * from './core/types.js';
export * from './core/constants.js';
export * from './core/errors.js';
export * from './core/i18n.js';

export { calculate, calculateSafe } from './reference-engine/engine.js';
export { normalizeBirth, buildCalendarInfo, hourBranchFromHour, utcOffsetMinutes } from './calendar/calendar-engine.js';

export {
  getRule, hasRule, listRules, listPatterns, listInterpretationRules,
  getSource, listSources, getEvidence, listEvidence, evidenceForRule,
  getProfile, listProfiles, resolveRuleForProfile
} from './rule-engine/registry.js';

export { evalDsl } from './rule-engine/dsl.js';

export {
  buildRelationContext, relatedPalaces, relationStarIds,
  sanFangSiZhengBranches, trineBranches, adjacentBranches, oppositeBranchOf,
  resolveStarGroup, MAJOR_MALEFIC_IDS
} from './relation-engine/relation-engine.js';

export {
  dignityOf, calcDignities, DIGNITY_ORDER, DIGNITY_ZH, DIGNITY_ZH_CN, DIGNITY_EN,
  dignityAtLeast, dignityLabel
} from './dignity-engine/dignity-engine.js';
export { sihuaForStem } from './executors/star-executors.js';
export { ziweiPalaceIndex, branchFromPalaceIndex } from './executors/palace-executors.js';
export { runInterpretation, runPatterns, groupByDomain } from './interpretation-engine/interpretation-engine.js';
export { resolveInterpretationHits, activeHits } from './interpretation-engine/resolver.js';
export { analyzeUnknownTime, rectifyAnalyze } from './rectification/rectification.js';
export type { UnknownTimeResult, RectificationResult, RectificationClue } from './rectification/rectification.js';
export { toContext } from './ai/context.js';
export type { AiContext } from './ai/context.js';
export {
  PIPELINE_STAGES, AI_ALLOWED_STAGES, canAdvance, canPromoteStatus,
  classifyDifference, DIFFERENTIAL_CLASSES, DIFFERENTIAL_CLASS_ZH
} from './ai/research.js';
export {
  listResearch, getResearch, researchForRule, hasOpenResearch,
  type ResearchItem, type ResearchStatus
} from './ai/research-registry.js';
export type { ResearchStage, PipelineGuardResult, ConflictReport } from './ai/research.js';
export { renderNarrative } from './narrative/narrative.js';
export type { NarrativeSection } from './narrative/narrative.js';
export { Tracer, explainTrace } from './trace/tracer.js';
export { renderChartSvg } from './renderer/svg-renderer.js';
export type { RenderOptions } from './renderer/svg-renderer.js';
export { getStar, listStars } from './executors/star-executors.js';
export { ageAt, virtualAge, resolveMajorPeriod } from './period-engine/major-period-resolver.js';
export { SCHEMA_VERSION, BIBLE_VERSION, ENGINE_VERSION } from './core/constants.js';
export {
  ASTRO_ENTITY_KINDS, isAstroEntityKind, entityKindForCategory, entityKindOfStarEntry,
  type AstroEntityKind
} from './core/entity-kinds.js';
export {
  listStarRegistry, getStarRegistryEntry, entityKindOfStar, groupStarsByEntityKind
} from './star-registry/registry.js';
export { QueryApi } from './query-engine/query.js';
export type { PalaceRelations } from './query-engine/query.js';
export {
  candidateAuxStars, placeByOffset, placeTaiFu, placeFengGao, placeJieShen,
  yearBranchGroup, xiaoXianStartBranch, xiaoXianDirection, xiaoXianBranchAtAge, xiaoXianSequence,
  xiaoXianForTarget, TAIFU_FENGGAO_RULE_ID, JIESHEN_RULE_ID, XIAOXIAN_RULE_ID,
  type CandidateStarPlacement, type CandidateBasis, type XiaoXianTargetResolution
} from './candidate-stars/candidate-stars.js';

import { calculate, calculateSafe } from './reference-engine/engine.js';
import { getRule, listRules, getSource, listSources } from './rule-engine/registry.js';
import { runInterpretation, runPatterns } from './interpretation-engine/interpretation-engine.js';
import { analyzeUnknownTime, rectifyAnalyze } from './rectification/rectification.js';
import { toContext } from './ai/context.js';
import {
  PIPELINE_STAGES, AI_ALLOWED_STAGES, canAdvance, canPromoteStatus, classifyDifference, DIFFERENTIAL_CLASSES
} from './ai/research.js';
import { listResearch, getResearch, researchForRule, hasOpenResearch } from './ai/research-registry.js';
import { renderChartSvg } from './renderer/svg-renderer.js';
import { explainTrace } from './trace/tracer.js';
import {
  calcYearPeriod, calcMonthPeriod, calcDayPeriod, calcHourPeriod
} from './period-engine/period-engine.js';
import { hourBranchFromHour } from './calendar/calendar-engine.js';
import { QueryApi } from './query-engine/query.js';
import {
  listStarRegistry, getStarRegistryEntry, entityKindOfStar, groupStarsByEntityKind
} from './star-registry/registry.js';
import { ASTRO_ENTITY_KINDS } from './core/entity-kinds.js';
import {
  candidateAuxStars, placeTaiFu, placeFengGao, placeJieShen,
  xiaoXianStartBranch, xiaoXianDirection, xiaoXianBranchAtAge, xiaoXianSequence, xiaoXianForTarget,
  TAIFU_FENGGAO_RULE_ID, JIESHEN_RULE_ID, XIAOXIAN_RULE_ID,
  type XiaoXianTargetResolution
} from './candidate-stars/candidate-stars.js';
import type { ZiWeiChart, CalculateOptions, ZiWeiBirthInput, TargetDate } from './core/types.js';

export const ZiWei = {
  calculate,
  calculateSafe,
  Periods: {
    /** 於既有本命盤上疊加指定目標日期之限運（不 mutate 原 chart） */
    at(chart: ZiWeiChart, target: TargetDate, options?: CalculateOptions): ZiWeiChart {
      const opts: CalculateOptions = { ...(options ?? {}), targetDate: target };
      return calculate(chart.input, opts);
    }
  },
  Interpret: (chart: ZiWeiChart) => chart.interpretation,
  Patterns: {
    match: (chart: ZiWeiChart) => chart.chart.patterns
  },
  Rectification: {
    analyze: rectifyAnalyze,
    analyzeUnknownTime
  },
  Renderer: {
    render: renderChartSvg
  },
  AI: {
    toContext,
    canAdvance,
    canPromoteStatus,
    pipelineStages: PIPELINE_STAGES,
    aiAllowedStages: AI_ALLOWED_STAGES
  },
  Research: {
    canAdvance,
    canPromoteStatus,
    classifyDifference,
    classes: DIFFERENTIAL_CLASSES,
    list: listResearch,
    get: getResearch,
    forRule: researchForRule,
    hasOpen: hasOpenResearch
  },
  Rules: {
    get: getRule,
    list: listRules,
    explain(ruleId: string) {
      const rule = getRule(ruleId);
      return {
        rule,
        sources: (rule.sourceRefs ?? []).map(id => {
          try { return getSource(id); } catch { return { sourceId: id, title: id, type: 'other', tier: 6 }; }
        }),
        evidence: (rule.evidenceRefs ?? [])
      };
    }
  },
  Sources: {
    get: getSource,
    list: listSources
  },
  /** Query Facade（spec Post-Stability §8）：只查既有結果，不新增演算法 */
  Query: QueryApi,
  /** Star Registry / Entity Taxonomy 查詢（spec §20 / §36） */
  StarRegistry: {
    list: listStarRegistry,
    get: getStarRegistryEntry,
    entityKind: entityKindOfStar,
    groupByKind: groupStarsByEntityKind
  },
  Taxonomy: {
    kinds: ASTRO_ENTITY_KINDS,
    ofStar: entityKindOfStar
  },
  /**
   * Candidate 星曜 / 小限（spec Post-Stability Phase B/C）。
   * 明確標示為 candidate：預設不併入 canonical 盤面，需 Owner 批准後才會進執行計畫。
   */
  Candidate: {
    auxStars: candidateAuxStars,
    taiFu: placeTaiFu,
    fengGao: placeFengGao,
    jieShen: placeJieShen,
    xiaoXian: {
      startBranch: xiaoXianStartBranch,
      direction: xiaoXianDirection,
      branchAtAge: xiaoXianBranchAtAge,
      sequence: xiaoXianSequence,
      /**
       * 目標日期所落之小限（以農曆年計算虛歲後定位，與大限相同之年齡慣例）。
       * 性別未知或無目標日期時回傳 reason，不猜方向。
       */
      forTarget(chart: ZiWeiChart, target: TargetDate): XiaoXianTargetResolution {
        const overlaid = calculate(chart.input, {
          targetDate: target,
          profile: chart.generatedWith.profile
        });
        const targetLunarYear = overlaid.periods.year?.lunarYear;
        if (targetLunarYear === undefined) {
          return { ruleId: XIAOXIAN_RULE_ID, reason: 'NO_TARGET_YEAR_PERIOD' };
        }
        return xiaoXianForTarget({
          birthLunarYear: chart.calendar.lunar.year,
          targetLunarYear,
          yearBranch: chart.calendar.ganzhi.year.branch,
          sex: chart.birthContext.sexForCalculation as 'male' | 'female' | 'unknown'
        });
      }
    },
    ruleIds: {
      taiFuFengGao: TAIFU_FENGGAO_RULE_ID,
      jieShen: JIESHEN_RULE_ID,
      xiaoXian: XIAOXIAN_RULE_ID
    }
  },
  Trace: {
    explain: explainTrace
  },
  analyzeUnknownTime,
  canAdvance,
  canPromoteStatus,
  classifyDifference,
  pipelineStages: PIPELINE_STAGES,
  aiAllowedStages: AI_ALLOWED_STAGES
};

export default ZiWei;
