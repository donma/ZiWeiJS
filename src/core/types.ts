import type { AstroEntityKind } from './entity-kinds.js';

export type RuleStatus =
  | 'canonical'
  | 'variant'
  | 'research'
  | 'candidate'
  | 'deprecated'
  | 'undetermined';

export type Certainty =
  | 'certain'
  | 'high'
  | 'medium'
  | 'low'
  | 'unknown'
  | 'unavailable'
  | 'variant-dependent';

export type Locale = 'zh-TW' | 'zh-CN' | 'en';

export type StemId =
  | 'jia' | 'yi' | 'bing' | 'ding' | 'wu'
  | 'ji' | 'geng' | 'xin' | 'ren' | 'gui';

export type BranchId =
  | 'zi' | 'chou' | 'yin' | 'mao' | 'chen' | 'si'
  | 'wu' | 'wei' | 'shen' | 'you' | 'xu' | 'hai';

export type BureauId = 'shui2' | 'mu3' | 'jin4' | 'tu5' | 'huo6';

export type PalaceId =
  | 'life' | 'siblings' | 'spouse' | 'children' | 'wealth' | 'health'
  | 'travel' | 'friends' | 'career' | 'property' | 'fortune' | 'parents';

export type StarCategory =
  | 'major'
  | 'aux'
  | 'malefic'
  | 'minor'
  | 'period'
  | 'interim';

export type StarTier =
  | 'core'
  | 'common'
  | 'extended'
  | 'school'
  | 'historical'
  | 'research';

export type TransformationType = 'lu' | 'quan' | 'ke' | 'ji';

export type TransformationScope =
  | 'natal'
  | 'palace'
  | 'major-period'
  | 'year'
  | 'month'
  | 'day'
  | 'hour';

export type DignityLevel =
  | 'miao'
  | 'wang'
  | 'de'
  | 'li'
  | 'ping'
  | 'bu'
  | 'xian';

export type ChangSheng =
  | 'changsheng' | 'muyu' | 'guandai' | 'linguan' | 'diwang' | 'shuai'
  | 'bing' | 'si' | 'mu' | 'jue' | 'tai' | 'yang';

export type PeriodScope =
  | 'natal'
  | 'major-period'
  | 'year'
  | 'month'
  | 'day'
  | 'hour';

export type Domain =
  | 'personality' | 'career' | 'wealth' | 'relationship' | 'marriage'
  | 'family' | 'health' | 'learning' | 'migration' | 'social'
  | 'risk' | 'timing' | 'general';

export interface LocalizedText {
  [locale: string]: string;
}

export interface ZiWeiBirthInput {
  calendarType: 'solar' | 'lunar';
  date: {
    year: number;
    month: number;
    day: number;
    isLeapMonth?: boolean;
  };
  time?: {
    hour?: number;
    minute?: number;
    second?: number;
  };
  timezone?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
  };
  sexForCalculation?: 'male' | 'female' | 'unknown';
  timeConvention?: 'civil' | 'true-solar' | 'local-mean-solar';
  dayBoundary?: 'midnight' | 'zi-hour';
  /** DST 邊界本地時間歧義處理（預設 'reject'，spec 3rd §P1-2） */
  timezoneDisambiguation?: 'reject' | 'earlier' | 'later';
  name?: string;
}

export interface TargetDate {
  year: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  timezone?: string;
}

export interface CalculateOptions {
  profile?: string;
  trace?: boolean;
  /** 目標日期。未提供時只計算本命盤，不產生任何限運（不得隱含 now）。 */
  targetDate?: TargetDate;
  interpretation?: boolean;
  patterns?: boolean;
}

export interface GanzhiPair {
  stem: StemId;
  branch: BranchId;
}

export interface CalendarInfo {
  solar: { year: number; month: number; day: number };
  lunar: {
    year: number;
    month: number;
    day: number;
    isLeapMonth: boolean;
  };
  ganzhi: {
    year: GanzhiPair;
    month: GanzhiPair;
    day: GanzhiPair;
    hour: GanzhiPair;
  };
  hourBranch: BranchId;
  solarTerm?: string;
  timezone: string;
  utcOffsetMinutes: number;
  timeConvention: string;
  trueSolarOffsetMinutes?: number;
  dayBoundary: string;
}

export interface Star {
  id: string;
  category: StarCategory;
  tier: StarTier;
  name: LocalizedText;
  shortDesc?: LocalizedText;
  brightness?: DignityLevel;
  status: RuleStatus;
  sources: string[];
  tags: string[];
  /** 實體分類（spec Post-Stability §20）；未給則由 category 推導 */
  entityKind?: AstroEntityKind;
  aliases?: string[];
  note?: string;
}

