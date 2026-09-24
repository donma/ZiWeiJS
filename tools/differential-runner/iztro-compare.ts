/**
 * iztro 對照核心（供 CLI 與 vitest 共用）
 *
 * 以 iztro（開源紫微斗數排盤庫，Tier 3 實作來源）作為外部對照。
 * 差異一律標記為 needs-review 並附分類欄位（spec §29.2），不直接判錯。
 */
import type { BranchId, ZiWeiChart, ZiWeiBirthInput } from '../../src/index.js';

export const BRANCH_ZH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const BRANCH_ID: BranchId[] = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];

/** 十四主星（iztro zh-TW / zh-CN 名稱 → 本引擎星曜 ID） */
export const MAJOR_STARS: Record<string, string> = {
  '紫微': 'ZW.STAR.MAJOR.ZIWEI', '天機': 'ZW.STAR.MAJOR.TIANJI', '天机': 'ZW.STAR.MAJOR.TIANJI',
  '太陽': 'ZW.STAR.MAJOR.TAIYANG', '太阳': 'ZW.STAR.MAJOR.TAIYANG',
  '武曲': 'ZW.STAR.MAJOR.WUQU', '天同': 'ZW.STAR.MAJOR.TIANTONG',
  '廉貞': 'ZW.STAR.MAJOR.LIANZHEN', '廉贞': 'ZW.STAR.MAJOR.LIANZHEN',
  '天府': 'ZW.STAR.MAJOR.TIANFU', '太陰': 'ZW.STAR.MAJOR.TAIYIN', '太阴': 'ZW.STAR.MAJOR.TAIYIN',
  '貪狼': 'ZW.STAR.MAJOR.TANLANG', '贪狼': 'ZW.STAR.MAJOR.TANLANG',
  '巨門': 'ZW.STAR.MAJOR.JUMEN', '巨门': 'ZW.STAR.MAJOR.JUMEN',
  '天相': 'ZW.STAR.MAJOR.TIANXIANG', '天梁': 'ZW.STAR.MAJOR.TIANLIANG',
  '七殺': 'ZW.STAR.MAJOR.QISHA', '七杀': 'ZW.STAR.MAJOR.QISHA',
  '破軍': 'ZW.STAR.MAJOR.POJUN', '破军': 'ZW.STAR.MAJOR.POJUN'
};

/** 輔煞雜曜（iztro 與本引擎皆有安放者；含簡繁對照） */
export const AUX_STARS: Record<string, string> = {
  '左輔': 'ZW.STAR.AUX.ZUOFU', '左辅': 'ZW.STAR.AUX.ZUOFU',
  '右弼': 'ZW.STAR.AUX.YOUBI',
  '文昌': 'ZW.STAR.AUX.WENCHANG', '文曲': 'ZW.STAR.AUX.WENQU',
  '祿存': 'ZW.STAR.AUX.LUCUN', '禄存': 'ZW.STAR.AUX.LUCUN',
  '天魁': 'ZW.STAR.AUX.TIANKUI', '天鉞': 'ZW.STAR.AUX.TIANYUE', '天钺': 'ZW.STAR.AUX.TIANYUE',
  '天馬': 'ZW.STAR.AUX.TIANMA', '天马': 'ZW.STAR.AUX.TIANMA',
  '擎羊': 'ZW.STAR.MALEFIC.QINGYANG', '陀羅': 'ZW.STAR.MALEFIC.TUOLUO', '陀罗': 'ZW.STAR.MALEFIC.TUOLUO',
  '火星': 'ZW.STAR.AUX.HUOLING', '鈴星': 'ZW.STAR.AUX.LINGXING', '铃星': 'ZW.STAR.AUX.LINGXING',
  '地空': 'ZW.STAR.MALEFIC.DIKONG', '地劫': 'ZW.STAR.MALEFIC.DIJIE',
  '紅鸞': 'ZW.STAR.AUX.HONGLUAN', '红鸾': 'ZW.STAR.AUX.HONGLUAN',
  '天喜': 'ZW.STAR.AUX.TIANXI', '天姚': 'ZW.STAR.AUX.TIANYAO',
  '咸池': 'ZW.STAR.AUX.XIANCHI',
  '孤辰': 'ZW.STAR.AUX.GUCHEN', '寡宿': 'ZW.STAR.AUX.GUASU',
  '華蓋': 'ZW.STAR.AUX.HUAGAI', '华盖': 'ZW.STAR.AUX.HUAGAI',
  '天刑': 'ZW.STAR.AUX.TIANXING', '天哭': 'ZW.STAR.AUX.TIANKU',
  '天虛': 'ZW.STAR.AUX.TIANXU', '天虚': 'ZW.STAR.AUX.TIANXU'
};

