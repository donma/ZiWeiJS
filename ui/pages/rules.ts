import { listRules, getSource, t } from '../../src/index.js';
import type { Rule } from '../../src/index.js';

let query = '';
let statusFilter = '';

export function renderRules(): string {
  const rules = listRules({ query: query || undefined, status: (statusFilter as never) || undefined });
  return `
  <h1>Rule Explorer</h1>
  <p class="sub">所有 machine-readable 規則（calculation / interpretation / pattern）。目前 ${rules.length} 條。</p>
  <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <input type="text" id="rule-q" placeholder="搜尋 Rule ID 或名稱…" value="${query}" style="flex:1;min-width:200px" />
    <select id="rule-status">
      <option value="">全部狀態</option>
      ${['canonical', 'variant', 'candidate', 'research', 'deprecated', 'undetermined'].map(s => `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
    </select>
  </div>
  <div class="card">
    <table class="data">
      <thead><tr><th>Rule ID</th><th>名稱</th><th>狀態</th><th>範圍</th><th>來源</th></tr></thead>
      <tbody>
        ${rules.map(r => ruleRow(r)).join('')}
      </tbody>
    </table>
  </div>
  <script>
    document.getElementById('rule-q').addEventListener('input', e => { window.__ruleQ = e.target.value; });
  </script>`;
}

function ruleRow(r: Rule): string {
  const sources = (r.sourceRefs ?? []).map(id => {
    try { return getSource(id).title; } catch { return id; }
  }).join(', ');
  return `<tr>
    <td class="mono small">${r.ruleId}</td>
    <td>${t(r.name)}</td>
    <td><span class="badge ${r.status}">${r.status}</span></td>
    <td class="small sub">${r.scope ?? (r as unknown as { domain?: string }).domain ?? ''}</td>
    <td class="small sub">${sources || '—'}</td>
  </tr>`;
}
