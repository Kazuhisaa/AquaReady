// Trains Wave's dry-spell early-warning model: logistic regression on 30+ years of Isabela data.
// Run after `npm run data`:  npm run train   → writes src/data/riskModel.json
//
// Question: at the end of month t, will this town reach a PAGASA dry spell in months t+1..t+3?
// Features use only what is known at the end of month t (no future rain):
//   ONI (3-month season centred on t-1, the latest NOAA has published), mean rain vs normal over t-2..t,
//   root-zone soil moisture z-score at t, and the season (sin/cos of the first target month).
// Train 1991–2012; test on unseen years 2013–2020 and 2023–2026 (incl. the 2015–16 and 2023–24 El Niños).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { droughtClass } from '../src/services/aquaready';

net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

type Months = Record<string, { ratio: number; soilZ: number }>;
const addMonths = (ym: string, k: number) => {
  const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5) - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

// ---------- data ----------
const cells = new Map<string, { town: string; months: Months }>(); // towns in one 0.5° cell share a series: keep one
for (const f of readdirSync('.cache/history').sort()) {
  const h = JSON.parse(readFileSync(`.cache/history/${f}`, 'utf8'));
  if (!cells.has(h.cell)) cells.set(h.cell, { town: f.replace('.json', ''), months: h.months });
}

async function loadOni(): Promise<Record<string, number>> {
  const txt = await (await fetch('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt')).text();
  const seasons = ['DJF', 'JFM', 'FMA', 'MAM', 'AMJ', 'MJJ', 'JJA', 'JAS', 'ASO', 'SON', 'OND', 'NDJ'];
  const out: Record<string, number> = {};
  for (const line of txt.trim().split('\n').slice(1)) {
    const [s, y, , a] = line.trim().split(/\s+/);
    out[`${y}-${String(seasons.indexOf(s) + 1).padStart(2, '0')}`] = Number(a);
  }
  return out;
}

const ALL = ['oni', 'rainPast3', 'soilZ', 'seasonSin', 'seasonCos', 'oniTrend', 'rainLast'] as const;
// Candidate models, chosen by validation on 2005–2012 only; the test years are scored once, at the end.
const CANDIDATES: { name: string; use: (typeof ALL)[number][]; l2: number }[] = [
  { name: 'base', use: ['oni', 'rainPast3', 'soilZ', 'seasonSin', 'seasonCos'], l2: 1e-3 },
  { name: 'base, strong L2', use: ['oni', 'rainPast3', 'soilZ', 'seasonSin', 'seasonCos'], l2: 0.3 },
  { name: 'no soil', use: ['oni', 'rainPast3', 'seasonSin', 'seasonCos'], l2: 1e-3 },
  { name: '+ ONI trend, last month', use: ['oni', 'rainPast3', 'soilZ', 'seasonSin', 'seasonCos', 'oniTrend', 'rainLast'], l2: 1e-3 },
  { name: '+ ONI trend, last month, strong L2', use: ['oni', 'rainPast3', 'soilZ', 'seasonSin', 'seasonCos', 'oniTrend', 'rainLast'], l2: 0.3 },
];

function features(months: Months, oni: Record<string, number>, t: string): number[] | null {
  const past = [addMonths(t, -2), addMonths(t, -1), t].map((k) => months[k]?.ratio);
  const o = oni[addMonths(t, -1)];
  if (past.some((r) => r === undefined) || o === undefined || !months[t]) return null;
  const o4 = oni[addMonths(t, -4)];
  if (o4 === undefined) return null;
  const m = +addMonths(t, 1).slice(5) - 1;
  // Order must match ALL
  return [o, past.reduce((a, b) => a + b!, 0) / 3, months[t].soilZ, Math.sin((2 * Math.PI * m) / 12), Math.cos((2 * Math.PI * m) / 12), o - o4, past[2]!];
}

