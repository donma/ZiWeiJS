import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import case1990 from '../../fixtures/golden/case-1990-05-15-male.json' with { type: 'json' };
import caseLeap from '../../fixtures/golden/case-lunar-1990-leap5.json' with { type: 'json' };
import case1985 from '../../fixtures/golden/case-1985-11-20-female.json' with { type: 'json' };
import case2000 from '../../fixtures/golden/case-2000-01-01-male.json' with { type: 'json' };
import case1984 from '../../fixtures/golden/case-1984-02-02-female.json' with { type: 'json' };

interface GoldenCase {
  name: string;
  input: ZiWeiBirthInput;
  expect: Record<string, unknown>;
  note?: string;
}

function runCase(gc: GoldenCase): void {
  const chart = calculate(gc.input);
  const exp = gc.expect;

  if (exp.lunar) {
    expect(chart.calendar.lunar).toEqual(exp.lunar);
  }
  if (exp['ganzhi.year']) {
    const gz = `${chart.calendar.ganzhi.year.stem}-${chart.calendar.ganzhi.year.branch}`;
    expect(gz).toBe(exp['ganzhi.year']);
  }
  if (exp.lifePalaceBranch && exp.lifePalaceBranch !== '_computed_') {
    expect(chart.chart.natal.lifePalaceBranch).toBe(exp.lifePalaceBranch);
  }
  if (exp.bodyPalaceBranch) {
    expect(chart.chart.natal.bodyPalaceBranch).toBe(exp.bodyPalaceBranch);
  }
  if (exp.bureau && exp.bureau !== '_computed_') {
    expect(chart.birthContext.bureau).toBe(exp.bureau);
  }
  const stars = exp.stars as Record<string, string> | undefined;
  if (stars) {
    for (const [starId, branch] of Object.entries(stars)) {
      const placement = chart.chart.stars[starId] as unknown as { branch?: string } | undefined;
      expect(placement?.branch, `${gc.name}: ${starId}`).toBe(branch);
    }
  }
  const sihua = exp['sihua.natal'] as Record<string, string> | undefined;
  if (sihua) {
    for (const [type, starId] of Object.entries(sihua)) {
      const tr = chart.chart.transformations.find(t => t.sourceScope === 'natal' && t.type === type);
      expect(tr?.targetStarId, `${gc.name}: sihua ${type}`).toBe(starId);
    }
  }
}

describe('golden charts', () => {
  it(case1990.name, () => runCase(case1990 as GoldenCase));
  it(caseLeap.name, () => runCase(caseLeap as GoldenCase));
  it(case1985.name, () => runCase(case1985 as GoldenCase));
  it(case2000.name, () => runCase(case2000 as GoldenCase));
  it(case1984.name, () => runCase(case1984 as GoldenCase));
});