/** 實體溯源中繼資料（spec 3rd §P1-7） */
export interface Provenance {
  ruleId: string;
  ruleVersion: string;
  profile: string;
  sourceRefs: string[];
  evidenceRefs: string[];
}

export interface StarPlacement {
  starId: string;
  star: Star;
  palaceId: PalaceId;
  branch: BranchId;
  dignity?: DignityLevel;
  certainty: Certainty;
  ruleId: string;
  ruleVersion: string;
  provenance?: Provenance;
  transformations?: Transformation[];
}

export interface Transformation {
  type: TransformationType;
  sourceScope: TransformationScope;
  sourceStem: StemId;
  sourcePalaceId?: PalaceId;
  targetStarId: string;
  targetPalaceId: PalaceId;
  profile: string;
  ruleId: string;
  provenance?: Provenance;
  selfTransformation?: boolean;
}

export interface Palace {
  id: PalaceId;
  index: number;
  name: LocalizedText;
  stem: StemId;
  branch: BranchId;
  ganzhi: GanzhiPair;
  isBodyPalace: boolean;
  isLifePalace: boolean;
  stars: StarPlacement[];
  majorStars: StarPlacement[];
  auxStars: StarPlacement[];
  maleficStars: StarPlacement[];
  minorStars: StarPlacement[];
  transformations: Transformation[];
  changsheng?: ChangSheng;
  boshi?: string;
  majorPeriod?: { fromAge: number; toAge: number };
  cycles: Record<string, unknown>;
}

export interface PatternResult {
  patternId: string;
  name: LocalizedText;
  status: 'complete' | 'partial' | 'enhanced' | 'broken' | 'variant-only' | 'insufficient';
  score: number;
  matchedConditions: string[];
  failedConditions: string[];
  breakers: string[];
  enhancers: string[];
  profile: string;
  ruleId: string;
  provenance?: Provenance;
}

export interface PeriodStarPlacement {
  starId: string;
  name: LocalizedText;
  branch: BranchId;
}

export interface PeriodPalace {
  palaceId: PalaceId;
  branch: BranchId;
  ganzhi: GanzhiPair;
  stars: PeriodStarPlacement[];
}

export interface PeriodOverlay {
  scope: PeriodScope;
  stem: StemId;
  branch: BranchId;
  lifePalaceBranch: BranchId;
  palaces: PeriodPalace[];
  periodStars: PeriodStarPlacement[];
  transformations: Transformation[];
}

export interface PeriodInfo {
  scope: PeriodScope;
  /**
   * 限運「命宮」所在地支（用於十二宮疊盤定位），
   * 不等於該限運之干支地支。限運干支見 `ganzhi`。
   */
  branch: BranchId;
  /** 該限運之真實干支（流年/流月/流日/流時各自獨立推算） */
  ganzhi?: GanzhiPair;
  stem: StemId;
  palaceId?: PalaceId;
  ageRange?: [number, number];
  /** 目標國曆年（civil / Gregorian） */
  year?: number;
  /** 目標農曆年（以正月初一為界） */
  lunarYear?: number;
  /** 依 profile.yearBoundaryPolicy 解析後、年柱所屬之年度（spec 3rd §P1-4） */
  resolvedYear?: number;
  /** 年柱換年分界策略（spec 3rd §P0-2） */
  yearBoundaryPolicy?: 'lunar-new-year' | 'lichun';
  /** 目標日期精度（year-only target 時標示欠缺月日，spec 3rd §P0-3） */
  resolution?: 'exact-date' | 'representative-date' | 'year-only';
  label: LocalizedText;
  overlay?: PeriodOverlay;
  provenance?: Provenance;
}

export interface MajorPeriod extends PeriodInfo {
  fromAge: number;
  toAge: number;
  direction: 'forward' | 'backward';
}

/** 規則執行狀態（spec §28） */
export type RuleExecutionStatus = 'executed' | 'skipped' | 'unavailable' | 'variant' | 'candidate' | 'error';

export interface TraceEntry {
  ruleId: string;
  ruleVersion?: string;
  inputs?: Record<string, unknown>;
  result: unknown;
  profile: string;
  sourceRefs?: string[];
  evidenceRefs?: string[];
  status?: RuleExecutionStatus;
  reason?: string;
  note?: string;
}

/** 解讀命中的解析狀態（spec §P0-6） */
export type InterpretationStatus = 'active' | 'overridden' | 'conflicted';

