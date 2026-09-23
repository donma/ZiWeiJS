import type { EngineContext } from '../executors/context.js';
import type { DignityLevel, BranchId } from '../core/types.js';
import dignityTable from '../../tables/dignity/brightness.json' with { type: 'json' };

const tables = dignityTable.tables as Record<string, Record<string, DignityLevel>>;

export function dignityOf(starId: string, branch: BranchId): DignityLevel | undefined {
  return tables[starId]?.[branch];
}

export function calcDignities(ctx: EngineContext): void {
  const results: string[] = [];
  for (const p of ctx.placements.values()) {
    const d = dignityOf(p.starId, p.branch);
    if (d) {
      p.dignity = d;
      results.push(`${p.starId}@${p.branch}:${d}`);
    }
  }
  ctx.tracer.record({
    ruleId: 'ZW.CALC.DIGNITY.BRIGHTNESS.001',
    inputs: {},
    result: results,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.MODERN-IMPL-CONSENSUS'],
    evidenceRefs: ['EVD.CONSENSUS.MIAOWANG']
  });
}

export const DIGNITY_ORDER: DignityLevel[] = ['miao', 'wang', 'de', 'li', 'ping', 'bu', 'xian'];

export function dignityAtLeast(level: DignityLevel | undefined, min: DignityLevel): boolean {
  if (!level) return false;
  return DIGNITY_ORDER.indexOf(level) <= DIGNITY_ORDER.indexOf(min);
}

export const DIGNITY_ZH: Record<DignityLevel, string> = {
  miao: '廟', wang: '旺', de: '得', li: '利', ping: '平', bu: '不', xian: '陷'
};

export const DIGNITY_ZH_CN: Record<DignityLevel, string> = {
  miao: '庙', wang: '旺', de: '得', li: '利', ping: '平', bu: '不', xian: '陷'
};

export const DIGNITY_EN: Record<DignityLevel, string> = {
  miao: 'Exalted', wang: 'Prosperous', de: 'Favourable', li: 'Beneficial',
  ping: 'Neutral', bu: 'Weak', xian: 'Fallen'
};

export function dignityLabel(level: DignityLevel | undefined, locale: string): string {
  if (!level) return '';
  if (locale === 'zh-CN') return DIGNITY_ZH_CN[level];
  if (locale === 'en') return DIGNITY_EN[level];
  return DIGNITY_ZH[level];
}
