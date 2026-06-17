// Shared readiness thresholds (frontend-bryan.md §2): green >90, yellow 80–90,
// red <80. Used by the company bars and KPI tone so the color story is consistent.

export type ReadinessTone = 'ok' | 'warn' | 'danger';

export function readinessTone(pct: number): ReadinessTone {
  if (pct > 90) return 'ok';
  if (pct >= 80) return 'warn';
  return 'danger';
}

export const TONE_HEX: Record<ReadinessTone, string> = {
  ok: '#4ade80',
  warn: '#fbbf24',
  danger: '#f87171',
};

export const TONE_BAR: Record<ReadinessTone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
};

export const TONE_TEXT: Record<ReadinessTone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};
