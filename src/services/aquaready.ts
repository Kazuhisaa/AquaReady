// AquaReady formulas — see AQUAREADY_SPEC.md.
// [S] = published standard (cite it). [D] = design default (needs health/DRRM advisor sign-off).

export type AgeBracket = 'infant' | 'child' | 'adult' | 'elderly';
export type StorageSize = 'small' | 'medium' | 'large';
export type Severity = 'low' | 'moderate' | 'high';
export type RainClass = 'way_below' | 'below' | 'near' | 'above';
export type DroughtClass = 'none' | 'dry_condition' | 'dry_spell' | 'drought';

export interface Member {
  age: AgeBracket;
  pregnant?: boolean;
  lactating?: boolean;
  formulaFed?: boolean;
  healthFlag?: boolean;
}

export interface CheckIn {
  storedLiters: number;
  eventDays: number;
  ranOutOnDay?: number;
  leftoverFraction?: number;
}

export const clampCalibration = (f: number) => Math.min(1.5, Math.max(1, f));

// ---------- 1. Household water need ----------

export const BASE_LPD = 15; // [S] Sphere 2018: household average ≥15 L/person/day (drinking+cooking+hygiene)
export const SURVIVAL_LPD = 7.5; // [S] Sphere absolute minimum: drinking, cooking, basic hygiene. The reserve households must store.
export const POTABLE_LPD = 3; // [S] Sphere/WHO: 2.5–3 L of it must be safe drinking/food water
const PREGNANT_L = 0.3; // [S] EFSA 2010 water DRV: +300 mL/day in pregnancy
const LACTATING_L = 0.7; // [S] EFSA 2010: +700 mL/day when lactating
const FORMULA_L = 1; // [D] potable water for formula prep
const HEALTH_L = 1; // [D] self-flagged, no clinical detail collected

// Heat bands are PAGASA's [S]; the added liters are [D].
export function heatAddLpd(heatIndexC: number): number {
  if (heatIndexC >= 42) return 1; // PAGASA "Danger" 42–51 °C
  if (heatIndexC >= 33) return 0.5; // PAGASA "Extreme Caution" 33–41 °C
  return 0;
}

export function memberAdjustment(m: Member): number {
  return (
    (m.pregnant ? PREGNANT_L : 0) +
    (m.lactating ? LACTATING_L : 0) +
    (m.formulaFed ? FORMULA_L : 0) +
    (m.healthFlag ? HEALTH_L : 0)
  );
}

// Sphere's 15 L is already a household average across all ages, so no per-age discount:
// age brackets drive vulnerability messaging + the regional map, not a lower number.
// Every adjustment is drinking-grade, so it lands in `potable`.
export function householdDaily(members: Member[], heatIndexC = 0, calibration = 1) {
  const n = members.length;
  const heat = heatAddLpd(heatIndexC) * n;
  const adj = members.reduce((s, m) => s + memberAdjustment(m), 0);
  const potable = POTABLE_LPD * n + adj + heat;
  const total = (BASE_LPD * n + adj + heat) * clampCalibration(calibration);
  const essential = (SURVIVAL_LPD * n + adj + heat) * clampCalibration(calibration);
  return { potable, domestic: total - potable, total, essential };
}

// ---------- 2. Rainfall & drought classes (PAGASA definitions) [S] ----------

// ratio = rainfall / 1991–2020 normal for that month and municipality
export function rainClass(ratio: number): RainClass {
  if (ratio <= 0.4) return 'way_below'; // >60% reduction
  if (ratio <= 0.8) return 'below'; // 21–60% reduction
  if (ratio <= 1.2) return 'near'; // 81–120% of normal
  return 'above';
}

