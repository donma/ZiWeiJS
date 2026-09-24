import type { ZiWeiChart } from '../core/types.js';
import { t } from '../core/i18n.js';
import { STEM_ZH, BRANCH_ZH, PALACE_NAME } from '../core/constants.js';
import { DIGNITY_ZH } from '../dignity-engine/dignity-engine.js';
import { getStarRegistryEntry } from '../star-registry/registry.js';

const SIHUA_ZH: Record<string, string> = { lu: '化祿', quan: '化權', ke: '化科', ji: '化忌' };

export interface AiContext {
  birth: {
    calendarType: string;
    solar: string;
    lunar: string;
    hourBranch?: string;
    sexForCalculation?: string;
    timezone: string;
    timeConvention: string;
  };
  pillars: { year: string; month: string; day: string; hour: string };
  lifePalace: { branch: string; palaceId: string };
  bodyPalace: { branch: string; palaceId: string };
  /** 命主（依命宮地支） */
  lifeMaster?: string;
  /** 身主（依生年支） */
  bodyMaster?: string;
  bureau: string;
  palaces: Array<{
    id: string;
    name: string;
    ganzhi: string;
    isLife: boolean;
    isBody: boolean;
    stars: Array<{ name: string; id: string; dignity?: string; transformations: string[] }>;
    changsheng?: string;
    majorPeriod?: { fromAge: number; toAge: number };
  }>;
  transformations: Array<{ type: string; star: string; starId: string; palace: string; scope: string }>;
  patterns: Array<{ id: string; name: string; status: string }>;
  periods: {
    major: Array<{ branch: string; ageRange?: [number, number]; palace?: string }>;
    /** 目標日期當下所在之大限（無 targetDate 時不存在） */
    activeMajor?: { age?: number; branch: string; ageRange?: [number, number]; palace?: string };
    year?: string;
    month?: string;
    day?: string;
    hour?: string;
    /** 小限（canonical；需 targetDate 且性別已知，虛歲 < 1 時不存在） */
    xiaoxian?: { age: number; branch: string; palace: string };
  };
  interpretationHits: Array<{ ruleId: string; domain: string; tendency: string; strength: number }>;
  ruleIds: string[];
  sourceIds: string[];
  evidenceIds: string[];
  profile: string;
  schemaVersion: string;
  certainty: Record<string, string>;
}

