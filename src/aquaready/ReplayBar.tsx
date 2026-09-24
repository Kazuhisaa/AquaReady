// Time machine: re-run the app as if it were a month of the 2023–24 El Niño, on the real data of that time.
// Scores use the trained AI model alone (it never saw 2013 onward in training), so this is an honest test.
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { earlyWarning, REPLAY_MONTHS } from './scenario';
import { riskScore } from '../services/aquaready';
import type { Language } from '../services/i18n';

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  tl: ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'],
};

export function ReplayBar({ month, onMonth, town, lang, onExit }: {
  month: string; onMonth: (m: string) => void; town: string; lang: Language; onExit: () => void;
}) {
  const en = lang === 'en';
  const name = (ym: string | null) => (ym ? `${MONTHS[lang][Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}` : '');
  const i = REPLAY_MONTHS.indexOf(month);
  const ew = useMemo(() => earlyWarning(town, (c) => riskScore(c.risk)), [town]);

  const verdict = !ew.drySpell
    ? (en ? `${town} had no dry spell in this period.` : `Walang tagtuyot sa ${town} sa panahong ito.`)
    : ew.firstModerate && ew.firstModerate <= ew.drySpell
      ? (en ? `The AI first warned in ${name(ew.firstModerate)}; the dry spell was reached in ${name(ew.drySpell)}.`
        : `Unang nagbabala ang AI noong ${name(ew.firstModerate)}; umabot sa tagtuyot noong ${name(ew.drySpell)}.`)
      : (en ? `The AI did not warn before the dry spell was reached in ${name(ew.drySpell)}.`
        : `Hindi nakapagbabala ang AI bago umabot sa tagtuyot noong ${name(ew.drySpell)}.`);

  return (
    <div className="mb-3 p-3.5 rounded-2xl border-2 border-violet-300 bg-violet-50 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-violet-800">
          <History className="w-4 h-4" aria-hidden /> {en ? 'Time machine · 2023–24 El Niño' : 'Balik-tanaw · 2023–24 El Niño'}
        </span>
        <button type="button" onClick={onExit} className="text-xs font-bold text-violet-800 underline cursor-pointer">
          {en ? 'Back to today' : 'Bumalik sa ngayon'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" aria-label={en ? 'Previous month' : 'Nakaraang buwan'} disabled={i <= 0} onClick={() => onMonth(REPLAY_MONTHS[i - 1])}
          className="w-9 h-9 rounded-full bg-white border border-violet-200 grid place-items-center disabled:opacity-40 cursor-pointer">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <div className="text-lg font-black text-violet-950 leading-tight">{name(month)}</div>
          <input type="range" min={0} max={REPLAY_MONTHS.length - 1} value={i} onChange={(e) => onMonth(REPLAY_MONTHS[Number(e.target.value)])}
            aria-label={en ? 'Month' : 'Buwan'} className="w-full accent-violet-600 cursor-pointer" />
        </div>
        <button type="button" aria-label={en ? 'Next month' : 'Susunod na buwan'} disabled={i >= REPLAY_MONTHS.length - 1} onClick={() => onMonth(REPLAY_MONTHS[i + 1])}
          className="w-9 h-9 rounded-full bg-white border border-violet-200 grid place-items-center disabled:opacity-40 cursor-pointer">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs font-semibold text-violet-950 m-0">{verdict}</p>
      <p className="text-[11px] text-violet-800/80 m-0">
        {en
          ? 'Real data from that time. Only the AI model is used here, and it never saw these years while training.'
          : 'Totoong datos noong panahong iyon. AI model lang ang gamit dito, at hindi nito nakita ang mga taong ito habang nagsasanay.'}
      </p>
    </div>
  );
}
