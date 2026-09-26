import {
  ZiWei, t, STEM_ZH, BRANCH_ZH, DIGNITY_ZH
} from '../../src/index.js';

export function renderBibleStarPage(starId: string): string {
  const stars = ZiWei.StarRegistry.list();
  const entry = stars.find(s => s.id === starId);
  if (!entry) {
    return `<div class="card card-pad"><h2>查無星曜</h2><p class="mono">${starId}</p><a href="#/rules">返回規則庫</a></div>`;
  }
  return `
  <div class="bible-detail-page">
    <div style="margin-bottom:14px"><a class="btn sm" href="#/rules">← 返回規則庫</a></div>
    <div class="card card-pad">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <h1 style="margin:0">${t(entry.name)}</h1>
        <span class="badge ${entry.status}">${entry.status}</span>
        <span class="badge canonical">${entry.category}</span>
        <span class="badge">${entry.tier}</span>
      </div>
      <dl class="kv small">
        <dt>ID</dt><dd class="mono">${entry.id}</dd>
        ${entry.aliases?.length ? `<dt>別名</dt><dd>${entry.aliases.join('、')}</dd>` : ''}
        <dt>分類</dt><dd>${entry.category} (${entry.tier})</dd>
        ${entry.entityKind ? `<dt>實體分類</dt><dd>${entry.entityKind}</dd>` : ''}
        <dt>來源</dt><dd>${(entry.sources ?? []).join(', ') || '無'}</dd>
        ${entry.tags?.length ? `<dt>Tags</dt><dd>${entry.tags.join(', ')}</dd>` : ''}
        ${(entry as unknown as { runtimePlacement?: Record<string, boolean> }).runtimePlacement ? `<dt>Runtime 支援</dt><dd class="mono">${JSON.stringify((entry as unknown as { runtimePlacement: Record<string, boolean> }).runtimePlacement)}</dd>` : ''}
        ${entry.note ? `<dt>備註</dt><dd>${entry.note}</dd>` : ''}
      </dl>
    </div>
  </div>`;
}

export function renderBibleRulePage(ruleId: string): string {
  let rule;
  try {
    rule = ZiWei.Bible.rule(ruleId);
  } catch {
    return `<div class="card card-pad"><h2>查無規則</h2><p class="mono">${ruleId}</p><a href="#/rules">返回規則庫</a></div>`;
  }
  const explanation = ZiWei.Bible.explainRule(ruleId);

  return `
  <div class="bible-detail-page">
    <div style="margin-bottom:14px"><a class="btn sm" href="#/rules">← 返回規則庫</a></div>
    <div class="card card-pad">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <h1 style="margin:0">${t(rule.name)}</h1>
        <span class="badge ${rule.status}">${rule.status}</span>
        <span class="badge canonical">v${rule.ruleVersion}</span>
      </div>
      <p class="mono faint" style="margin:0 0 12px">${rule.ruleId}</p>
      ${rule.description ? `<p style="margin:0 0 14px">${t(rule.description)}</p>` : ''}

      <h3>文獻依據</h3>
      <ul class="clean-list small">
        ${explanation.sources.map(s => `
          <li style="margin-bottom:6px">
            <strong>${s.title}</strong> <span class="badge canonical">Tier ${s.tier}</span> <span class="mono faint">(${s.sourceId})</span>
          </li>`).join('')}
      </ul>

      ${explanation.evidence.filter((e): e is NonNullable<typeof e> => !!e).length ? `
      <h3>證據條目</h3>
      <ul class="clean-list small">
        ${explanation.evidence.filter((e): e is NonNullable<typeof e> => !!e).map(e => `
          <li style="margin-bottom:8px">
            <span class="badge ${e.type === 'conflicts' ? 'deprecated' : 'canonical'}">${e.type}</span>
            <span class="mono faint">${e.evidenceId}</span>
            ${e.quote ? `<blockquote style="margin:4px 0 0;padding-left:8px;border-left:2px solid var(--border)">${e.quote}</blockquote>` : ''}
          </li>`).join('')}
      </ul>` : ''}

      <h3>Rule JSON</h3>
      <pre tabindex="0" class="json">${JSON.stringify(rule, null, 1)}</pre>
    </div>
  </div>`;
}

export function renderBiblePatternPage(patternId: string): string {
  const patterns = ZiWei.Bible.rules().filter(r => r.category === 'pattern' || r.ruleId.startsWith('ZW.PAT.'));
  const pat = patterns.find(p => p.ruleId === patternId);
  if (!pat) {
    return `<div class="card card-pad"><h2>查無格局</h2><p class="mono">${patternId}</p><a href="#/rules">返回規則庫</a></div>`;
  }
  return `
  <div class="bible-detail-page">
    <div style="margin-bottom:14px"><a class="btn sm" href="#/rules">← 返回規則庫</a></div>
    <div class="card card-pad">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <h1 style="margin:0">${t(pat.name)}</h1>
        <span class="badge ${pat.status}">${pat.status}</span>
      </div>
      <p class="mono faint" style="margin:0 0 12px">${pat.ruleId}</p>
      ${pat.description ? `<p style="margin:0 0 14px">${t(pat.description)}</p>` : ''}
      <h3>Rule JSON</h3>
      <pre tabindex="0" class="json">${JSON.stringify(pat, null, 1)}</pre>
    </div>
  </div>`;
}

export function renderBibleProfilePage(profileId: string): string {
  let profile;
  try {
    profile = ZiWei.Profiles.get(profileId);
  } catch {
    return `<div class="card card-pad"><h2>查無 Profile</h2><p class="mono">${profileId}</p><a href="#/rules">返回規則庫</a></div>`;
  }
  const explanation = ZiWei.Profiles.explain(profileId);

  return `
  <div class="bible-detail-page">
    <div style="margin-bottom:14px"><a class="btn sm" href="#/rules">← 返回規則庫</a></div>
    <div class="card card-pad">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <h1 style="margin:0">${t(profile.name)}</h1>
        <span class="badge canonical">${profile.profileId}</span>
      </div>
      ${profile.description ? `<p style="margin:0 0 14px">${t(profile.description)}</p>` : ''}

      <h3>相較 Canonical 的差異</h3>
      ${explanation.diffs.length === 0 ? '<p class="sub small">無規則差異（完全等於 canonical）。</p>' : `
        <ul class="clean-list small">
          ${explanation.diffs.map(d => `
            <li style="margin-bottom:10px">
              <div><strong>${d.dimension}</strong></div>
              <div class="mono faint">canonical: ${d.canonicalRule} → variant: ${d.variantRule}</div>
              ${d.description ? `<div class="sub">${d.description}</div>` : ''}
            </li>`).join('')}
        </ul>`}

      <h3>Policies</h3>
      <pre tabindex="0" class="json">${JSON.stringify(explanation.policies, null, 1)}</pre>
    </div>
  </div>`;
}
