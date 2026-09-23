import type { ZiWeiChart } from '../../src/index.js';
import { t } from '../../src/index.js';

export interface DiffRow {
  field: string;
  bible: string;
  sourceA?: string;
  sourceB?: string;
  status: 'match' | 'needs-review' | 'empty';
}

export const EXTERNAL_FIELDS: string[] = [
  '命宮', '身宮', '五行局',
  '紫微', '天機', '太陽', '武曲', '天同', '廉貞',
  '天府', '太陰', '貪狼', '巨門', '天相', '天梁', '七殺', '破軍',
  '左輔', '右弼', '文昌', '文曲', '祿存', '天魁', '天鉞', '天馬',
  '擎羊', '陀羅', '火星', '鈴星', '地空', '地劫',
  '化祿', '化權', '化科', '化忌',
  '大限方向', '流年命宮'
];

const STAR_FIELD_MAP: Record<string, string> = {
  '紫微': 'ZW.STAR.MAJOR.ZIWEI', '天機': 'ZW.STAR.MAJOR.TIANJI', '太陽': 'ZW.STAR.MAJOR.TAIYANG',
  '武曲': 'ZW.STAR.MAJOR.WUQU', '天同': 'ZW.STAR.MAJOR.TIANTONG', '廉貞': 'ZW.STAR.MAJOR.LIANZHEN',
  '天府': 'ZW.STAR.MAJOR.TIANFU', '太陰': 'ZW.STAR.MAJOR.TAIYIN', '貪狼': 'ZW.STAR.MAJOR.TANLANG',
  '巨門': 'ZW.STAR.MAJOR.JUMEN', '天相': 'ZW.STAR.MAJOR.TIANXIANG', '天梁': 'ZW.STAR.MAJOR.TIANLIANG',
  '七殺': 'ZW.STAR.MAJOR.QISHA', '破軍': 'ZW.STAR.MAJOR.POJUN',
  '左輔': 'ZW.STAR.AUX.ZUOFU', '右弼': 'ZW.STAR.AUX.YOUBI',
  '文昌': 'ZW.STAR.AUX.WENCHANG', '文曲': 'ZW.STAR.AUX.WENQU',
  '祿存': 'ZW.STAR.AUX.LUCUN', '天魁': 'ZW.STAR.AUX.TIANKUI', '天鉞': 'ZW.STAR.AUX.TIANYUE',
  '天馬': 'ZW.STAR.AUX.TIANMA',
  '擎羊': 'ZW.STAR.MALEFIC.QINGYANG', '陀羅': 'ZW.STAR.MALEFIC.TUOLUO',
  '火星': 'ZW.STAR.AUX.HUOLING', '鈴星': 'ZW.STAR.AUX.LINGXING',
  '地空': 'ZW.STAR.MALEFIC.DIKONG', '地劫': 'ZW.STAR.MALEFIC.DIJIE'
};

const SIHUA_FIELD_MAP: Record<string, string> = {
  '化祿': 'lu', '化權': 'quan', '化科': 'ke', '化忌': 'ji'
};

export function bibleValue(chart: ZiWeiChart, field: string): string {
  if (field === '命宮') return chart.chart.natal.lifePalaceBranch;
  if (field === '身宮') return chart.chart.natal.bodyPalaceBranch;
  if (field === '五行局') return t(chart.birthContext.bureauName);
  if (field === '大限方向') return chart.birthContext.direction;
  if (field === '流年命宮') return chart.periods.year?.branch ?? '—';

  const starId = STAR_FIELD_MAP[field];
  if (starId) {
    const p = chart.chart.stars[starId];
    return p?.branch ?? '—';
  }

  const sihua = SIHUA_FIELD_MAP[field];
  if (sihua) {
    const tr = chart.chart.transformations.find(x => x.sourceScope === 'natal' && x.type === sihua);
    if (!tr) return '—';
    const p = chart.chart.stars[tr.targetStarId];
    return p ? `${t(p.star.name)}@${tr.targetPalaceId}` : tr.targetStarId;
  }
  return '—';
}

export function compareChart(
  chart: ZiWeiChart,
  externalValue: (field: string, bibleValue: string) => string | undefined
): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const field of EXTERNAL_FIELDS) {
    const bible = bibleValue(chart, field);
    const ext = externalValue(field, bible);
    if (ext === undefined || ext === '') {
      rows.push({ field, bible, status: 'empty' });
    } else if (ext === bible) {
      rows.push({ field, bible, sourceA: ext, status: 'match' });
    } else {
      rows.push({ field, bible, sourceA: ext, status: 'needs-review' });
    }
  }
  return rows;
}