function label(months: Months, t: string): number | null {
  const series: number[] = [];
  for (let k = -11; k <= 3; k++) {
    const r = months[addMonths(t, k)]?.ratio;
    if (r === undefined) { if (k > 0) return null; series.length = 0; continue; } // need t+1..t+3; history may start later
    series.push(r);
  }
  // Dry spell (or worse) reached at any of t+1..t+3
  for (let k = 3; k >= 1; k--) {
    const upTo = series.slice(0, series.length - (3 - k));
    if (['dry_spell', 'drought'].includes(droughtClass(upTo))) return 1;
  }
  return 0;
}

// ---------- model ----------
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function fit(X: number[][], y: number[], l2 = 1e-3, iters = 4000, lr = 0.2) {
  const d = X[0].length;
  const mean = Array.from({ length: d }, (_, j) => X.reduce((s, x) => s + x[j], 0) / X.length);
  const std = Array.from({ length: d }, (_, j) => Math.sqrt(X.reduce((s, x) => s + (x[j] - mean[j]) ** 2, 0) / X.length) || 1);
  const Z = X.map((x) => x.map((v, j) => (v - mean[j]) / std[j]));
  let w = Array.from({ length: d }, () => 0);
  let b = 0;
  for (let it = 0; it < iters; it++) {
    const gw = Array.from({ length: d }, () => 0);
    let gb = 0;
    Z.forEach((z, i) => {
      const e = sigmoid(b + z.reduce((s, v, j) => s + v * w[j], 0)) - y[i];
      gb += e;
      z.forEach((v, j) => { gw[j] += e * v; });
    });
    w = w.map((wj, j) => wj - lr * (gw[j] / Z.length + l2 * wj));
    b -= lr * (gb / Z.length);
  }
  return { mean, std, coef: w, intercept: b };
}
type Model = ReturnType<typeof fit>;
const predict = (m: Model, x: number[]) => sigmoid(m.intercept + x.reduce((s, v, j) => s + ((v - m.mean[j]) / m.std[j]) * m.coef[j], 0));

function auc(p: number[], y: number[]) {
  const pos = p.filter((_, i) => y[i] === 1);
  const neg = p.filter((_, i) => y[i] === 0);
  let s = 0;
  for (const a of pos) for (const b of neg) s += a > b ? 1 : a === b ? 0.5 : 0;
  return s / (pos.length * neg.length);
}
const brier = (p: number[], y: number[]) => p.reduce((s, v, i) => s + (v - y[i]) ** 2, 0) / p.length;

// ---------- run ----------
let oni: Record<string, number> = {};
let FEATURES: string[] = [];
async function main() {
oni = await loadOni();
const rows: { cell: string; town: string; t: string; x: number[]; y: number }[] = [];
for (const [cell, { town, months }] of cells) {
  for (const t of Object.keys(months).sort()) {
    const x = features(months, oni, t);
    const y = label(months, t);
    if (x && y !== null) rows.push({ cell, town, t, x, y });
  }
}
const isTrain = (t: string) => t <= '2012-12';
const train = rows.filter((r) => isTrain(r.t));
const test = rows.filter((r) => !isTrain(r.t));
const sel = (x: number[], use: string[]) => use.map((f) => x[ALL.indexOf(f as (typeof ALL)[number])]);

// Model selection on 1991–2004 → 2005–2012
const fitRows = train.filter((r) => r.t <= '2004-12');
const valRows = train.filter((r) => r.t > '2004-12');
const valBase = fitRows.reduce((s, r) => s + r.y, 0) / fitRows.length;
const validation = CANDIDATES.map((c) => {
  const m = fit(fitRows.map((r) => sel(r.x, c.use)), fitRows.map((r) => r.y), c.l2);
  const p = valRows.map((r) => predict(m, sel(r.x, c.use)));
  const y = valRows.map((r) => r.y);
  return { name: c.name, brier: brier(p, y), brierSkill: 1 - brier(p, y) / brier(p.map(() => valBase), y), auc: auc(p, y) };
});
const best = CANDIDATES[validation.reduce((bi, v, i, a) => (v.brier < a[bi].brier ? i : bi), 0)];
FEATURES = best.use;
console.table(validation);
console.log('chosen:', best.name);
model = fit(train.map((r) => sel(r.x, best.use)), train.map((r) => r.y), best.l2);
rows.forEach((r) => { r.x = sel(r.x, best.use); });

const pTest = test.map((r) => predict(model, r.x));
const yTest = test.map((r) => r.y);
const baseRate = train.reduce((s, r) => s + r.y, 0) / train.length;
const bs = brier(pTest, yTest);
const bsClimo = brier(pTest.map(() => baseRate), yTest);
const hits = pTest.filter((p, i) => p >= 0.5 && yTest[i] === 1).length;
// The app starts saying "medium risk" at 30%, so also score that threshold.
const hits30 = pTest.filter((p, i) => p >= 0.3 && yTest[i] === 1).length;
const falseAlarms30 = pTest.filter((p, i) => p >= 0.3 && yTest[i] === 0).length;
const events = yTest.filter((v) => v === 1).length;
const falseAlarms = pTest.filter((p, i) => p >= 0.5 && yTest[i] === 0).length;

return { rows, train, test, model, pTest, yTest, baseRate, bs, bsClimo, hits, events, falseAlarms, hits30, falseAlarms30, validation, best };
}

