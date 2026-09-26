/**
 * Bible deterministic search（spec 0.71 §38）。
 * 不做 embeddings，僅做 ID / 名稱 / 別名 / tags / description / source title / evidence quote 的精確比對。
 */
import { listRules, listSources, listEvidence } from '../rule-engine/registry.js';
import type { Rule, Source, Evidence } from '../core/types.js';

export interface BibleSearchResult {
  rules: Rule[];
  sources: Source[];
  evidence: Evidence[];
}

export function searchBible(query: string): BibleSearchResult {
  const q = query.toLowerCase().trim();
  if (!q) return { rules: [], sources: [], evidence: [] };

  const rules = listRules({ query });
  const sources = listSources().filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.sourceId.toLowerCase().includes(q) ||
    (s.author ?? '').toLowerCase().includes(q) ||
    (s.notes ?? '').toLowerCase().includes(q)
  );
  const evidence = listEvidence().filter(e =>
    e.evidenceId.toLowerCase().includes(q) ||
    (e.quote ?? '').toLowerCase().includes(q) ||
    (e.location ?? '').toLowerCase().includes(q) ||
    (e.sourceId ?? '').toLowerCase().includes(q)
  );

  return { rules, sources, evidence };
}
