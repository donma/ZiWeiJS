/**
 * AI Handoff Package（spec 0.71 §40–§75）。
 *
 * 定位：
 *   命盤資料 + interpretation contract。
 *   deterministic / versioned / machine-readable / human-readable /
 *   privacy-aware / profile-aware / uncertainty-aware。
 *
 * 非「一大段強制 AI 扮演角色的 Prompt」（§46）。
 * vendor-neutral / model-neutral。
 */
import { getProfile, getRule, getSource, getEvidence } from '../rule-engine/registry.js';
import { explainProfile } from '../rule-engine/profile-explain.js';
import { t } from '../core/i18n.js';
import { STEM_ZH, BRANCH_ZH, PALACE_NAME, BUREAU_NAME } from '../core/constants.js';
import { canonicalJson, fingerprint } from '../product/product.js';
import type {
  ZiWeiChart, ZiWeiBirthInput, BranchId, RuleStatus,
  BirthTimePrecision
} from '../core/types.js';
import type { BirthTimeUncertaintyResult } from '../birth-time/birth-time.js';

export const AI_HANDOFF_FORMAT_VERSION = '1.0';

export type AiHandoffMode = 'compact' | 'full';
export type AiHandoffFormat = 'json' | 'markdown' | 'text';
export type AiHandoffPrivacy = 'minimal' | 'interpretation' | 'full';

export interface AiHandoffOptions {
  mode?: AiHandoffMode;
  format?: AiHandoffFormat;
  privacy?: AiHandoffPrivacy;
}

interface ResearchWarning {
  kind: 'candidate-rule' | 'research' | 'dynamic-star-candidate' | 'variant' | 'deprecated';
  id: string;
  note: string;
}

const SIHUA_ZH: Record<string, string> = { lu: '化祿', quan: '化權', ke: '化科', ji: '化忌' };

const DEFAULT_INSTRUCTIONS = {
  treatChartAsPrecalculated: true,
  doNotRecalculateUnlessAsked: true,
  respectProfile: true,
  distinguishRuleStatus: true,
  doNotTreatCandidateAsCanonical: true,
  respectBirthTimeUncertainty: true,
  doNotInventMissingFacts: true
} as const;

/* ------------------------------------------------------------------ *
 * 內部：chart → handoff payload
 * ------------------------------------------------------------------ */

function buildPalaceSummary(chart: ZiWeiChart, statusOf: (starId: string) => { status?: RuleStatus; ruleId?: string; ruleVersion?: string }) {
  return chart.chart.palaces.map(p => ({
    palaceId: p.id,
    name: t(p.name),
    stem: STEM_ZH[p.stem],
    branch: p.branch,
    isLifePalace: p.isLifePalace,
    isBodyPalace: p.isBodyPalace,
    majorPeriod: p.majorPeriod,
    stars: p.stars.map(s => {
      const meta = statusOf(s.starId);
      return {
        starId: s.starId,
        name: t(s.star.name),
        category: s.star.category,
        dignity: s.dignity,
        transformations: (s.transformations ?? [])
          .filter(tr => tr.sourceScope === 'natal')
          .map(tr => SIHUA_ZH[tr.type] ?? tr.type),
        status: meta.status,
        ruleId: meta.ruleId,
        ruleVersion: meta.ruleVersion
      };
    }),
    changsheng: p.changsheng,
    boshi: p.boshi
  }));
}

function buildNatalSummary(chart: ZiWeiChart) {
  const n = chart.chart.natal;
  return {
    lifePalace: t(PALACE_NAME[n.lifePalace]),
    lifePalaceBranch: n.lifePalaceBranch,
    bodyPalace: t(PALACE_NAME[n.bodyPalace]),
    bodyPalaceBranch: n.bodyPalaceBranch,
    bureau: chart.birthContext.bureau,
    bureauName: t(chart.birthContext.bureauName),
    masterStar: n.masterStar,
    bodyStar: n.bodyStar,
    yinYang: chart.birthContext.yinYang,
    direction: chart.birthContext.direction
  };
}

