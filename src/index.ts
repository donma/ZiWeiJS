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
export { analyzeUnknownTime, rectifyAnalyze } from './rectification/rectification.js';
export type { UnknownTimeResult, RectificationResult, RectificationClue } from './rectification/rectification.js';
export { toContext } from './ai/context.js';
export type { AiContext } from './ai/context.js';
export {
  PIPELINE_STAGES, AI_ALLOWED_STAGES, canAdvance, canPromoteStatus,
  classifyDifference, DIFFERENTIAL_CLASSES, DIFFERENTIAL_CLASS_ZH
} from './ai/research.js';
export type { ResearchStage, PipelineGuardResult, ConflictReport } from './ai/research.js';
export { renderNarrative } from './narrative/narrative.js';
export type { NarrativeSection } from './narrative/narrative.js';
export { Tracer, explainTrace } from './trace/tracer.js';
export { renderChartSvg } from './renderer/svg-renderer.js';
export type { RenderOptions } from './renderer/svg-renderer.js';
export { getStar, listStars } from './executors/star-executors.js';
export { SCHEMA_VERSION, BIBLE_VERSION, ENGINE_VERSION } from './core/constants.js';

import { calculate, calculateSafe } from './reference-engine/engine.js';
import { getRule, listRules, getSource, listSources } from './rule-engine/registry.js';
import { runInterpretation, runPatterns } from './interpretation-engine/interpretation-engine.js';
import { analyzeUnknownTime, rectifyAnalyze } from './rectification/rectification.js';
import { toContext } from './ai/context.js';
import {
  PIPELINE_STAGES, AI_ALLOWED_STAGES, canAdvance, canPromoteStatus, classifyDifference, DIFFERENTIAL_CLASSES
} from './ai/research.js';
import { renderChartSvg } from './renderer/svg-renderer.js';
import { explainTrace } from './trace/tracer.js';
import {
  calcYearPeriod, calcMonthPeriod, calcDayPeriod, calcHourPeriod
} from './period-engine/period-engine.js';
import { hourBranchFromHour } from './calendar/calendar-engine.js';
import type { ZiWeiChart, CalculateOptions, ZiWeiBirthInput } from './core/types.js';

export const ZiWei = {
  calculate,
  calculateSafe,
  Periods: {
    at(chart: ZiWeiChart, target: { year: number; month?: number; day?: number; hour?: number }, options?: CalculateOptions): ZiWeiChart {
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
    classes: DIFFERENTIAL_CLASSES
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
