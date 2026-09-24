import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * External Capability Report（spec Post-Stability §5 / §40）
 *
 * 驗證報告只陳述可查證事實：license / commit 必須與各專案 snapshot 一致，
 * 且 copyleft / 授權不明者必須被標出使用界線（不得複製程式碼）。
 */
describe('external capability report', () => {
  const report = JSON.parse(readFileSync('research/assimilation/external-capability-report.json', 'utf8'));

  it('涵蓋所有含 snapshot 的外部專案', () => {
    expect(report.totalProjects).toBe(6);
    expect(report.projects.length).toBe(6);
  });

  it('每個專案的 license 與 commit 皆可回查 snapshot', () => {
    for (const p of report.projects) {
      const snap = JSON.parse(readFileSync(`research/assimilation/${p.project}/snapshot.json`, 'utf8'));
      expect(p.license).toBe(snap.license ?? 'UNKNOWN');
      expect(p.commit).toBe(snap.commit ?? null);
      expect(p.areasUsed).toEqual([...snap.areasUsed].sort());
    }
  });

  it('copyleft（GPL-3.0）與授權不明者皆有明確使用界線', () => {
    const chart = report.projects.find((p: { project: string }) => p.project === 'ziwei-chart');
    const simple = report.projects.find((p: { project: string }) => p.project === 'ziwei-doushu-simple');
    expect(chart.license).toBe('GPL-3.0');
    expect(chart.licenseBoundary).toContain('不得複製');
    expect(simple.license).toBe('UNKNOWN');
    expect(simple.licenseBoundary).toContain('不得引用');
  });

  it('報告自我聲明不構成規則或 Evidence', () => {
    expect(report.note).toContain('不構成規則');
    expect(report.generatedBy).toBe('tools/assimilation/external-capability-report.ts');
  });
});