function buildTransformations(chart: ZiWeiChart) {
  return chart.chart.transformations.map(tr => ({
    scope: tr.sourceScope,
    type: tr.type,
    sourceStem: tr.sourceStem,
    targetStarId: tr.targetStarId,
    targetPalaceId: tr.targetPalaceId,
    status: tr.provenance ? getRuleStatus(tr.provenance.ruleId) : undefined,
    ruleId: tr.provenance?.ruleId
  }));
}

function getRuleStatus(ruleId: string): RuleStatus | undefined {
  try { return getRule(ruleId).status; } catch { return undefined; }
}

function buildPatterns(chart: ZiWeiChart) {
  return chart.chart.patterns.map(p => ({
    patternId: p.patternId,
    name: t(p.name),
    status: p.status === 'variant-only' ? 'variant-only' : p.status as 'complete' | 'enhanced' | 'partial' | 'broken' | 'insufficient',
    ruleStatus: getRuleStatus(p.ruleId) ?? 'canonical',
    matchedConditions: p.matchedConditions,
    breakers: p.breakers,
    enhancers: p.enhancers
  }));
}

function buildPeriods(chart: ZiWeiChart) {
  const periods: Record<string, unknown> = {};
  if (chart.periods.major.length > 0) {
    periods.major = chart.periods.major.map(m => ({
      branch: m.branch,
      fromAge: m.fromAge,
      toAge: m.toAge,
      direction: m.direction
    }));
  }
  if (chart.periods.active) {
    periods.active = {
      age: chart.periods.active.age,
      major: chart.periods.active.major ? {
        branch: chart.periods.active.major.branch,
        fromAge: chart.periods.active.major.fromAge,
        toAge: chart.periods.active.major.toAge
      } : undefined
    };
  }
  if (chart.periods.year) periods.year = { branch: chart.periods.year.branch, ganzhi: chart.periods.year.ganzhi };
  if (chart.periods.month) periods.month = { branch: chart.periods.month.branch, ganzhi: chart.periods.month.ganzhi };
  if (chart.periods.day) periods.day = { branch: chart.periods.day.branch, ganzhi: chart.periods.day.ganzhi };
  if (chart.periods.hour) periods.hour = { branch: chart.periods.hour.branch, ganzhi: chart.periods.hour.ganzhi };
  if (chart.periods.xiaoxian) {
    periods.xiaoxian = { age: chart.periods.xiaoxian.age, branch: chart.periods.xiaoxian.branch };
  }
  // 0.71 §54：dynamicStars 仍為 candidate → 僅能進 researchWarnings，不當正式流曜
  if (chart.periods.dynamicStars && chart.periods.dynamicStars.length > 0) {
    periods.dynamicStars = chart.periods.dynamicStars.map(d => ({
      baseStarId: d.baseStarId,
      scope: d.scope,
      branch: d.branch,
      ganzhi: d.ganzhi,
      status: 'candidate' as const,
      ruleId: d.provenance?.ruleId
    }));
  }
  return Object.keys(periods).length > 0 ? periods : undefined;
}

function buildInterpretation(chart: ZiWeiChart, mode: AiHandoffMode) {
  const hits = chart.interpretation.hits
    .filter(h => mode === 'full' || h.status === 'active' || h.status === undefined)
    .map(h => ({
      ruleId: h.ruleId,
      domain: h.domain,
      tendency: h.tendency,
      strength: h.strength,
      confidence: h.confidence,
      status: h.status ?? 'active',
      supports: h.supports,
      conflicts: h.conflictsWith
    }));
  return { hits };
}

function buildProfileDifferences(chart: ZiWeiChart) {
  const profileId = chart.generatedWith.profile;
  if (profileId === 'canonical') return undefined;
  try {
    const explanation = explainProfile(profileId);
    // 0.71 §48：AI 需要能讀懂「與 canonical 的具體差異」
    // diffs 陣列改由 explainProfile 產生之 { dimension, canonicalRule, variantRule, ... } 映射
    const diffs = (explanation as unknown as { diffs?: Array<Record<string, unknown>> }).diffs ?? [];
    if (diffs.length === 0) return undefined;
    return diffs.map(d => ({
      dimension: d.dimension,
      canonicalRuleId: d.canonicalRule,
      variantRuleId: d.variantRule,
      description: d.description,
      sourceRefs: d.sourceRefs,
      evidenceRefs: d.evidenceRefs
    }));
  } catch {
    return undefined;
  }
}

