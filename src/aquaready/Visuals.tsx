import { droughtClass, SEVERITY_COLOR, SEVERITY_WORD } from '../services/aquaready';
import { monthLabel, type TimelineMonth } from './scenario';

export { SEVERITY_COLOR, SEVERITY_WORD };

// Modern Household Water Drum Visualizer
export function DrumGauge({ stored, low, high, capacity, en = true }: { stored: number; low: number; high: number; capacity: number; en?: boolean }) {
  const H = 220;
  const top = Math.max(high, capacity, stored) * 1.08;
  const y = (l: number) => 12 + H - (Math.min(l, top) / top) * H;
  const capY = y(capacity);
  const fillPct = Math.min(100, Math.round((stored / Math.max(1, high)) * 100));

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 160 252"
        width="140"
        height="220"
        className="w-[140px] shrink-0 drop-shadow-sm select-none"
        role="img"
        aria-label={`Stored ${Math.round(stored)} liters of a ${low} to ${high} liter target; container holds ${capacity} liters`}
      >
        <defs>
          <clipPath id="drumClip">
            <rect x="22" y="14" width="116" height={H} rx="16" />
          </clipPath>
          <linearGradient id="drumBg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="waterSurface" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="50%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
          <pattern id="targetHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#38bdf8" strokeWidth="2.5" opacity="0.45" />
          </pattern>
        </defs>

        {/* Drum Body Outer Shell */}
        <rect
          x="22"
          y="14"
          width="116"
          height={H}
          rx="16"
          fill="url(#drumBg)"
          stroke="#94a3b8"
          strokeWidth="2"
        />

        {/* Water & Target Band inside clipped container */}
        <g clipPath="url(#drumClip)">
          {/* Target Range Band */}
          <rect
            x="22"
            y={y(high)}
            width="116"
            height={Math.max(4, y(low) - y(high))}
            fill="url(#targetHatch)"
          />

          {/* Stored Water Fill */}
          <rect
            className="aq-fill transition-all duration-700 ease-out"
            x="22"
            y={y(stored)}
            width="116"
            height={14 + H - y(stored)}
            fill="url(#waterGradient)"
          />

          {/* Water Surface Highlight */}
          {stored > 0 && (
            <rect
              className="aq-fill transition-all duration-700 ease-out"
              x="22"
              y={y(stored) - 2}
              width="116"
              height="4"
              fill="url(#waterSurface)"
              opacity="0.8"
            />
          )}

          {/* Container Capacity Limit Overlay if less than top */}
          {capacity < top && (
            <rect
              x="22"
              y="14"
              width="116"
              height={capY - 14}
              fill="#f8fafc"
              opacity="0.5"
            />
          )}
        </g>

        {/* Measurement Grid Lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="24"
            x2="136"
            y1={14 + H * f}
            y2={14 + H * f}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.7"
          />
        ))}

        {/* Target High & Low Guideline Markers */}
        <line x1="14" x2="146" y1={y(high)} y2={y(high)} stroke="#0284c7" strokeWidth="2.5" strokeDasharray="4 3" />
        <line x1="14" x2="146" y1={y(low)} y2={y(low)} stroke="#0284c7" strokeWidth="2.5" strokeDasharray="4 3" />

        {/* Drum Top Lid */}
        <rect x="46" y="5" width="68" height="12" rx="5" fill="#475569" stroke="#334155" strokeWidth="1.5" />
        <rect x="62" y="2" width="36" height="5" rx="2" fill="#64748b" />

        {/* Container Capacity Marker Line */}
        {capacity < top && (
          <line x1="10" x2="150" y1={capY} y2={capY} stroke="#e11d48" strokeWidth="2" strokeDasharray="2 2" />
        )}
      </svg>
      <div className="mt-1 text-[11px] font-bold text-slate-500">
        {en ? 'Filled: ' : 'Laman: '}<span className="text-sky-700 font-extrabold">{fillPct}%</span>{en ? ' of target' : ' ng target'}
      </div>
    </div>
  );
}

// Rain vs normal, month by month: last 4 observed + next 5, with PAGASA's 80% "below normal" line.
// Values are the town's own 1991–2020 monthly normal (ERA5), so 100% = a usual month.
const MONTHS_TL = ['Ene', 'Peb', 'Mar', 'Abr', 'May', 'Hun', 'Hul', 'Ago', 'Set', 'Okt', 'Nob', 'Dis'];
const MAX = 1.6; // bars above 160% are capped (and labelled with their real value)

