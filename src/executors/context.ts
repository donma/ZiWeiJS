import type {
  ZiWeiBirthInput, Profile, BureauId, BranchId,
  Palace, StarPlacement, Transformation, MajorPeriod, PeriodInfo
} from '../core/types.js';
import type { Tracer } from '../trace/tracer.js';
import type { NormalizedBirth } from '../calendar/calendar-engine.js';

export interface EngineContext {
  input: ZiWeiBirthInput;
  normalized: NormalizedBirth;
  profile: Profile;
  tracer: Tracer;

  sexForCalculation: 'male' | 'female' | 'unknown';
  yinYang: 'yang' | 'yin';
  direction: 'forward' | 'backward';

  lifePalaceBranch: BranchId;
  bodyPalaceBranch: BranchId;
  palaces: Palace[];
  bureau: BureauId;
  bureauNumber: number;

  placements: Map<string, StarPlacement>;
  transformations: Transformation[];

  majorPeriods: MajorPeriod[];
  yearPeriod?: PeriodInfo;
  monthPeriod?: PeriodInfo;
  dayPeriod?: PeriodInfo;
  hourPeriod?: PeriodInfo;

  masterStar?: string;
  bodyStar?: string;

  lucunBranch?: BranchId;
}