function buildResearchWarnings(chart: ZiWeiChart, mode: AiHandoffMode): ResearchWarning[] {
  const warnings: ResearchWarning[] = [];
  const seen = new Set<string>();

  const add = (w: ResearchWarning) => {
    if (seen.has(w.id)) return;
    seen.add(w.id);
    warnings.push(w);
  };

  // candidate / research rules in trace
  for (const e of chart.trace?.entries ?? []) {
    const st = e.status;
    if (st === 'candidate' || st === 'variant') {
      add({
        kind: st === 'candidate' ? 'candidate-rule' : 'variant',
        id: e.ruleId,
        note: st === 'candidate'
          ? `Candidate rule executed on-demand (status=candidate); NOT canonical.`
          : `Variant rule active under profile '${chart.generatedWith.profile}'.`
      });
    }
  }

  // dynamic stars (candidate by design)
  if (chart.periods.dynamicStars?.length) {
    for (const d of chart.periods.dynamicStars) {
      add({
        kind: 'dynamic-star-candidate',
        id: d.baseStarId,
        note: `Dynamic period star is candidate-only (spec 0.71 §54); must not be treated as canonical 流曜.`
      });
    }
  }

  if (mode === 'compact') {
    return warnings;
  }
  return warnings;
}

/* ------------------------------------------------------------------ *
 * 主 API
 * ------------------------------------------------------------------ */

export function handoff(chart: ZiWeiChart, options: AiHandoffOptions = {}): Record<string, unknown> {
  const mode = options.mode ?? 'compact';
  const privacy = options.privacy ?? 'interpretation';

  const statusOf = (starId: string) => {
    const p = chart.chart.stars[starId];
    const ruleId = p?.ruleId;
    return {
      status: ruleId ? getRuleStatus(ruleId) : undefined,
      ruleId,
      ruleVersion: p?.ruleVersion
    };
  };

  const precision: BirthTimePrecision =
    chart.inputResolution?.birthTimePrecision ??
    (chart.input.time?.hour !== undefined ? 'exact' : 'unknown');

  const birth: Record<string, unknown> = {
    calendarType: chart.input.calendarType,
    birthTimePrecision: precision
  };

  if (privacy !== 'minimal') {
    birth.solar = chart.calendar.solar;
    birth.lunar = chart.calendar.lunar;
    birth.timezone = chart.calendar.timezone;
    if (chart.inputResolution?.selectedCandidate) birth.selectedCandidate = chart.inputResolution.selectedCandidate;
    if (chart.inputResolution?.representativeTimeUsed) birth.representativeTimeUsed = true;
    if (chart.calendar.hourBranch) birth.hourBranch = chart.calendar.hourBranch;
  }
  if (privacy === 'full' && chart.input.birthTimeSource) {
    birth.birthTimeSource = chart.input.birthTimeSource;
  }

  const subject: Record<string, unknown> = {};
  if (privacy === 'full' && chart.input.name) subject.name = chart.input.name;
  subject.sexForCalculation = chart.input.sexForCalculation;

  const payload: Record<string, unknown> = {
    formatVersion: AI_HANDOFF_FORMAT_VERSION,
    generator: {
      product: 'ZiWeiJS',
      bibleVersion: chart.generatedWith.bibleVersion,
      engineVersion: chart.generatedWith.engineVersion,
      schemaVersion: chart.generatedWith.schemaVersion,
      profile: chart.generatedWith.profile
    },
    subject,
    birth,
    natal: buildNatalSummary(chart),
    palaces: buildPalaceSummary(chart, statusOf),
    transformations: buildTransformations(chart),
    patterns: buildPatterns(chart),
    instructions: DEFAULT_INSTRUCTIONS
  };

  const periods = buildPeriods(chart);
  if (periods) payload.periods = periods;

  const interp = buildInterpretation(chart, mode);
  if (interp.hits.length > 0) payload.interpretation = interp;

  const diffs = buildProfileDifferences(chart);
  if (diffs) payload.profileDifferences = diffs;

  const warnings = buildResearchWarnings(chart, mode);
  if (warnings.length > 0) payload.researchWarnings = warnings;

  if (mode === 'full') {
    // sources / evidence only in full mode
    const sourceIds = new Set<string>();
    const evidenceIds = new Set<string>();
    for (const e of chart.trace?.entries ?? []) {
      for (const s of e.sourceRefs ?? []) sourceIds.add(s);
      for (const v of e.evidenceRefs ?? []) evidenceIds.add(v);
    }
    payload.sources = [...sourceIds].map(id => { try { const s = getSource(id); return { sourceId: s.sourceId, title: s.title, tier: s.tier, type: s.type }; } catch { return { sourceId: id }; } });
    payload.evidence = [...evidenceIds].map(id => { try { const e = getEvidence(id); return e ? { evidenceId: e.evidenceId, sourceId: e.sourceId, type: e.type, quote: e.quote } : undefined; } catch { return undefined; } }).filter(Boolean);
  }

  // fingerprint on canonical normalized payload WITHOUT the fingerprint field itself
  const fp = fingerprint(payload);
  payload.fingerprint = fp;

  return payload;
}

