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
  year?: number;
  label: LocalizedText;
  overlay?: PeriodOverlay;
}

export interface MajorPeriod extends PeriodInfo {
  fromAge: number;
  toAge: number;
  direction: 'forward' | 'backward';
}

/** 規則執行狀態（spec §28） */
export type RuleExecutionStatus = 'executed' | 'skipped' | 'unavailable' | 'variant' | 'error';

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
  leapMonthPolicy: string;
  transformationPolicy?: string;
  starRules?: Record<string, string>;
  periodRules?: Record<string, string>;
  dignityRules?: Record<string, string>;
  ruleOverrides?: Record<string, string>;
}

export interface RuleDataFile {
  $schema?: string;
  rules: Rule[];
}
