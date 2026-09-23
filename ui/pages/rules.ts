import { listRules, getSource, getEvidence, t, ZiWei } from '../../src/index.js';
import type { Rule, Evidence, Source } from '../../src/index.js';

let query = '';
let statusFilter = '';

export function renderRules(): string {
  const all = listRules();
  const rules = listRules({ query: query || undefined, status: (statusFilter as never) || undefined });
  return `
  <h1>Rule Explorer</h1>
  <p class="sub">所有 machine-readable 規則（calculation / interpretation / pattern）。共 ${all.length} 條，目前顯示 ${rules.length} 條。</p>
  <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <input type="text" id="rule-q" aria-label="搜尋規則" placeholder="搜尋 Rule ID 或中文名稱…" value="${escapeAttr(query)}" style="flex:1;min-width:200px" />
    <select id="rule-status" aria-label="依狀態篩選">
      <option value="">全部狀態</option>
      ${['canonical', 'variant', 'candidate', 'research', 'deprecated', 'undetermined'].map(s => `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s}（${all.filter(r => r.status === s).length}）</option>`).join('')}
      </select>
  </div>
  <div id="rule-detail"></div>
  <div class="card">
    <div class="table-scroll">
    <table class="data">
      <thead><tr><th>Rule ID</th><th>名稱</th><th>狀態</th><th>範圍</th><th>版本</th><th>來源</th></tr></thead>
      <tbody id="rule-tbody">
        ${rules.map(r => ruleRow(r)).join('')}
      </tbody>
    </table>
    </div>
  </div>
  <div id="rule-count" class="small faint" style="margin-top:6px">顯示 ${rules.length} / ${all.length} 條</div>
  <p class="small faint" style="margin-top:10px">點擊任一列可展開規則詳情（條件、來源、Evidence、變更紀錄）。</p>`;
}

function ruleRow(r: Rule): string {
  const sources = (r.sourceRefs ?? []).map(id => {
    try { return getSource(id).title; } catch { return id; }
  }).join(', ');
  return `<tr data-rule-id="${r.ruleId}" style="cursor:pointer">
    <td class="mono small">${r.ruleId}</td>
    <td>${t(r.name)}</td>
    <td><span class="badge ${r.status}">${r.status}</span></td>
    <td class="small sub">${r.scope ?? (r as unknown as { domain?: string }).domain ?? ''}</td>
    <td class="small mono">${r.ruleVersion}</td>
    <td class="small sub">${sources || '—'}</td>
  </tr>`;
}