let model: Model;
// El Niño case studies: how many months ahead did the model first cross 50% before each town's dry spell began?
function leadTime(months: Months, from: string, to: string) {
  let onset: string | null = null;
  for (let t = from; t <= to && !onset; t = addMonths(t, 1)) {
    const series = Array.from({ length: 12 }, (_, k) => months[addMonths(t, k - 11)]?.ratio).filter((r): r is number => r !== undefined);
    if (['dry_spell', 'drought'].includes(droughtClass(series))) onset = t;
  }
  if (!onset) return { onset: null, warned: null };
  for (let k = 6; k >= 1; k--) {
    const t = addMonths(onset, -k);
    const x = features(months, oni, t);
    if (x && predict(model, FEATURES.map((f) => x[ALL.indexOf(f as (typeof ALL)[number])])) >= 0.5) return { onset, warned: t, monthsAhead: k };
  }
  return { onset, warned: null, monthsAhead: 0 };
}

function report(r: Awaited<ReturnType<typeof main>>) {
const { train, test, pTest, yTest, baseRate, bs, bsClimo, hits, events, falseAlarms, hits30, falseAlarms30, validation, best } = r;
const caseStudies = [['2015–16 El Niño', '2015-06', '2016-06'], ['2023–24 El Niño', '2023-06', '2024-06']].map(([name, from, to]) => ({
  name,
  towns: [...cells.values()].map(({ town, months }) => ({ town, ...leadTime(months, from, to) })),
}));

const out = {
  trainedAt: new Date().toISOString(),
  question: 'P(PAGASA dry spell reached within the next 3 months)',
  features: FEATURES,
  ...model,
  selection: { validatedOn: '1991–2004 fit → 2005–2012', candidates: validation, chosen: best.name, l2: best.l2 },
  data: { cells: cells.size, trainPeriod: '1991–2012', testPeriod: '2013–2020, 2023–2026', trainRows: train.length, testRows: test.length, baseRate },
  test: {
    auc: auc(pTest, yTest), brier: bs, brierClimatology: bsClimo, brierSkill: 1 - bs / bsClimo,
    events, hits, falseAlarms, threshold: 0.5, hits30, falseAlarms30,
  },
  caseStudies,
};
writeFileSync('src/data/riskModel.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ ...out.data, ...out.test, coef: FEATURES.map((f, j) => `${f} ${model.coef[j].toFixed(2)}`) }, null, 1));
for (const c of caseStudies) console.log(c.name, c.towns.map((t) => `${t.town}: ${t.onset ?? 'no dry spell'}${t.warned ? ` (warned ${t.monthsAhead} mo ahead)` : t.onset ? ' (missed)' : ''}`).join('; '));
}

main().then(report);
