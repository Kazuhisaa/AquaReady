// Spec §6.D notifications, derived from current state so they survive reloads:
// advisory (risk elevated), pacing reminder (3 days since last top-up), post-event check-in prompt.
import type { Severity } from '../services/aquaready';

export type AlertKind = 'advisory' | 'pacing' | 'checkin' | 'heat';
export interface Alert { id: string; kind: AlertKind; at: string; value?: number }

export interface AlertState {
  severity: Severity;
  litersEvery3Days: number;
  dataDate: string; // when the forecast was pulled
  lastAddedAt?: string; // last time stored water went up
  alertSeverity?: Severity; // highest risk seen since the last check-in; cleared by a check-in
  heatDays?: { date: string; hi: number }[]; // next 7 days' peak heat index (live only)
}

const DAY = 864e5;

export function computeAlerts(s: AlertState, now = new Date()): Alert[] {
  const out: Alert[] = [];
  if (s.severity !== 'low') out.push({ id: `advisory-${s.severity}-${s.dataDate.slice(0, 10)}`, kind: 'advisory', at: s.dataDate });

  if (s.severity !== 'low' && s.litersEvery3Days > 0) {
    const last = s.lastAddedAt ? new Date(s.lastAddedAt).getTime() : null;
    if (last === null || now.getTime() - last >= 3 * DAY) {
      const due = last === null ? now : new Date(last + 3 * DAY);
      out.push({ id: `pacing-${due.toISOString().slice(0, 10)}`, kind: 'pacing', at: due.toISOString() });
    }
  }

  // Dangerous heat (PAGASA "Danger", heat index ≥ 42 °C) on any day this week: one alert, on the first such day
  const hot = (s.heatDays ?? []).filter((d) => d.hi >= 42);
  if (hot.length) {
    const peak = Math.max(...hot.map((d) => d.hi));
    out.push({ id: `heat-${hot[0].date}`, kind: 'heat', at: `${hot[0].date}T00:00:00`, value: Math.round(peak) });
  }

  // Post-event: risk was elevated, is back to low, and the family hasn't checked in since.
  if (s.severity === 'low' && s.alertSeverity && s.alertSeverity !== 'low') {
    out.push({ id: `checkin-${s.dataDate.slice(0, 10)}`, kind: 'checkin', at: s.dataDate });
  }
  return out;
}
