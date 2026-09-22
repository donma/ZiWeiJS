import type { ZiWeiChart } from '../core/types.js';
import { t } from '../core/i18n.js';
import { STEM_ZH, BRANCH_ZH, PALACE_NAME } from '../core/constants.js';
import { DIGNITY_ZH } from '../dignity-engine/dignity-engine.js';

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
    year?: string;
    month?: string;
  };
  interpretationHits: Array<{ ruleId: string; domain: string; tendency: string; strength: number }>;
  ruleIds: string[];
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
  const evidenceIds = new Set<string>();
  for (const h of chart.interpretation.hits) ruleIds.add(h.ruleId);
  for (const p of chart.chart.patterns) ruleIds.add(p.ruleId);
  if (chart.trace) for (const e of chart.trace.entries) ruleIds.add(e.ruleId);

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
      major: chart.periods.major.map(m => ({
        branch: m.branch,
        ageRange: m.ageRange,
        palace: m.palaceId
      })),
      year: chart.periods.year ? `${chart.periods.year.stem}-${chart.periods.year.branch}` : undefined,
      month: chart.periods.month ? `${chart.periods.month.stem}-${chart.periods.month.branch}` : undefined
    },
    interpretationHits: chart.interpretation.hits.map(h => ({
      ruleId: h.ruleId,
      domain: h.domain,
      tendency: h.tendency,
      strength: h.strength
    })),
    ruleIds: [...ruleIds],
    evidenceIds: [...evidenceIds],
    profile: chart.generatedWith.profile,
    schemaVersion: chart.schemaVersion,
    certainty: chart.certainty as Record<string, string>
  };
}
