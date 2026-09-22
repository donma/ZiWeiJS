import { state } from '../app/state.js';
import { t } from '../../src/index.js';
import { DIGNITY_ZH } from '../../src/index.js';

const CAT_LABEL: Record<string, string> = {
  major: '十四主星',
  aux: '輔星',
  malefic: '煞星',
  minor: '雜曜',
  period: '歲建諸星',
  interim: '將前諸星'
};

const SIHUA_LABEL: Record<string, string> = { lu: '化祿', quan: '化權', ke: '化科', ji: '化忌' };

function starTooltipHtml(starId: string): string | null {
  const chart = state.chart;
  if (!chart) return null;
  const placement = chart.chart.stars[starId] as unknown as { star: { name: Record<string,string>; category: string; shortDesc?: Record<string,string> }; palaceId: string; dignity?: string; ruleId?: string } | undefined;
  if (!placement || !placement.star) return null;
  const star = placement.star;
  const name = t(star.name);
  const palace = chart.chart.palaces.find(p => p.id === placement.palaceId);
  const sihua = chart.chart.transformations
    .filter(tr => tr.targetStarId === starId && tr.sourceScope === 'natal')
    .map(tr => SIHUA_LABEL[tr.type]);
  const lines: string[] = [];
  lines.push(`<div class="tt-title">${name}</div>`);
  lines.push(`<div class="tt-line">${CAT_LABEL[star.category] ?? star.category}之一</div>`);
  if (star.shortDesc) lines.push(`<div class="tt-line">${t(star.shortDesc)}</div>`);
  if (palace) lines.push(`<div class="tt-line">位置：${t(palace.name)}（${palace.branch}）</div>`);
  if (placement.dignity) lines.push(`<div class="tt-line">廟旺：${DIGNITY_ZH[placement.dignity as keyof typeof DIGNITY_ZH]}</div>`);
  if (sihua.length) lines.push(`<div class="tt-line">四化：${sihua.join('、')}</div>`);
  if (state.mode === 'expert' && placement.ruleId) lines.push(`<div class="tt-line mono">${placement.ruleId}</div>`);
  lines.push(`<div class="tt-line faint" style="margin-top:4px">點擊查看詳情 →</div>`);
  return lines.join('');
}

export function initTooltip(): void {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  const show = (el: Element, x: number, y: number) => {
    const starId = (el as HTMLElement).dataset.star;
    if (!starId) return;
    const html = starTooltipHtml(starId);
    if (!html) return;
    tooltip.innerHTML = html;
    tooltip.classList.add('show');
    const rect = tooltip.getBoundingClientRect();
    let tx = x + 14;
    let ty = y + 14;
    if (tx + rect.width > innerWidth - 8) tx = x - rect.width - 14;
    if (ty + rect.height > innerHeight - 8) ty = y - rect.height - 14;
    tooltip.style.left = `${tx}px`;
    tooltip.style.top = `${ty}px`;
  };

  const hide = () => tooltip.classList.remove('show');

  document.querySelectorAll('.zw-star').forEach(el => {
    el.addEventListener('mouseenter', e => {
      show(el, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
    });
    el.addEventListener('mousemove', e => {
      if (tooltip.classList.contains('show')) {
        show(el, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
      }
    });
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', () => {
      const r = (el as Element).getBoundingClientRect();
      show(el, r.left + r.width / 2, r.bottom);
    });
    el.addEventListener('blur', hide);
    el.addEventListener('click', e => {
      e.stopPropagation();
      const starId = (el as HTMLElement).dataset.star!;
      openStarDetail(starId);
    });
  });
}

function openStarDetail(starId: string): void {
  const isMobile = matchMedia('(max-width: 800px)').matches;
  const html = starDetailHtml(starId);
  if (isMobile) {
    const sheet = document.getElementById('bottom-sheet')!;
    document.getElementById('sheet-content')!.innerHTML = html;
    document.getElementById('sheet-backdrop')!.classList.add('show');
    sheet.classList.add('show');
  } else {
    const drawer = document.getElementById('drawer')!;
    document.getElementById('drawer-content')!.innerHTML = html;
    document.getElementById('sheet-backdrop')!.classList.add('show');
    drawer.classList.add('show');
  }
}

function starDetailHtml(starId: string): string {
  const chart = state.chart;
  if (!chart) return '';
  const placement = chart.chart.stars[starId] as unknown as {
    star: { name: Record<string,string>; category: string; shortDesc?: Record<string,string>; tags?: string[] };
    palaceId: string; dignity?: string; ruleId?: string; branch: string; certainty?: string;
  } | undefined;
  if (!placement) return `<p>找不到星曜 ${starId}</p>`;
  const star = placement.star;
  const palace = chart.chart.palaces.find(p => p.id === placement.palaceId);
  const sihua = chart.chart.transformations.filter(tr => tr.targetStarId === starId);
  const sfsz = palace ? [palace.branch] : [];

  return `
    <div style="display:flex;justify-content:space-between;align-items:start">
      <h2 class="serif">${t(star.name)}</h2>
      <button class="icon-btn" onclick="document.getElementById('sheet-backdrop').classList.remove('show');document.getElementById('bottom-sheet').classList.remove('show');document.getElementById('drawer').classList.remove('show')">✕</button>
    </div>
    <p class="sub">${star.shortDesc ? t(star.shortDesc) : ''}</p>
    <dl class="kv">
      <dt>類別</dt><dd>${CAT_LABEL[star.category] ?? star.category}</dd>
      <dt>所在宮位</dt><dd>${palace ? t(palace.name) : ''}（${placement.branch}）</dd>
      ${placement.dignity ? `<dt>廟旺</dt><dd>${DIGNITY_ZH[placement.dignity as keyof typeof DIGNITY_ZH]}</dd>` : ''}
      <dt>確定度</dt><dd>${placement.certainty ?? 'high'}</dd>
      ${placement.ruleId ? `<dt>安星規則</dt><dd class="mono small">${placement.ruleId}</dd>` : ''}
    </dl>
    ${sihua.length ? `<h3>四化</h3><ul>${sihua.map(tr => `<li>${SIHUA_LABEL[tr.type]} · 來源 ${tr.sourceScope} · 干 ${tr.sourceStem}${tr.selfTransformation ? ' · 自化' : ''}</li>`).join('')}</ul>` : ''}
    ${star.tags?.length ? `<p class="small faint">tags: ${star.tags.join(', ')}</p>` : ''}
  `;
}
