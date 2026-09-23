
import { calculate } from './src/reference-engine/engine.ts';
const input = {"calendarType":"solar","date":{"year":1993,"month":7,"day":7},"time":{"hour":14,"minute":0},"timezone":"Asia/Taipei","sexForCalculation":"female"};
const c = calculate(input);
const out = {
  lifePalaceBranch: c.chart.natal.lifePalaceBranch,
  bodyPalaceBranch: c.chart.natal.bodyPalaceBranch,
  bureau: c.birthContext.bureau,
  direction: c.birthContext.direction,
  lunar: c.calendar.lunar,
  ganzhiYear: c.calendar.ganzhi.year.stem + '-' + c.calendar.ganzhi.year.branch,
  stars: Object.fromEntries(Object.entries(c.chart.stars).map(([k, v]) => [k, v.branch])),
  sihua: Object.fromEntries(c.chart.transformations.filter(t => t.sourceScope === 'natal').map(t => [t.type, t.targetStarId])),
  patterns: c.chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced').map(p => p.patternId)
};
console.log(JSON.stringify(out));