// Classifies the trailing run of months (oldest → newest).
export function droughtClass(monthlyRatios: number[]): DroughtClass {
  let below = 0;
  let wayBelow = 0;
  for (let i = monthlyRatios.length - 1; i >= 0 && rainClass(monthlyRatios[i]) !== 'near' && rainClass(monthlyRatios[i]) !== 'above'; i--) below++;
  for (let i = monthlyRatios.length - 1; i >= 0 && rainClass(monthlyRatios[i]) === 'way_below'; i--) wayBelow++;
  if (below >= 5 || wayBelow >= 3) return 'drought';
  if (below >= 3 || wayBelow >= 2) return 'dry_spell';
  if (below >= 2) return 'dry_condition';
  return 'none';
}

const DROUGHT_RANK: Record<DroughtClass, number> = { none: 0, dry_condition: 1, dry_spell: 2, drought: 3 };

// Months from now until PAGASA "dry spell" or worse is reached. 0 = already there; null = not within forecast.
export function monthsToDrySpell(observedRatios: number[], forecastRatios: number[]): number | null {
  const series = [...observedRatios];
  if (DROUGHT_RANK[droughtClass(series)] >= 2) return 0;
  for (let k = 0; k < forecastRatios.length; k++) {
    series.push(forecastRatios[k]);
    if (DROUGHT_RANK[droughtClass(series)] >= 2) return k + 1;
  }
  return null;
}

// ---------- 3. Risk score: trained model + ECMWF ensemble ----------

export interface RiskInputs {
  rainRatio: number; // environmental: seasonal forecast, next-3-month rainfall / normal (display)
  oni: number; // environmental: NOAA Oceanic Niño Index (display)
  ecoZ: number; // ecological: root-zone (28–100 cm) soil moisture z-score, ERA5, vs 1991–2020 same month
  heatIndexC: number; // environmental: forecast max feels-like temperature (adds drinking water)
  pModel: number; // P(dry spell within 3 months) from the trained model (scripts/train-model.ts)
  pForecast: number; // share of ECMWF ensemble members that reach a dry spell within 3 months
}

// Equal-weight blend of a statistical and a dynamical forecast, a standard multi-model ensemble.
// The score is a probability: 0.6 = "6 in 10 chance of a dry spell in the next 3 months".
export function riskScore(r: RiskInputs): number {
  return 0.5 * r.pModel + 0.5 * r.pForecast;
}

/** Trained logistic regression (src/data/riskModel.json); `features` names the inputs in training order. */
export interface RiskModel { features: string[]; mean: number[]; std: number[]; coef: number[]; intercept: number }
export function predictDrySpell(m: RiskModel, f: Record<string, number>): number {
  const z = m.intercept + m.features.reduce((s, name, j) => s + ((f[name] - m.mean[j]) / m.std[j]) * m.coef[j], 0);
  return 1 / (1 + Math.exp(-z));
}

/**
 * Every feature the trainer may pick (scripts/train-model.ts), from data known at the end of month t:
 * ONI centred on t-1 and on t-4, the last 3 months' rain vs normal (oldest → newest), soil z at t, and the first target month.
 */
export function modelFeatures(oni: number, oni4: number, last3Ratios: number[], soilZ: number, firstTargetMonth: number): Record<string, number> {
  const m = firstTargetMonth - 1; // 1–12 → 0–11
  return {
    oni, oniTrend: oni - oni4, soilZ,
    rainPast3: last3Ratios.reduce((a, b) => a + b, 0) / last3Ratios.length, rainLast: last3Ratios[last3Ratios.length - 1],
    seasonSin: Math.sin((2 * Math.PI * m) / 12), seasonCos: Math.cos((2 * Math.PI * m) / 12),
  };
}