export interface InterpretationHit {
  ruleId: string;
  domain: Domain;
  tendency: string;
  strength: number;
  confidence: number;
  priority: number;
  text?: LocalizedText;
  supports: string[];
  conflictsWith: string[];
  overriddenBy: string[];
  overridesList?: string[];
  effectiveStrength?: number;
  /** 解析結果。Narrative 預設只吃 active；Expert 模式另顯示 overridden / conflicted。 */
  status?: InterpretationStatus;
  supportedBy?: string[];
  provenance?: Provenance;
}

export interface ZiWeiChart {
  schemaVersion: string;
  generatedWith: {
    bibleVersion: string;
    schemaVersion: string;
    profile: string;
    engineVersion: string;
  };
  input: ZiWeiBirthInput;
  calendar: CalendarInfo;
  birthContext: {
    sexForCalculation: string;
    yinYang: 'yang' | 'yin';
    /** 性別未知時為 undetermined —— 不猜方向（spec §27） */
    direction: 'forward' | 'backward' | 'undetermined';
    bureau: BureauId;
    bureauName: LocalizedText;
  };
  chart: {
    natal: {
      lifePalace: PalaceId;
      bodyPalace: PalaceId;
      lifePalaceBranch: BranchId;
      bodyPalaceBranch: BranchId;
      masterStar?: string;
      bodyStar?: string;
    };
    palaces: Palace[];
    stars: Record<string, StarPlacement>;
    transformations: Transformation[];
    patterns: PatternResult[];
  };
  periods: {
    major: MajorPeriod[];
    /** 有 targetDate 時才有值；描述目標日期當下所在之限運。 */
    active?: {
      age: number;
      asOf: TargetDate;
      major?: MajorPeriod;
      majorSkippedReason?: string;
    };
    year?: PeriodInfo;
    month?: PeriodInfo;
    day?: PeriodInfo;
    hour?: PeriodInfo;
  };
  interpretation: {
    hits: InterpretationHit[];
    byDomain: Record<string, InterpretationHit[]>;
  };
  certainty: Record<string, Certainty>;
  trace?: { entries: TraceEntry[] };
}

export interface Rule {
  ruleId: string;
  ruleVersion: string;
  status: RuleStatus;
  scope: string;
  category: string;
  name: LocalizedText;
  description?: LocalizedText;
  profile?: string;
  variantOf?: string;
  inputs?: string[];
  logic: {
    dsl?: Record<string, unknown>;
    executor?: string;
    params?: Record<string, unknown>;
    tableRef?: string;
    /** 執行階段（spec §P0-1 execution plan） */
    stage?: 'natal' | 'period' | 'variant' | 'on-demand' | 'analysis' | 'unplanned';
    /** 同一階段內的執行順序 */
    order?: number;
  };
  outputs?: string[];
  sourceRefs?: string[];
  evidenceRefs?: string[];
  tests?: Array<{ fixture?: string; expect?: unknown }>;
  changeLog?: Array<{
    version: string;
    type: string;
    note?: string;
    date?: string;
  }>;
  tags?: string[];
}

export interface Source {
  sourceId: string;
  title: string;
  author?: string;
  era?: string;
  edition?: string;
  type: string;
  tier: number;
  notes?: string;
  [key: string]: unknown;
}

export interface Evidence {
  evidenceId: string;
  sourceId: string;
  ruleId?: string;
  type: 'supports' | 'conflicts' | 'mentions' | 'variant-only';
  location?: string;
  quote?: string;
  confidence?: number;
  notes?: string;
}

export interface Profile {
  profileId: string;
  name: LocalizedText;
  description?: LocalizedText;
  timeConvention: 'civil' | 'true-solar' | 'local-mean-solar';
  dayBoundary: 'midnight' | 'zi-hour';
  /** 年柱分界（lunar-new-year：正月初一；lichun：立春，spec 3rd §P0-2） */
  yearBoundaryPolicy?: 'lunar-new-year' | 'lichun';
  /** 閏月處理（same-as-normal | next-month | mid-month；split 暫未支援） */
  leapMonthPolicy: 'mid-month' | 'same-as-normal' | 'split' | 'next-month' | string;
  /** 限運相關設定（目前支援 ageMethod: 'virtual-age'） */
  periodRules?: { ageMethod?: 'virtual-age' | string };
  /** 所有演算法 variant 統一由此機制控制（canonical ruleId -> variant ruleId） */
  ruleOverrides?: Record<string, string>;
  /** 保留欄位（未實作不得宣稱有 runtime 效果，spec 2nd §P0-8） */
  _reserved?: Record<string, unknown>;
}

export interface RuleDataFile {
  $schema?: string;
  rules: Rule[];
}
