// Risks tab: what could cause water scarcity in the household's town, in plain words, and what to do.
// Exact numbers and sources sit behind "How do we know?" for anyone who wants to verify.
import type { ReactNode } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { addMonths, type Conditions, DATA, monthLabel } from './scenario';
import riskModel from '../data/riskModel.json';
import type { buildPlan, Severity } from '../services/aquaready';
import type { Language } from '../services/i18n';

type Plan = ReturnType<typeof buildPlan>;

const MONTHS_TL = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (ym: string, lang: Language) => (lang === 'en' ? MONTHS_EN : MONTHS_TL)[Number(ym.slice(5)) - 1];

const SEV: Record<Severity, { dot: string; box: string; en: string; tl: string }> = {
  high: { dot: '🔴', box: 'bg-rose-50 border-rose-200', en: 'High risk', tl: 'Mataas ang panganib' },
  moderate: { dot: '🟠', box: 'bg-amber-50 border-amber-200', en: 'Medium risk', tl: 'Katamtaman ang panganib' },
  low: { dot: '🟢', box: 'bg-emerald-50 border-emerald-200', en: 'Low risk', tl: 'Mababa ang panganib' },
};

/** "about half", "less than half" … of normal rain, in words people use. */
function rainWords(ratio: number, lang: Language) {
  if (lang === 'en') return ratio <= 0.45 ? 'less than half of the usual rain' : ratio <= 0.6 ? 'only about half of the usual rain' : 'less rain than usual';
  return ratio <= 0.45 ? 'wala pang kalahati ng karaniwang ulan' : ratio <= 0.6 ? 'mga kalahati lang ng karaniwang ulan' : 'mas kaunting ulan kaysa karaniwan';
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs ${className}`}>{children}</div>;
}

export function RisksView({ plan, cond, stored, lang, onOpenPlan }: {
  plan: Plan; cond: Conditions; stored: number; lang: Language; onOpenPlan: () => void;
}) {
  const en = lang === 'en';
  const town = cond.lgu.name;
  const past3 = cond.observedRatios.slice(-3);
  const past3Avg = past3.length ? past3.reduce((a, b) => a + b, 0) / past3.length : 1;
  const advisoryLevel = DATA.enso.level ?? 0;
  const s = SEV[plan.severity];

  const when = plan.daysToImpact === null
    ? (en ? 'No dry spell is expected in the next 6 months.' : 'Walang inaasahang tagtuyot sa susunod na 6 na buwan.')
    : !plan.impactMonth
      ? (en ? 'Your town is already in a dry spell.' : 'Tagtuyot na ngayon sa inyong bayan.')
      : en ? `Water may run low starting ${monthName(plan.impactMonth, lang)}.` : `Posibleng kumonti ang tubig simula ${monthName(plan.impactMonth, lang)}.`;

  // ---- Why: only the causes that apply right now ----
  const why: [string, string][] = [];
  if (cond.risk.rainRatio < 0.9) why.push(['🌧️', en
    ? `Expect ${rainWords(cond.risk.rainRatio, lang)} in the next 3 months.`
    : `Inaasahan ang ${rainWords(cond.risk.rainRatio, lang)} sa susunod na 3 buwan.`]);
  if (advisoryLevel >= 1 || cond.risk.oni >= 0.5) why.push(['🌊', en
    ? 'El Niño is here. It makes the weather hotter and drier.'
    : 'May El Niño ngayon. Mas mainit at mas tuyo ang panahon dahil dito.']);
  if (past3Avg < 0.8) why.push(['☀️', en
    ? 'The last 3 months were already drier than usual.'
    : 'Mas tuyo na ang nakaraang 3 buwan kaysa karaniwan.']);
  if (cond.risk.ecoZ <= -1) why.push(['🌱', en
    ? 'The ground is dry, so wells and water pumps can drop faster.'
    : 'Tuyo na ang lupa, kaya mas mabilis bumaba ang tubig sa balon at poso.']);
  if (cond.risk.heatIndexC >= 42) why.push(['🌡️', en
    ? `Dangerous heat this week (heat index up to ${Math.round(cond.risk.heatIndexC)}°C), so everyone needs to drink more.`
    : `Delikadong init ngayong linggo (heat index hanggang ${Math.round(cond.risk.heatIndexC)}°C), kaya mas maraming tubig ang kailangang inumin.`]);
  const sl = cond.projection2050?.seaLevel2050;
  if (cond.coastal && (plan.severity !== 'low' || sl)) why.push(['🧂', en
    ? `Your town is by the sea. Well water can turn salty in a long dry spell${sl ? `, and the sea is expected to rise about ${Math.round(sl.p50 * 100)} cm by 2050` : ''}.`
    : `Malapit sa dagat ang inyong bayan. Puwedeng umalat ang tubig sa balon kapag matagal ang tagtuyot${sl ? `, at inaasahang tataas ang dagat nang mga ${Math.round(sl.p50 * 100)} cm pagsapit ng 2050` : ''}.`]);

  // ---- What to do: one main action, then the rest ----
  const containersFull = stored >= plan.storable && plan.litersEvery3Days === 0;
  const main = containersFull && plan.shortfall > 0
    ? (en ? `Your containers are full, but you still need about ${plan.shortfall} L more. Add containers or find a refill point.`
      : `Puno na ang mga lalagyan mo, pero kulang pa ng mga ${plan.shortfall} L. Magdagdag ng lalagyan o alamin ang pinakamalapit na igiban.`)
    : containersFull
    ? (en ? 'Your reserve is full. Keep it fresh by using the oldest water first.' : 'Kumpleto na ang ipon mo. Gamitin muna ang pinakalumang tubig para laging sariwa.')
    : plan.urgent
      ? (en ? `Store as much as you can today, then ${plan.litersEvery3Days} L every 3 days.` : `Mag-ipon na ngayon ng kaya mo, tapos ${plan.litersEvery3Days} L kada 3 araw.`)
      : (en ? `Store ${plan.litersEvery3Days} L every 3 days.` : `Mag-ipon ng ${plan.litersEvery3Days} L kada 3 araw.`);

  const someRain = cond.timeline.some((m) => m.kind === 'forecast' && m.month <= addMonths(cond.asOf, 1) && m.ratio >= 0.3);
  const todo: string[] = [
    en ? 'Cover drums and pails tightly so mosquitoes can’t breed in them.' : 'Takpan nang mahigpit ang drum at balde para hindi pamugaran ng lamok.',
  ];
  if (stored > 0) todo.push(en ? 'Use the oldest stored water first, then refill it with fresh water.' : 'Gamitin muna ang pinakalumang naipong tubig, tapos palitan ng bago.');
  if (someRain) todo.push(en ? 'When it rains, catch rainwater for cleaning and flushing.' : 'Kapag umulan, sahurin ang tubig-ulan para sa panlinis at pang-flush.');
  if (plan.shortfall > 0 || plan.urgent) todo.push(en
    ? `Find the nearest water refill point in your barangay${plan.shortfall > 0 ? `, or add containers (you're short about ${plan.shortfall} L)` : ''}.`
    : `Alamin ang pinakamalapit na igiban o refilling station sa barangay${plan.shortfall > 0 ? `, o magdagdag ng lalagyan (kulang ng mga ${plan.shortfall} L)` : ''}.`);
  if (plan.severity === 'high') todo.push(en ? 'If tap water gets weak or cuts off, boil water before drinking.' : 'Kapag humina o nawala ang tubig sa gripo, pakuluan muna bago inumin.');
  if (cond.coastal && plan.severity !== 'low') todo.push(en ? 'If well water tastes salty, don’t drink it. Buy drinking water instead.' : 'Kung maalat ang lasa ng tubig sa balon, huwag itong inumin. Bumili ng inuming tubig.');
  const proj = cond.projection2050;
  if (sl) todo.push(en
    ? 'For the years ahead: as the sea rises, wells near the shore get saltier. Plan for a rain tank or a deeper, inland water source.'
    : 'Para sa mga susunod na taon: habang tumataas ang dagat, mas umaalat ang mga balon malapit sa baybayin. Magplano ng tangke ng tubig-ulan o mas malalim na balon na malayo sa dagat.');
  if (proj && (proj.tmaxChangeC >= 0.5 || proj.dryRainChangePct <= -5)) todo.push(en
    ? `For the years ahead: summers around ${town} are expected to get hotter by 2050 (about +${proj.tmaxChangeC.toFixed(1)}°C). Save up for a bigger tank or a rain catcher.`
    : `Para sa mga susunod na taon: inaasahang mas iinit pa ang tag-araw sa ${town} pagsapit ng 2050 (mga +${proj.tmaxChangeC.toFixed(1)}°C). Mag-ipon para sa mas malaking tangke o pansahod ng ulan.`);

  // 2023–24 El Niño case study from training: areas that had a dry spell, and how many the model warned ahead
  const study = riskModel.caseStudies.find((c) => c.name.startsWith('2023'));
  const leads = study?.towns.filter((t) => t.warned).map((t) => t.monthsAhead ?? 0) ?? [];
  const elNino = study && leads.length > 0 && {
    hit: study.towns.filter((t) => t.onset).length, warned: leads.length,
    lead: Math.min(...leads) === Math.max(...leads) ? `${Math.min(...leads)}` : `${Math.min(...leads)}–${Math.max(...leads)}`,
  };
  const updated = new Date(DATA.generatedAt).toLocaleDateString(en ? 'en-US' : 'fil-PH', { day: 'numeric', month: 'short', year: 'numeric' });
  const pct = (r: number) => `${Math.round(r * 100)}%`;

  return (
    <div className="space-y-3.5">
      <Card className={s.box}>
        <h2 className="text-lg font-extrabold text-slate-900 m-0">{s.dot} {en ? `${s.en} in ${town}` : `${s.tl} sa ${town}`}</h2>
        <p className="text-sm text-slate-700 m-0 mt-1">{when}</p>
        <p className="text-sm text-slate-700 m-0 mt-1">
          {en ? `About ${Math.round(plan.score * 10)} in 10 chance of a dry spell in the next 3 months.`
            : `Mga ${Math.round(plan.score * 10)} sa 10 ang tsansa ng tagtuyot sa susunod na 3 buwan.`}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-800 bg-white/70 border border-sky-200 rounded-full px-2.5 py-1 mt-2.5 mb-0">
          <span aria-hidden>🤖</span>
          {cond.hindsight
            ? (en ? `Wave AI · as of ${monthLabel(cond.asOf, true)} (replay)` : `Wave AI · noong ${monthLabel(cond.asOf, true)} (balik-tanaw)`)
            : en ? `Wave AI forecast · 5 data sources · ${updated}` : `Hula ng Wave AI · 5 data source · ${updated}`}
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-sky-700">{en ? 'Do this now' : 'Gawin ngayon'}</div>
        <p className="text-base font-bold text-slate-900 m-0">{main}</p>
        <button type="button" onClick={onOpenPlan}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 cursor-pointer">
          {en ? 'Open my storage plan' : 'Buksan ang plano ko'} <ArrowRight className="w-4 h-4" aria-hidden />
        </button>
      </Card>

      <Card className="space-y-2.5">
        <h3 className="text-sm font-extrabold text-slate-900 m-0">{en ? 'Why?' : 'Bakit?'}</h3>
        {why.length === 0 ? (
          <p className="text-sm text-slate-600 m-0">{en ? 'No big threat to your water right now.' : 'Walang malaking banta sa tubig ninyo ngayon.'}</p>
        ) : (
          <ul className="m-0 p-0 list-none space-y-2">
            {why.map(([icon, text]) => (
              <li key={text} className="flex gap-2.5 text-sm text-slate-700"><span aria-hidden>{icon}</span><span>{text}</span></li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2.5">
        <h3 className="text-sm font-extrabold text-slate-900 m-0">{en ? 'Also do these' : 'Iba pang dapat gawin'}</h3>
        <ul className="m-0 p-0 list-none space-y-2">
          {todo.map((text) => (
            <li key={text} className="flex gap-2.5 text-sm text-slate-700"><span aria-hidden>✅</span><span>{text}</span></li>
          ))}
        </ul>
      </Card>

      <details className="group p-4 rounded-2xl border border-slate-200/90 bg-white">
        <summary className="flex items-center justify-between cursor-pointer text-sm font-bold text-slate-700 list-none">
          {en ? 'How do we know?' : 'Paano namin nalaman?'}
          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-3 mb-0 text-xs text-slate-600 leading-relaxed">
          {en
            ? `The chance mixes two forecasts, half each: an AI model we trained on ${riskModel.data.trainPeriod} rain and soil records for Isabela, and the ECMWF weather model's forecast for ${cond.lgu.name}. `
              + (elNino ? `Tested on years it never saw, it warned ${elNino.warned} of ${elNino.hit} areas ${elNino.lead} months before their dry spell in the 2023–24 El Niño. ` : '')
              + 'On its own it is only somewhat better than guessing from averages, which is why we combine it with ECMWF. Your check-in answers then adjust your own target.'
            : `Pinagsasama ng tsansa ang dalawang hula, kalahati bawat isa: isang AI model na tinuruan namin gamit ang datos ng ulan at lupa sa Isabela mula ${riskModel.data.trainPeriod}, at ang forecast ng ECMWF weather model para sa ${cond.lgu.name}. `
              + (elNino ? `Sinubok sa mga taong hindi nito nakita: sa 2023–24 El Niño, nabalaan nito ang ${elNino.warned} sa ${elNino.hit} na lugar ${elNino.lead} buwan bago magsimula ang tagtuyot. ` : '')
              + 'Mag-isa, bahagya lang itong mas magaling kaysa sa paghula batay sa karaniwan, kaya pinagsasama namin ito sa ECMWF. Ang sagot mo sa Check-In naman ang nag-aayos ng sarili mong target.'}
        </p>
        <dl className="mt-3 space-y-2 text-xs text-slate-600">
          <Row k={en ? 'Rain, next 3 months' : 'Ulan, susunod na 3 buwan'}
            v={`${pct(cond.risk.rainRatio)} ${en ? 'of normal' : 'ng normal'} (${pct(cond.rainRatioDry)}–${pct(cond.rainRatioWet)})`} src={DATA.sources.forecast} />
          <Row k="PAGASA" v={`“${DATA.enso.quote ?? DATA.enso.label}” (${DATA.enso.issued})`} src={DATA.enso.url} />
          <Row k={en ? 'Ocean temperature (ONI)' : 'Init ng dagat (ONI)'} v={`${cond.risk.oni >= 0 ? '+' : ''}${cond.risk.oni.toFixed(2)} (${monthLabel(cond.oniMonth, true)})`} src={DATA.sources.oni} />
          <Row k={en ? 'Rain, last 3 months' : 'Ulan, nakaraang 3 buwan'} v={`${pct(past3Avg)} ${en ? 'of normal' : 'ng normal'}`} src={DATA.sources.normals} />
          <Row k={en ? 'Soil moisture' : 'Basa ng lupa'} v={`${cond.risk.ecoZ >= 0 ? '+' : ''}${cond.risk.ecoZ.toFixed(1)} SD`} src={DATA.sources.soil} />
          <Row k={en ? (cond.hindsight ? 'Feels-like max temp that month' : 'Peak heat index, next 7 days') : (cond.hindsight ? 'Pinakamainit na pakiramdam noong buwang iyon' : 'Pinakamataas na heat index, susunod na 7 araw')} v={`${cond.risk.heatIndexC.toFixed(0)}°C`} src={DATA.sources.heat} />
          {proj && <Row k="2041–2050" v={`${proj.dryRainChangePct > 0 ? '+' : ''}${proj.dryRainChangePct.toFixed(0)}% ${en ? 'dry-season rain' : 'ulan sa tag-araw'}, +${proj.tmaxChangeC.toFixed(1)}°C`} src={DATA.sources.projection} />}
          <Row k={en ? 'Chance of a dry spell, next 3 months' : 'Tsansa ng tagtuyot, susunod na 3 buwan'}
            v={`${pct(plan.score)} = ${cond.hindsight ? (en ? 'AI model only (time machine)' : 'AI model lang (balik-tanaw)') : `½ AI ${pct(cond.risk.pModel)} + ½ ECMWF ${pct(cond.risk.pForecast)}`} (${en ? 'low <30% · medium <60% · high' : 'mababa <30% · katamtaman <60% · mataas'})`} />
          <Row k={en ? 'AI model test (unseen years)' : 'Test ng AI model (hindi nakitang taon)'}
            v={`AUC ${riskModel.test.auc.toFixed(2)} · Brier skill ${riskModel.test.brierSkill >= 0 ? '+' : ''}${riskModel.test.brierSkill.toFixed(2)} · ${en ? 'at 30%' : 'sa 30%'}: ${riskModel.test.hits30}/${riskModel.test.events} ${en ? 'dry spells warned' : 'tagtuyot nabalaan'}, ${riskModel.test.falseAlarms30} ${en ? 'false alarms' : 'maling babala'} (${riskModel.data.testPeriod})`} src="scripts/train-model.ts" />
          {sl && <Row k={en ? 'Sea level by 2050' : 'Taas ng dagat pagsapit ng 2050'}
            v={`+${Math.round(sl.p50 * 100)} cm (${Math.round(sl.p17 * 100)}–${Math.round(sl.p83 * 100)} cm), ${en ? 'incl.' : 'kasama ang'} ${Math.round(sl.landSinking * 100)} cm ${en ? 'from land sinking' : 'mula sa paglubog ng lupa'}`} src={DATA.sources.seaLevel} />}
        </dl>
        <p className="text-[11px] text-slate-400 mt-3 mb-0">{en ? 'Updated' : 'Na-update'}: {updated}</p>
      </details>
    </div>
  );
}

function Row({ k, v, src }: { k: string; v: string; src?: string }) {
  return (
    <div>
      <dt className="font-bold text-slate-800">{k}</dt>
      <dd className="m-0">{v}{src && <span className="block text-slate-400 break-words">{src}</span>}</dd>
    </div>
  );
}
