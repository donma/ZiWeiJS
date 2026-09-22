import type { ZiWeiChart, Palace, StarPlacement, BranchId, Transformation } from '../core/types.js';
import { STEM_ZH, BRANCH_ZH, PALACE_NAME } from '../core/constants.js';
import { t } from '../core/i18n.js';
import type { Locale } from '../core/types.js';
import { DIGNITY_ZH } from '../dignity-engine/dignity-engine.js';

export interface RenderOptions {
  mode?: 'standard' | 'expert';
  locale?: Locale;
  theme?: 'light' | 'dark';
  cellSize?: number;
  interactive?: boolean;
  showPeriods?: boolean;
  title?: string;
}

const GRID_POS: Record<BranchId, [number, number]> = {
  si: [0, 0], wu: [0, 1], wei: [0, 2], shen: [0, 3],
  chen: [1, 0], you: [1, 3],
  mao: [2, 0], xu: [2, 3],
  yin: [3, 0], chou: [3, 1], zi: [3, 2], hai: [3, 3]
};

const SIHUA_MARK: Record<string, string> = { lu: '祿', quan: '權', ke: '科', ji: '忌' };
const SIHUA_COLOR: Record<string, string> = {
  lu: '#8a6d1f', quan: '#5b3f8c', ke: '#2f6f4f', ji: '#a03030'
};

interface Theme {
  bg: string; panel: string; line: string; lineStrong: string;
  text: string; textSub: string; textFaint: string;
  accent: string; accentSoft: string;
  major: string; aux: string; malefic: string; minor: string;
  life: string; body: string;
}

const LIGHT: Theme = {
  bg: '#faf7f2', panel: '#ffffff', line: '#ddd5c8', lineStrong: '#8a8175',
  text: '#2b2620', textSub: '#6b6156', textFaint: '#a3988a',
  accent: '#4a3f66', accentSoft: '#ece7f4',
  major: '#2b2620', aux: '#41576b', malefic: '#9c3d3d', minor: '#8a8175',
  life: '#4a3f66', body: '#8a6d1f'
};

const DARK: Theme = {
  bg: '#161512', panel: '#201e1a', line: '#3a362f', lineStrong: '#6b6459',
  text: '#e8e2d8', textSub: '#b0a899', textFaint: '#6b6459',
  accent: '#a99bd4', accentSoft: '#2c2740',
  major: '#efe9dd', aux: '#9db6c9', malefic: '#d98a8a', minor: '#8a8175',
  life: '#a99bd4', body: '#d4b96a'
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderChartSvg(chart: ZiWeiChart, options: RenderOptions = {}): string {
  const mode = options.mode ?? 'standard';
  const locale = options.locale ?? 'zh-TW';
  const theme = options.theme === 'dark' ? DARK : LIGHT;
  const cell = options.cellSize ?? 210;
  const expert = mode === 'expert';
  const W = cell * 4;
  const H = cell * 4;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Zi Wei Dou Shu chart" font-family="'Noto Serif TC','Source Han Serif TC','Songti TC','PMingLiU','SimSun',serif">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${theme.bg}"/>`);

  for (const palace of chart.chart.palaces) {
    const [r, c] = GRID_POS[palace.branch];
    parts.push(renderPalace(chart, palace, c * cell, r * cell, cell, theme, expert, locale));
  }

  parts.push(renderCenter(chart, cell, cell, cell * 2, cell * 2, theme, expert, locale, options.title));

  parts.push(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${theme.lineStrong}" stroke-width="1.5"/>`);
  parts.push('</svg>');
  return parts.join('\n');
}