/** 全部對照星曜 ID（去重：對照表同時收錄繁/簡名稱，值會重複） */
export const ALL_DIFF_STAR_IDS: string[] = [
  ...new Set([...Object.values(MAJOR_STARS), ...Object.values(AUX_STARS)])
];

export function toStarId(name: string): string | null {
  return MAJOR_STARS[name] ?? AUX_STARS[name] ?? null;
}

/** 時辰 → iztro timeIndex（0=早子 … 11=亥，12=晚子） */
export function iztroTimeIndex(hour: number): number {
  if (hour === 23) return 12;
  return Math.floor(((hour + 1) % 24) / 2);
}

export const IZTRO_DIGNITY: Record<string, string> = {
  '廟': 'miao', '庙': 'miao', '旺': 'wang', '得': 'de', '利': 'li', '平': 'ping', '不': 'bu', '陷': 'xian'
};

const IZTRO_MUTAGEN: Record<string, string> = {
  '祿': 'lu', '禄': 'lu', '權': 'quan', '权': 'quan', '科': 'ke', '忌': 'ji'
};

export type DiffClassification =
  | 'school-variance' | 'calendar-variance' | 'time-basis-variance'
  | 'day-boundary-variance' | 'leap-month-variance' | 'bug' | 'external-error' | 'unclassified';

export interface IztroDiffRow {
  field: string;
  bible: string | undefined;
  external: string | undefined;
  status: 'match' | 'needs-review' | 'empty';
  classification?: DiffClassification;
}

/** 本引擎快照（從公開 chart 取出可對照欄位） */
export interface EngineSnapshot {
  lifePalaceBranch: string;
  bodyPalaceBranch: string;
  bureau: string;
  bureauName: string;
  direction: string;
  stars: Record<string, string>;
  dignity: Record<string, string>;
  sihua: Record<string, string>;
  majorPeriods: Array<{ branch: string; fromAge: number; toAge: number; stem: string }>;
}

export function snapshotEngine(chart: ZiWeiChart): EngineSnapshot {
  const stars: Record<string, string> = {};
  const dignity: Record<string, string> = {};
  for (const [id, p] of Object.entries(chart.chart.stars)) {
    stars[id] = p.branch;
    if (p.dignity) dignity[id] = p.dignity;
  }
  const sihua: Record<string, string> = {};
  for (const tr of chart.chart.transformations) {
    if (tr.sourceScope === 'natal') sihua[tr.type] = tr.targetStarId;
  }
  return {
    lifePalaceBranch: chart.chart.natal.lifePalaceBranch,
    bodyPalaceBranch: chart.chart.natal.bodyPalaceBranch,
    bureau: chart.birthContext.bureau,
    bureauName: chart.birthContext.bureauName['zh-TW'] ?? chart.birthContext.bureau,
    direction: chart.birthContext.direction,
    stars,
    dignity,
    sihua,
    majorPeriods: chart.periods.major.map(p => ({ branch: p.branch, fromAge: p.fromAge, toAge: p.toAge, stem: p.stem }))
  };
}

/** iztro 排盤物件快照 */
export interface IztroLikePalace {
  earthlyBranch: string;
  majorStars: Array<{ name: string; brightness?: string; mutagen?: string }>;
  minorStars: Array<{ name: string; brightness?: string; mutagen?: string }>;
}
export interface IztroLikeChart {
  earthlyBranchOfSoulPalace: string;
  earthlyBranchOfBodyPalace: string;
  fiveElementsClass: string;
  palaces: IztroLikePalace[];
}

export interface IztroSnapshot {
  lifePalaceBranch: string;
  bodyPalaceBranch: string;
  bureauName: string;
  stars: Record<string, string>;
  dignity: Record<string, string>;
  sihua: Record<string, string>;
}

