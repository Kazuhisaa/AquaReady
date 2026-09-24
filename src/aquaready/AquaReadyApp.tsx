import { useEffect, useRef, useState } from 'react';
import './aquaready.css';
import {
  Droplets,
  Home,
  Bell,
  RotateCw,
  Info,
  X,
  LogOut,
  Smartphone,
  Languages,
  History,
} from 'lucide-react';
import {
  buildPlan, riskScore, severity, getHouseholdCapacity,
} from '../services/aquaready';
import { conditions, DATA, dataAgeDays, REPLAY_MONTHS, STALE_AFTER_DAYS, type Mode } from './scenario';
import { ReplayBar } from './ReplayBar';
import { computeAlerts } from './alerts';
import { alertText } from './AlertsView';
import {
  HouseholdPanel,
  type Household,
  type AppTab,
} from './HouseholdPanel';
import { usePwaInstall } from '../pwa';
import { type Language, TRANSLATIONS } from '../services/i18n';

const STORE_KEY = 'aquaready.household';
const LANG_KEY = 'aquaready_lang';
const NOTIFIED_KEY = 'aquaready_notified';
const load = (): Household | null => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
  } catch {
    return null;
  }
};

// Pure Live Mode (No Replay)
const LIVE_MODE: Mode = { kind: 'live' };

// Native Smartphone Loading / Splash Screen
function LoadingSplash({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('Syncing PAGASA climate data...');

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(45);
      setStatusText('Checking rainfall and weather...');
    }, 400);

    const t2 = setTimeout(() => {
      setProgress(80);
      setStatusText('Setting up water guide...');
    }, 900);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText('Launching AquaReady...');
    }, 1400);

    const t4 = setTimeout(() => {
      onComplete();
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className="absolute inset-0 z-50 bg-gradient-to-b from-sky-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-between p-6 sm:p-8 select-none animate-in fade-in duration-300">
      {/* Top Tag */}
      <div className="pt-6 sm:pt-8">
        <span className="text-[11px] font-black uppercase tracking-widest text-sky-400 bg-sky-950/70 px-3 py-1 rounded-full border border-sky-800/80 shadow-2xs">
          DOST-PAGASA · Isabela Province
        </span>
      </div>

      {/* Center Icon & Branding */}
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Animated Glowing Droplet */}
        <div className="relative flex items-center justify-center my-2">
          <div className="absolute w-28 h-28 rounded-full bg-sky-500/20 animate-ping" />
          <div className="absolute w-20 h-20 rounded-full bg-sky-500/30 animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-sky-500/30 relative z-10">
            <Droplets className="w-9 h-9" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0">
            AquaReady
          </h1>
          <p className="text-xs text-sky-200/80 mt-1 font-medium m-0">
            Household Water Planning App
          </p>
        </div>
      </div>

      {/* Bottom Loading Progress Bar */}
      <div className="w-full space-y-2.5 pb-4 sm:pb-6">
        <div className="flex justify-between items-center text-[11px] text-sky-300/80 font-mono">
          <span className="truncate pr-2">{statusText}</span>
          <span className="font-bold">{progress}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-sky-300 to-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-center pt-1">
          <span className="text-[11px] text-slate-500">
            Water Planning Guide · Offline Ready
          </span>
        </div>
      </div>
    </div>
  );
}

function replayPeakSeverity(town: string, month: string) {
  const rank = { low: 0, moderate: 1, high: 2 } as const;
  return REPLAY_MONTHS.filter((m) => m < month)
    .map((m) => severity(riskScore(conditions(town, { kind: 'replay', month: m }).risk)))
    .reduce<'low' | 'moderate' | 'high'>((a, b) => (rank[b] > rank[a] ? b : a), 'low');
}

