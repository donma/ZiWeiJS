import type { EngineContext } from './context.js';
import type { ExecutorOutcome } from '../rule-engine/executor-registry.js';
import { isYangStem } from '../core/constants.js';
import { ZiWeiError } from '../core/errors.js';

/**
 * 性別必要欄位（工程契約類規則）。
 * 未提供 sexForCalculation 時報 UNKNOWN_SEX_FOR_CALCULATION，不得偷偷預設。
 */
export function requireSex(ctx: EngineContext): ExecutorOutcome {
  if (!ctx.input.sexForCalculation) {
    throw new ZiWeiError(
      'UNKNOWN_SEX_FOR_CALCULATION',
      'sexForCalculation is required for deterministic calculation'
    );
  }
  return {
    inputs: { sexForCalculation: ctx.input.sexForCalculation },
    result: ctx.input.sexForCalculation
  };
}

/**
 * 陰陽順逆：陽男陰女順行、陰男陽女逆行。
 * 性別 unknown 時無從判定，回傳 undetermined（不猜，spec §27）。
 */
export function calcDirection(ctx: EngineContext): ExecutorOutcome {
  const yangStem = isYangStem(ctx.normalized.ganzhi.year.stem);
  const sex = ctx.input.sexForCalculation;

  if (sex === 'unknown') {
    ctx.direction = 'undetermined';
    return {
      inputs: { yearStem: ctx.normalized.ganzhi.year.stem, yinYang: yangStem ? 'yang' : 'yin', sex },
      result: 'undetermined',
      status: 'unavailable',
      reason: 'UNKNOWN_SEX_FOR_CALCULATION'
    };
  }

  const male = sex === 'male';
  const female = sex === 'female';
  ctx.direction = ((yangStem && male) || (!yangStem && female)) ? 'forward' : 'backward';
  return {
    inputs: { yearStem: ctx.normalized.ganzhi.year.stem, yinYang: yangStem ? 'yang' : 'yin', sex },
    result: ctx.direction
  };
}