export function toContext(chart: ZiWeiChart): AiContext {
  const gz = chart.calendar.ganzhi;
  const gzStr = (p: { stem: keyof typeof STEM_ZH; branch: keyof typeof BRANCH_ZH }) =>
    `${STEM_ZH[p.stem]}${BRANCH_ZH[p.branch]}`;

  const starTransformMap = new Map<string, string[]>();
  for (const tr of chart.chart.transformations) {
    if (tr.sourceScope !== 'natal') continue;
    const arr = starTransformMap.get(tr.targetStarId) ?? [];
    arr.push(SIHUA_ZH[tr.type] ?? tr.type);
    starTransformMap.set(tr.targetStarId, arr);
  }

  const ruleIds = new Set<string>();
  const sourceIds = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const h of chart.interpretation.hits) ruleIds.add(h.ruleId);
  for (const p of chart.chart.patterns) ruleIds.add(p.ruleId);
  if (chart.trace) {
    for (const e of chart.trace.entries) {
      ruleIds.add(e.ruleId);
      for (const s of e.sourceRefs ?? []) sourceIds.add(s);
      for (const v of e.evidenceRefs ?? []) evidenceIds.add(v);
    }
  }

  const starName = (starId: string | undefined): string | undefined => {
    if (!starId) return undefined;
    const entry = getStarRegistryEntry(starId);
    return entry ? t(entry.name) : starId;
  };

  const periodStr = (p: { stem: keyof typeof STEM_ZH; branch: keyof typeof BRANCH_ZH } | undefined) =>
    p ? `${STEM_ZH[p.stem]}${BRANCH_ZH[p.branch]}` : undefined;

  const active = chart.periods.active;
  const majorShape = (m: { branch: string; ageRange?: [number, number]; palaceId?: string }) => ({
    branch: m.branch,
    ageRange: m.ageRange,
    palace: m.palaceId
  });

  return {
    birth: {
      calendarType: chart.input.calendarType,
      solar: `${chart.calendar.solar.year}-${chart.calendar.solar.month}-${chart.calendar.solar.day}`,
      lunar: `${chart.calendar.lunar.year}年${chart.calendar.lunar.isLeapMonth ? '閏' : ''}${chart.calendar.lunar.month}月${chart.calendar.lunar.day}日`,
      hourBranch: chart.input.time?.hour !== undefined ? chart.calendar.hourBranch : undefined,
      sexForCalculation: chart.input.sexForCalculation,
      timezone: chart.calendar.timezone,
      timeConvention: chart.calendar.timeConvention
    },
    pillars: {
      year: gzStr(gz.year),
      month: gzStr(gz.month),
      day: gzStr(gz.day),
      hour: gzStr(gz.hour)
    },
    lifePalace: { branch: chart.chart.natal.lifePalaceBranch, palaceId: chart.chart.natal.lifePalace },
    bodyPalace: { branch: chart.chart.natal.bodyPalaceBranch, palaceId: chart.chart.natal.bodyPalace },
    lifeMaster: starName(chart.chart.natal.masterStar),
    bodyMaster: starName(chart.chart.natal.bodyStar),
    bureau: t(chart.birthContext.bureauName),
    palaces: chart.chart.palaces.map(p => ({
      id: p.id,
      name: t(p.name),
      ganzhi: `${STEM_ZH[p.stem]}${BRANCH_ZH[p.branch]}`,
      isLife: p.isLifePalace,
      isBody: p.isBodyPalace,
      stars: p.stars.map(s => ({
        name: t(s.star.name),
        id: s.starId,
        dignity: s.dignity ? DIGNITY_ZH[s.dignity] : undefined,
        transformations: starTransformMap.get(s.starId) ?? []
      })),
      changsheng: p.changsheng,
      majorPeriod: p.majorPeriod
    })),
    transformations: chart.chart.transformations.map(tr => {
      const placement = chart.chart.stars[tr.targetStarId];
      const starName = placement && 'star' in placement
        ? t((placement as { star: { name: Record<string, string> } }).star.name)
        : tr.targetStarId;
      return {
        type: SIHUA_ZH[tr.type] ?? tr.type,
        star: starName,
        starId: tr.targetStarId,
        palace: tr.targetPalaceId,
        scope: tr.sourceScope
      };
    }),
    patterns: chart.chart.patterns.map(p => ({
      id: p.patternId,
      name: t(p.name),
      status: p.status
    })),
    periods: {
      major: chart.periods.major.map(majorShape),
      activeMajor: active?.major
        ? { age: active.age, ...majorShape(active.major) }
        : undefined,
      year: periodStr(chart.periods.year),
      month: periodStr(chart.periods.month),
      day: periodStr(chart.periods.day),
      hour: periodStr(chart.periods.hour),
      xiaoxian: chart.periods.xiaoxian
        ? {
            age: chart.periods.xiaoxian.age,
            branch: chart.periods.xiaoxian.branch,
            palace: t(PALACE_NAME[chart.periods.xiaoxian.palaceId])
          }
        : undefined
    },
    interpretationHits: chart.interpretation.hits.map(h => ({
      ruleId: h.ruleId,
      domain: h.domain,
      tendency: h.tendency,
      strength: h.strength
    })),
    ruleIds: [...ruleIds].sort(),
    sourceIds: [...sourceIds].sort(),
    evidenceIds: [...evidenceIds].sort(),
    profile: chart.generatedWith.profile,
    schemaVersion: chart.schemaVersion,
    certainty: chart.certainty as Record<string, string>
  };
}
