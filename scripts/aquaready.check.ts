// Self-check for src/services/aquaready.ts. Run: npm run check:aquaready
import assert from 'node:assert/strict';
import {
  householdDaily, heatIndexC, heatLevel, dailyHeat, riskScore, severity, predictDrySpell, modelFeatures, ensembleDrySpellProb, droughtClass, monthsToDrySpell,
  updateCalibration, calibrationFromAnswer, buildPlan, reserveDays, municipalPathways, type Member, type PlanInput,
} from '../src/services/aquaready';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

// Appendix example: 2 adults, 1 child, 1 pregnant adult → Sphere 15×4 + EFSA 0.3
const family: Member[] = [{ age: 'adult' }, { age: 'adult' }, { age: 'child' }, { age: 'adult', pregnant: true }];
near(householdDaily(family).total, 60.3);
near(householdDaily(family).potable, 12.3);

// Old age multipliers put a 2-adult/3-child home at 57 L — below Sphere's 15 L household average.
const kids: Member[] = [{ age: 'adult' }, { age: 'adult' }, { age: 'child' }, { age: 'child' }, { age: 'child' }];
assert.ok(householdDaily(kids).total >= 15 * 5);

// Heat adds drinking water: +1 L/person at PAGASA "Danger"
near(householdDaily(family, 45).total, 64.3);

// Score = ½ trained model + ½ ECMWF ensemble, both probabilities
const obs = { rainRatio: 0.5, oni: 1.8, ecoZ: -1, heatIndexC: 40 };
assert.equal(severity(riskScore({ ...obs, pModel: 0.8, pForecast: 0.9 })), 'high');
assert.equal(severity(riskScore({ ...obs, pModel: 0.1, pForecast: 0.2 })), 'low');
near(riskScore({ ...obs, pModel: 0.4, pForecast: 0.6 }), 0.5);

// Model plumbing: zero weights → 50%; a positive ONI weight raises the probability with ONI
const flat = { features: ['oni', 'rainPast3'], mean: [0, 0], std: [1, 1], coef: [0, 0], intercept: 0 };
near(predictDrySpell(flat, modelFeatures(1.8, 1, [0.6, 0.5, 0.4], -1, 11)), 0.5);
const oniOnly = { ...flat, coef: [1, 0] };
assert.ok(predictDrySpell(oniOnly, modelFeatures(1.8, 1, [1, 1, 1], 0, 1)) > predictDrySpell(oniOnly, modelFeatures(-1, 1, [1, 1, 1], 0, 1)));
const feats = modelFeatures(1.8, 1.2, [0.6, 0.9, 0.3], 0, 1);
near(feats.rainPast3, 0.6);
near(feats.rainLast, 0.3);
assert.ok(Math.abs(feats.oniTrend - 0.6) < 1e-9);

// Ensemble: share of members reaching a dry spell (2 of 4 here)
near(ensembleDrySpellProb([1, 0.7], [[0.6, 0.6, 1], [0.3, 0.3, 0.3], [1, 1, 1], [0.9, 1.1, 1]]), 0.5);

// PAGASA drought classes
assert.equal(droughtClass([0.7, 0.7]), 'dry_condition');
assert.equal(droughtClass([0.7, 0.7, 0.7]), 'dry_spell');
assert.equal(droughtClass([0.3, 0.3]), 'dry_spell');
assert.equal(droughtClass([0.7, 0.7, 0.7, 0.7, 0.7]), 'drought');
assert.equal(droughtClass([0.3, 0.3, 0.3]), 'drought');
assert.equal(droughtClass([0.7, 1.0]), 'none');

// Time to impact: 1 below month observed, dry spell reached on 2nd forecast month
assert.equal(monthsToDrySpell([1.0, 0.7], [0.6, 0.5, 0.9]), 2);
assert.equal(monthsToDrySpell([0.3, 0.3], [1.0]), 0);
assert.equal(monthsToDrySpell([1.0], [1.0, 1.1]), null);

// Reserve days match the old tiers at the band edges
near(reserveDays(0.2), 3);
near(reserveDays(0.6), 14);

