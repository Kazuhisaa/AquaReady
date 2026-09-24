// Pulls live climate inputs for all 37 Isabela LGUs into src/data/isabelaRisk.json.
// Run: npm run data   (open APIs, no keys; ~5–10 min because of Open-Meteo's per-minute quota)
//   Coordinates        Open-Meteo geocoding (GeoNames)
//   Rain normals, observed rain, root-zone soil moisture   ERA5 via Open-Meteo archive
//   Feels-like max temperature (observed + next 7 days)    ERA5 archive / Open-Meteo forecast
//   6-month rain forecast, 50+ member ensemble             ECMWF SEAS5 via Open-Meteo seasonal
//   2041–2050 vs 1995–2014 dry-season change               CMIP6 EC-Earth3P-HR via Open-Meteo climate
//   Oceanic Niño Index                                     NOAA CPC
// PAGASA's ENSO status has no API: it is hand-entered in ADVISORY below, with its source.
// Per-town responses are cached in .cache/ so a rerun resumes after a failure (delete it to refresh).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';

net.setDefaultAutoSelectFamilyAttemptTimeout(3000); // Node 20's 250 ms default times out on slow IPv6 links

// Checked by hand on https://www.pagasa.dost.gov.ph/climate/el-nino-la-nina/monitoring (2026-09-24):
// "A moderate to strong El Niño is present in the Tropical Pacific." (updated: 26 August 2026)
// PAGASA ENSO Alert System: El Niño present = Advisory, level 3 of 3.
const ADVISORY = {
  level: 3,
  label: 'El Niño Advisory',
  issued: '2026-08-26',
  quote: 'A moderate to strong El Niño is present in the Tropical Pacific.',
  url: 'https://www.pagasa.dost.gov.ph/climate/el-nino-la-nina/monitoring',
};

const LGUS = [
  'Alicia', 'Angadanan', 'Aurora', 'Benito Soliven', 'Burgos', 'Cabagan', 'Cabatuan', 'Cauayan', 'Cordon',
  'Delfin Albano', 'Dinapigue', 'Divilacan', 'Echague', 'Gamu', 'Ilagan', 'Jones', 'Luna', 'Maconacon',
  'Mallig', 'Naguilian', 'Palanan', 'Quezon', 'Quirino', 'Ramon', 'Reina Mercedes', 'Roxas', 'San Agustin',
  'San Guillermo', 'San Isidro', 'San Manuel', 'San Mariano', 'San Mateo', 'San Pablo', 'Santa Maria',
  'Santiago', 'Santo Tomas', 'Tumauini',
];
// Not in the GeoNames populated-place index: approximate poblacion coordinates.
// ponytail: hand-entered, ±5 km; fine at the ~36 km seasonal-model grid.
const MANUAL = { 'San Agustin': [16.52, 121.75], 'San Pablo': [17.45, 121.8], Divilacan: [17.33, 122.3] };
const HISTORY_FROM = '2023-01'; // covers the 2023–24 El Niño replay

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 8) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return url.endsWith('.txt') ? res.text() : res.json();
      if (i >= tries) throw new Error(`${res.status} ${url}`);
      if (res.status === 429) {
        const why = (await res.text()).toLowerCase();
        if (why.includes('daily')) throw new Error('Open-Meteo daily limit reached. Cached cells are kept in .cache/; rerun tomorrow to finish.');
        const wait = why.includes('hourly') ? 10 * 60000 : 65000; // hourly quota: poll every 10 min until it resets
        process.stdout.write(`  rate-limited (${why.includes('hourly') ? 'hourly' : 'per-minute'}), waiting ${wait / 1000} s\n`);
        await sleep(wait); i--; continue; // quota waits do not use up retries
      }
    } catch (e) {
      if (i >= tries) throw e;
    }
    await sleep(2000 * (i + 1));
  }
}
const ym = (d) => d.slice(0, 7);
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i % 1);
};
/** Group a daily series into { 'YYYY-MM': values[] }. */
function byMonth(time, values) {
  const out = {};
  time.forEach((t, i) => { if (values[i] != null) (out[ym(t)] ??= []).push(values[i]); });
  return out;
}

