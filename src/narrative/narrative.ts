import type { ZiWeiChart, InterpretationHit } from '../core/types.js';
import { t } from '../core/i18n.js';
import type { Locale } from '../core/types.js';
import { activeHits } from '../interpretation-engine/resolver.js';

export interface NarrativeSection {
  domain: string;
  title: string;
  paragraphs: string[];
  hitRuleIds: string[];
}

/**
 * 產生敘事。預設只使用 status = active 的命中（spec §P0-6）；
 * overridden / conflicted 僅在 Expert 模式顯示（見 UI）。
 */
export function renderNarrative(
  chart: ZiWeiChart,
  opts: { locale?: Locale; domains?: string[]; includeNonActive?: boolean } = {}
): NarrativeSection[] {
  const locale = opts.locale ?? 'zh-TW';
  const sections: NarrativeSection[] = [];
  const domains = opts.domains ?? Object.keys(chart.interpretation.byDomain);
  for (const domain of domains) {
    const all: InterpretationHit[] = chart.interpretation.byDomain[domain] ?? [];
    const hits = opts.includeNonActive === true ? all : activeHits(all);
    if (hits.length === 0) continue;
    const paragraphs = hits
      .filter(h => h.text)
      .map(h => t(h.text, locale))
      .filter(s => s.length > 0);
    if (paragraphs.length === 0) continue;
    sections.push({
      domain,
      title: DOMAIN_TITLES[domain]?.[locale] ?? domain,
      paragraphs,
      hitRuleIds: hits.map(h => h.ruleId)
    });
  }
  return sections;
}

const DOMAIN_TITLES: Record<string, Record<string, string>> = {
  personality: { 'zh-TW': '性格特質', 'zh-CN': '性格特质', en: 'Personality' },
  career: { 'zh-TW': '事業與工作', 'zh-CN': '事业与工作', en: 'Career' },
  wealth: { 'zh-TW': '財富', 'zh-CN': '财富', en: 'Wealth' },
  relationship: { 'zh-TW': '人際關係', 'zh-CN': '人际关系', en: 'Relationships' },
  marriage: { 'zh-TW': '婚姻感情', 'zh-CN': '婚姻感情', en: 'Marriage' },
  family: { 'zh-TW': '家庭', 'zh-CN': '家庭', en: 'Family' },
  health: { 'zh-TW': '健康', 'zh-CN': '健康', en: 'Health' },
  learning: { 'zh-TW': '學習', 'zh-CN': '学习', en: 'Learning' },
  migration: { 'zh-TW': '遷移外出', 'zh-CN': '迁移外出', en: 'Migration' },
  social: { 'zh-TW': '社交', 'zh-CN': '社交', en: 'Social' },
  risk: { 'zh-TW': '風險', 'zh-CN': '风险', en: 'Risk' },
  timing: { 'zh-TW': '時機', 'zh-CN': '时机', en: 'Timing' },
  general: { 'zh-TW': '綜合', 'zh-CN': '综合', en: 'General' }
};