// Calibration never drops below Sphere minimum, caps at 1.5
let f = 1;
for (let i = 0; i < 10; i++) f = updateCalibration(f, { storedLiters: 400, eventDays: 7, leftoverFraction: 0.5 }, 60);
near(f, 1);
f = 1;
for (let i = 0; i < 10; i++) f = updateCalibration(f, { storedLiters: 600, eventDays: 7, ranOutOnDay: 2 }, 60);
near(f, 1.5);

// Full plan: the old "5 L every 3 days" took 466 days to fill 777 L — pacing must finish before impact
const base: PlanInput = {
  members: family, storage: 'large', storedLiters: 0, calibration: 1, coastal: false,
  risk: { ...obs, pModel: 0.7, pForecast: 0.8 },
  observedRatios: [0.9, 0.7], forecastRatios: [0.6, 0.5, 0.5],
};
const plan = buildPlan(base);
assert.equal(plan.daysToImpact, 60);
assert.ok(plan.targetRange[0] < plan.targetRange[1], 'always a range');
assert.ok((plan.litersEvery3Days / 3) * (plan.daysToImpact! - 3) >= plan.storable, 'fills before impact');
assert.equal(plan.litersEvery3Days % 5, 0, 'whole 5 L steps');
assert.equal(plan.shortfall, 0);

// Spec §7 asymmetric ×0.85–×1.20 band (never one hard number)
assert.ok(Math.abs(plan.targetRange[1] / plan.targetRange[0] - 1.2 / 0.85) < 0.05);

// Two tiers: essential reserve (7.5 L/p/d) is about half the full 15 L goal
assert.ok(plan.fullTarget > plan.targetRange[1]);
near(householdDaily(family).essential, 7.5 * 4 + 0.3);

// Dry spell already underway: pacing stays humanly possible and flags urgency
const now = buildPlan({ ...base, observedRatios: [0.3, 0.3], forecastRatios: [0.3] });
assert.equal(now.daysToImpact, 0);
assert.ok(now.urgent);
assert.ok(now.litersEvery3Days <= Math.ceil(now.storable / 3 / 5) * 5, `${now.litersEvery3Days} L per trip`);

// 3-option check-in (spec §8): short ×1.15, extra ×0.95, never below 1.0 or above 1.5
near(calibrationFromAnswer(1, 'short'), 1.15);
near(calibrationFromAnswer(1.15, 'fine'), 1.15);
assert.ok(Math.abs(calibrationFromAnswer(1.15, 'extra') - 1.0925) < 0.001);
near(calibrationFromAnswer(1, 'extra'), 1);
let g = 1; for (let i = 0; i < 20; i++) g = calibrationFromAnswer(g, 'short');
near(g, 1.5);

// Small storage → capped, shortfall routed to refill + rainwater pathways; coastal → salinity
const small = buildPlan({ ...base, storage: 'small', coastal: true, projection2050: { dryRainChangePct: -12, tmaxChangeC: 1.9 } });
assert.equal(small.storable, 40);
assert.ok(small.shortfall > 0);
const ids = small.pathways.map((p) => p.id);
for (const id of ['cover', 'store', 'refill', 'rainwater', 'salinity', 'upgrade']) assert.ok(ids.includes(id), id);
assert.deepEqual(new Set(small.pathways.map((p) => p.horizon)), new Set(['now', 'season', 'long_term']));

// Real 2041–50 projections are +0.7–1.0 °C and wetter: long-term pathway must still appear
const wetter = buildPlan({ ...base, projection2050: { dryRainChangePct: 6.5, tmaxChangeC: 0.99 } });
assert.ok(wetter.pathways.some((p) => p.id === 'upgrade'));

// Town pathways: imminent dry spell → advisory now; low risk, no dry spell → long-term only
const town = municipalPathways({ severity: 'high', monthsToDrySpell: 2, heatIndexC: 43, coastal: true, projection2050: { dryRainChangePct: 6.5, tmaxChangeC: 0.99 } });
for (const id of ['advisory', 'water-points', 'cooling', 'rain-capture', 'refill-map', 'storage-infra', 'watershed', 'salinity-monitor']) assert.ok(town.some((p) => p.id === id), id);
const calm = municipalPathways({ severity: 'low', monthsToDrySpell: null, heatIndexC: 30, coastal: false });
assert.deepEqual(calm.map((p) => p.horizon), ['long_term']);