function renderPalace(
  chart: ZiWeiChart, palace: Palace, x: number, y: number, size: number,
  theme: Theme, expert: boolean, locale: Locale
): string {
  const out: string[] = [];
  out.push(`<g class="zw-palace" data-palace="${palace.id}" data-branch="${palace.branch}">`);
  out.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${theme.panel}" stroke="${theme.line}" stroke-width="1"/>`);

  const sihuaByStar = new Map<string, string[]>();
  for (const tr of chart.chart.transformations) {
    if (tr.sourceScope !== 'natal' && tr.sourceScope !== 'year') continue;
    const arr = sihuaByStar.get(tr.targetStarId) ?? [];
    arr.push(tr.type);
    sihuaByStar.set(tr.targetStarId, arr);
  }

  const stars = [...palace.stars];
  const catRank = (s: StarPlacement) =>
    s.star.category === 'major' ? 0 : s.star.category === 'aux' ? 1 : s.star.category === 'malefic' ? 2 : 3;
  stars.sort((a, b) => catRank(a) - catRank(b));

  const topPad = 8;
  const footerReserve = 34;
  const availableH = size - topPad - footerReserve;
  const cols = stars.length > 10 ? 3 : stars.length > 4 ? 2 : 1;
  const rows = Math.ceil(stars.length / cols);
  const maxLineH = expert ? 24 : 27;
  const lineH = Math.min(maxLineH, availableH / Math.max(rows, 1));
  const colW = (size - 14) / cols;

  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sx = x + 7 + col * colW;
    const sy = y + topPad + row * lineH + lineH * 0.72;
    const name = t(s.star.name, locale);
    const isMajor = s.star.category === 'major';
    const isMalefic = s.star.category === 'malefic';
    const color = isMajor ? theme.major : isMalefic ? theme.malefic : s.star.category === 'aux' ? theme.aux : theme.minor;
    const fs = isMajor
      ? Math.min(cols >= 3 ? 17 : 20, lineH * 0.95)
      : s.star.category === 'aux' || isMalefic
        ? Math.min(cols >= 3 ? 13.5 : 15.5, lineH * 0.78)
        : Math.min(cols >= 3 ? 11.5 : 13, lineH * 0.65);
    const fw = isMajor ? 700 : 400;

    out.push(`<g class="zw-star" data-star="${s.starId}" data-rule="${s.ruleId}" tabindex="0" role="button" aria-label="${esc(name)}" cursor="pointer">`);
    out.push(`<rect x="${sx - 3}" y="${sy - lineH * 0.78}" width="${colW - 2}" height="${lineH * 0.95}" rx="3" fill="transparent"/>`);
    out.push(`<text x="${sx}" y="${sy}" font-size="${fs}" font-weight="${fw}" fill="${color}">${esc(name)}</text>`);

    let badgeX = sx + name.length * (fs * 0.95) + 2;
    if (s.dignity && isMajor) {
      out.push(`<text x="${badgeX}" y="${sy}" font-size="${Math.min(10, fs * 0.55)}" fill="${theme.textFaint}">${DIGNITY_ZH[s.dignity]}</text>`);
      badgeX += Math.min(12, fs * 0.68);
    }
    const marks = sihuaByStar.get(s.starId) ?? [];
    for (const m of marks) {
      const mc = SIHUA_COLOR[m] ?? theme.accent;
      const bs = Math.min(13, fs * 0.78);
      out.push(`<rect x="${badgeX - 0.5}" y="${sy - bs + 0.5}" width="${bs + 2}" height="${bs + 2}" rx="2" fill="${mc}"/>`);
      out.push(`<text x="${badgeX + bs / 2 + 0.5}" y="${sy - 0.5}" font-size="${bs * 0.72}" font-weight="700" fill="#fff" text-anchor="middle">${SIHUA_MARK[m] ?? m}</text>`);
      badgeX += bs + 4;
    }
    out.push('</g>');
  }

  const footerY = y + size - 4;
  const meta = [
    palace.changsheng ? (CHANGSHENG_ZH[palace.changsheng] ?? palace.changsheng) : '',
    palace.boshi ? (BOSHI_ZH[palace.boshi] ?? palace.boshi) : '',
    palace.majorPeriod ? `${palace.majorPeriod.fromAge}-${palace.majorPeriod.toAge}` : ''
  ].filter(Boolean).join(' ');
  if (meta) {
    out.push(`<text x="${x + 7}" y="${footerY - 14}" font-size="10.5" fill="${theme.textFaint}">${esc(meta)}</text>`);
  }

  const palaceLabel = t(palace.name, locale);
  const gz = `${STEM_ZH[palace.stem]}${BRANCH_ZH[palace.branch]}`;
  const labelColor = palace.isLifePalace ? theme.life : palace.isBodyPalace ? theme.body : theme.textSub;
  const palaceText = esc(palaceLabel) + (palace.isBodyPalace && !palace.isLifePalace ? '·身' : '');
  out.push(`<text x="${x + size - 8}" y="${footerY - 13}" font-size="12" font-weight="${palace.isLifePalace || palace.isBodyPalace ? 700 : 400}" fill="${labelColor}" text-anchor="end">${palaceText}</text>`);
  out.push(`<text x="${x + size - 8}" y="${footerY - 1}" font-size="10.5" fill="${theme.textSub}" text-anchor="end">${gz}</text>`);

  out.push('</g>');
  return out.join('\n');
}

const CHANGSHENG_ZH: Record<string, string> = {
  changsheng: '長生', muyu: '沐浴', guandai: '冠帶', linguan: '臨官', diwang: '帝旺',
  shuai: '衰', bing: '病', si: '死', mu: '墓', jue: '絕', tai: '胎', yang: '養'
};

const BOSHI_ZH: Record<string, string> = {
  boshi: '博士', lishi: '力士', qinglong: '青龍', xiaohao: '小耗', jiangjun: '將軍',
  zoushu: '奏書', feilian: '飛廉', xishen: '喜神', bingfu: '病符', dahao: '大耗',
  fubing: '伏兵', guanfu: '官府'
};

