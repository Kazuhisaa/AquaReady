// Heat alert detail: next 7 days' heat index with PAGASA's categories, and what to do about it.
import type { Conditions } from './scenario';
import { heatAddLpd, heatLevel, type HeatLevel } from '../services/aquaready';
import type { Language } from '../services/i18n';

const LEVEL: Record<HeatLevel, { en: string; tl: string; cls: string }> = {
  none: { en: 'Normal', tl: 'Normal', cls: 'bg-slate-100 text-slate-700' },
  caution: { en: 'Caution', tl: 'Caution', cls: 'bg-yellow-100 text-yellow-900' },
  extremeCaution: { en: 'Extreme caution', tl: 'Extreme caution', cls: 'bg-amber-100 text-amber-900' },
  danger: { en: 'Danger', tl: 'Danger', cls: 'bg-orange-200 text-orange-950' },
  extremeDanger: { en: 'Extreme danger', tl: 'Extreme danger', cls: 'bg-rose-200 text-rose-950' },
};

export function HeatView({ cond, lang }: { cond: Conditions; lang: Language }) {
  const en = lang === 'en';
  const peak = Math.max(...cond.heatDays.map((d) => d.hi));
  const level = heatLevel(peak);
  const extraL = heatAddLpd(peak);
  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(en ? 'en-US' : 'fil-PH', { weekday: 'short', month: 'short', day: 'numeric' });

  const todo = en
    ? [
        'Drink water often, even if you are not thirsty.',
        'Avoid work or play outdoors from 10 AM to 4 PM.',
        'Give drinking water first to older people, babies, pregnant women and anyone sick.',
        'Keep stored water covered and in the shade. Don’t leave water jugs in the sun.',
        extraL > 0 && `We already added ${extraL} L of drinking water per person per day to your target this week.`,
        'Heat stroke signs: very hot skin, confusion, no more sweating, fainting. Move the person to shade, wet their body, and call 911 or your health center.',
        level === 'extremeDanger' && 'Stay indoors or in the shade as much as you can.',
      ]
    : [
        'Uminom nang madalas, kahit hindi nauuhaw.',
        'Iwasang magtrabaho o maglaro sa labas mula 10 AM hanggang 4 PM.',
        'Unahin sa inuming tubig ang matatanda, sanggol, buntis, at may sakit.',
        'Takpan at ilagay sa lilim ang naipong tubig. Huwag iwan sa araw ang mga galon.',
        extraL > 0 && `Nadagdagan na namin ng ${extraL} L na inuming tubig bawat tao kada araw ang target mo ngayong linggo.`,
        'Senyales ng heat stroke: sobrang init ng balat, pagkalito, hindi na pinagpapawisan, nahihimatay. Ilipat sa lilim, basain ang katawan, at tumawag sa 911 o sa health center.',
        level === 'extremeDanger' && 'Manatili sa loob ng bahay o sa lilim hangga’t maaari.',
      ];

  return (
    <div className="space-y-3.5">
      <div className="p-4 rounded-2xl border border-orange-200 bg-orange-50 shadow-2xs">
        <h2 className="text-lg font-extrabold text-slate-900 m-0">
          🌡️ {en ? `Dangerous heat in ${cond.lgu.name}` : `Delikadong init sa ${cond.lgu.name}`}
        </h2>
        <p className="text-sm text-slate-700 m-0 mt-1">
          {en ? `The heat index may reach ${Math.round(peak)}°C this week (PAGASA: ${LEVEL[level].en}).`
            : `Maaaring umabot sa ${Math.round(peak)}°C ang heat index ngayong linggo (PAGASA: ${LEVEL[level].tl}).`}
        </p>
      </div>

      <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-2">
        <h3 className="text-sm font-extrabold text-slate-900 m-0">{en ? 'Heat index, next 7 days' : 'Heat index, susunod na 7 araw'}</h3>
        <ul className="m-0 p-0 list-none divide-y divide-slate-100">
          {cond.heatDays.map((d) => {
            const l = heatLevel(d.hi);
            return (
              <li key={d.date} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-slate-700">{day(d.date)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 tabular-nums">{Math.round(d.hi)}°C</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${LEVEL[l].cls}`}>{LEVEL[l][lang]}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-2.5">
        <h3 className="text-sm font-extrabold text-slate-900 m-0">{en ? 'What to do' : 'Ano ang gagawin'}</h3>
        <ul className="m-0 p-0 list-none space-y-2">
          {todo.filter((t): t is string => Boolean(t)).map((t) => (
            <li key={t} className="flex gap-2.5 text-sm text-slate-700"><span aria-hidden>✅</span><span>{t}</span></li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-slate-500 m-0 px-1">
        {en ? 'Heat index from the hourly temperature and humidity forecast (Open-Meteo), with PAGASA’s heat index categories: 33–41 °C extreme caution, 42–51 °C danger, 52 °C and up extreme danger.'
          : 'Heat index mula sa forecast ng temperatura at humidity kada oras (Open-Meteo), gamit ang mga kategorya ng PAGASA: 33–41 °C extreme caution, 42–51 °C danger, 52 °C pataas extreme danger.'}
      </p>
    </div>
  );
}