console.log('aquaready: all checks passed', { target: plan.targetRange, every3Days: plan.litersEvery3Days, severity: plan.severity });


// Shortfall must count water already stored: logging more than the listed containers hold
// (i.e. the family has unlisted containers) must not keep saying "still need X L".
const smallBox = { ...base, storage: 'small' as const, storageCapacityLiters: 240 };
const need = buildPlan(smallBox).targetRange[1];
assert.equal(buildPlan({ ...smallBox, storedLiters: 0 }).shortfall, need - 240);
assert.equal(buildPlan({ ...smallBox, storedLiters: 300 }).shortfall, need - 300);
assert.equal(buildPlan({ ...smallBox, storedLiters: need + 100 }).shortfall, 0);
assert.equal(buildPlan({ ...smallBox, storedLiters: need + 100 }).litersEvery3Days, 0);

// Heat index vs NOAA's published table (°F → °C): 90 °F/70% → 106 °F; 96 °F/65% → 121 °F; 80 °F/40% → 80 °F
const nearC = (a: number, f: number) => assert.ok(Math.abs(a - (f - 32) * 5 / 9) <= 1.1, `${a} vs ${f}°F`);
nearC(heatIndexC(32.2, 70), 106);
nearC(heatIndexC(35.6, 65), 121);
nearC(heatIndexC(26.7, 40), 80);
assert.equal(heatLevel(41.9), 'extremeCaution');
assert.equal(heatLevel(42), 'danger');
assert.equal(heatLevel(52), 'extremeDanger');
assert.deepEqual(dailyHeat([{ date: 'd', t: [30, 34], rh: [60, 60] }]).map((x) => x.hi), [heatIndexC(34, 60)]);

// Calendar: forecast starts with the current month; dry spell reached in December → days from today to Dec 1
const cal = buildPlan({ ...base, observedRatios: [1.0], forecastRatios: [1.0, 0.7, 0.7, 0.7], asOf: '2026-09', today: new Date(Date.UTC(2026, 8, 24)) });
assert.equal(cal.impactMonth, '2026-12');
assert.equal(cal.daysToImpact, 68);

// Notifications (spec §6.D)
import { computeAlerts } from '../src/aquaready/alerts';
const today = new Date('2026-09-24T12:00:00Z');
const kinds = (s: Parameters<typeof computeAlerts>[0]) => computeAlerts(s, today).map((a) => a.kind);
const alertBase = { dataDate: '2026-09-24T00:00:00Z', litersEvery3Days: 30 };
assert.deepEqual(kinds({ ...alertBase, severity: 'high' }), ['advisory', 'pacing']); // never logged → remind now
assert.deepEqual(kinds({ ...alertBase, severity: 'high', lastAddedAt: '2026-09-23T12:00:00Z' }), ['advisory']); // topped up yesterday
assert.deepEqual(kinds({ ...alertBase, severity: 'high', lastAddedAt: '2026-09-21T11:00:00Z' }), ['advisory', 'pacing']); // 3+ days ago
assert.deepEqual(kinds({ ...alertBase, severity: 'low' }), []);
assert.deepEqual(kinds({ ...alertBase, severity: 'low', alertSeverity: 'high' }), ['checkin']); // dry period over
// Heat: alert only at PAGASA "Danger" (≥ 42 °C), once, dated to the first dangerous day
assert.deepEqual(kinds({ ...alertBase, severity: 'low', heatDays: [{ date: '2026-09-25', hi: 40 }] }), []);
const heat = computeAlerts({ ...alertBase, severity: 'low', heatDays: [{ date: '2026-09-25', hi: 41 }, { date: '2026-09-26', hi: 43.4 }, { date: '2026-09-27', hi: 45.6 }] }, today);
assert.deepEqual(heat.map((a) => [a.kind, a.id, a.value]), [['heat', 'heat-2026-09-26', 46]]);
console.log('alerts: all checks passed');