export function ruleDetailHtml(ruleId: string): string {
  let rule: Rule;
  try {
    rule = ZiWei.Rules.get(ruleId);
  } catch {
    return `<p>找不到規則 ${ruleId}</p>`;
  }
  const sources = (rule.sourceRefs ?? []).map(id => {
    try { return getSource(id) as Source; } catch { return null; }
  }).filter((s): s is Source => !!s);
  const evidence = (rule.evidenceRefs ?? []).map(id => getEvidence(id)).filter((e): e is Evidence => !!e);
  const variant = rule.variantOf;

  return `
  <div class="card card-pad" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap">
      <div>
        <h2 class="serif" style="margin:0 0 4px">${t(rule.name)}</h2>
        <div class="mono small sub">${rule.ruleId}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="badge ${rule.status}">${rule.status}</span>
        <span class="badge">v${rule.ruleVersion}</span>
        ${variant ? `<span class="badge variant">variant of ${variant}</span>` : ''}
        ${ZiWei.Research.hasOpen(rule.ruleId) ? '<span class="badge warn" style="background:#8a5a1520;color:#8a5a15">open research</span>' : ''}
      </div>
    </div>
    ${rule.description ? `<p class="sub small" style="margin:10px 0 0">${t(rule.description)}</p>` : ''}

    <div class="grid grid-2" style="margin-top:14px;gap:14px">
      <div>
        <h3 style="font-size:13px;margin:0 0 6px">範圍 Scope</h3>
        <div class="mono small">${rule.scope ?? (rule as unknown as { domain?: string }).domain ?? '—'}</div>
        ${rule.inputs?.length ? `<h3 style="font-size:13px;margin:12px 0 6px">輸入 Inputs</h3><div class="small mono">${rule.inputs.join(', ')}</div>` : ''}
      </div>
      <div>
        <h3 style="font-size:13px;margin:0 0 6px">執行方式 Logic</h3>
        ${rule.logic?.executor ? `<div class="small">executor: <span class="mono">${rule.logic.executor}</span></div>` : ''}
        ${rule.logic?.tableRef ? `<div class="small">table: <span class="mono">${rule.logic.tableRef}</span></div>` : ''}
        ${rule.logic?.dsl ? `<pre tabindex="0" class="json" style="max-height:160px">${escapeHtml(JSON.stringify(rule.logic.dsl, null, 1))}</pre>` : ''}
      </div>
    </div>

    ${rule.tags?.length ? `<div style="margin-top:10px">${rule.tags.map(tag => `<span class="badge">${tag}</span>`).join(' ')}</div>` : ''}

    <h3 style="font-size:13px;margin:16px 0 6px">來源 Sources</h3>
    ${sources.length === 0 ? '<p class="small faint">（未登錄來源）</p>' : `
    <div class="table-scroll">
    <table class="data small">
      <thead><tr><th>ID</th><th>書名</th><th>作者</th><th>Tier</th></tr></thead>
      <tbody>${sources.map(s => `<tr><td class="mono">${s.sourceId}</td><td>${s.title}</td><td>${s.author ?? '—'}</td><td>${s.tier}</td></tr>`).join('')}</tbody>
    </table>`}
    </div>

    <h3 style="font-size:13px;margin:16px 0 6px">Evidence</h3>
    ${evidence.length === 0 ? '<p class="small faint">（未登錄證據）</p>' : evidence.map(e => `
      <div style="border-left:2px solid var(--line-strong);padding-left:10px;margin-bottom:8px">
        <div class="small"><span class="badge ${e.type === 'supports' ? 'canonical' : e.type === 'conflicts' ? 'deprecated' : 'variant'}">${e.type}</span>
        <span class="mono small">${e.sourceId}</span>${e.location ? ` · <span class="small sub">${e.location}</span>` : ''}
        ${e.confidence !== undefined ? ` · 信心 ${e.confidence}` : ''}</div>
        ${e.quote ? `<div class="small" style="margin-top:4px">「${e.quote}」</div>` : ''}
        ${e.notes ? `<div class="small faint">${e.notes}</div>` : ''}
      </div>`).join('')}

    <h3 style="font-size:13px;margin:16px 0 6px">變更紀錄 Change Log</h3>
    ${(rule.changeLog ?? []).length === 0 ? '<p class="small faint">v1.0 初版。</p>' : `
    <div class="table-scroll">
    <table class="data small">
      <thead><tr><th>版本</th><th>類型</th><th>說明</th></tr></thead>
      <tbody>${(rule.changeLog ?? []).map(c => `<tr><td class="mono">${c.version}</td><td><span class="badge">${c.type}</span></td><td>${c.note ?? ''}</td></tr>`).join('')}</tbody>
    </table>`}
    </div>

    ${ZiWei.Research.forRule(rule.ruleId).length ? `
    <h3 style="font-size:13px;margin:16px 0 6px">相關研究項目 Research Queue</h3>
    <div class="table-scroll">
    <table class="data small">
      <thead><tr><th>ID</th><th>狀態</th><th>類型</th><th>標題</th><th>提問</th></tr></thead>
      <tbody>${ZiWei.Research.forRule(rule.ruleId).map(i => `<tr>
        <td class="mono">${i.researchId}</td>
        <td><span class="badge ${i.status === 'open' ? 'warn' : 'canonical'}">${i.status}</span></td>
        <td><span class="badge">${i.type}</span></td>
        <td>${i.title}</td>
        <td class="small sub">${i.question}</td>
      </tr>`).join('')}</tbody>
    </table>
    </div>` : ''}

    <h3 style="font-size:13px;margin:16px 0 6px">Trace 範例</h3>
    <pre tabindex="0" class="json" style="max-height:200px">${escapeHtml(traceExample(rule))}</pre>
  </div>`;
}

function traceExample(rule: Rule): string {
  const entry = {
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    inputs: (rule.inputs ?? []).reduce((acc, k) => ({ ...acc, [k]: '<value>' }), {} as Record<string, string>),
    result: rule.outputs?.length ? `<${rule.outputs.join(' | ')}>` : '<result>',
    profile: rule.profile ?? 'canonical',
    sourceRefs: rule.sourceRefs ?? [],
    evidenceRefs: rule.evidenceRefs ?? []
  };
  return JSON.stringify(entry, null, 2);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function refreshTable(): void {
  const tbody = document.getElementById('rule-tbody');
  if (!tbody) return;
  const rules = listRules({ query: query || undefined, status: (statusFilter as never) || undefined });
  tbody.innerHTML = rules.map(r => ruleRow(r)).join('');
  const count = document.getElementById('rule-count');
  if (count) count.textContent = `顯示 ${rules.length} / ${listRules().length} 條`;
  bindRows();
}

function bindRows(): void {
  document.querySelectorAll('tr[data-rule-id]').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = (tr as HTMLElement).dataset.ruleId!;
      const detail = document.getElementById('rule-detail');
      if (detail) {
        detail.innerHTML = ruleDetailHtml(id);
        detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

export function bindRuleExplorer(): void {
  const q = document.getElementById('rule-q') as HTMLInputElement | null;
  const sel = document.getElementById('rule-status') as HTMLSelectElement | null;
  let timer: number | undefined;
  q?.addEventListener('input', () => {
    query = q.value;
    clearTimeout(timer);
    timer = window.setTimeout(refreshTable, 120);
  });
  sel?.addEventListener('change', () => {
    statusFilter = sel.value;
    refreshTable();
  });
  bindRows();
}