/** Share of ensemble members whose next 3 months (after the observed ones) reach a PAGASA dry spell. */
export function ensembleDrySpellProb(observedRatios: number[], members: number[][]): number {
  if (!members.length) return 0;
  return members.filter((m) => monthsToDrySpell(observedRatios, m) !== null).length / members.length;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r5 = (x: number) => Math.round(x / 5) * 5;
const clamp01 = (x: number) => clamp(x, 0, 1);

export function severity(score: number): Severity {
  return score < 0.3 ? 'low' : score < 0.6 ? 'moderate' : 'high';
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  low: 'var(--low)',
  moderate: 'var(--moderate)',
  high: 'var(--high)',
};

export const SEVERITY_WORD: Record<Severity, string> = {
  low: 'Low risk',
  moderate: 'Moderate risk',
  high: 'High risk',
};

// [D] interruption buffer, continuous so the range tracks forecast spread:
// 3 days at score ≤0.3 → 14 days at score ≥0.6. Validate against Isabela's past interruptions.
export function reserveDays(score: number): number {
  return 3 + 11 * clamp01((score - 0.3) / 0.3);
}

// Measures actual liters/day instead of "short / fine / extra", so forecast error
// (a shorter dry spell) isn't mistaken for low consumption.
// Spec §8 rule for the 3-option check-in: ran short ×1.15, had extra ×0.95, lasted fine unchanged.
export type CheckInAnswer = 'short' | 'fine' | 'extra';
export function calibrationFromAnswer(current: number, a: CheckInAnswer): number {
  const next = a === 'short' ? current * 1.15 : a === 'extra' ? current * 0.95 : current;
  return Math.round(clampCalibration(next) * 1000) / 1000;
}

export function updateCalibration(current: number, c: CheckIn, baseDailyTotal: number): number {
  const days = c.ranOutOnDay ?? c.eventDays;
  const used = c.ranOutOnDay ? c.storedLiters : c.storedLiters * (1 - (c.leftoverFraction ?? 0));
  const observed = used / days / baseDailyTotal;
  return clampCalibration(0.7 * current + 0.3 * observed);
}

// ---------- 5. Storage plan ----------

// [D] plain-language sizes → liters: 2 jerry cans / 1 drum / 1 tank
export const STORAGE_LITERS: Record<StorageSize, number> = { small: 40, medium: 200, large: 1000 };

export interface WaterContainerItem {
  id: string;
  name: string;
  liters: number;
  count: number;
}

export function capacityToStorageSize(liters: number): StorageSize {
  if (liters <= 80) return 'small';
  if (liters <= 400) return 'medium';
  return 'large';
}

export function getHouseholdCapacity(h: { containers?: WaterContainerItem[]; storage: StorageSize }): number {
  if (h.containers && h.containers.length > 0) {
    return h.containers.reduce((sum, c) => sum + Math.max(0, c.liters * c.count), 0);
  }
  return STORAGE_LITERS[h.storage] ?? 200;
}

export interface PlanInput {
  members: Member[];
  storage: StorageSize;
  storageCapacityLiters?: number;
  storedLiters: number;
  calibration: number;
  coastal: boolean;
  risk: RiskInputs;
  observedRatios: number[]; // recent months, oldest → newest
  forecastRatios: number[]; // ensemble median, next months
  asOf?: string; // YYYY-MM of forecastRatios[0]
  today?: Date; // for days-to-impact; defaults to the 1st of asOf
  projection2050?: { dryRainChangePct: number; tmaxChangeC: number; seaLevel2050?: { p17: number; p50: number; p83: number; landSinking: number } };
}

export type Horizon = 'now' | 'season' | 'long_term';
export type PathwayCategory = 'grassroots' | 'utility' | 'ecological';

export interface Pathway {
  id: string;
  horizon: Horizon;
  text: string;
  category?: PathwayCategory;
  tag?: string;
}

export function buildPlan(p: PlanInput) {
  const daily = householdDaily(p.members, p.risk.heatIndexC, p.calibration);
  const score = riskScore(p.risk);
  // Two tiers: households must store the essential reserve (7.5 L/p/d); the full 15 L is a stretch goal.
  // Range: spec §7 asymmetric band around the central target; the score itself is already a probability.
  const point = daily.essential * reserveDays(score);
  const targetLow = r5(point * 0.85);
  const targetHigh = r5(point * 1.2);
  const fullTarget = r5(daily.total * reserveDays(score) * 1.2);

  const capacity = p.storageCapacityLiters ?? STORAGE_LITERS[p.storage] ?? 200;
  const storable = Math.min(targetHigh, capacity); // aim at the dry case: under-storing costs more
  // What containers can't hold. Count water already stored: logging more than the listed containers
  // means the family has containers we don't know about, so trust the log.
  const shortfall = Math.max(0, targetHigh - Math.max(capacity, p.storedLiters));

  const months = monthsToDrySpell(p.observedRatios, p.forecastRatios);
  // Dry spell is reached in month forecastRatios[months-1]; count days from today to the 1st of that month.
  let impactMonth: string | null = null;
  let daysToImpact: number | null = null;
  if (months === 0) daysToImpact = 0;
  else if (months !== null && p.asOf) {
    const start = Date.UTC(+p.asOf.slice(0, 4), +p.asOf.slice(5) - 1 + months - 1, 1);
    const d = new Date(start);
    impactMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    daysToImpact = Math.max(0, Math.round((start - (p.today ?? new Date(Date.UTC(+p.asOf.slice(0, 4), +p.asOf.slice(5) - 1, 1))).getTime()) / 864e5));
  } else if (months !== null) daysToImpact = months * 30; // no calendar given (tests): 30-day months
  // Finish 3 days early, but always spread over ≥3 trips: an imminent dry spell must not demand
  // one impossible top-up. `urgent` tells the UI to point to refill stations as well.
  const fillDays = Math.max(9, (daysToImpact ?? 30) - 3);
  const remaining = Math.max(0, storable - p.storedLiters);
  const litersEvery3Days = remaining === 0 ? 0 : Math.max(5, Math.ceil((remaining / fillDays) * 3 / 5) * 5);
  const urgent = daysToImpact !== null && daysToImpact < 12 && remaining > 0;

  return {
    score,
    severity: severity(score),
    daily,
    targetRange: [targetLow, targetHigh] as [number, number],
    fullTarget,
    urgent,
    capacity: Math.round(capacity),
    storable: Math.round(storable),
    shortfall: Math.round(shortfall),
    daysToImpact,
    impactMonth,
    litersEvery3Days,
    pathways: pathways(p, severity(score), shortfall),
  };
}

// Rule-based adaptation pathways across horizons with strategic categorization.
export function pathways(p: PlanInput, sev: Severity, shortfall: number): Pathway[] {
  const out: Pathway[] = [
    {
      id: 'cover',
      horizon: 'now',
      category: 'grassroots',
      tag: 'Dengue Prevention',
      text: 'Keep every container covered and scrub it weekly: stored water breeds dengue mosquitoes (DOH 4S).',
    },
  ];
  if (sev !== 'low') {
    out.push({
      id: 'store',
      horizon: 'now',
      category: 'grassroots',
      tag: 'Paced Storing',
      text: 'Follow your storage plan. Keep drinking water separate from washing water.',
    });
  }
  if (p.risk.heatIndexC >= 42) {
    out.push({
      id: 'heat',
      horizon: 'now',
      category: 'grassroots',
      tag: 'Heat Hydration',
      text: 'Danger-level heat: give elderly and infants their drinking water first and keep ORS on hand.',
    });
  }
  if (p.members.some((m) => m.formulaFed)) {
    out.push({
      id: 'formula-prep',
      horizon: 'now',
      category: 'grassroots',
      tag: 'Infant Safety',
      text: 'Formula-fed infant: prioritize boiling 1 L potable water daily for sterile preparation.',
    });
  }
  if (shortfall > 0) {
    out.push({
      id: 'refill',
      horizon: 'season',
      category: 'utility',
      tag: 'Community Refill',
      text: 'Your target is bigger than your containers. Find your barangay refill point before the dry spell.',
    });
    out.push({
      id: 'rainwater',
      horizon: 'season',
      category: 'ecological',
      tag: 'Rain Catchment',
      text: 'Catch rainwater from your roof now, while it still rains, and use it for washing.',
    });
  }
  if (sev !== 'low') {
    out.push({
      id: 'greywater',
      horizon: 'season',
      category: 'grassroots',
      tag: 'Greywater Reuse',
      text: 'Recycle vegetable-wash and laundry rinse water for toilet flushing to stretch potable reserves.',
    });
  }
  if (p.coastal) {
    out.push({
      id: 'salinity',
      horizon: 'long_term',
      category: 'ecological',
      tag: 'Coastal Salinity',
      text: 'Coastal well: sea-level rise pushes salt water into wells during droughts. Test for saltiness and keep rainwater as backup.',
    });
  }
  if (p.projection2050) {
    out.push({
      id: 'upgrade',
      horizon: 'long_term',
      category: 'grassroots',
      tag: '2050 Upgrade',
      text: `By 2041–50 your dry season is projected to get ${describeProjection(p.projection2050)}. A covered tank or roof-rainwater system pays off before the next El Niño.`,
    });
  }
  return out;
}

// ---------- 6. Regional view (LGU readiness map) ----------

export type Projection = { dryRainChangePct: number; tmaxChangeC: number };
export const describeProjection = (p: Projection) =>
  `${Math.abs(p.dryRainChangePct).toFixed(0)}% ${p.dryRainChangePct < 0 ? 'less' : 'more'} rain and ${p.tmaxChangeC.toFixed(1)} °C more heat`;

export interface TownInput {
  severity: Severity;
  monthsToDrySpell: number | null;
  heatIndexC: number;
  coastal: boolean;
  projection2050?: Projection;
  name?: string;
  type?: 'city' | 'municipality';
  population?: number;
  ecoZ?: number;
  rainRatio?: number;
}

const CITIES = new Set(['Cauayan', 'Ilagan', 'Santiago']);
const AGRI_GRAIN_BASIN = new Set([
  'Alicia', 'Angadanan', 'Aurora', 'Burgos', 'Cabatuan', 'Luna', 'Mallig',
  'Quezon', 'Quirino', 'Ramon', 'Reina Mercedes', 'Roxas', 'San Manuel', 'San Mateo',
]);

// Strategic municipal adaptation pathways across 3 Pillars:
// 1. Grassroots & Household Buffering
// 2. Municipal Utility Grid & Logistics
// 3. Agro-Ecological & Landscape Transition
export function municipalPathways(t: TownInput): Pathway[] {
  const out: Pathway[] = [];
  const m = t.monthsToDrySpell;
  const isCity = (t.name && CITIES.has(t.name)) || t.type === 'city';
  const isAgri = t.name && AGRI_GRAIN_BASIN.has(t.name);
  const isSevere = t.severity !== 'low';

  // --- PILLAR 1: Grassroots & Household Buffering ---
  if (m === 0) {
    out.push({
      id: 'advisory',
      horizon: 'now',
      category: 'grassroots',
      tag: 'MDRRMO Alert',
      text: 'Dry spell underway: send the storage advisory to every barangay by SMS and barangay announcement.',
    });
  } else if (m !== null && m <= 3) {
    out.push({
      id: 'advisory',
      horizon: 'now',
      category: 'grassroots',
      tag: 'Early Warning',
      text: `Dry spell expected in about ${m} month${m > 1 ? 's' : ''}: send the storage advisory to every barangay now, while there is time to fill up gradually.`,
    });
  }

  if (t.severity === 'high') {
    out.push({
      id: 'water-points',
      horizon: 'now',
      category: 'grassroots',
      tag: 'Vulnerability Survey',
      text: 'Check barangay water points and deep wells, and list households with no containers.',
    });
  }

  if (isSevere) {
    out.push({
      id: 'rain-capture',
      horizon: 'season',
      category: 'grassroots',
      tag: 'Public Rain Catchment',
      text: 'Set up rainwater collection at schools and barangay halls before the rains stop.',
    });
    out.push({
      id: 'refill-map',
      horizon: 'season',
      category: 'grassroots',
      tag: 'Refill Network',
      text: 'Map a refill point for each barangay and log barangays with none. That list becomes the Phase 2 gap data.',
    });
  }

  if (t.projection2050) {
    out.push({
      id: 'storage-infra',
      horizon: 'long_term',
      category: 'grassroots',
      tag: '2050 Cistern Plan',
      text: `By 2041–50 the dry season is projected to get ${describeProjection(t.projection2050)} (CMIP6; PAGASA expects drier summers). Plan public rainwater storage for either case.`,
    });
  }

  // --- PILLAR 2: Municipal Utility Grid & Logistics ---
  if (t.heatIndexC >= 42 || (isCity && isSevere)) {
    out.push({
      id: 'cooling',
      horizon: 'now',
      category: 'utility',
      tag: 'Urban Heat Shelter',
      text: isCity
        ? 'Danger-level heat: open public air-conditioned cooling stations and hydration posts in commercial centers, markets, and terminals.'
        : 'Danger-level heat: open drinking-water and cooling stations for seniors and farm workers.',
    });
  }

  if (isCity && isSevere) {
    out.push({
      id: 'utility-pressure',
      horizon: 'now',
      category: 'utility',
      tag: 'Water District Pressure',
      text: 'Coordinate with City Water District for zone-throttling to maintain adequate pressure for hospitals and critical facilities.',
    });
  } else if (!isCity && isSevere) {
    out.push({
      id: 'tanker-deployment',
      horizon: 'now',
      category: 'utility',
      tag: 'Emergency Tankers',
      text: 'Mobilize municipal water delivery tankers for off-grid upland and agricultural sitios where shallow pumps fail.',
    });
  }

  if (isSevere) {
    out.push({
      id: 'solar-pumping',
      horizon: 'season',
      category: 'utility',
      tag: 'Solar Pumping Backup',
      text: 'Equip communal deep wells with solar auxiliary power to maintain supply during brownouts or heatwave power spikes.',
    });
  }

  if (isSevere) {
    out.push({
      id: 'grid-interloop',
      horizon: 'long_term',
      category: 'utility',
      tag: 'Grid Loop Line',
      text: isCity
        ? 'Build secondary transmission loops to link city water district mains with outlying barangay water systems (BWSAs).'
        : 'Connect isolated communal spring and deep-well networks into clustered multi-barangay emergency grids.',
    });
  }

  // --- PILLAR 3: Agro-Ecological & Landscape Transition ---
  if (isAgri && isSevere) {
    out.push({
      id: 'irrigation-rationing',
      horizon: 'now',
      category: 'ecological',
      tag: 'NIA-MARIIS Coordination',
      text: 'Enforce strict rotational canal rationing with NIA-MARIIS to prevent total crop desiccation during peak vegetative stage.',
    });
    out.push({
      id: 'awd-crop-shift',
      horizon: 'season',
      category: 'ecological',
      tag: 'Alternate Wetting & Drying',
      text: 'Promote Alternate Wetting and Drying (AWD) in rice paddies (saving 30% water) and distribute drought-tolerant hybrid corn/sorghum.',
    });
  }

  out.push({
    id: 'watershed',
    horizon: 'long_term',
    category: 'ecological',
    tag: 'Watershed Reforestation',
    text: 'Protect the forest and river cover that recharges wells and irrigation.',
  });

  if (t.coastal) {
    if (isSevere) {
      out.push({
        id: 'coastal-conductivity',
        horizon: 'now',
        category: 'ecological',
        tag: 'Conductivity Alert',
        text: 'Conduct weekly electrical conductivity testing of coastal shallow wells to catch early saltwater encroachment.',
      });
    }
    out.push({
      id: 'salinity-monitor',
      horizon: 'long_term',
      category: 'ecological',
      tag: 'Sea-Level Salinity Defense',
      text: 'Monitor well salinity: rising seas push salt water into coastal wells during droughts. Establish coastal mangrove buffer zones.',
    });
  }

  return out;
}

