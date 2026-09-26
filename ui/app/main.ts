import '../styles/base.css';
import { state, recalc, navigate, currentRoute, setAppLocale } from './state.js';
import { renderHome } from '../pages/home.js';
import { renderChartPage, bindChartInteractions } from '../pages/chart.js';
import { renderUnknownTimePage, bindUnknownTimeInteractions } from '../pages/unknown-time.js';
import {
  renderBibleStarPage, renderBibleRulePage, renderBiblePatternPage, renderBibleProfilePage
} from '../pages/bible-detail.js';
import { renderRules, bindRuleExplorer } from '../pages/rules.js';
import { renderSources } from '../pages/sources.js';
import { renderGeek } from '../pages/geek.js';
import { renderDifferential } from '../pages/differential.js';
import { renderAbout } from '../pages/about.js';
import { birthFormHtml, bindBirthFormInteractions } from '../components/birth-form.js';
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
        <select class="icon-btn" id="locale-select" aria-label="語系" style="min-height:32px;padding:3px 6px">
          <option value="zh-TW" ${state.locale === 'zh-TW' ? 'selected' : ''}>繁中</option>
          <option value="zh-CN" ${state.locale === 'zh-CN' ? 'selected' : ''}>简中</option>
          <option value="en" ${state.locale === 'en' ? 'selected' : ''}>EN</option>
        </select>
        <button class="icon-btn" id="theme-toggle" aria-label="切換主題">${state.theme === 'light' ? '◐' : '◑'}</button>
      </div>
    </header>
    <main><div class="container">${content}</div></main>
    <footer class="footer"><div class="container">
      ZiWeiJS v${state.chart?.generatedWith.bibleVersion ?? '0.71.0'} · schema ${state.chart?.schemaVersion ?? '2.0'} ·
      Machine-readable Zi Wei Dou Shu reference · Local-only · <a href="#/about">License</a>
    </div></footer>
    <div class="tooltip" id="tooltip" role="tooltip" aria-hidden="true"></div>
    <div class="sheet-backdrop" id="sheet-backdrop"></div>
    <div class="bottom-sheet" id="bottom-sheet" role="dialog" aria-modal="true"><div class="grabber"></div><div id="sheet-content"></div></div>
    <div class="drawer" id="drawer" role="dialog" aria-modal="true"><div id="drawer-content"></div></div>
  `;
}

function route(): void {
  const r = currentRoute();
  state.route = r;
  let content = '';

  // Bible deep-link routes（spec 0.71 §39）
  if (r.startsWith('/bible/')) {
    const [, , kind, id] = r.split('/');
    switch (kind) {
      case 'star': content = renderBibleStarPage(decodeURIComponent(id ?? '')); break;
      case 'rule': content = renderBibleRulePage(decodeURIComponent(id ?? '')); break;
      case 'pattern': content = renderBiblePatternPage(decodeURIComponent(id ?? '')); break;
      case 'profile': content = renderBibleProfilePage(decodeURIComponent(id ?? '')); break;
      default: content = renderHome(); break;
    }
  } else {
    switch (r) {
      case '/chart':
      case '/expert':
        if (!state.chart && !state.error) recalc();
        content = renderChartPage(r === '/expert' ? 'expert' : state.mode);
        break;
      case '/unknown-time':
        content = renderUnknownTimePage();
        break;
      case '/rules': content = renderRules(); break;
      case '/sources': content = renderSources(); break;
      case '/geek': content = renderGeek(); break;
      case '/differential': content = renderDifferential(); break;
      case '/about': content = renderAbout(); break;
      default: content = renderHome(); break;
    }
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
  const localeSel = document.getElementById('locale-select') as HTMLSelectElement | null;
  localeSel?.addEventListener('change', () => {
    setAppLocale(localeSel.value as 'zh-TW' | 'zh-CN' | 'en');
    route();
  });
  initTooltip();
  initSheet();
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate((el as HTMLElement).dataset.nav!);
      // file:// 下 navigate() 用 replaceState，不觸發 hashchange → 需主動 route()
      route();
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

  // 出生表單互動（0.71 §16：segmented control + 12 時辰卡）
  bindBirthFormInteractions();
  // 命盤 Workspace 互動（0.71 §24–§30）
  bindChartInteractions();
  // 未知時辰工作區互動（0.71 §17–§22）
  bindUnknownTimeInteractions();

  if (currentRoute() === '/rules') bindRuleExplorer();
}

function handleForm(form: HTMLFormElement): void {
  const kind = form.dataset.form;
  const fd = new FormData(form);
  if (kind !== 'birth') return;

  const calType = fd.get('calendarType') as 'solar' | 'lunar';
  const precision = (fd.get('timePrecision') as string) || 'exact';
  const hourRaw = fd.get('hour') as string;
  const minuteRaw = fd.get('minute') as string;
  const hourBranchRaw = (fd.get('hourBranch') as string) || '';
  const rangeFrom = fd.get('rangeFrom') as string;
  const rangeTo = fd.get('rangeTo') as string;

  const base: typeof state.input = {
    calendarType: calType,
    date: {
      year: Number(fd.get('year')),
      month: Number(fd.get('month')),
      day: Number(fd.get('day')),
      isLeapMonth: fd.get('isLeapMonth') === 'on'
    },
    timezone: (fd.get('timezone') as string) || 'Asia/Taipei',
    sexForCalculation: (fd.get('sex') as 'male' | 'female') || undefined,
    name: (fd.get('name') as string) || undefined
  };

  const longitude = fd.get('longitude') as string;
  if (longitude) {
    base.location = {
      longitude: Number(longitude),
      latitude: Number(fd.get('latitude') || 0),
      placeName: (fd.get('placeName') as string) || undefined
    };
  }

  // 依 precision 填入對應欄位（0.71 §2）
  if (precision === 'exact') {
    base.time = {
      hour: hourRaw === '' ? undefined : Number(hourRaw),
      minute: Number(minuteRaw || 0)
    };
    base.timePrecision = 'exact';
  } else if (precision === 'hour-branch') {
    base.timePrecision = 'hour-branch';
    base.hourBranch = (hourBranchRaw || 'zi') as typeof base.hourBranch;
  } else if (precision === 'range') {
    base.timePrecision = 'range';
    base.timeRange = {
      fromHour: Number(rangeFrom || 9),
      toHour: Number(rangeTo || 17)
    };
  } else {
    base.timePrecision = 'unknown';
  }

  state.input = base;
  state.profile = (fd.get('profile') as string) || 'canonical';
  const targetYearRaw = (fd.get('targetYear') as string) ?? '';
  const targetYear = targetYearRaw.trim() === '' ? null : Number(targetYearRaw);
  state.targetYear = targetYear !== null && Number.isInteger(targetYear) && targetYear >= 1900 && targetYear <= 2100
    ? targetYear
    : null;

  // 未知時辰 → Unknown Time Workspace（spec 0.71 §17）
  if (precision === 'unknown') {
    state.chart = null;
    state.error = null;
    navigate('/unknown-time');
    route();
    return;
  }

  recalc();
  if (state.chart) {
    navigate('/chart');
    // 若原本就在 /chart，hash 不變 → 不觸發 hashchange → 必須主動 route() 才會更新
    route();
  } else {
    route();
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