export function snapshotIztro(a: IztroLikeChart): IztroSnapshot {
  const stars: Record<string, string> = {};
  const dignity: Record<string, string> = {};
  const sihua: Record<string, string> = {};
  for (const p of a.palaces) {
    const branch = BRANCH_ID[BRANCH_ZH.indexOf(p.earthlyBranch)];
    for (const s of [...p.majorStars, ...p.minorStars]) {
      const id = toStarId(s.name);
      if (!id) continue;
      if (stars[id] === undefined) stars[id] = branch;
      if (s.brightness && IZTRO_DIGNITY[s.brightness]) dignity[id] = IZTRO_DIGNITY[s.brightness];
      if (s.mutagen) {
        const type = IZTRO_MUTAGEN[s.mutagen];
        if (type) sihua[type] = id;
      }
    }
  }
  return {
    lifePalaceBranch: BRANCH_ID[BRANCH_ZH.indexOf(a.earthlyBranchOfSoulPalace)],
    bodyPalaceBranch: BRANCH_ID[BRANCH_ZH.indexOf(a.earthlyBranchOfBodyPalace)],
    bureauName: a.fiveElementsClass,
    stars,
    dignity,
    sihua
  };
}

/**
 * 比對引擎與外部來源。主星／命身宮／五行局差異預設歸類為 bug（布星共識），
 * 輔星與四化預設歸類為 school-variance（流派差異）。
 */
export function compareIztro(
  engine: EngineSnapshot,
  iztro: IztroSnapshot,
  opts: { dayBoundaryVariance?: boolean } = {}
): IztroDiffRow[] {
  const rows: IztroDiffRow[] = [];
  const push = (field: string, bible: string | undefined, external: string | undefined, cls: DiffClassification) => {
    if (external === undefined) {
      rows.push({ field, bible, external, status: 'empty' });
    } else if (bible === external) {
      rows.push({ field, bible, external, status: 'match' });
    } else {
      rows.push({ field, bible, external, status: 'needs-review', classification: cls });
    }
  };

  push('命宮', engine.lifePalaceBranch, iztro.lifePalaceBranch, 'bug');
  push('身宮', engine.bodyPalaceBranch, iztro.bodyPalaceBranch, 'bug');
  push('五行局', engine.bureauName, iztro.bureauName, 'bug');

  for (const id of ALL_DIFF_STAR_IDS) {
    const isMajor = id.includes('MAJOR');
    push(id.replace('ZW.STAR.', ''), engine.stars[id], iztro.stars[id], isMajor ? 'bug' : 'school-variance');
  }

  for (const type of ['lu', 'quan', 'ke', 'ji']) {
    push('四化.' + type, engine.sihua[type], iztro.sihua[type], 'school-variance');
  }

  if (opts.dayBoundaryVariance) {
    for (const r of rows) {
      if (r.status === 'needs-review' && r.classification === 'bug') r.classification = 'day-boundary-variance';
    }
  }

  return rows;
}

/** 內建對照案例（涵蓋不同年干、五行局、時辰與性別） */
export const IZTRO_CASES: ZiWeiBirthInput[] = [
  { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 2000, month: 8, day: 16 }, time: { hour: 4 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' },
  { calendarType: 'solar', date: { year: 1985, month: 11, day: 20 }, time: { hour: 14 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' },
  { calendarType: 'solar', date: { year: 1978, month: 12, day: 25 }, time: { hour: 6 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' },
  { calendarType: 'solar', date: { year: 1995, month: 8, day: 8 }, time: { hour: 8 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 1962, month: 3, day: 3 }, time: { hour: 0 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 2020, month: 2, day: 29 }, time: { hour: 23 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' }
];

/**
 * iztro 預設 dayDivide='forward'（晚子時算次日）；本引擎 canonical 為午夜換日。
 * 23 時出生時改用 traditional-zi（子初換日）profile 對齊，
 * 使差異可歸類為「換日差異」而非 Bug。
 */
export function profileForCase(input: ZiWeiBirthInput): { profile: string; dayBoundaryVariance: boolean } {
  const hour = input.time?.hour ?? 12;
  if (hour === 23) return { profile: 'traditional-zi', dayBoundaryVariance: true };
  return { profile: 'canonical', dayBoundaryVariance: false };
}

export function summarize(rows: IztroDiffRow[]) {
  return {
    total: rows.length,
    match: rows.filter(r => r.status === 'match').length,
    review: rows.filter(r => r.status === 'needs-review').length,
    empty: rows.filter(r => r.status === 'empty').length
  };
}