export function RainTimeline({ months, hindsight, en = true }: { months: TimelineMonth[]; hindsight: boolean; en?: boolean }) {
  const first = months.findIndex((m) => m.kind === 'forecast');
  const shown = months.slice(Math.max(0, first - 4), first + 5);
  const start = months.indexOf(shown[0]);
  // First month the PAGASA dry-spell rule is met (observed or forecast), checked on the whole series
  const isDry = (i: number) => ['dry_spell', 'drought'].includes(droughtClass(months.slice(0, i + 1).map((x) => x.ratio)));
  const dryAt = months.findIndex((_, i) => isDry(i));
  const H = 110;
  const y = (r: number) => H - (Math.min(r, MAX) / MAX) * H;
  const color = (r: number) => (r <= 0.4 ? '#e11d48' : r <= 0.8 ? '#f59e0b' : '#0ea5e9');
  const label = (ym: string) => (en ? monthLabel(ym) : MONTHS_TL[Number(ym.slice(5)) - 1]);
  const summary = shown.map((m) => `${label(m.month)} ${Math.round(m.ratio * 100)}%`).join(', ');

  return (
    <figure className="m-0 space-y-2" aria-label={`${en ? 'Rain vs normal' : 'Ulan kumpara sa karaniwan'}: ${summary}`}>
      <div className="relative" style={{ height: H + 34 }}>
        {/* reference lines: 100% = usual month, 80% = PAGASA "below normal" */}
        {[1, 0.8].map((r) => (
          <div key={r} className={`absolute inset-x-0 border-t ${r === 1 ? 'border-slate-300' : 'border-dashed border-amber-500'}`} style={{ top: 16 + y(r) }}>
            <span className={`absolute right-0 -top-3.5 text-[11px] font-bold ${r === 1 ? 'text-slate-400' : 'text-amber-600'}`}>
              {r === 1 ? (en ? 'normal' : 'karaniwan') : '80%'}
            </span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-[18px] flex items-end gap-1" style={{ height: H + 16 }} aria-hidden="true">
          {shown.map((m, i) => {
            const idx = start + i;
            const fc = m.kind === 'forecast';
            return (
              <div key={m.month} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                <span className="text-[11px] font-bold text-slate-600 leading-none mb-0.5">{Math.round(m.ratio * 100)}</span>
                <div className="w-full rounded-t" style={{
                  height: Math.max(3, H - y(m.ratio)),
                  background: color(m.ratio),
                  opacity: fc ? 0.55 : 1,
                  outline: idx === dryAt ? '2px solid #e11d48' : undefined,
                  outlineOffset: 1,
                }} />
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex gap-1 text-[11px] text-slate-500" aria-hidden="true">
          {shown.map((m, i) => (
            <span key={m.month} className={`flex-1 min-w-0 text-center ${start + i === first ? 'font-extrabold text-slate-900' : ''}`}>{label(m.month)}</span>
          ))}
        </div>
      </div>
      <figcaption className="text-[11px] text-slate-500 leading-snug">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-500 align-middle mr-1" />{en ? 'Actual' : 'Aktuwal'}
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-500/55 align-middle ml-3 mr-1" />
        {hindsight ? (en ? 'What happened next' : 'Ang sumunod na nangyari') : (en ? 'Forecast (ECMWF)' : 'Hula (ECMWF)')}
        {' · '}% {en ? 'of usual rain for that month' : 'ng karaniwang ulan sa buwang iyon'}
        {dryAt >= 0 && (en ? `. Red outline: dry spell reached (${monthLabel(months[dryAt].month, true)}).` : `. Pulang guhit: umabot sa tagtuyot (${MONTHS_TL[Number(months[dryAt].month.slice(5)) - 1]} ${months[dryAt].month.slice(0, 4)}).`)}
      </figcaption>
      <p className="text-[11px] text-slate-600 m-0">
        {en
          ? 'PAGASA calls it a dry spell when rain stays below 80% of usual for 3 months in a row, or below 40% for 2 months.'
          : 'Tagtuyot (dry spell) ayon sa PAGASA: 3 sunod na buwan sa ilalim ng 80% ng karaniwang ulan, o 2 buwan sa ilalim ng 40%.'}
      </p>
    </figure>
  );
}
