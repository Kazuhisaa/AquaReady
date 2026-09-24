// Spec §6.C: nearby refill points where partner (LGU/NGO) data exists; otherwise let the family log the gap.
// Known points live in src/data/refillPoints.json (empty until partner data arrives).
// Reports stay on this phone for now; Phase 2 would send them to the LGU dashboard.
import { useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import refillPoints from '../data/refillPoints.json';
import type { Language } from '../services/i18n';

type Kind = 'refilling' | 'well' | 'tap' | 'none';
export interface RefillPoint { town: string; barangay?: string; name: string; kind: Kind; drinkingSafe?: boolean; hours?: string; source: string }
interface Report { id: string; at: string; town: string; barangay: string; kind: Kind; place: string }

const KEY = 'aquaready.gapReports';
const KIND: Record<Kind, { en: string; tl: string }> = {
  refilling: { en: 'Water refilling station', tl: 'Water refilling station' },
  well: { en: 'Hand pump or deep well', tl: 'Poso o deep well' },
  tap: { en: 'Public tap / water district', tl: 'Pampublikong gripo / water district' },
  none: { en: 'There is no water point here', tl: 'Walang igiban dito' },
};

const loadReports = (): Report[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
};

export function RefillPoints({ town, barangay, lang }: { town: string; barangay: string; lang: Language }) {
  const en = lang === 'en';
  const [reports, setReports] = useState<Report[]>(loadReports);
  const [kind, setKind] = useState<Kind>('refilling');
  const [place, setPlace] = useState('');
  const save = (next: Report[]) => {
    setReports(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const known = (refillPoints as RefillPoint[])
    .filter((p) => p.town === town)
    .sort((a, b) => Number(b.barangay === barangay) - Number(a.barangay === barangay));
  const mine = reports.filter((r) => r.town === town);
  const where = barangay ? `${barangay}, ${town}` : town;
  const canSubmit = kind === 'none' || place.trim().length > 0;

  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
      <h3 className="text-sm font-extrabold text-slate-900 m-0 flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-sky-600" aria-hidden /> {en ? 'Water refill points near you' : 'Mga igiban malapit sa iyo'}
      </h3>

      {known.length ? (
        <ul className="m-0 p-0 list-none space-y-2">
          {known.map((p) => (
            <li key={`${p.name}-${p.barangay}`} className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-sm">
              <span className="block font-bold text-slate-900">{p.name}</span>
              <span className="block text-xs text-slate-600">
                {KIND[p.kind][lang]}{p.barangay ? ` · ${p.barangay}` : ''}{p.hours ? ` · ${p.hours}` : ''}
                {p.drinkingSafe !== undefined && ` · ${p.drinkingSafe ? (en ? 'safe to drink' : 'ligtas inumin') : (en ? 'for washing only' : 'panlinis lang')}`}
              </span>
              <span className="block text-[11px] text-slate-400">{en ? 'Source' : 'Pinagmulan'}: {p.source}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600 m-0">
          {en ? `No water refill points are on record yet for ${where}.` : `Wala pang naitalang igiban para sa ${where}.`}
        </p>
      )}

      <form className="space-y-2 pt-1 border-t border-slate-100" onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        save([{ id: `gap-${Date.now()}`, at: new Date().toISOString(), town, barangay, kind, place: place.trim().slice(0, 80) }, ...reports]);
        setPlace('');
      }}>
        <p className="text-xs font-bold text-slate-800 m-0 pt-2">
          {en ? 'Help map water points: report one you know, or that there is none.' : 'Tumulong sa pagmapa: i-report ang alam mong igiban, o kung walang igiban.'}
        </p>
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} aria-label={en ? 'Type' : 'Uri'}
          className="w-full text-sm p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900">
          {(Object.keys(KIND) as Kind[]).map((k) => <option key={k} value={k}>{KIND[k][lang]}</option>)}
        </select>
        {kind !== 'none' && (
          <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80}
            placeholder={en ? 'Name or place (e.g. beside the chapel, Purok 3)' : 'Pangalan o lugar (hal. tabi ng kapilya, Purok 3)'}
            aria-label={en ? 'Name or place' : 'Pangalan o lugar'}
            className="w-full text-sm p-2.5 rounded-xl border border-slate-300 text-slate-900" />
        )}
        <button type="submit" disabled={!canSubmit}
          className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer">
          {en ? 'Save report' : 'I-save ang report'}
        </button>
      </form>

      {mine.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-700 m-0">{en ? 'Your reports' : 'Mga naitala mo'}</p>
          <ul className="m-0 p-0 list-none space-y-1.5">
            {mine.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 text-xs text-slate-700 p-2 rounded-lg bg-slate-50">
                <span>
                  <span className="font-bold">{KIND[r.kind][lang]}</span>{r.place ? `: ${r.place}` : ''}
                  <span className="block text-[11px] text-slate-400">{r.barangay || r.town} · {new Date(r.at).toLocaleDateString(en ? 'en-US' : 'fil-PH')}</span>
                </span>
                <button type="button" aria-label={en ? 'Delete report' : 'Burahin ang report'} onClick={() => save(reports.filter((x) => x.id !== r.id))}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-slate-400 m-0">
        {en ? 'Saved only on this phone. In a later phase, reports will help the LGU see where water points are missing.'
          : 'Sa phone na ito lang naka-save. Sa susunod na yugto, makakatulong ang mga report para makita ng LGU kung saan kulang ang igiban.'}
      </p>
    </div>
  );
}
