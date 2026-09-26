import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

describe('Zhongzhou Profile Variants (spec 0.6 §7–§11, §38)', () => {
  // 案例 1: 1984-02-03 23:00 女 (甲子年；命宮在寅；生年支在子)
  // 生年支子為陽支，女為陰性 → 陰男陽女之「陽女」→ 中州派天傷天使對調
  const inputYinFemale: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 1984, month: 2, day: 3 },
    time: { hour: 23 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'female'
  };

  it('命主：canonical 取命宮地支 (寅→祿存)，中州派取生年支 (子→貪狼)', () => {
    const canon = calculate(inputYinFemale, { profile: 'canonical' });
    const zz = calculate(inputYinFemale, { profile: 'school-zhongzhou' });

    expect(canon.chart.natal.lifePalaceBranch).toBe('yin');
    expect(canon.chart.natal.masterStar).toBe('ZW.STAR.AUX.LUCUN');
    expect(zz.chart.natal.masterStar).toBe('ZW.STAR.MAJOR.TANLANG');
  });

  it('身主：兩派一致，皆取生年支 (子→火星)', () => {
    const canon = calculate(inputYinFemale, { profile: 'canonical' });
    const zz = calculate(inputYinFemale, { profile: 'school-zhongzhou' });

    expect(canon.chart.natal.bodyStar).toBe('ZW.STAR.AUX.HUOLING');
    expect(zz.chart.natal.bodyStar).toBe('ZW.STAR.AUX.HUOLING');
  });

  it('天傷天使：陰男陽女在中州派對調 (天傷居疾厄、天使居交友)', () => {
    const canon = calculate(inputYinFemale, { profile: 'canonical' });
    const zz = calculate(inputYinFemale, { profile: 'school-zhongzhou' });

    const canonFriends = canon.chart.palaces.find(p => p.id === 'friends')!;
    const canonHealth = canon.chart.palaces.find(p => p.id === 'health')!;
    expect(canonFriends.stars.some(s => s.starId === 'ZW.STAR.AUX.TIANSHANG')).toBe(true);
    expect(canonHealth.stars.some(s => s.starId === 'ZW.STAR.AUX.TIANSHI')).toBe(true);

    const zzFriends = zz.chart.palaces.find(p => p.id === 'friends')!;
    const zzHealth = zz.chart.palaces.find(p => p.id === 'health')!;
    expect(zzFriends.stars.some(s => s.starId === 'ZW.STAR.AUX.TIANSHI')).toBe(true);
    expect(zzHealth.stars.some(s => s.starId === 'ZW.STAR.AUX.TIANSHANG')).toBe(true);
  });

  it('庚干四化：中州派維持天府化權、天相化科 (已有之 variant)', () => {
    const gengInput: ZiWeiBirthInput = {
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'male'
    };
    const canon = calculate(gengInput, { profile: 'canonical' });
    const zz = calculate(gengInput, { profile: 'school-zhongzhou' });

    const canonQuan = canon.chart.transformations.find(t => t.type === 'quan' && t.sourceScope === 'natal');
    const zzQuan = zz.chart.transformations.find(t => t.type === 'quan' && t.sourceScope === 'natal');
    expect(canonQuan?.targetStarId).toBe('ZW.STAR.MAJOR.WUQU');
    expect(zzQuan?.targetStarId).toBe('ZW.STAR.MAJOR.TIANFU');
  });
});