function renderCenter(
  chart: ZiWeiChart, x: number, y: number, w: number, h: number,
  theme: Theme, expert: boolean, locale: Locale, title?: string
): string {
  const out: string[] = [];
  out.push(`<g class="zw-center">`);
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${theme.bg}" stroke="${theme.lineStrong}" stroke-width="1"/>`);

  const cx = x + w / 2;
  let cy = y + 34;

  const bureau = t(chart.birthContext.bureauName, locale);
  const lunar = chart.calendar.lunar;
  const g = chart.calendar.ganzhi;
  const gz = (p: { stem: keyof typeof STEM_ZH; branch: keyof typeof BRANCH_ZH }) => `${STEM_ZH[p.stem]}${BRANCH_ZH[p.branch]}`;

  out.push(`<text x="${cx}" y="${cy}" font-size="24" font-weight="700" fill="${theme.text}" text-anchor="middle">${esc(title ?? (chart.input.name || '紫微斗數命盤'))}</text>`);
  cy += 30;
  out.push(`<text x="${cx}" y="${cy}" font-size="17" fill="${theme.textSub}" text-anchor="middle">農曆 ${lunar.year}年${lunar.isLeapMonth ? '閏' : ''}${lunar.month}月${lunar.day}日 ${BRANCH_ZH[chart.calendar.hourBranch]}時</text>`);
  cy += 23;
  out.push(`<text x="${cx}" y="${cy}" font-size="17" fill="${theme.textSub}" text-anchor="middle">國曆 ${chart.calendar.solar.year}-${String(chart.calendar.solar.month).padStart(2, '0')}-${String(chart.calendar.solar.day).padStart(2, '0')}</text>`);
  cy += 30;

  const sexLabel = chart.input.sexForCalculation === 'male' ? '乾造(男)' : chart.input.sexForCalculation === 'female' ? '坤造(女)' : '未知';
  out.push(`<text x="${cx}" y="${cy}" font-size="18" font-weight="600" fill="${theme.accent}" text-anchor="middle">${sexLabel} · ${bureau} · ${chart.birthContext.yinYang === 'yang' ? '陽' : '陰'}${chart.input.sexForCalculation === 'female' ? '女' : '男'}</text>`);
  cy += 27;

  out.push(`<text x="${cx}" y="${cy}" font-size="15.5" fill="${theme.textSub}" text-anchor="middle">四柱：${gz(g.year)} / ${gz(g.month)} / ${gz(g.day)} / ${gz(g.hour)}</text>`);
  cy += 23;
  const lifeGz = chart.chart.palaces.find(p => p.isLifePalace);
  const bodyGz = chart.chart.palaces.find(p => p.isBodyPalace);
  out.push(`<text x="${cx}" y="${cy}" font-size="15.5" fill="${theme.textSub}" text-anchor="middle">命宮 ${lifeGz ? STEM_ZH[lifeGz.stem] + BRANCH_ZH[lifeGz.branch] : ''} · 身宮 ${bodyGz ? STEM_ZH[bodyGz.stem] + BRANCH_ZH[bodyGz.branch] : ''}</text>`);
  cy += 26;

  const natalSihua = chart.chart.transformations.filter(tr => tr.sourceScope === 'natal');
  const sihuaStr = natalSihua.map(tr => {
    const placement = chart.chart.stars[tr.targetStarId];
    const starName = placement && 'star' in placement
      ? t((placement as { star: { name: Record<string, string> } }).star.name, locale)
      : tr.targetStarId;
    return `${starName}${SIHUA_MARK[tr.type]}`;
  }).join('　');
  out.push(`<text x="${cx}" y="${cy}" font-size="17" font-weight="600" fill="${theme.text}" text-anchor="middle">${esc(sihuaStr)}</text>`);
  cy += 27;

  const completePatterns = chart.chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced');
  if (completePatterns.length > 0) {
    const patStr = completePatterns.map(p => t(p.name, locale)).join('、');
    out.push(`<text x="${cx}" y="${cy}" font-size="14.5" fill="${theme.accent}" text-anchor="middle">格局：${esc(patStr)}</text>`);
    cy += 22;
  }

  if (chart.periods.year) {
    const yp = chart.periods.year;
    out.push(`<text x="${cx}" y="${cy}" font-size="14" fill="${theme.textFaint}" text-anchor="middle">流年 ${STEM_ZH[yp.stem]}${BRANCH_ZH[yp.branch]}</text>`);
    cy += 20;
  }

  if (expert) {
    out.push(`<text x="${cx}" y="${cy}" font-size="11" fill="${theme.textFaint}" text-anchor="middle">profile: ${chart.generatedWith.profile} · schema ${chart.schemaVersion} · v${chart.generatedWith.bibleVersion}</text>`);
  }

  out.push('</g>');
  return out.join('\n');
}