export function handoffUnknownTime(result: BirthTimeUncertaintyResult, options: AiHandoffOptions = {}): Record<string, unknown> {
  const firstChart = result.candidates.find(c => c.chart)?.chart;
  const privacy = options.privacy ?? 'interpretation';
  const birth: Record<string, unknown> = {
    calendarType: firstChart?.input.calendarType ?? 'solar',
    birthTimePrecision: 'unknown'
  };
  if (privacy !== 'minimal' && firstChart) {
    birth.solar = firstChart.calendar.solar;
    birth.lunar = firstChart.calendar.lunar;
    birth.timezone = firstChart.calendar.timezone;
  }

  const payload: Record<string, unknown> = {
    formatVersion: AI_HANDOFF_FORMAT_VERSION,
    generator: {
      product: 'ZiWeiJS',
      bibleVersion: firstChart?.generatedWith.bibleVersion ?? '0.71.0',
      engineVersion: firstChart?.generatedWith.engineVersion ?? '0.1.0',
      schemaVersion: firstChart?.generatedWith.schemaVersion ?? '2.0',
      profile: result.provenance.profile
    },
    subject: {},
    birth,
    unknownTime: {
      candidates: result.candidates.map(c => ({
        hourBranch: c.hourBranch,
        timeRange: c.timeRange,
        representativeTime: c.representativeTime,
        signature: c.signature
      })),
      stableFacts: result.stableFacts,
      variableFacts: result.variableFacts,
      uniqueFacts: result.uniqueFacts,
      groups: result.groups
    },
    instructions: {
      ...DEFAULT_INSTRUCTIONS,
      isUnknownTimeComparison: true,
      doNotTreatAnyCandidateAsVerifiedBirthTime: true
    },
    natal: { lifePalace: 'unknown', lifePalaceBranch: 'zi', bodyPalace: 'unknown', bodyPalaceBranch: 'zi', bureau: 'unknown' },
    palaces: [],
    transformations: [],
    patterns: []
  };
  payload.fingerprint = fingerprint(payload);
  return payload;
}

/* ------------------------------------------------------------------ *
 * Markdown rendering
 * ------------------------------------------------------------------ */

