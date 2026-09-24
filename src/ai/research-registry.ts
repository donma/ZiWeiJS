import researchRegistry from '../../research/registry.json' with { type: 'json' };

export type ResearchStatus = 'open' | 'candidate' | 'resolved' | 'rejected';

/**
 * Research Queue registry reader（spec 2nd §P1-4 / Final §1）。
 *
 * 研究項目（AI / 研究者提出、尚未併入 canonical 的規則或證據衝突）
 * 需可經公開 API 查詢，Expert UI 亦標示「此規則是否存在 open research conflict」。
 *
 * 資料以 JSON 匯入（與 rules / tables 一致），因此瀏覽器與離線 demo 皆可查詢。
 */
export interface ResearchItem {
  researchId: string;
  title: string;
  status: ResearchStatus;
  type: string;
  relatedRules: string[];
  evidence?: string[];
  question: string;
  nextAction?: string;
  ownerReviewRequired?: boolean;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

const items: ResearchItem[] = (researchRegistry as { items?: ResearchItem[] }).items ?? [];

export function listResearch(filter?: { status?: ResearchStatus; type?: string }): ResearchItem[] {
  let out = items;
  if (filter?.status) out = out.filter(i => i.status === filter.status);
  if (filter?.type) out = out.filter(i => i.type === filter.type);
  return out;
}

export function getResearch(researchId: string): ResearchItem | undefined {
  return items.find(i => i.researchId === researchId);
}

export function researchForRule(ruleId: string): ResearchItem[] {
  return items.filter(i => (i.relatedRules ?? []).includes(ruleId));
}

const ACTIVE_RESEARCH_STATUSES: ReadonlySet<ResearchStatus> = new Set(['open', 'candidate']);

/** 該規則是否仍有未結案的研究衝突（供 Expert UI 標示，open 或 candidate 視為進行中） */
export function hasOpenResearch(ruleId: string): boolean {
  return researchForRule(ruleId).some(i => ACTIVE_RESEARCH_STATUSES.has(i.status));
}
