/**
 * Profile Gap Audit（spec Post-Stability §5 / Phase E；供 CLI 與測試共用）
 *
 * 目的：把「profile schema 宣告的欄位 / 列舉值」與「runtime 是否真的消費」分開，
 * 避免 `_reserved` 或未實作的 enum 被誤認為可用功能。
 *
 * 判定方式：
 *   - `RUNTIME_CONSUMED`：本引擎確實會依該欄位改變行為（附消費位置）
 *   - `declared-not-exercised`：schema 有宣告，但沒有任何 profile 使用該值
 *   - `reserved`：profile JSON 的 `_reserved` 內宣告，明確非 runtime 有效
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listProfiles, listRules, listResearch } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** profile 欄位 → runtime 消費位置（人工維護，隨實作更新） */
const RUNTIME_CONSUMED: Record<string, { consumedBy: string; note: string; hasDefault?: boolean }> = {
  timeConvention: {
    consumedBy: 'calendar-engine（true-solar）',
    note: 'true-solar profile 觸發真太陽時修正；未給 locator 時 fail-close（MISSING_LOCATION_FOR_SOLAR_TIME）。'
  },
  dayBoundary: {
    consumedBy: 'calendar-engine（子時換日）',
    note: 'midnight（午夜換日，canonical） / zi-hour（子初換日，traditional-zi）。'
  },
  yearBoundaryPolicy: {
    consumedBy: 'ZW.CALC.CALENDAR.YEAR_BOUNDARY.001 / variants',
    note: 'lunar-new-year（農曆正月初一） / lichun（立春）；影響 resolvedYear 與年柱。'
  },
  leapMonthPolicy: {
    consumedBy: 'calendar-engine（閏月）',
    note: '目前僅 same-as-normal 為各 profile 實際值；next-month / mid-month / split 見 gap。'
  },
  periodRules: {
    consumedBy: 'major-period-resolver.ageAt',
    note: '僅支援 ageMethod=virtual-age；所有 profile 均未顯式設定，由 engine 預設套用。',
    hasDefault: true
  },
  ruleOverrides: {
    consumedBy: 'reference-engine（activeRules）+ 各 executor 之 variantPatchFor',
    note: 'canonical ruleId → variant ruleId；所有流派差異唯一入口。'
  }
};

/** schema 宣告、但 runtime 尚未實作之值 */
const NOT_IMPLEMENTED_VALUES: Array<{
  field: string;
  value: string;
  gap: string;
  researchId: string | null;
}> = [
  {
    field: 'leapMonthPolicy',
    value: 'split',
    gap: '整月拆分未實作（schema 允許，executor 無對應分支）。',
    researchId: 'RSH.LEAP_MONTH_SPLIT'
  },
  {
    field: 'leapMonthPolicy',
    value: 'mid-month',
    gap: 'mid-month 僅能以日期分界近似，未以獨立規則表達。',
    researchId: 'RSH.LEAP_MONTH_SPLIT'
  },
  {
    field: 'leapMonthPolicy',
    value: 'next-month',
    gap: 'next-month 未以獨立規則表達（現行僅 same-as-normal 生效）。',
    researchId: 'RSH.LEAP_MONTH_SPLIT'
  },
  {
    field: 'timeConvention',
    value: 'local-mean-solar',
    gap: 'local-mean-solar 未實作（僅 civil / true-solar 有 runtime 行為）。',
    researchId: 'RSH.PROFILE.TIME_CONVENTION'
  }
];

export interface ProfileGapReport {
  generatedBy: string;
  note: string;
  profiles: Array<{
    profileId: string;
    fieldsSet: string[];
    reservedFields: string[];
    overrides: number;
  }>;
  fields: Array<{
    field: string;
    declaredInSchema: boolean;
    runtimeConsumed: boolean;
    consumedBy: string | null;
    hasDefault: boolean;
    valuesUsedByProfiles: string[];
    notImplementedValues: string[];
  }>;
  unimplementedValues: typeof NOT_IMPLEMENTED_VALUES;
}

function readProfileJsons(): Array<Record<string, unknown> & { profileId: string }> {
  const dir = join(root, 'profiles');
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown> & { profileId: string });
}

