import '../styles/base.css';
import { state, recalc, navigate, currentRoute } from './state.js';
import { renderHome } from '../pages/home.js';
import { renderChartPage } from '../pages/chart.js';
import { renderRules } from '../pages/rules.js';
import { renderSources } from '../pages/sources.js';
import { renderGeek } from '../pages/geek.js';
import { renderDifferential } from '../pages/differential.js';
import { renderAbout } from '../pages/about.js';
import { initTooltip } from '../components/tooltip.js';
import { initSheet } from '../components/sheet.js';

const NAV: Array<[string, string]> = [
  ['/', '首頁'],
  ['/chart', '命盤'],
  ['/expert', 'Expert'],
  ['/rules', '規則庫'],
  ['/sources', '文獻來源'],
  ['/differential', '差異測試'],
  ['/geek', 'Geek'],
  ['/about', '關於']
];

function shell(content: string): string {
  const route = currentRoute();
  const nav = NAV.map(([r, label]) => {
    const active = route === r || (r === '/expert' && route === '/expert');
    return `<a href="#${r}" class="${active ? 'active' : ''}">${label}</a>`;
  }).join('');
  return `
    <header class="topbar">
      <div class="container topbar-inner">
        <a class="brand" href="#/"><span class="mark">紫</span>ZiWeiJS</a>
        <nav class="nav">${nav}</nav>
        <button class="icon-btn" id="theme-toggle" aria-label="切換主題">${state.theme === 'light' ? '◐' : '◑'}</button>
      </div>
    </header>
    <main><div class="container">${content}</div></main>
    <footer class="footer"><div class="container">
      ZiWeiJS v${state.chart?.generatedWith.bibleVersion ?? '0.1.0'} · schema ${state.chart?.schemaVersion ?? '1.0'} ·
      Machine-readable Zi Wei Dou Shu reference · Local-only · <a href="#/about">License</a>
    </div></footer>
    <div class="tooltip" id="tooltip" role="tooltip"></div>
    <div class="sheet-backdrop" id="sheet-backdrop"></div>
    <div class="bottom-sheet" id="bottom-sheet" role="dialog" aria-modal="true"><div class="grabber"></div><div id="sheet-content"></div></div>
    <div class="drawer" id="drawer" role="dialog" aria-modal="true"><div id="drawer-content"></div></div>
  `;
}

function route(): void {
  const r = currentRoute();
  state.route = r;
  let content = '';
  switch (r) {
    case '/chart':
    case '/expert':
      if (!state.chart && !state.error) recalc();
      content = renderChartPage(r === '/expert' ? 'expert' : state.mode);
      break;
    case '/rules': content = renderRules(); break;
    case '/sources': content = renderSources(); break;
    case '/geek': content = renderGeek(); break;
    case '/differential': content = renderDifferential(); break;
    case '/about': content = renderAbout(); break;
    default: content = renderHome(); break;
  }
  document.getElementById('app')!.innerHTML = shell(content);
  afterRender();
}

function afterRender(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = state.theme === 'dark' ? 'dark' : '';
    route();
  });
  initTooltip();
  initSheet();
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate((el as HTMLElement).dataset.nav!);
    });
  });
  document.querySelectorAll('form[data-form]').forEach(f => {
    f.addEventListener('submit', e => {
      e.preventDefault();
      handleForm(f as HTMLFormElement);
    });
  });
  document.querySelectorAll('[data-mode]').forEach(el => {
    el.addEventListener('click', () => {
      state.mode = (el as HTMLElement).dataset.mode as 'standard' | 'expert';
      route();
    });
  });
  document.querySelectorAll('[data-chart-action]').forEach(el => {
    el.addEventListener('click', () => handleChartAction((el as HTMLElement).dataset.chartAction!));
  });
}

function handleForm(form: HTMLFormElement): void {
  const kind = form.dataset.form;
  const fd = new FormData(form);
  if (kind === 'birth') {
    const calType = fd.get('calendarType') as 'solar' | 'lunar';
    const hourRaw = fd.get('hour') as string;
    const minuteRaw = fd.get('minute') as string;
    state.input = {
      calendarType: calType,
      date: {
        year: Number(fd.get('year')),
        month: Number(fd.get('month')),
        day: Number(fd.get('day')),
        isLeapMonth: fd.get('isLeapMonth') === 'on'
      },
      time: hourRaw === '' ? undefined : { hour: Number(hourRaw), minute: Number(minuteRaw || 0) },
      timezone: (fd.get('timezone') as string) || 'Asia/Taipei',
      sexForCalculation: (fd.get('sex') as 'male' | 'female') || undefined,
      location: (fd.get('longitude') as string)
        ? { longitude: Number(fd.get('longitude')), latitude: Number(fd.get('latitude') || 0) }
        : undefined,
      name: (fd.get('name') as string) || undefined
    };
    state.profile = (fd.get('profile') as string) || 'canonical';
    recalc();
    if (state.chart) navigate('/chart');
    else route();
  }
}

function handleChartAction(action: string): void {
  if (!state.chart) return;
  if (action === 'export-svg') {
    const svg = document.querySelector('.chart-wrap svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ziwei-chart.svg';
    a.click();
  } else if (action === 'export-json') {
    const blob = new Blob([JSON.stringify(state.chart, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ziwei-chart.json';
    a.click();
  } else if (action === 'export-png') {
    const svg = document.querySelector('.chart-wrap svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2; canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = state.theme === 'dark' ? '#161512' : '#faf7f2';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'ziwei-chart.png';
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  } else if (action === 'print') {
    window.print();
  }
}

window.addEventListener('hashchange', route);
document.documentElement.dataset.theme = '';
route();
