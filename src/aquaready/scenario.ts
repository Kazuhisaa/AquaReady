// Turns src/data/isabelaRisk.json (scripts/fetch-data.mjs) into model inputs per LGU,
// for today's live forecast or for any month of the 2023–24 El Niño replay.
import raw from '../data/isabelaRisk.json';
import { ISABELA_LGUS, type IsabelaLgu } from '../data/isabelaMunicipalities';
import riskModel from '../data/riskModel.json';
import {
  dailyHeat, droughtClass, ensembleDrySpellProb, modelFeatures, predictDrySpell, type PlanInput,
} from '../services/aquaready';

interface MonthObs { ratio: number; ecoZ: number; heat: number }
interface LguData {
  name: string;
  zone: string;
  normals: number[];
  months: Record<string, MonthObs>;
  forecast: { month: string; p20: number; med: number; p80: number }[];
  rain3: { p20: number; med: number; p80: number };
  heatHours: { date: string; t: number[]; rh: number[] }[]; // next 7 days, 11 AM–3 PM
  lastObserved: string;
  members3: number[][]; // each ECMWF member's next-3-month rain ratios
}
interface RiskData {
  generatedAt: string;
  enso: { label: string; issued: string; url: string; level?: number; quote?: string; oni: Record<string, number> };
  projections: Record<string, { dryRainChangePct: number; tmaxChangeC: number; seaLevel2050?: { p17: number; p50: number; p83: number; landSinking: number } }>;
  lgus: LguData[];
  sources: Record<string, string>;
}
export const DATA = raw as RiskData;

export type Mode = { kind: 'live' } | { kind: 'replay'; month: string };

// ECMWF issues a new seasonal forecast monthly; past this the snapshot may be wrong (npm run data refreshes it).
export const STALE_AFTER_DAYS = 35;
export const dataAgeDays = (now = new Date()) => Math.floor((now.getTime() - new Date(DATA.generatedAt).getTime()) / 864e5);

