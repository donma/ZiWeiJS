import type { BranchId, StemId, PalaceId, BureauId, LocalizedText } from './types.js';

export const SCHEMA_VERSION = '2.0';
export const BIBLE_VERSION = '0.3.0';
export const ENGINE_VERSION = '0.1.0';

export const STEMS: StemId[] = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];
export const BRANCHES: BranchId[] = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];

export const STEM_ZH: Record<StemId, string> = {
  jia: '甲', yi: '乙', bing: '丙', ding: '丁', wu: '戊',
  ji: '己', geng: '庚', xin: '辛', ren: '壬', gui: '癸'
};

export const BRANCH_ZH: Record<BranchId, string> = {
  zi: '子', chou: '丑', yin: '寅', mao: '卯', chen: '辰', si: '巳',
  wu: '午', wei: '未', shen: '申', you: '酉', xu: '戌', hai: '亥'
};

export const STEM_YINYANG: Record<StemId, 'yang' | 'yin'> = {
  jia: 'yang', yi: 'yin', bing: 'yang', ding: 'yin', wu: 'yang',
  ji: 'yin', geng: 'yang', xin: 'yin', ren: 'yang', gui: 'yin'
};

export const BRANCH_ZODIAC: Record<BranchId, string> = {
  zi: '鼠', chou: '牛', yin: '虎', mao: '兔', chen: '龍', si: '蛇',
  wu: '馬', wei: '羊', shen: '猴', you: '雞', xu: '狗', hai: '豬'
};

export const PALACE_IDS: PalaceId[] = [
  'life', 'siblings', 'spouse', 'children', 'wealth', 'health',
  'travel', 'friends', 'career', 'property', 'fortune', 'parents'
];

export const PALACE_NAME: Record<PalaceId, LocalizedText> = {
  life: { 'zh-TW': '命宮', 'zh-CN': '命宫', en: 'Life' },
  siblings: { 'zh-TW': '兄弟宮', 'zh-CN': '兄弟宫', en: 'Siblings' },
  spouse: { 'zh-TW': '夫妻宮', 'zh-CN': '夫妻宫', en: 'Spouse' },
  children: { 'zh-TW': '子女宮', 'zh-CN': '子女宫', en: 'Children' },
  wealth: { 'zh-TW': '財帛宮', 'zh-CN': '财帛宫', en: 'Wealth' },
  health: { 'zh-TW': '疾厄宮', 'zh-CN': '疾厄宫', en: 'Health' },
  travel: { 'zh-TW': '遷移宮', 'zh-CN': '迁移宫', en: 'Travel' },
  friends: { 'zh-TW': '交友宮', 'zh-CN': '交友宫', en: 'Friends' },
  career: { 'zh-TW': '官祿宮', 'zh-CN': '官禄宫', en: 'Career' },
  property: { 'zh-TW': '田宅宮', 'zh-CN': '田宅宫', en: 'Property' },
  fortune: { 'zh-TW': '福德宮', 'zh-CN': '福德宫', en: 'Fortune' },
  parents: { 'zh-TW': '父母宮', 'zh-CN': '父母宫', en: 'Parents' }
};

export const BUREAU_NAME: Record<BureauId, LocalizedText> = {
  shui2: { 'zh-TW': '水二局', 'zh-CN': '水二局', en: 'Water 2' },
  mu3: { 'zh-TW': '木三局', 'zh-CN': '木三局', en: 'Wood 3' },
  jin4: { 'zh-TW': '金四局', 'zh-CN': '金四局', en: 'Metal 4' },
  tu5: { 'zh-TW': '土五局', 'zh-CN': '土五局', en: 'Earth 5' },
  huo6: { 'zh-TW': '火六局', 'zh-CN': '火六局', en: 'Fire 6' }
};

export const BUREAU_NUMBER: Record<BureauId, number> = {
  shui2: 2, mu3: 3, jin4: 4, tu5: 5, huo6: 6
};

export function stemIndex(stem: StemId): number {
  return STEMS.indexOf(stem);
}

export function branchIndex(branch: BranchId): number {
  return BRANCHES.indexOf(branch);
}

export function stemAt(index: number): StemId {
  return STEMS[((index % 10) + 10) % 10];
}

export function branchAt(index: number): BranchId {
  return BRANCHES[((index % 12) + 12) % 12];
}

export function oppositeBranch(branch: BranchId): BranchId {
  return branchAt(branchIndex(branch) + 6);
}

export function isYangStem(stem: StemId): boolean {
  return STEM_YINYANG[stem] === 'yang';
}