export function toMarkdown(pkg: Record<string, unknown>): string {
  const g = pkg.generator as { bibleVersion: string; schemaVersion: string; profile: string; engineVersion: string };
  const b = pkg.birth as Record<string, unknown>;
  const n = pkg.natal as Record<string, unknown>;
  const ins = pkg.instructions as Record<string, unknown>;

  const lines: string[] = [
    '# ZiWeiJS 命盤資料',
    '',
    '## Engine',
    `- Bible: ${g.bibleVersion}`,
    `- Schema: ${g.schemaVersion}`,
    `- Engine: ${g.engineVersion}`,
    `- Profile: ${g.profile}`,
    '',
    '## 出生資料'
  ];

  if (b.calendarType) lines.push(`- 曆法：${b.calendarType}`);
  if (b.solar) lines.push(`- 國曆：${(b.solar as {year:number;month:number;day:number}).year}-${(b.solar as {month:number}).month}-${(b.solar as {day:number}).day}`);
  if (b.lunar) lines.push(`- 農曆：${(b.lunar as {year:number}).year}年${(b.lunar as {isLeapMonth:boolean}).isLeapMonth?'閏':''}${(b.lunar as {month:number}).month}月${(b.lunar as {day:number}).day}日`);
  lines.push(`- 出生時間精度：${b.birthTimePrecision}${b.representativeTimeUsed ? '（使用代表時間）' : ''}`);
  if (b.hourBranch) lines.push(`- 時辰：${BRANCH_ZH[b.hourBranch as keyof typeof BRANCH_ZH]}`);
  if (b.selectedCandidate) lines.push(`- 選定候選：${BRANCH_ZH[b.selectedCandidate as keyof typeof BRANCH_ZH]}`);
  if (b.timezone) lines.push(`- 時區：${b.timezone}`);

  lines.push('', '## 命盤核心');
  lines.push(`- 命宮：${n.lifePalace}（${BRANCH_ZH[n.lifePalaceBranch as keyof typeof BRANCH_ZH]}）`);
  lines.push(`- 身宮：${n.bodyPalace}（${BRANCH_ZH[n.bodyPalaceBranch as keyof typeof BRANCH_ZH]}）`);
  lines.push(`- 五行局：${n.bureauName}`);
  if (n.masterStar) lines.push(`- 命主：${n.masterStar}`);
  if (n.bodyStar) lines.push(`- 身主：${n.bodyStar}`);

  const palaces = pkg.palaces as Array<Record<string, unknown>>;
  if (palaces?.length) {
    lines.push('', '## 十二宮');
    for (const p of palaces) {
      const stars = (p.stars as Array<Record<string, unknown>>).map(s => s.name).join('、') || '（無主星）';
      const flags = [p.isLifePalace && '命', p.isBodyPalace && '身'].filter(Boolean).join('/');
      lines.push(`- **${p.name}** ${flags ? `（${flags}）` : ''}：${stars}`);
    }
  }

  const trs = pkg.transformations as Array<Record<string, unknown>>;
  if (trs?.length) {
    lines.push('', '## 四化');
    for (const tr of trs) {
      lines.push(`- ${tr.sourceStem}干 ${SIHUA_ZH[tr.type as string] ?? tr.type} → ${tr.targetStarId} @ ${tr.targetPalaceId}`);
    }
  }

  const pats = pkg.patterns as Array<Record<string, unknown>>;
  if (pats?.length) {
    lines.push('', '## 格局');
    for (const p of pats) {
      lines.push(`- ${p.name}：${p.status}（ruleStatus=${p.ruleStatus}）`);
    }
  }

  const periods = pkg.periods as Record<string, unknown> | undefined;
  if (periods) {
    lines.push('', '## 限運');
    if (periods.year) lines.push(`- 流年：${JSON.stringify(periods.year)}`);
    if (periods.xiaoxian) lines.push(`- 小限：${JSON.stringify(periods.xiaoxian)}`);
    if (periods.active) lines.push(`- 當前大限：${JSON.stringify(periods.active)}`);
  }

  const warnings = pkg.researchWarnings as Array<{kind:string;id:string;note:string}> | undefined;
  if (warnings?.length) {
    lines.push('', '## Rule / Research 狀態');
    for (const w of warnings) lines.push(`- [${w.kind}] ${w.id}：${w.note}`);
  }

  lines.push('', '## AI 解讀注意');
  lines.push('- 本命盤已由 ZiWeiJS 計算完成，除非使用者要求，請勿自行換另一套算法重排。');
  lines.push('- 請保留本資料指定的 Profile / Variant。');
  lines.push('- canonical、variant、candidate、research 必須分開處理。');
  lines.push('- 若出生時辰不是 exact，不得把代表時間當成真實出生分鐘。');
  lines.push('- 若資料標示 unknown / unavailable，不得自行補猜。');

  return lines.join('\n');
}

export function toJson(pkg: Record<string, unknown>): string {
  return canonicalJson(pkg);
}