export function addMonths(ym: string, k: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const REPLAY_MONTHS = Array.from({ length: 12 }, (_, i) => addMonths('2023-07', i));

export interface TimelineMonth { month: string; ratio: number; kind: 'observed' | 'forecast' }

export interface Conditions extends Omit<PlanInput, 'members' | 'storage' | 'storedLiters' | 'calibration'> {
  lgu: IsabelaLgu;
  asOf: string; // first forecast month
  timeline: TimelineMonth[];
  oniMonth: string;
  hindsight: boolean; // replay: "forecast" is what actually happened
  rainRatioDry: number; // ensemble 20th percentile, next 3 months (display)
  rainRatioWet: number; // ensemble 80th percentile
  today: Date;
  heatDays: { date: string; hi: number }[]; // live: daily peak heat index, next 7 days; replay: []
}

/** Trained model's P(dry spell in the 3 months after `t`), from data known at the end of month `t`. */
function pModelAt(d: LguData, t: string, oniFallback: number): number {
  const last3 = [addMonths(t, -2), addMonths(t, -1), t].map((k) => d.months[k]?.ratio ?? 1);
  const oni = DATA.enso.oni[addMonths(t, -1)] ?? oniFallback;
  const oni4 = DATA.enso.oni[addMonths(t, -4)] ?? oni;
  return predictDrySpell(riskModel, modelFeatures(oni, oni4, last3, d.months[t]?.ecoZ ?? 0, Number(addMonths(t, 1).slice(5))));
}

const latestOni = () => {
  const k = Object.keys(DATA.enso.oni).sort().at(-1)!;
  return { month: k, value: DATA.enso.oni[k] };
};

export function conditions(name: string, mode: Mode): Conditions {
  const lgu = ISABELA_LGUS.find((l) => l.name === name)!;
  const d = DATA.lgus.find((l) => l.name === name)!;
  const projection2050 = DATA.projections[d.zone];

  if (mode.kind === 'live') {
    const heatDays = dailyHeat(d.heatHours);
    const observedKeys = Object.keys(d.months).sort().slice(-6);
    const oni = latestOni();
    const observed = observedKeys.map((k) => d.months[k].ratio);
    const forecast = d.forecast.map((f) => f.med);
    return {
      lgu, coastal: lgu.coastal, projection2050, hindsight: false, today: new Date(), heatDays,
      asOf: d.forecast[0].month,
      oniMonth: oni.month,
      risk: {
        rainRatio: d.rain3.med, oni: oni.value, ecoZ: d.months[d.lastObserved].ecoZ, heatIndexC: Math.max(...heatDays.map((h) => h.hi)),
        pModel: pModelAt(d, d.lastObserved, oni.value),
        pForecast: ensembleDrySpellProb(observed, d.members3),
      },
      rainRatioDry: d.rain3.p20,
      rainRatioWet: d.rain3.p80,
      observedRatios: observed,
      forecastRatios: forecast,
      timeline: [
        ...observedKeys.map((k) => ({ month: k, ratio: d.months[k].ratio, kind: 'observed' as const })),
        ...d.forecast.map((f) => ({ month: f.month, ratio: f.med, kind: 'forecast' as const })),
      ],
    };
  }

  // Replay: as of the 1st of `month`, only earlier months are observed; the next months are what really happened.
  const t = mode.month;
  const past = Array.from({ length: 6 }, (_, i) => addMonths(t, i - 6));
  const next = Array.from({ length: 6 }, (_, i) => addMonths(t, i)).filter((k) => d.months[k]);
  const next3 = next.slice(0, 3);
  const norm = (k: string) => d.normals[Number(k.slice(5)) - 1];
  const rain3 = next3.reduce((s, k) => s + d.months[k].ratio * norm(k), 0) / next3.reduce((s, k) => s + norm(k), 0);
  const oniMonth = addMonths(t, -1);
  return {
    lgu, coastal: lgu.coastal, projection2050, hindsight: true, heatDays: [], today: new Date(Date.UTC(+t.slice(0, 4), +t.slice(5) - 1, 1)),
    asOf: t,
    oniMonth,
    risk: {
      rainRatio: rain3, oni: DATA.enso.oni[oniMonth] ?? 0, ecoZ: d.months[addMonths(t, -1)].ecoZ, heatIndexC: d.months[t].heat,
      pModel: pModelAt(d, addMonths(t, -1), DATA.enso.oni[oniMonth] ?? 0),
      // No archived ECMWF forecasts for 2023, and using what actually happened would be cheating,
      // so replay scores with the trained AI model alone (it never saw 2013 onward in training).
      pForecast: pModelAt(d, addMonths(t, -1), DATA.enso.oni[oniMonth] ?? 0),
    },
    rainRatioDry: rain3 * 0.8, // ponytail: ±20% stand-in spread [D]; archived SEAS5 hindcasts would give the real one
    rainRatioWet: rain3 * 1.2,
    observedRatios: past.map((k) => d.months[k].ratio),
    forecastRatios: next.map((k) => d.months[k].ratio),
    timeline: [
      ...past.map((k) => ({ month: k, ratio: d.months[k].ratio, kind: 'observed' as const })),
      ...next.map((k) => ({ month: k, ratio: d.months[k].ratio, kind: 'forecast' as const })),
    ],
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (ym: string, withYear = false) =>
  MONTHS[Number(ym.slice(5)) - 1] + (withYear ? ` ${ym.slice(0, 4)}` : '');

// Backtest shown in replay: when would AquaReady have warned, and when did PAGASA's dry-spell mark actually hit?
export function earlyWarning(name: string, score: (c: Conditions) => number) {
  const d = DATA.lgus.find((l) => l.name === name)!;
  const firstAt = (min: number) => REPLAY_MONTHS.find((m) => score(conditions(name, { kind: 'replay', month: m })) >= min) ?? null;
  const drySpell = REPLAY_MONTHS.find((m) => {
    const upTo = Array.from({ length: 6 }, (_, i) => addMonths(m, i - 5)).map((k) => d.months[k].ratio);
    return ['dry_spell', 'drought'].includes(droughtClass(upTo));
  }) ?? null;
  return { firstModerate: firstAt(0.3), firstHigh: firstAt(0.6), drySpell };
}

export const monthsBetween = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5)) - Number(a.slice(5));

