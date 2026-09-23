import type { RuleStatus } from '../core/types.js';

/**
 * AI Research Pipeline（spec §63）
 *
 *   外部來源 → Research Agent → Research Rule → Source/Evidence
 *   → Conflict Detection → Candidate → Tests → Owner Review → Canonical
 *
 * 護欄：AI 不得將 candidate 升級為 canonical，也不得將 variant 改為 canonical。
 */

export type ResearchStage =
  | 'external-source'
  | 'research-rule'
  | 'source-evidence'
  | 'conflict-detection'
  | 'candidate'
  | 'tests'
  | 'owner-review'
  | 'canonical';

export const PIPELINE_STAGES: ResearchStage[] = [
  'external-source',
  'research-rule',
  'source-evidence',
  'conflict-detection',
  'candidate',
  'tests',
  'owner-review',
  'canonical'
];

/** AI Agent 可自動執行的階段（不含 owner-review 與 canonical） */
export const AI_ALLOWED_STAGES: ResearchStage[] = [
  'external-source',
  'research-rule',
  'source-evidence',
  'conflict-detection',
  'candidate',
  'tests'
];

export interface PipelineGuardResult {
  allowed: boolean;
  reason: string;
}

/**
 * 檢查某個階段推進是否被允許。
 * 只有 Owner 能執行 owner-review → canonical。
 */
export function canAdvance(
  from: ResearchStage,
  to: ResearchStage,
  actor: 'ai' | 'owner'
): PipelineGuardResult {
  const fromIdx = PIPELINE_STAGES.indexOf(from);
  const toIdx = PIPELINE_STAGES.indexOf(to);

  if (toIdx < 0 || fromIdx < 0) {
    return { allowed: false, reason: `未知階段：${from} → ${to}` };
  }
  if (toIdx !== fromIdx + 1) {
    return { allowed: false, reason: `不得跳階段：${from} → ${to}` };
  }
  if (to === 'canonical' && actor !== 'owner') {
    return { allowed: false, reason: 'canonical 最終批准僅限專案 Owner（spec §1.3 / §63）' };
  }
  if (to === 'owner-review' && actor !== 'owner') {
    return { allowed: false, reason: 'Owner Review 僅限專案 Owner 執行（spec §63：AI 不得跳過 Owner Review）' };
  }
  if (actor === 'ai' && !AI_ALLOWED_STAGES.includes(to)) {
    return { allowed: false, reason: `AI 不得進入階段：${to}` };
  }
  return { allowed: true, reason: 'ok' };
}

/**
 * 檢查狀態轉換是否合法（規則 status 層級）。
 * 明確禁止 candidate → canonical 與 variant → canonical。
 */
export function canPromoteStatus(
  from: RuleStatus,
  to: RuleStatus,
  actor: 'ai' | 'owner'
): PipelineGuardResult {
  if ((from === 'candidate' || from === 'variant' || from === 'research') && to === 'canonical') {
    if (actor !== 'owner') {
      return {
        allowed: false,
        reason: `${from} → canonical 僅限 Owner（AI 不得自行升級，spec §1.3 / §56）`
      };
    }
  }
  if (to === 'canonical' && actor === 'ai') {
    return { allowed: false, reason: 'AI 不得將任何規則設為 canonical' };
  }
  return { allowed: true, reason: 'ok' };
}

export interface ConflictReport {
  type: 'status' | 'implementation' | 'evidence' | 'table' | 'policy';
  severity: 'blocker' | 'warning' | 'info';
  subject: string;
  bible: string;
  external?: string;
  classification:
    | 'school-variance'
    | 'calendar-variance'
    | 'time-basis-variance'
    | 'day-boundary-variance'
    | 'leap-month-variance'
    | 'bug'
    | 'external-error'
    | 'unclassified';
  note?: string;
}

/**
 * 依 spec §29.2 分類差異。差異不直接判錯，須先分類再人工裁決。
 */
export function classifyDifference(
  report: Omit<ConflictReport, 'classification'>
): ConflictReport {
  let classification: ConflictReport['classification'] = 'unclassified';
  const sub = report.subject.toLowerCase();
  const note = (report.note ?? '').toLowerCase();

  if (report.type === 'policy') {
    if (sub.includes('leap') || note.includes('閏')) classification = 'leap-month-variance';
    else if (sub.includes('boundary') || note.includes('換日') || note.includes('zi')) classification = 'day-boundary-variance';
    else classification = 'school-variance';
  } else if (report.type === 'table' || report.type === 'implementation') {
    if (sub.includes('calendar') || sub.includes('solar') || sub.includes('lunar')) classification = 'calendar-variance';
    else if (sub.includes('time') || sub.includes('dst') || sub.includes('timezone')) classification = 'time-basis-variance';
    else if (sub.includes('sihua') || sub.includes('aux') || sub.includes('major') || sub.includes('star')) classification = 'school-variance';
  }

  return { ...report, classification };
}

export const DIFFERENTIAL_CLASSES: ConflictReport['classification'][] = [
  'school-variance',
  'calendar-variance',
  'time-basis-variance',
  'day-boundary-variance',
  'leap-month-variance',
  'bug',
  'external-error',
  'unclassified'
];

export const DIFFERENTIAL_CLASS_ZH: Record<ConflictReport['classification'], string> = {
  'school-variance': '流派差異',
  'calendar-variance': '曆法差異',
  'time-basis-variance': '時間基準差異',
  'day-boundary-variance': '換日差異',
  'leap-month-variance': '閏月差異',
  bug: 'Bug',
  'external-error': '外部來源錯誤',
  unclassified: '待分類'
};