async function locate(name) {
  if (MANUAL[name]) return { lat: MANUAL[name][0], lon: MANUAL[name][1] };
  const r = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=100&country_code=PH`);
  // Must be a settlement inside that municipality of Isabela; prefer the seat (PPLA*) over a same-named barangay.
  const hits = (r.results ?? []).filter((x) => /Isabela/.test(x.admin2 ?? '') && (x.admin3 ?? '').includes(name) && x.feature_code?.startsWith('PPL'));
  const hit = hits.sort((a, b) => Number(/PPLA/.test(b.feature_code)) - Number(/PPLA/.test(a.feature_code)))[0];
  if (!hit) throw new Error(`No Isabela match for ${name}`);
  return { lat: round(hit.latitude, 4), lon: round(hit.longitude, 4) };
}

// Heavy requests are shared by towns in the same grid cell (37 towns → 9 cells at 0.5°, 2 at 1°),
// which keeps a full run inside Open-Meteo's free daily quota.
const cellKey = (lat, lon, deg) => `${(Math.round(lat / deg) * deg).toFixed(2)}_${(Math.round(lon / deg) * deg).toFixed(2)}`;
async function cached(file, load) {
  const f = `.cache/${file}.json`;
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  const data = await load();
  writeFileSync(f, JSON.stringify(data));
  return data;
}
const joinDaily = (a, b, keys) => ({ time: [...a.time, ...b.time], ...Object.fromEntries(keys.map((k) => [k, [...a[k], ...b[k]]])) });

async function fetchTown(name) {
  const { lat, lon } = await locate(name);
  const at = (deg) => { const [la, lo] = cellKey(lat, lon, deg).split('_'); return `latitude=${la}&longitude=${lo}&timezone=Asia%2FManila`; };
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const normal = await cached(`normal-${cellKey(lat, lon, 0.5)}`, () =>
    get(`https://archive-api.open-meteo.com/v1/archive?${at(0.5)}&start_date=1991-01-01&end_date=2020-12-31&daily=precipitation_sum,soil_moisture_28_to_100cm_mean`));
  const recent = await cached(`recent-${cellKey(lat, lon, 0.25)}`, () =>
    get(`https://archive-api.open-meteo.com/v1/archive?${at(0.25)}&start_date=${HISTORY_FROM}-01&end_date=${yesterday}&daily=precipitation_sum,soil_moisture_28_to_100cm_mean,apparent_temperature_max`));
  const seasonal = await cached(`seasonal-${cellKey(lat, lon, 0.5)}`, () =>
    get(`https://seasonal-api.open-meteo.com/v1/seasonal?${at(0.5)}&daily=precipitation_sum&forecast_days=183`));
  const climate = await cached(`climate-${cellKey(lat, lon, 1)}`, async () => {
    const q = (from, to) => get(`https://climate-api.open-meteo.com/v1/climate?${at(1)}&start_date=${from}&end_date=${to}&models=EC_Earth3P_HR&daily=precipitation_sum,temperature_2m_max`);
    const keys = ['precipitation_sum', 'temperature_2m_max'];
    return { daily: joinDaily((await q('1995-01-01', '2014-12-31')).daily, (await q('2041-01-01', '2050-12-31')).daily, keys) };
  });
  const keys = ['precipitation_sum', 'soil_moisture_28_to_100cm_mean'];
  return {
    lat, lon,
    archive: { daily: joinDaily(normal.daily, recent.daily, keys) },
    heat: { daily: { time: recent.daily.time, apparent_temperature_max: recent.daily.apparent_temperature_max } },
    heatNext: await get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Asia%2FManila&daily=apparent_temperature_max&forecast_days=7`),
    seasonal, climate,
  };
}

function town(name, raw) {
  const rain = byMonth(raw.archive.daily.time, raw.archive.daily.precipitation_sum);
  const soil = byMonth(raw.archive.daily.time, raw.archive.daily.soil_moisture_28_to_100cm_mean);
  const heat = byMonth(raw.heat.daily.time, raw.heat.daily.apparent_temperature_max);
  const monthTotal = (k) => rain[k].reduce((a, b) => a + b, 0);
  const full = (k) => rain[k]?.length >= 28;

  const years = Array.from({ length: 30 }, (_, i) => 1991 + i);
  const mm = (m) => String(m).padStart(2, '0');
  const normals = Array.from({ length: 12 }, (_, m) => round(mean(years.map((y) => monthTotal(`${y}-${mm(m + 1)}`))), 1));
  const soilStats = Array.from({ length: 12 }, (_, m) => {
    const xs = years.map((y) => mean(soil[`${y}-${mm(m + 1)}`]));
    return { m: mean(xs), s: sd(xs) };
  });

  const months = {};
  for (const k of Object.keys(rain).filter((k) => k >= HISTORY_FROM && full(k)).sort()) {
    const n = Number(k.slice(5)) - 1;
    months[k] = {
      ratio: round(monthTotal(k) / normals[n]),
      ecoZ: round((mean(soil[k]) - soilStats[n].m) / soilStats[n].s),
      heat: round(Math.max(...heat[k]), 1),
    };
  }
  const lastObserved = Object.keys(months).sort().at(-1);

  // Full monthly history 1991– (rain vs normal, soil z) for training the risk model: scripts/train-model.ts
  const history = {};
  for (const k of Object.keys(rain).filter(full).sort()) {
    const n = Number(k.slice(5)) - 1;
    if (!soil[k]?.length) continue;
    history[k] = { ratio: round(monthTotal(k) / normals[n]), soilZ: round((mean(soil[k]) - soilStats[n].m) / soilStats[n].s) };
  }

  // Seasonal ensemble → per-member monthly totals → quantiles of ratio-to-normal
  const sea = raw.seasonal.daily;
  const members = Object.keys(sea).filter((k) => k.startsWith('precipitation_sum'));
  const sums = {};
  sea.time.forEach((t, i) => {
    const k = ym(t);
    sums[k] ??= { n: 0, v: members.map(() => 0) };
    sums[k].n++;
    members.forEach((m, j) => { sums[k].v[j] += sea[m][i] ?? 0; });
  });
  // The current month is part observed, part forecast: add the observed days to every member so it isn't skipped
  // (a skipped month would make the dry-spell rule treat August and October as consecutive).
  for (const k of Object.keys(sums)) {
    if (sums[k].n < 28 && rain[k] && !full(k)) {
      const seen = monthTotal(k);
      sums[k].v = sums[k].v.map((v) => v + seen);
      sums[k].n += rain[k].length;
    }
  }
  const fMonths = Object.keys(sums).filter((k) => sums[k].n >= 28 && k > lastObserved).sort();
  const forecast = fMonths.map((k) => {
    const r = sums[k].v.map((s) => s / normals[Number(k.slice(5)) - 1]);
    return { month: k, p20: round(quantile(r, 0.2)), med: round(quantile(r, 0.5)), p80: round(quantile(r, 0.8)) };
  });
  const next3 = fMonths.slice(0, 3);
  const norm3 = next3.reduce((s, k) => s + normals[Number(k.slice(5)) - 1], 0);
  const r3 = members.map((_, j) => next3.reduce((s, k) => s + sums[k].v[j], 0) / norm3);
  // Each member's next-3-month ratios, so the app can count how many members reach a PAGASA dry spell
  const members3 = members.map((_, j) => next3.map((k) => round(sums[k].v[j] / normals[Number(k.slice(5)) - 1])));

  // CMIP6: dry season (Feb–Apr) rain and daily max temperature, 2041–2050 vs 1995–2014 (IPCC AR6 baseline)
  const c = raw.climate.daily;
  // Skip missing days (null): counting them as 0 once made 2050 look 1.7 °C cooler and 30% drier.
  const dry = (from, to, key) => c.time.map((t, i) => [t, c[key][i]])
    .filter(([t, v]) => v != null && t.slice(0, 4) >= from && t.slice(0, 4) <= to && ['02', '03', '04'].includes(t.slice(5, 7)))
    .map(([, v]) => v);
  const rainChange = mean(dry('2041', '2050', 'precipitation_sum')) / mean(dry('1995', '2014', 'precipitation_sum')) - 1;

  return {
    history,
    lgu: {
      name, zone: name, lat: raw.lat, lon: raw.lon, normals, months, forecast,
      rain3: { p20: round(quantile(r3, 0.2)), med: round(quantile(r3, 0.5)), p80: round(quantile(r3, 0.8)) },
      heatNow: round(Math.max(...raw.heatNext.daily.apparent_temperature_max), 1),
      lastObserved,
      members3,
    },
    projection: {
      dryRainChangePct: round(rainChange * 100, 1),
      tmaxChangeC: round(mean(dry('2041', '2050', 'temperature_2m_max')) - mean(dry('1995', '2014', 'temperature_2m_max')), 1),
    },
  };
}

// IPCC AR6 relative sea-level projection (NASA Sea Level Projection Tool), nearest 1° ocean grid point.
// Total incl. vertical land motion, SSP2-4.5, medium confidence, metres vs 1995–2014.
const COASTAL = new Set(['Palanan', 'Divilacan', 'Maconacon', 'Dinapigue']);
async function seaLevel(lat, lon) {
  const grid = [16, 17, 18].map((la) => [la, 123]).sort((a, b) => Math.hypot(a[0] - lat, a[1] - lon) - Math.hypot(b[0] - lat, b[1] - lon))[0];
  const all = await cached(`sealevel-${grid.join('_')}`, () =>
    get(`https://d3qt3aobtsas2h.cloudfront.net/edge/ws/search/projection?lat=${grid[0]}&lon=${grid[1]}`));
  const pick = (process) => all.find((x) => x.process === process && x.scenario === 'ssp245' && x.confidence === 'medium');
  const total = pick('total');
  const i = total.year.indexOf(2050);
  return {
    p17: total.height_17[i], p50: total.height_50[i], p83: total.height_83[i],
    landSinking: pick('verticallandmotion').height_50[i], grid, scenario: 'SSP2-4.5',
  };
}

// ONI seasons → centre month: "JJA 2026" → 2026-07; "DJF 2026" → 2026-01; "NDJ 2025" → 2025-12
const SEASONS = ['DJF', 'JFM', 'FMA', 'MAM', 'AMJ', 'MJJ', 'JJA', 'JAS', 'ASO', 'SON', 'OND', 'NDJ'];
const oni = {};
for (const line of (await get('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt')).trim().split('\n').slice(1)) {
  const [seas, yr, , anom] = line.trim().split(/\s+/);
  const k = `${yr}-${String(SEASONS.indexOf(seas) + 1).padStart(2, '0')}`;
  if (k >= HISTORY_FROM) oni[k] = Number(anom);
}

mkdirSync('.cache', { recursive: true });
const lgus = [];
const projections = {};
for (const name of LGUS) {
  // Towns fetched by the first (per-town) run keep their own cache file.
  const file = `.cache/${name}.json`;
  const t = town(name, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : await fetchTown(name));
  lgus.push(t.lgu);
  projections[name] = t.projection;
  mkdirSync('.cache/history', { recursive: true });
  writeFileSync(`.cache/history/${name}.json`, JSON.stringify({ cell: cellKey(t.lgu.lat, t.lgu.lon, 0.5), months: t.history }));
  if (COASTAL.has(name)) projections[name].seaLevel2050 = await seaLevel(t.lgu.lat, t.lgu.lon);
  console.log(`${lgus.length}/${LGUS.length} ${name}: next 3 months ${Math.round(t.lgu.rain3.med * 100)}% of normal`);
}

writeFileSync('src/data/isabelaRisk.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  enso: { ...ADVISORY, oni },
  projections,
  lgus,
  sources: {
    forecast: 'ECMWF SEAS5 seasonal ensemble via Open-Meteo',
    normals: 'ERA5 reanalysis 1991–2020 via Open-Meteo archive',
    soil: 'ERA5 root-zone soil moisture (28–100 cm) via Open-Meteo archive',
    heat: 'Feels-like max temperature, ERA5 + Open-Meteo forecast',
    projection: 'CMIP6 EC-Earth3P-HR via Open-Meteo climate API',
    seaLevel: 'IPCC AR6 sea-level projections, NASA Sea Level Projection Tool (SSP2-4.5, medium confidence)',
    oni: 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
    advisory: ADVISORY.url,
  },
}, null, 1) + '\n');
console.log('wrote src/data/isabelaRisk.json · ONI', Object.entries(oni).at(-1));