export function AquaReadyApp() {
  const [household, setHouseholdState] = useState<Household | null>(load);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<AppTab>('home');
  const [mode, setMode] = useState<Mode>(LIVE_MODE);
  const replay = mode.kind === 'replay';
  const [showSpec, setShowSpec] = useState(false);
  const { canInstall, installApp } = usePwaInstall();
  const mainRef = useRef<HTMLElement>(null);

  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'tl' ? 'tl' : 'en';
  });
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    document.title = 'AquaReady · Household Water Planning App';
  }, []);

  const setHousehold = (h: Household | null) => {
    // Stamp top-ups here, the one place every "+ L" button goes through, so pacing reminders reset.
    if (h && household && h.stored > household.stored) h = { ...h, lastAddedAt: new Date().toISOString() };
    setHouseholdState(h);
    setIsEditingProfile(false);
    try {
      if (h) localStorage.setItem(STORE_KEY, JSON.stringify(h));
      else localStorage.removeItem(STORE_KEY);
    } catch {
      // private mode
    }
  };

  const activeTown = household?.lgu ?? 'Ilagan';


  // Current household conditions & computed water plan
  const cond = conditions(activeTown, mode);
  const plan = household
    ? buildPlan({
        ...cond,
        members: household.members,
        storage: household.storage,
        storageCapacityLiters: getHouseholdCapacity(household),
        storedLiters: household.stored,
        calibration: household.calibration,
      })
    : null;

  const alerts = household && plan
    ? computeAlerts({
        severity: plan.severity, litersEvery3Days: plan.litersEvery3Days,
        dataDate: replay ? cond.today.toISOString() : DATA.generatedAt,
        lastAddedAt: household.lastAddedAt,
        // Replay: "highest risk since the last check-in" comes from the replayed months before this one, not from today
        alertSeverity: replay ? replayPeakSeverity(activeTown, mode.month) : household.alertSeverity,
        heatDays: cond.heatDays,
      }, cond.today)
    : [];
  const unread = alerts.filter((a) => !(household?.seenAlerts ?? []).includes(a.id)).length;

  // Remember the highest risk seen since the last check-in, so the post-event prompt fires when it drops back.
  const rank = { low: 0, moderate: 1, high: 2 } as const;
  useEffect(() => {
    if (!household || !plan || isEditingProfile || replay) return; // replay must not change the real household
    if (rank[plan.severity] > rank[household.alertSeverity ?? 'low']) setHousehold({ ...household, alertSeverity: plan.severity });
  }, [plan?.severity, household?.alertSeverity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phone notification for each new alert, once, if the user allowed it. Fires when the app is opened:
  // alerts while it is closed would need a push server (Web Push), which this pilot doesn't have.
  useEffect(() => {
    if (!household || !plan || replay || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let shown: string[] = [];
    try { shown = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]'); } catch { /* private mode */ }
    const fresh = alerts.filter((a) => !shown.includes(a.id) && !(household.seenAlerts ?? []).includes(a.id));
    if (!fresh.length) return;
    for (const a of fresh) {
      const { title, sub } = alertText(a, plan, household.lgu, lang);
      const opts = { body: sub, icon: '/icons/icon-192.png', tag: a.id };
      navigator.serviceWorker?.getRegistration()
        .then((reg) => { if (reg) return reg.showNotification(title, opts); new Notification(title, opts); })
        .catch(() => { /* notifications blocked */ });
    }
    try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...shown, ...fresh.map((a) => a.id)].slice(-50))); } catch { /* private mode */ }
  }, [alerts.map((a) => a.id).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="aq min-h-screen bg-slate-900/95 sm:bg-slate-900 py-0 sm:py-6 px-0 sm:px-4 flex flex-col items-center justify-center font-sans antialiased selection:bg-sky-500/20">
      {/* Smartphone Mockup Frame with FIXED Shell Dimensions */}
      <div className="w-full sm:max-w-[460px] bg-slate-50 h-screen sm:h-[880px] max-h-screen sm:max-h-[920px] sm:rounded-[44px] sm:border-[8px] sm:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative sm:ring-1 sm:ring-white/10">
        
        {/* Smartphone Status Bar (Top Notch & Island) */}
        <div className="hidden sm:flex items-center justify-between px-7 pt-3.5 pb-2 bg-white text-[12px] font-bold text-slate-800 shrink-0 z-40 select-none">
          <span>9:41</span>
          <div className="w-24 h-5 bg-slate-900 rounded-full flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
          </div>
          <div className="flex items-center gap-1.5 text-slate-800">
            <span className="text-[11px] font-bold tracking-tighter">5G</span>
            <div className="w-5 h-2.5 border border-slate-700 rounded-xs p-0.5 flex items-center">
              <div className="w-full h-full bg-slate-900 rounded-2xs" />
            </div>
          </div>
        </div>

        {/* Loading Splash Screen Component (App Launch) */}
        {isLoading && (
          <LoadingSplash onComplete={() => setIsLoading(false)} />
        )}

        {/* Mobile App Header (FIXED at top, shrink-0) */}
        <header className="px-3.5 py-2.5 bg-white border-b border-slate-200/80 shrink-0 z-30 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            {/* Logo & App Title */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Droplets className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-slate-900 leading-none">
                    AquaReady
                  </span>
                  <span className="text-[11px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                    Isabela
                  </span>
                </div>
              </div>
            </div>

            {/* Live Status Badge & Header Controls */}
            <div className="flex items-center gap-1.5">
              {household && (
                <button
                  type="button"
                  onClick={() => setMode(replay ? LIVE_MODE : { kind: 'replay', month: REPLAY_MONTHS[0] })}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${replay ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:text-violet-700 hover:bg-violet-50'}`}
                  title={lang === 'en' ? 'Time machine: replay the 2023–24 El Niño' : 'Balik-tanaw: ulitin ang 2023–24 El Niño'}
                  aria-pressed={replay}
                >
                  <History className="w-4 h-4" />
                </button>
              )}

              {/* Language Switcher Button: EN | TL */}
              <button
                type="button"
                onClick={() =>
                  setLang((prev) => {
                    const next: Language = prev === 'en' ? 'tl' : 'en';
                    localStorage.setItem(LANG_KEY, next);
                    return next;
                  })
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-[11px] font-black cursor-pointer transition-all active:scale-95 shadow-2xs"
                title={t.header.switchLangTooltip}
              >
                <Languages className="w-3.5 h-3.5 text-sky-600" />
                <span>{lang === 'en' ? 'EN' : 'TL'}</span>
              </button>

              <button
                type="button"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                onClick={() => setShowSpec(true)}
                title={t.header.about}
              >
                <Info className="w-4 h-4" />
              </button>

              {household && (
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                  onClick={() => {
                    // Erasing is permanent (no backup, no server), so ask first.
                    const ok = window.confirm(lang === 'en'
                      ? 'Erase your household profile and stored-water log on this phone? This cannot be undone.'
                      : 'Burahin ang profile ng pamilya at ang tala ng naipong tubig sa phone na ito? Hindi na ito maibabalik.');
                    if (ok) setHousehold(null);
                  }}
                  title={t.header.signout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ONLY THE MIDDLE SCREEN SCROLLS! (flex-1 min-h-0 overflow-y-auto) */}
        <main
          ref={mainRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative no-scrollbar p-2.5 sm:p-3"
        >
          {!replay && household && !isEditingProfile && dataAgeDays() > STALE_AFTER_DAYS && (() => {
            const date = new Date(DATA.generatedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fil-PH', { month: 'long', day: 'numeric', year: 'numeric' });
            return (
              <div role="alert" className="mb-3 p-3 rounded-2xl border-2 border-amber-300 bg-amber-50 text-sm text-amber-950">
                <strong className="block">{lang === 'en' ? '⚠️ This forecast may be out of date' : '⚠️ Baka luma na ang hulang ito'}</strong>
                {lang === 'en'
                  ? `The weather data is from ${date} (${dataAgeDays()} days ago). Treat the risk and dates below with caution until the app is updated.`
                  : `Ang datos ng panahon ay mula ${date} (${dataAgeDays()} araw na ang nakaraan). Mag-ingat sa panganib at mga petsa sa ibaba hangga't hindi pa na-a-update ang app.`}
              </div>
            );
          })()}
          {replay && household && !isEditingProfile && (
            <ReplayBar month={mode.month} onMonth={(m) => setMode({ kind: 'replay', month: m })} town={household.lgu} lang={lang} onExit={() => setMode(LIVE_MODE)} />
          )}
          <HouseholdPanel
            household={household}
            setHousehold={setHousehold}
            plan={plan}
            cond={cond}
            alerts={alerts}
            isEditing={isEditingProfile}
            onEditProfile={() => setIsEditingProfile(true)}
            tab={tab}
            onSelectTab={setTab}
            lang={lang}
          />
        </main>

        {/* FIXED BOTTOM NAVIGATION BAR (shrink-0, CANNOT MOVE OR SCROLL!) */}
        {household && !isEditingProfile && (
          <nav
            role="tablist"
            className="shrink-0 bg-white/98 backdrop-blur-md border-t border-slate-200/90 py-1.5 px-2 flex items-center justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.03)] z-30 select-none"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'home'}
              onClick={() => {
                setTab('home');
                mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                tab === 'home' ? 'text-sky-600 font-black' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${tab === 'home' ? 'bg-sky-50' : ''}`}>
                <Home className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight">{t.tabs.home}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === 'plan'}
              onClick={() => {
                setTab('plan');
                mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                tab === 'plan' ? 'text-sky-600 font-black' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${tab === 'plan' ? 'bg-sky-50' : ''}`}>
                <Droplets className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight">{t.tabs.plan}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === 'alerts'}
              onClick={() => {
                setTab('alerts');
                mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                tab === 'alerts' ? 'text-sky-600 font-black' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-all ${tab === 'alerts' ? 'bg-sky-50' : ''}`}>
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[11px] font-black grid place-items-center">{unread}</span>
                )}
              </div>
              <span className="text-[11px] tracking-tight">{t.tabs.alerts}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === 'checkin'}
              onClick={() => {
                setTab('checkin');
                mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                tab === 'checkin' ? 'text-sky-600 font-black' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${tab === 'checkin' ? 'bg-sky-50' : ''}`}>
                <RotateCw className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight">{t.tabs.profile}</span>
            </button>
          </nav>
        )}

        {/* Smartphone Bottom Home Indicator Line (Desktop frame aesthetic) */}
        <div className="w-32 h-1 bg-slate-300 rounded-full mx-auto my-2 shrink-0 hidden sm:block pointer-events-none" />
      </div>

      {/* Desktop Helper Toolbar below the Smartphone */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 max-w-[430px] w-full px-4 text-center">
        <span>15 L/day Goal</span>
        {canInstall && (
          <>
            <span>·</span>
            <button
              type="button"
              className="text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer underline transition-colors"
              onClick={installApp}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          </>
        )}
      </div>

      {/* Modal: About & Sources */}
      {showSpec && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
          onClick={() => setShowSpec(false)}
        >
          <div
            className="max-w-md w-full p-5 sm:p-6 shadow-2xl bg-white border border-slate-200 rounded-3xl text-slate-900 overflow-y-auto max-h-[85vh] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-base font-black m-0 text-slate-900">About AquaReady</h3>
                <p className="text-xs m-0 text-slate-500">Water resilience standards & datasets</p>
              </div>
              <button
                type="button"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                onClick={() => setShowSpec(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
                <strong className="block font-bold text-sky-900 mb-0.5">
                  Sphere Standard (15 L/person/day)
                </strong>
                <p className="m-0 text-[11px]">
                  Global humanitarian floor (3 L drinking/cooking + 12 L hygiene). AquaReady adjusts for infants, pregnancy, and sickness.
                </p>
              </div>

              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
                <strong className="block font-bold text-sky-900 mb-0.5">
                  Climate Intelligence Pipeline
                </strong>
                <p className="m-0 text-[11px]">
                  Real-time synchronization using PAGASA ENSO advisories, NOAA ONI indices (+1.8°C), ECMWF SEAS5 rainfall forecasts, and NASA soil moisture.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all cursor-pointer"
              onClick={() => setShowSpec(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
