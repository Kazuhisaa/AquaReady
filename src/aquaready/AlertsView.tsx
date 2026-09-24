// Alerts tab (spec §6.D): advisory, pacing reminder, post-event check-in prompt.
// Tapping the advisory opens the "why + what to do" explanation (RisksView).
import { useEffect, useState } from 'react';
import { ArrowLeft, BellRing, ChevronRight } from 'lucide-react';
import type { Alert } from './alerts';
import { RisksView } from './RisksView';
import { RainTimeline } from './Visuals';
import type { Conditions } from './scenario';
import type { buildPlan } from '../services/aquaready';
import type { Language } from '../services/i18n';

type Plan = ReturnType<typeof buildPlan>;

const RISK_WORD = {
  en: { high: 'High risk', moderate: 'Medium risk', low: 'Low risk' },
  tl: { high: 'Mataas ang panganib', moderate: 'Katamtaman ang panganib', low: 'Mababa ang panganib' },
};

export function alertText(a: Alert, plan: Plan, town: string, lang: Language): { icon: string; title: string; sub: string } {
  const en = lang === 'en';
  if (a.kind === 'advisory') return {
    icon: plan.severity === 'high' ? '🔴' : '🟠',
    title: en ? `${RISK_WORD.en[plan.severity]} in ${town}. Start storing water now.` : `${RISK_WORD.tl[plan.severity]} sa ${town}. Simulan na ang pag-iipon ng tubig.`,
    sub: en ? 'Tap to see why and what to do.' : 'Pindutin para malaman kung bakit at ano ang gagawin.',
  };
  if (a.kind === 'pacing') return {
    icon: '💧',
    title: en ? `Time to add ${plan.litersEvery3Days} L of water.` : `Oras nang magdagdag ng ${plan.litersEvery3Days} L na tubig.`,
    sub: en ? 'Log it in your storage plan when done.' : 'I-log sa plano mo kapag tapos na.',
  };
  return {
    icon: '✅',
    title: en ? 'Is the dry spell over? Tell us if your water lasted.' : 'Tapos na ba ang tagtuyot? Sabihin kung tumagal ang tubig ninyo.',
    sub: en ? 'Your answer adjusts your next target.' : 'Iaayon dito ang susunod mong target.',
  };
}

export function AlertsView({ alerts, plan, cond, stored, lang, onOpenPlan, onOpenCheckIn, onSeen }: {
  alerts: Alert[]; plan: Plan; cond: Conditions; stored: number; lang: Language;
  onOpenPlan: () => void; onOpenCheckIn: () => void; onSeen: (ids: string[]) => void;
}) {
  const en = lang === 'en';
  const [detail, setDetail] = useState(false);
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  // Opening the tab counts as reading every alert on it.
  const ids = alerts.map((a) => a.id).join('|');
  useEffect(() => { if (ids) onSeen(ids.split('|')); }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  if (detail) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setDetail(false)} className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 cursor-pointer">
          <ArrowLeft className="w-4 h-4" aria-hidden /> {en ? 'Back to alerts' : 'Bumalik sa mga abiso'}
        </button>
        <RisksView plan={plan} cond={cond} stored={stored} lang={lang} onOpenPlan={onOpenPlan} />
      </div>
    );
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(en ? 'en-US' : 'fil-PH', { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
        <h2 className="text-lg font-extrabold text-slate-900 m-0">{en ? 'Alerts' : 'Mga Abiso'}</h2>
        <p className="text-xs text-slate-500 m-0 mt-0.5">
          {en ? `We alert you when water risk rises in ${cond.lgu.name}, and when it's time to add water.` : `Aabisuhan ka namin kapag tumaas ang panganib sa ${cond.lgu.name}, at kapag oras nang magdagdag ng tubig.`}
        </p>
        {perm === 'default' && (
          <button type="button" onClick={() => Notification.requestPermission().then(setPerm)}
            className="mt-3 inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer">
            <BellRing className="w-4 h-4" aria-hidden /> {en ? 'Show alerts on my phone' : 'Ipakita ang abiso sa phone ko'}
          </button>
        )}
      </div>

      <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-2">
        <h3 className="text-sm font-extrabold text-slate-900 m-0">
          {en ? `Rain in ${cond.lgu.name} vs a usual month` : `Ulan sa ${cond.lgu.name} kumpara sa karaniwan`}
        </h3>
        <RainTimeline months={cond.timeline} hindsight={cond.hindsight} en={en} />
      </div>

      {alerts.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
          {en ? `No new alerts. Water risk in ${cond.lgu.name} is low right now.` : `Walang bagong abiso. Mababa ang panganib sa ${cond.lgu.name} ngayon.`}
        </div>
      ) : (
        <ul className="m-0 p-0 list-none space-y-2">
          {alerts.map((a) => {
            const t = alertText(a, plan, cond.lgu.name, lang);
            const open = a.kind === 'advisory' ? () => setDetail(true) : a.kind === 'pacing' ? onOpenPlan : onOpenCheckIn;
            return (
              <li key={a.id}>
                <button type="button" onClick={open}
                  className="w-full p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs flex items-start gap-3 text-left cursor-pointer hover:border-sky-300">
                  <span className="text-lg leading-none mt-0.5" aria-hidden>{t.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{t.title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{t.sub} · {fmt(a.at)}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
