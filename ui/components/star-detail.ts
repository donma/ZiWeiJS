import { state } from '../app/state.js';
import { t, DIGNITY_ZH, ZiWei, getEvidence, getSource } from '../../src/index.js';
import type { Evidence, Source, Rule, TraceEntry } from '../../src/index.js';

const CAT_LABEL: Record<string, string> = {
  major: '十四主星', aux: '輔星', malefic: '煞星', minor: '雜曜',
  period: '歲建諸星', interim: '將前諸星'
};
const SIHUA_LABEL: Record<string, string> = { lu: '化祿', quan: '化權', ke: '化科', ji: '化忌' };

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function starDetailHtml(starId: string): string {
  const chart = state.chart;
  if (!chart) return '';
  const placement = chart.chart.stars[starId];
  if (!placement) return `<p>找不到星曜 ${starId}</p>`;

  const star = placement.star;
  const palace = chart.chart.palaces.find(p => p.id === placement.palaceId);
  const sihua = chart.chart.transformations.filter(tr => tr.targetStarId === starId);
  const rule: Rule | null = placement.ruleId ? safeRule(placement.ruleId) : null;
  const sources: Source[] = (rule?.sourceRefs ?? []).map(id => safeSource(id)).filter((s): s is Source => !!s);
  const evidence: Evidence[] = (rule?.evidenceRefs ?? []).map(id => getEvidence(id)).filter((e): e is Evidence => !!e);
  const traceEntry: TraceEntry | undefined = chart.trace?.entries.find(e => e.ruleId === placement.ruleId);

  const expert = state.mode === 'expert';

  return `
  <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
    <div>
      <h2 class="serif" style="margin:0 0 2px">${t(star.name)}</h2>
      <div class="mono small faint">${starId}</div>
    </div>
    <button class="icon-btn" data-close-panel="1">✕</button>
  </div>

  <p class="sub small" style="margin:10px 0">${star.shortDesc ? t(star.shortDesc) : ''}</p>

  <dl class="kv small">
    <dt>類別</dt><dd>${CAT_LABEL[star.category] ?? star.category}</dd>
    <dt>所在宮位</dt><dd>${palace ? t(palace.name) : ''}（${placement.branch}）</dd>
    ${placement.dignity ? `<dt>廟旺</dt><dd>${DIGNITY_ZH[placement.dignity as keyof typeof DIGNITY_ZH]}</dd>` : ''}
    <dt>確定度</dt><dd>${placement.certainty ?? 'high'}</dd>
  </dl>

  ${sihua.length ? `
  <h3 style="font-size:13px;margin:16px 0 6px">四化</h3>
  <ul class="small" style="margin:0;padding-left:18px">
    ${sihua.map(tr => `<li>${SIHUA_LABEL[tr.type]} · 來源 ${tr.sourceScope} · ${tr.sourceStem} 干${tr.selfTransformation ? ' · 自化' : ''}</li>`).join('')}
  </ul>` : ''}

  ${rule ? `
  <h3 style="font-size:13px;margin:16px 0 6px">安星規則 Rule</h3>
  <div class="card card-pad" style="padding:10px 12px">
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
      <span class="mono small">${rule.ruleId}</span>
      <span class="badge ${rule.status}">${rule.status}</span>
      <span class="badge">v${rule.ruleVersion}</span>
    </div>
    <div class="small">${t(rule.name)}</div>
    ${rule.description ? `<div class="small sub" style="margin-top:4px">${t(rule.description)}</div>` : ''}
    ${rule.logic?.executor ? `<div class="small mono faint" style="margin-top:4px">executor: ${rule.logic.executor}</div>` : ''}
  </div>` : ''}

  ${traceEntry ? `
  <h3 style="font-size:13px;margin:16px 0 6px">Trace（輸入 → 結果）</h3>
  <pre tabindex="0" class="json" style="max-height:220px">${esc(JSON.stringify(traceEntry, null, 1))}</pre>` : (expert ? '<p class="small faint">（此星曜無 trace 記錄，請以 Expert 模式重新排盤）</p>' : '')}

  ${sources.length ? `
  <h3 style="font-size:13px;margin:16px 0 6px">來源 Sources</h3>
  ${sources.map(s => `<div class="small" style="margin-bottom:4px"><span class="mono faint">${s.sourceId}</span> · ${esc(s.title)}${s.author ? `（${esc(s.author)}）` : ''} · Tier ${s.tier}</div>`).join('')}` : ''}

  ${evidence.length ? `
  <h3 style="font-size:13px;margin:16px 0 6px">Evidence</h3>
  ${evidence.map(e => `
    <div style="border-left:2px solid var(--line-strong);padding-left:10px;margin-bottom:8px">
      <div class="small"><span class="badge ${e.type === 'supports' ? 'canonical' : 'variant'}">${e.type}</span>
      <span class="mono small">${e.sourceId}</span>${e.location ? ` · ${esc(e.location)}` : ''}</div>
      ${e.quote ? `<div class="small" style="margin-top:3px">「${esc(e.quote)}」</div>` : ''}
    </div>`).join('')}` : ''}

  ${star.tags?.length ? `<p class="small faint" style="margin-top:12px">tags: ${star.tags.join(', ')}</p>` : ''}
  `;
}

function safeRule(id: string): Rule | null {
  try { return ZiWei.Rules.get(id); } catch { return null; }
}
function safeSource(id: string): Source | null {
  try { return getSource(id); } catch { return null; }
}
