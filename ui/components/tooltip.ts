import { state } from '../app/state.js';
import { t } from '../../src/index.js';
import { DIGNITY_ZH } from '../../src/index.js';
import { starDetailHtml } from './star-detail.js';

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

export function openStarDetail(starId: string): void {
  const isMobile = matchMedia('(max-width: 800px)').matches;
  const html = starDetailHtml(starId);
  const target = isMobile
    ? document.getElementById('sheet-content')!
    : document.getElementById('drawer-content')!;
  target.innerHTML = html;
  document.getElementById('sheet-backdrop')!.classList.add('show');
  if (isMobile) document.getElementById('bottom-sheet')!.classList.add('show');
  else document.getElementById('drawer')!.classList.add('show');

  target.querySelectorAll('[data-close-panel]').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('bottom-sheet')?.classList.remove('show');
      document.getElementById('drawer')?.classList.remove('show');
      document.getElementById('sheet-backdrop')?.classList.remove('show');
    });
  });
}