export function buildProfileGapReport(): ProfileGapReport {
  const schema = JSON.parse(readFileSync(join(root, 'schemas/profile.schema.json'), 'utf8')) as {
    properties?: Record<string, unknown>;
  };
  const declared = Object.keys(schema.properties ?? {});
  const jsonProfiles = readProfileJsons();

  const fields = declared.map(field => {
    const valuesUsed = new Set<string>();
    for (const p of jsonProfiles) {
      const v = p[field];
      if (v === undefined) continue;
      if (typeof v === 'string') valuesUsed.add(v);
      else if (typeof v === 'object' && v !== null) valuesUsed.add('<object>');
    }
    const consumed = RUNTIME_CONSUMED[field];
    return {
      field,
      declaredInSchema: true,
      runtimeConsumed: !!consumed,
      consumedBy: consumed?.consumedBy ?? null,
      hasDefault: !!consumed?.hasDefault,
      valuesUsedByProfiles: [...valuesUsed].sort(),
      notImplementedValues: NOT_IMPLEMENTED_VALUES.filter(n => n.field === field).map(n => n.value)
    };
  });

  return {
    generatedBy: 'tools/profiles/profile-gap-audit.ts',
    note:
      'profile 欄位與 enum 之實作盤點。runtimeConsumed=false 或列於 notImplementedValues 者，' +
      '不得宣稱為可用功能（spec 2nd §P0-8）。',
    profiles: jsonProfiles.map(p => ({
      profileId: p.profileId,
      fieldsSet: Object.keys(p).filter(k => !k.startsWith('$')).sort(),
      reservedFields: Object.keys((p._reserved as Record<string, unknown>) ?? {}).sort(),
      overrides: Object.keys((p.ruleOverrides as Record<string, unknown>) ?? {}).length
    })),
    fields,
    unimplementedValues: NOT_IMPLEMENTED_VALUES
  };
}

export interface ProfileGapResult {
  failures: string[];
  stats: { profiles: number; declaredFields: number; runtimeConsumed: number; unimplementedValues: number };
}

export function runProfileGapChecks(): ProfileGapResult {
  const failures: string[] = [];
  const report = buildProfileGapReport();
  const profiles = listProfiles();
  const profileIds = new Set(profiles.map(p => p.profileId));

  /* 1. 報告中的 profile 必須與 registry 一致 */
  const reportedIds = report.profiles.map(p => p.profileId).sort();
  const registryIds = [...profileIds].sort();
  if (JSON.stringify(reportedIds) !== JSON.stringify(registryIds)) {
    failures.push(`profile 清單不一致：report=${reportedIds.join(',')} registry=${registryIds.join(',')}`);
  }

  /* 2. 未實作值必須有 researchId（且該研究項必須存在） */
  const researchIds = new Set(listResearch().map(r => r.researchId));
  for (const n of report.unimplementedValues) {
    if (!n.gap) {
      failures.push(`${n.field}=${n.value}: 未實作值必須提供 gap 說明`);
    }
    if (n.researchId && !researchIds.has(n.researchId)) {
      failures.push(`${n.field}=${n.value}: researchId 無法解析 ${n.researchId}`);
    }
  }

  /* 3. 標記為 runtime 消費的欄位，必須真的有 profile 使用，或由 engine 提供預設值 */
  for (const f of report.fields) {
    if (!f.runtimeConsumed) continue;
    if (f.valuesUsedByProfiles.length === 0 && !f.hasDefault) {
      failures.push(`${f.field}: 標記 runtimeConsumed 但無任何 profile 使用且無預設值`);
    }
  }

  /* 4. ruleOverrides 目標必須存在（與 reference-engine 一致的靜態檢查） */
  const ruleIds = new Set(listRules().map(r => r.ruleId));
  for (const p of profiles) {
    for (const [canon, variant] of Object.entries(p.ruleOverrides ?? {})) {
      if (!ruleIds.has(canon)) failures.push(`${p.profileId}: override 來源不存在 ${canon}`);
      if (!ruleIds.has(variant)) failures.push(`${p.profileId}: override 目標不存在 ${variant}`);
    }
  }

  return {
    failures,
    stats: {
      profiles: report.profiles.length,
      declaredFields: report.fields.length,
      runtimeConsumed: report.fields.filter(f => f.runtimeConsumed).length,
      unimplementedValues: report.unimplementedValues.length
    }
  };
}
