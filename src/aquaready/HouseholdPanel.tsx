import { useState, useMemo } from 'react';
import {
  Droplets,
  Sparkles,
  CheckCircle2,
  Plus,
  Minus,
  ChevronRight,
  MapPin,
  Users,
  User,
  Baby,
  Shield,
  ShieldCheck,
  ShieldAlert,
  HeartPulse,
  Milk,
  Check,
  Pencil,
  Info,
  Trash2,
} from 'lucide-react';
import { ISABELA_LGUS } from '../data/isabelaMunicipalities';
import {
  householdDaily,
  calibrationFromAnswer,
  type CheckInAnswer,
  capacityToStorageSize,
  type AgeBracket,
  type Member,
  type StorageSize,
  type WaterContainerItem,
  type buildPlan,
  type Severity,
} from '../services/aquaready';
import { type Conditions, monthLabel } from './scenario';
import { AlertsView, alertText } from './AlertsView';
import { RefillPoints } from './RefillPoints';
import type { Alert } from './alerts';
import { DrumGauge, SEVERITY_COLOR, SEVERITY_WORD } from './Visuals';
import { type Language, TRANSLATIONS } from '../services/i18n';

export type { WaterContainerItem };

export interface Household {
  id?: string;
  name?: string;
  mobile?: string;
  barangay?: string;
  lgu: string;
  members: Member[];
  storage: StorageSize;
  containers?: WaterContainerItem[];
  stored: number;
  calibration: number;
  consent: boolean;
  lastAddedAt?: string; // last time stored water went up (drives pacing reminders)
  alertSeverity?: Severity; // highest risk seen since the last check-in (drives the post-event prompt)
  seenAlerts?: string[];
}

type Plan = ReturnType<typeof buildPlan>;

const CONTAINER_PRESETS: Array<{ name: string; liters: number; hint: string }> = [
  { name: 'Blue Drum', liters: 200, hint: 'Standard 200 L drum' },
  { name: '5-Gallon Water Jug', liters: 20, hint: 'Slim/round water bottle' },
  { name: 'Timba / Bucket', liters: 15, hint: 'Household plastic pail' },
  { name: 'Jerry Can', liters: 10, hint: 'Portable water container' },
  { name: 'Water Tank', liters: 500, hint: 'Stainless / poly tank' },
  { name: 'Small Bottle / Jug', liters: 5, hint: 'Small drinking container' },
];

const DEFAULT_CONTAINERS: WaterContainerItem[] = [
  { id: 'c-default-1', name: 'Blue Drum', liters: 200, count: 1 },
  { id: 'c-default-2', name: '5-Gallon Water Jug', liters: 20, count: 2 },
];

const SAMPLE_HOUSEHOLD: Household = {
  name: 'Santos Family',
  mobile: '0917 123 4567',
  barangay: '',
  // Cabagan: medium risk now, and in the 2023–24 replay the AI warned 2 months before its dry spell
  lgu: 'Cabagan',
  members: [{ age: 'adult' }, { age: 'adult', pregnant: true }, { age: 'child' }, { age: 'elderly' }],
  storage: 'medium',
  containers: [
    { id: 'c-sample-1', name: 'Blue Drum', liters: 200, count: 1 },
    { id: 'c-sample-2', name: '5-Gallon Water Jug', liters: 20, count: 2 },
  ],
  stored: 40,
  calibration: 1,
  consent: true,
};

const AGE_LABEL: Record<AgeBracket, string> = {
  infant: '0–1 yr',
  child: '2–12 yr',
  adult: '13–64 yr',
  elderly: '65+ yr',
};

const STORAGE_LABEL: Record<StorageSize, { name: string; hint: string }> = {
  small: { name: 'Small Containers', hint: 'Jugs or 1–2 jerry cans (~40 L)' },
  medium: { name: 'Blue Drum', hint: 'Standard drum (~200 L)' },
  large: { name: 'Water Tank or Drums', hint: 'Large tank or multiple drums (~1,000 L)' },
};

export function ContainerBadgeIcon({ liters }: { liters: number }) {
  if (liters >= 400) {
    return (
      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
          <rect x="3" y="6" width="18" height="15" rx="3" />
          <path d="M7 6V3h10v3" />
        </svg>
      </div>
    );
  }
  if (liters >= 80) {
    return (
      <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
          <rect x="5" y="4" width="14" height="16" rx="3" />
          <line x1="5" y1="9" x2="19" y2="9" />
          <line x1="5" y1="15" x2="19" y2="15" />
        </svg>
      </div>
    );
  }
  if (liters >= 18) {
    return (
      <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center shrink-0">
        <Droplets className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
        <path d="M4 8h16l-2 12H6L4 8z" />
        <path d="M8 8V5a4 4 0 0 1 8 0v3" />
      </svg>
    </div>
  );
}

// ---------- Mobile App Onboarding / Setup Flow ----------

export function Onboarding({
  onDone,
  initialData,
  lang = 'en',
}: {
  onDone: (h: Household) => void;
  initialData?: Household | null;
  lang?: Language;
}) {
  const t = TRANSLATIONS[lang];
  const [step, setStep] = useState(0);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customLiters, setCustomLiters] = useState('');
  const [h, setH] = useState<Household>(
    initialData ?? {
      name: '',
      mobile: '',
      barangay: '',
      lgu: 'Ilagan',
      members: [{ age: 'adult' }, { age: 'adult' }, { age: 'child' }],
      storage: 'medium',
      containers: DEFAULT_CONTAINERS,
      stored: 0,
      calibration: 1,
      consent: false,
    }
  );

  const adultCount = h.members.filter((m) => m.age === 'adult').length;
  const elderlyCount = h.members.filter((m) => m.age === 'elderly').length;
  const childCount = h.members.filter((m) => m.age === 'child').length;
  const infantCount = h.members.filter((m) => m.age === 'infant').length;
  const totalPersons = h.members.length;

  const isPregnant = h.members.some((m) => m.pregnant);
  const isLactating = h.members.some((m) => m.lactating);
  const hasHealthFlag = h.members.some((m) => m.healthFlag);
  const isFormulaFed = h.members.some((m) => m.formulaFed);
  const sensitive = isPregnant || isLactating || hasHealthFlag || isFormulaFed;

  const dailyNeeds = useMemo(() => {
    return householdDaily(h.members);
  }, [h.members]);

  const currentContainers: WaterContainerItem[] = useMemo(() => {
    if (h.containers && h.containers.length > 0) return h.containers;
    return DEFAULT_CONTAINERS;
  }, [h.containers]);

  const totalStorageCapacity = useMemo(() => {
    return currentContainers.reduce((sum, c) => sum + c.liters * c.count, 0);
  }, [currentContainers]);

  const updateContainerCount = (id: string, delta: number) => {
    const nextList = currentContainers
      .map((c) => (c.id === id ? { ...c, count: Math.max(0, c.count + delta) } : c))
      .filter((c) => c.count > 0);
    const newCap = nextList.reduce((sum, c) => sum + c.liters * c.count, 0);
    setH({
      ...h,
      containers: nextList,
      storage: capacityToStorageSize(newCap),
    });
  };

  const removeContainer = (id: string) => {
    const nextList = currentContainers.filter((c) => c.id !== id);
    const newCap = nextList.reduce((sum, c) => sum + c.liters * c.count, 0);
    setH({
      ...h,
      containers: nextList,
      storage: capacityToStorageSize(newCap),
    });
  };

  const addPreset = (name: string, liters: number) => {
    const existing = currentContainers.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.liters === liters
    );
    let nextList: WaterContainerItem[];
    if (existing) {
      nextList = currentContainers.map((c) => (c.id === existing.id ? { ...c, count: c.count + 1 } : c));
    } else {
      nextList = [
        ...currentContainers,
        {
          id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name,
          liters,
          count: 1,
        },
      ];
    }
    const newCap = nextList.reduce((sum, c) => sum + c.liters * c.count, 0);
    setH({
      ...h,
      containers: nextList,
      storage: capacityToStorageSize(newCap),
    });
  };

  const handleAddCustom = () => {
    const name = customName.trim();
    const liters = Math.max(1, Math.round(Number(customLiters) || 0));
    if (!name || liters <= 0) return;
    const newItem: WaterContainerItem = {
      id: `c-custom-${Date.now()}`,
      name,
      liters,
      count: 1,
    };
    const nextList = [...currentContainers, newItem];
    const newCap = nextList.reduce((sum, c) => sum + c.liters * c.count, 0);
    setH({
      ...h,
      containers: nextList,
      storage: capacityToStorageSize(newCap),
    });
    setCustomName('');
    setCustomLiters('');
    setShowAddCustom(false);
  };

  const syncMembers = (
    counts: { adult: number; elderly: number; child: number; infant: number },
    special: { pregnant: boolean; lactating: boolean; healthFlag: boolean; formulaFed: boolean }
  ) => {
    const list: Member[] = [];
    for (let i = 0; i < counts.adult; i++) list.push({ age: 'adult' });
    for (let i = 0; i < counts.elderly; i++) list.push({ age: 'elderly' });
    for (let i = 0; i < counts.child; i++) list.push({ age: 'child' });
    for (let i = 0; i < counts.infant; i++) list.push({ age: 'infant' });

    if (list.length === 0) list.push({ age: 'adult' });

    if (special.pregnant) {
      const target = list.find((m) => m.age === 'adult') ?? list[0];
      if (target) target.pregnant = true;
    }
    if (special.lactating) {
      const target =
        list.find((m) => m.age === 'adult' && !m.pregnant) ??
        list.find((m) => m.age === 'adult') ??
        list[0];
      if (target) target.lactating = true;
    }
    if (special.formulaFed) {
      const target = list.find((m) => m.age === 'infant') ?? list[0];
      if (target) target.formulaFed = true;
    }
    if (special.healthFlag) {
      const target =
        list.find((m) => m.age === 'elderly') ??
        list.find((m) => m.age === 'adult') ??
        list[0];
      if (target) target.healthFlag = true;
    }

    setH((prev) => ({ ...prev, members: list }));
  };

  const updateCounts = (category: AgeBracket, delta: number) => {
    const currentCounts = {
      adult: adultCount,
      elderly: elderlyCount,
      child: childCount,
      infant: infantCount,
    };
    const nextCount = Math.max(0, currentCounts[category] + delta);
    const nextTotal =
      (category === 'adult' ? nextCount : currentCounts.adult) +
      (category === 'elderly' ? nextCount : currentCounts.elderly) +
      (category === 'child' ? nextCount : currentCounts.child) +
      (category === 'infant' ? nextCount : currentCounts.infant);

    if (nextTotal < 1) return;

    currentCounts[category] = nextCount;
    syncMembers(currentCounts, {
      pregnant: isPregnant,
      lactating: isLactating,
      healthFlag: hasHealthFlag,
      formulaFed: category === 'infant' && nextCount === 0 ? false : isFormulaFed,
    });
  };

  const toggleSpecial = (key: 'pregnant' | 'lactating' | 'healthFlag' | 'formulaFed') => {
    const currentCounts = {
      adult: adultCount,
      elderly: elderlyCount,
      child: childCount,
      infant: infantCount,
    };
    const currentSpecial = {
      pregnant: isPregnant,
      lactating: isLactating,
      healthFlag: hasHealthFlag,
      formulaFed: isFormulaFed,
    };
    currentSpecial[key] = !currentSpecial[key];
    syncMembers(currentCounts, currentSpecial);
  };

  const categoryDefs = [
    {
      key: 'adult' as AgeBracket,
      title: 'Adults',
      age: AGE_LABEL.adult,
      sub: 'Core water needs',
      count: adultCount,
      icon: User,
      iconBg: 'bg-sky-50 text-sky-600 border border-sky-100',
    },
    {
      key: 'elderly' as AgeBracket,
      title: 'Seniors',
      age: AGE_LABEL.elderly,
      sub: 'Priority drinking water',
      count: elderlyCount,
      icon: ShieldCheck,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
    },
    {
      key: 'child' as AgeBracket,
      title: 'Children',
      age: AGE_LABEL.child,
      sub: 'Daily water share',
      count: childCount,
      icon: Users,
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    },
    {
      key: 'infant' as AgeBracket,
      title: 'Babies',
      age: AGE_LABEL.infant,
      sub: 'Feeding & bath water',
      count: infantCount,
      icon: Baby,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
    },
  ];

  const steps = [
    // Step 1: Location & Profile
    <div key="signup" className="space-y-4">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-800 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
          <MapPin className="w-3 h-3 text-sky-600" />
          Step 1 of 4 · Town & Family
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0">
          Your Location & Family
        </h2>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed m-0">
          Pick your town in Isabela to track local water supply and weather.
        </p>
      </div>

      <div className="space-y-3 pt-1">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1" htmlFor="aq-name">
            {t.profile.familyName}
          </label>
          <input
            id="aq-name"
            type="text"
            placeholder={t.profile.familyNamePlaceholder}
            className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
            value={h.name ?? ''}
            onChange={(e) => setH({ ...h, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1" htmlFor="aq-lgu">
            {t.profile.municipality}
          </label>
          <select
            id="aq-lgu"
            className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 font-medium cursor-pointer"
            value={h.lgu}
            onChange={(e) => setH({ ...h, lgu: e.target.value })}
          >
            <option value="">Select municipality</option>
            {ISABELA_LGUS.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name} ({l.type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1" htmlFor="aq-brgy">
            Barangay (optional)
          </label>
          <input
            id="aq-brgy"
            type="text"
            placeholder="e.g. Alibagu, Centro"
            className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
            value={h.barangay ?? ''}
            onChange={(e) => setH({ ...h, barangay: e.target.value })}
          />
        </div>
      </div>
    </div>,

    // Step 2: Members
    <div key="who" className="space-y-4">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-800 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
          <Users className="w-3 h-3 text-sky-600" />
          Step 2 of 4 · Family Members
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0">
          Who lives with you?
        </h2>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed m-0">
          How many people are in your home? We use this to calculate your daily water goal.
        </p>
      </div>

      {/* Modern Category Stepper Rows */}
      <div className="space-y-2">
        {categoryDefs.map((cat) => (
          <div
            key={cat.key}
            className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 transition-colors shadow-2xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cat.iconBg}`}>
                <cat.icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900 tracking-tight">
                    {cat.title}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    ({cat.age})
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 m-0 truncate leading-tight mt-0.5">
                  {cat.sub}
                </p>
              </div>
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => updateCounts(cat.key, -1)}
                disabled={cat.count === 0 || (totalPersons <= 1 && cat.count === 1)}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs active:scale-95"
                aria-label={`Decrease ${cat.title}`}
              >
                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <span className="w-7 text-center font-black text-sm text-slate-900 select-none">
                {cat.count}
              </span>
              <button
                type="button"
                onClick={() => updateCounts(cat.key, 1)}
                disabled={cat.count >= 20}
                className="w-7 h-7 rounded-lg bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center cursor-pointer transition-all shadow-2xs active:scale-95"
                aria-label={`Increase ${cat.title}`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Extra Needs (Optional) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black tracking-wider uppercase text-slate-500">
            Extra Needs (Optional)
          </span>
          <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
            +5 L / day extra
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Pregnant Card */}
          <button
            type="button"
            onClick={() => toggleSpecial('pregnant')}
            className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
              isPregnant
                ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20 shadow-2xs'
                : 'border-slate-200/90 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isPregnant ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  isPregnant ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isPregnant && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                +5 L
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 m-0 leading-tight">Pregnancy</p>
              <p className="text-[11px] text-slate-500 m-0 leading-tight">Extra drinking water</p>
            </div>
          </button>

          {/* Nursing Card */}
          <button
            type="button"
            onClick={() => toggleSpecial('lactating')}
            className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
              isLactating
                ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20 shadow-2xs'
                : 'border-slate-200/90 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isLactating ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Milk className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  isLactating ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isLactating && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                +5 L
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 m-0 leading-tight">Nursing Mother</p>
              <p className="text-[11px] text-slate-500 m-0 leading-tight">Breastfeeding support</p>
            </div>
          </button>

          {/* Chronic Illness Card */}
          <button
            type="button"
            onClick={() => toggleSpecial('healthFlag')}
            className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
              hasHealthFlag
                ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20 shadow-2xs'
                : 'border-slate-200/90 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  hasHealthFlag ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  hasHealthFlag ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {hasHealthFlag && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                +5 L
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 m-0 leading-tight">Medical Need</p>
              <p className="text-[11px] text-slate-500 m-0 leading-tight">Illness / maintenance</p>
            </div>
          </button>

          {/* Formula Baby Card */}
          {infantCount > 0 && (
            <button
              type="button"
              onClick={() => toggleSpecial('formulaFed')}
              className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                isFormulaFed
                  ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isFormulaFed ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Baby className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                    isFormulaFed ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isFormulaFed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  +5 L
                </span>
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 m-0 leading-tight">Formula-Fed</p>
                <p className="text-[11px] text-slate-500 m-0 leading-tight">Bottle prep</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Live Calculation Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50 via-sky-50/60 to-blue-50/40 border border-sky-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block leading-tight">
                Daily Need: {dailyNeeds.total} L / day
              </span>
              <span className="text-[11px] text-slate-500 block">
                {totalPersons} {totalPersons === 1 ? 'person' : 'people'} in household
              </span>
            </div>
          </div>
          {sensitive && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
              Extra buffer active
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-100">
          <div className="px-2.5 py-1.5 rounded-xl bg-white/90 border border-sky-100/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Drinking & Food</span>
            <span className="font-black text-sky-800">{dailyNeeds.potable} L/d</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-white/90 border border-sky-100/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Washing & Bath</span>
            <span className="font-black text-slate-700">{dailyNeeds.domestic} L/d</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
          <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>Standard: 15 L per person for drinking, cooking, and hygiene.</span>
        </div>
      </div>
    </div>,

    // Step 3: Dynamic Containers
    <div key="storage" className="space-y-3.5">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-800 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
          <Droplets className="w-3 h-3 text-sky-600" />
          Step 3 of 4 · Storage
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0">
          Water Containers
        </h2>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed m-0">
          Add what you store water in at home. You can add common containers or create custom ones.
        </p>
      </div>

      {/* Active Containers List */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
          Your Containers ({currentContainers.length})
        </span>

        {currentContainers.length === 0 ? (
          <div className="p-3 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
            No containers added yet. Tap a preset below or add a custom container.
          </div>
        ) : (
          <div className="space-y-1.5">
            {currentContainers.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ContainerBadgeIcon liters={item.liters} />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 block truncate">
                      {item.name}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 block">
                      {item.liters} L each · Total: {item.liters * item.count} L
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Stepper */}
                  <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => updateContainerCount(item.id, -1)}
                      className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs active:scale-95"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    <span className="w-6 text-center font-black text-xs text-slate-900 select-none">
                      {item.count}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateContainerCount(item.id, 1)}
                      className="w-6 h-6 rounded-lg bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeContainer(item.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg cursor-pointer transition-colors"
                    title="Remove container"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Add Presets */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
          Quick Add Presets
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {CONTAINER_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => addPreset(preset.name, preset.liters)}
              className="p-2 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-sky-50 hover:border-sky-300 text-left cursor-pointer transition-all flex items-center gap-2 group shadow-2xs active:scale-98"
            >
              <ContainerBadgeIcon liters={preset.liters} />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-900 group-hover:text-sky-700 block truncate leading-tight">
                  {preset.name}
                </span>
                <span className="text-[11px] text-slate-500 font-bold block mt-0.5">
                  +{preset.liters} L
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add Custom Container (Any Liter Capacity) */}
      <div className="pt-1">
        {!showAddCustom ? (
          <button
            type="button"
            onClick={() => setShowAddCustom(true)}
            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-sky-400 bg-sky-50/60 hover:bg-sky-50 text-sky-700 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Container (Any Size)</span>
          </button>
        ) : (
          <div className="p-3 rounded-2xl border border-sky-300 bg-sky-50/80 space-y-2.5 shadow-2xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-sky-950">Add Custom Container</span>
              <button
                type="button"
                onClick={() => setShowAddCustom(false)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5" htmlFor="custom-c-name">
                  Container Name
                </label>
                <input
                  id="custom-c-name"
                  type="text"
                  placeholder="e.g. Basin, Palanggana, Tub"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5" htmlFor="custom-c-liters">
                  Capacity (Liters)
                </label>
                <input
                  id="custom-c-liters"
                  type="number"
                  min="1"
                  placeholder="e.g. 25, 60, 350"
                  value={customLiters}
                  onChange={(e) => setCustomLiters(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!customName.trim() || Number(customLiters) <= 0}
              onClick={handleAddCustom}
              className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Container</span>
            </button>
          </div>
        )}
      </div>

      {/* Live Total Capacity Summary Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50 via-sky-50/70 to-blue-50/50 border border-sky-200/90 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-900">Total Storage Capacity</span>
          <span className="text-sm font-black text-sky-700 bg-white px-2.5 py-0.5 rounded-lg border border-sky-200 shadow-2xs">
            {totalStorageCapacity} Liters
          </span>
        </div>
        <p className="text-[11px] text-slate-600 m-0 leading-snug">
          With a daily need of {dailyNeeds.total} L, this holds{' '}
          <strong className="text-slate-900">
            {Math.floor(totalStorageCapacity / Math.max(1, dailyNeeds.total)) >= 1
              ? `about ~${Math.floor(totalStorageCapacity / Math.max(1, dailyNeeds.total))} ${
                  Math.floor(totalStorageCapacity / Math.max(1, dailyNeeds.total)) === 1 ? 'day' : 'days'
                }`
              : 'under 1 day'}
          </strong>{' '}
          of reserve water.
        </p>
      </div>
    </div>,

    // Step 4: Consent & Complete
    <div key="consent" className="space-y-4">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-800 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
          <Shield className="w-3 h-3 text-sky-600" />
          Step 4 of 4 · Done
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0">
          Ready to Plan
        </h2>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed m-0">
          Your information is saved safely on your phone.
        </p>
      </div>

      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Family:</span>
          <span className="font-bold text-slate-900">{h.name || 'Santos Family'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Town:</span>
          <span className="font-bold text-slate-900">{h.lgu}, Isabela</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Members:</span>
          <span className="font-bold text-slate-900">{h.members.length} people</span>
        </div>
        <div className="flex justify-between items-start pt-1 border-t border-slate-200/60">
          <span className="text-slate-500">Storage Capacity:</span>
          <div className="text-right">
            <span className="font-black text-sky-700 block">{totalStorageCapacity} Liters</span>
            <span className="text-[11px] text-slate-500 block max-w-[200px] truncate">
              {currentContainers.map((c) => `${c.count}x ${c.name}`).join(', ')}
            </span>
          </div>
        </div>
      </div>

      <label className="p-3 rounded-xl border border-slate-200 bg-white flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={h.consent}
          onChange={(e) => setH({ ...h, consent: e.target.checked })}
          className="w-4 h-4 rounded border-slate-300 accent-sky-600 mt-0.5 shrink-0"
        />
        <span className="text-xs text-slate-700 leading-relaxed font-medium">
          I agree to save my family details on this device for water planning.
        </span>
      </label>
    </div>,
  ];

  return (
    <div className="p-2.5 sm:p-3.5 space-y-4">
      {/* Mobile Step Progress Indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
          <span>SETUP WIZARD</span>
          <span>STEP {step + 1} OF 4</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step View */}
      <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        {steps[step]}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {step > 0 ? (
            <button
              type="button"
              className="py-2 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < steps.length - 1 ? (
            <button
              type="button"
              className="py-2.5 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-sm cursor-pointer flex items-center gap-1"
              onClick={() => setStep(step + 1)}
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!h.consent}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-xs font-black shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              onClick={() => onDone(h)}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Launch App</span>
            </button>
          )}
        </div>
      </div>

      {/* 1-Click Demo Shortcut */}
      <div className="text-center pt-1">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full border border-sky-200 bg-sky-50 text-sky-800 text-[11px] font-bold cursor-pointer hover:bg-sky-100 transition-colors"
          onClick={() => onDone(SAMPLE_HOUSEHOLD)}
        >
          <Sparkles className="w-3 h-3 text-sky-600" />
          <span>Quick Demo: Load Santos Family (Cabagan)</span>
        </button>
      </div>
    </div>
  );
}

export type AppTab = 'home' | 'plan' | 'alerts' | 'checkin';

// ---------- Main Household Active View (App Layout) ----------

export function HouseholdPanel({
  household,
  setHousehold,
  plan,
  cond,
  alerts,
  isEditing,
  onEditProfile,
  tab = 'home',
  onSelectTab,
  lang = 'en',
}: {
  household: Household | null;
  setHousehold: (h: Household | null) => void;
  plan: Plan | null;
  cond: Conditions;
  alerts: Alert[];
  isEditing?: boolean;
  onEditProfile?: () => void;
  tab?: AppTab;
  onSelectTab?: (tab: AppTab) => void;
  lang?: Language;
}) {
  if (!household || isEditing) {
    return (
      <Onboarding
        initialData={household}
        lang={lang}
        onDone={(h) => {
          setHousehold(h);
        }}
      />
    );
  }

  if (!plan) return null;

  return (
    <HouseholdActiveView
      household={household}
      setHousehold={setHousehold}
      plan={plan}
      cond={cond}
      alerts={alerts}
      onEditProfile={onEditProfile}
      tab={tab}
      onSelectTab={onSelectTab}
      lang={lang}
    />
  );
}

function HouseholdActiveView({
  household,
  setHousehold,
  plan,
  cond,
  alerts,
  onEditProfile,
  tab,
  onSelectTab,
  lang = 'en',
}: {
  household: Household;
  setHousehold: (h: Household | null) => void;
  plan: Plan;
  cond: Conditions;
  alerts: Alert[];
  onEditProfile?: () => void;
  tab: AppTab;
  onSelectTab?: (tab: AppTab) => void;
  lang?: Language;
}) {
  const t = TRANSLATIONS[lang];
  const sev = plan.severity;
  const [lo, hi] = plan.targetRange;
  const [isManagingContainers, setIsManagingContainers] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customLiters, setCustomLiters] = useState('');

  const activeContainers: WaterContainerItem[] = useMemo(() => {
    if (household.containers && household.containers.length > 0) return household.containers;
    return [{ id: 'init-c', name: STORAGE_LABEL[household.storage]?.name || 'Water Drum', liters: plan.capacity || 200, count: 1 }];
  }, [household.containers, household.storage, plan.capacity]);

  const updateActiveContainerCount = (id: string, delta: number) => {
    const nextList = activeContainers
      .map((c) => (c.id === id ? { ...c, count: Math.max(0, c.count + delta) } : c))
      .filter((c) => c.count > 0);
    const newCap = nextList.reduce((sum, c) => sum + c.liters * c.count, 0);
    setHousehold({
      ...household,
      containers: nextList,
      storage: capacityToStorageSize(newCap),
    });
  };

  const removeActiveContainer = (id: string) => {
    const nextList = activeContainers.filter((c) => c.id !== id);
    const newCap = nextList.reduce((sum, c) => sum + c.liters * c.count, 0);
    setHousehold({
      ...household,
      containers: nextList,
      storage: capacityToStorageSize(newCap),
    });
  };

  const addActivePreset = (name: string, liters: number) => {
    const existing = activeContainers.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.liters === liters
    );
    let nextList: WaterContainerItem[];
    if (existing) {
      nextList = activeContainers.map((c) => (c.id === existing.id ? { ...c, count: c.count + 1 } : c));
    } else {
      nextList = [
        ...activeContainers,
        {
          id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name,
          liters,
          count: 1,
        },
      ];
    }
    const newCap = nextList.reduce((sum, c) => sum + c.liters * c.count, 0);
    setHousehold({
      ...household,
      containers: nextList,
      storage: capacityToStorageSize(newCap),
    });
  };

  const handleAddActiveCustom = () => {
    const name = customName.trim();
    const liters = Math.max(1, Math.round(Number(customLiters) || 0));
    if (!name || liters <= 0) return;
    const newItem: WaterContainerItem = {
      id: `c-act-${Date.now()}`,
      name,
      liters,
      count: 1,
    };
    const nextList = [...activeContainers, newItem];
    const newCap = nextList.reduce((sum, c) => sum + c.liters * c.count, 0);
    setHousehold({
      ...household,
      containers: nextList,
      storage: capacityToStorageSize(newCap),
    });
    setCustomName('');
    setCustomLiters('');
  };

  const impactDateLabel = useMemo(() => {
    if (!plan.impactMonth) return null;
    const [y, m] = plan.impactMonth.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === 'en' ? 'en-US' : 'fil-PH', { month: 'long', year: 'numeric' });
  }, [plan.impactMonth, lang]);

  const when = useMemo(() => {
    if (plan.daysToImpact === null) {
      return t.home.noDrySpell;
    }
    if (!plan.impactMonth) {
      return t.home.drySpellUnderway;
    }
    const months = Math.max(1, Math.round(plan.daysToImpact / 30));
    return t.home.waterSupplyScarce(months, impactDateLabel);
  }, [plan.daysToImpact, plan.impactMonth, impactDateLabel, t]);

  const fillBy = useMemo(() => {
    if (!plan.daysToImpact) return null;
    return new Date(cond.today.getTime() + (plan.daysToImpact - 3) * 864e5);
  }, [plan.daysToImpact, cond.today]);

  // Computed live metrics for AI allocation and storage status (100% reactive across tabs)
  const daysOnHand = useMemo(() => {
    return household.stored / Math.max(1, plan.daily.total);
  }, [household.stored, plan.daily.total]);

  // Whole integer days (no decimals; if less than 1 whole day, do not display fractional days)
  const wholeDaysOnHand = Math.floor(daysOnHand);

  // Same goal as the pacing plan (top of the range): under-storing costs more than over-storing (spec §7)
  const targetGoal = plan.targetRange[1];
  const progressPct = useMemo(() => {
    return Math.min(100, Math.round((household.stored / Math.max(1, targetGoal)) * 100));
  }, [household.stored, targetGoal]);

  const hasBaby = household.members.some((m) => m.age === 'infant');
  const hasFormula = household.members.some((m) => m.formulaFed);
  const hasPregnant = household.members.some((m) => m.pregnant);
  const hasLactating = household.members.some((m) => m.lactating);
  const heatIndex = Math.round(cond.risk.heatIndexC);

  // Daily Allocation Categories (in Liters)
  const drinkingLiters = plan.daily.potable;
  const hygieneLiters = Math.round(plan.daily.domestic * 0.55);
  const sanitationLiters = Math.max(0, Math.round(plan.daily.domestic - hygieneLiters));

  // Dynamic Home Status Message based on actual water collected/stored (using integer days only)
  const homeStatusMessage = useMemo(() => {
    const stored = household.stored;
    const dailyTotal = Math.max(1, plan.daily.total);
    const wholeDays = Math.floor(stored / dailyTotal);
    const drinkingL = drinkingLiters.toFixed(1);
    const en = lang === 'en';

    // Low risk: a small or empty reserve is not an emergency, so don't raise a red alarm.
    if (plan.severity === 'low' && stored < targetGoal) {
      return {
        level: 'calm' as const,
        badge: en ? 'LOW RISK · NO RUSH' : 'MABABA ANG PANGANIB',
        title: en ? 'Build your reserve slowly' : 'Mag-ipon nang dahan-dahan',
        message: en
          ? `You have ${stored} L stored. Water risk in ${household.lgu} is low right now, so there's no rush: add ${plan.litersEvery3Days} L every 3 days.`
          : `May ${stored} L kang naipon. Mababa ang panganib sa ${household.lgu} ngayon, kaya walang pagmamadali: magdagdag ng ${plan.litersEvery3Days} L kada 3 araw.`,
        quickTip: en ? 'Keep stored water covered.' : 'Takpan ang naipong tubig.',
        guidance: en ? 'We will alert you if the risk goes up.' : 'Aabisuhan ka namin kapag tumaas ang panganib.',
        boxBg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
        tagBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        barColor: 'from-emerald-500 to-teal-600',
        emoji: '🟢',
      };
    }

    if (stored === 0) {
      return {
        level: 'empty' as const,
        badge: t.home.statusEmpty.badge,
        title: t.home.statusEmpty.title,
        message: t.home.statusEmpty.message(drinkingL, household.lgu),
        quickTip: t.home.statusEmpty.quickTip,
        guidance: t.home.statusEmpty.guidance(drinkingL),
        boxBg: 'bg-rose-50 border-rose-200 text-rose-950',
        tagBg: 'bg-rose-100 text-rose-800 border-rose-300',
        barColor: 'from-rose-500 to-red-600',
        emoji: '🚨',
      };
    }

    if (wholeDays < 1) {
      return {
        level: 'critical' as const,
        badge: t.home.statusCritical.badge(0),
        title: t.home.statusCritical.title,
        message: t.home.statusCritical.message(stored, 0),
        quickTip: t.home.statusCritical.quickTip(0),
        guidance: t.home.statusCritical.guidance,
        boxBg: 'bg-rose-50/90 border-rose-200 text-rose-950',
        tagBg: 'bg-rose-100 text-rose-800 border-rose-300',
        barColor: 'from-rose-500 to-amber-500',
        emoji: '⚠️',
      };
    }

    if (wholeDays < 3) {
      return {
        level: 'low' as const,
        badge: t.home.statusLow.badge(wholeDays),
        title: t.home.statusLow.title,
        message: t.home.statusLow.message(stored, wholeDays),
        quickTip: t.home.statusLow.quickTip(wholeDays),
        guidance: t.home.statusLow.guidance(plan.litersEvery3Days),
        boxBg: 'bg-amber-50 border-amber-200 text-amber-950',
        tagBg: 'bg-amber-100 text-amber-900 border-amber-300',
        barColor: 'from-amber-400 to-sky-500',
        emoji: '🟡',
      };
    }

    if (stored < targetGoal) {
      return {
        level: 'good' as const,
        badge: t.home.statusGood.badge(wholeDays),
        title: t.home.statusGood.title,
        message: t.home.statusGood.message(stored, wholeDays, progressPct),
        quickTip: t.home.statusGood.quickTip(progressPct, stored, targetGoal),
        guidance: t.home.statusGood.guidance(targetGoal),
        boxBg: 'bg-sky-50 border-sky-200 text-sky-950',
        tagBg: 'bg-sky-100 text-sky-800 border-sky-300',
        barColor: 'from-sky-500 to-blue-600',
        emoji: '💧',
      };
    }

    return {
      level: 'optimal' as const,
      badge: t.home.statusOptimal.badge(wholeDays),
      title: t.home.statusOptimal.title,
      message: t.home.statusOptimal.message(stored, progressPct, wholeDays, household.lgu),
      quickTip: t.home.statusOptimal.quickTip,
      guidance: t.home.statusOptimal.guidance,
      boxBg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      tagBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      barColor: 'from-teal-500 to-emerald-600',
      emoji: '✅',
    };
  }, [household.stored, plan.daily.total, plan.litersEvery3Days, drinkingLiters, household.lgu, targetGoal, progressPct, t, plan.severity, lang]);

  // AI Storage Diagnosis based on actual stored water & climate data
  const aiStorageDiagnosis = useMemo(() => {
    const wholeDays = Math.floor(daysOnHand);
    if (household.stored === 0) {
      return {
        level: 'critical',
        badge: lang === 'en' ? '0 L Stored · No Buffer' : '0 L Imbak · Walang Buffer',
        badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
        priorityOrder: t.storage.tipsEmpty,
      };
    }
    if (wholeDays < 1) {
      return {
        level: 'critical',
        badge:
          lang === 'en'
            ? `${household.stored} L Stored · Under 1 Day`
            : `${household.stored} L Imbak · Kulang sa 1 Araw`,
        badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
        priorityOrder: t.storage.tipsEmpty,
      };
    }
    if (wholeDays < 3) {
      return {
        level: 'low',
        badge:
          lang === 'en'
            ? `${household.stored} L Stored · ${wholeDays} Day${wholeDays > 1 ? 's' : ''} Buffer`
            : `${household.stored} L Imbak · ${wholeDays} Araw na Buffer`,
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
        priorityOrder: t.storage.tipsLow(drinkingLiters.toFixed(1), plan.litersEvery3Days),
      };
    }
    if (household.stored < plan.storable) {
      return {
        level: 'building',
        badge:
          lang === 'en'
            ? `${household.stored} L Stored · ${wholeDays} Days Pacing`
            : `${household.stored} L Imbak · ${wholeDays} Araw na Pacing`,
        badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
        priorityOrder: t.storage.tipsBuilding(plan.litersEvery3Days, plan.storable),
      };
    }
    return {
      level: 'optimal',
      badge:
        lang === 'en'
          ? `${household.stored} L Stored · ${wholeDays} Days Buffer`
          : `${household.stored} L Imbak · ${wholeDays} Araw na Buffer`,
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      priorityOrder: t.storage.tipsOptimal,
    };
  }, [household.stored, daysOnHand, drinkingLiters, plan.litersEvery3Days, plan.storable, lang, t]);

  return (
    <div className="space-y-3.5">
      {/* Screen 1: Home & Target */}
      {tab === 'home' && (
        <div className="space-y-3.5">
          {/* Top Greeting & Location Header */}
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-black text-xs shrink-0">
                {household.name ? household.name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 m-0 leading-tight">
                  {household.name || 'Santos Family'}
                </h3>
                <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                  <MapPin className="w-2.5 h-2.5 text-sky-600" />
                  {household.lgu}, Isabela · {household.members.length} members
                </span>
              </div>
            </div>
            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-sky-700 rounded-lg hover:bg-slate-50 cursor-pointer"
              onClick={onEditProfile}
              title="Edit Household"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Newest unread alert, tap to open the Alerts tab */}
          {(() => {
            const unread = alerts.find((x) => !(household.seenAlerts ?? []).includes(x.id));
            if (!unread) return null;
            const t2 = alertText(unread, plan, household.lgu, lang);
            return (
              <button type="button" onClick={() => onSelectTab?.('alerts')}
                className="w-full p-3 rounded-2xl border border-amber-300 bg-amber-50 shadow-2xs flex items-start gap-2.5 text-left cursor-pointer">
                <span aria-hidden>{t2.icon}</span>
                <span className="text-xs text-amber-950 font-semibold leading-snug">{t2.title}</span>
              </button>
            );
          })()}

          {/* Hero Water Target Mobile Card */}
          <div className="p-4 sm:p-4.5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <span
                className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-1.5"
                style={{
                  color: SEVERITY_COLOR[sev],
                  background: sev === 'high' ? '#fff1f2' : sev === 'moderate' ? '#fffbeb' : '#f0fdf4',
                  borderColor: SEVERITY_COLOR[sev],
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: SEVERITY_COLOR[sev] }} />
                {lang === 'en'
                  ? `${SEVERITY_WORD[sev]} · ${household.lgu}`
                  : `${sev === 'high' ? 'Mataas na Panganib' : sev === 'moderate' ? 'Katamtamang Panganib' : 'Mababang Panganib'} · ${household.lgu}`}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {monthLabel(cond.asOf, true)}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                {t.home.waterToStore}
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight m-0 bg-gradient-to-r from-slate-900 to-sky-700 bg-clip-text text-transparent">
                {t.home.storeLiters(lo, hi)}
              </h1>
              <p className="text-xs text-slate-500 mt-1 m-0">
                {lang === 'en'
                  ? `For drinking, cooking and basic washing. With bathing and cleaning too: ${plan.fullTarget} L.`
                  : `Pang-inom, pagluluto at basic na paghuhugas. Kung kasama ang paliligo at paglilinis: ${plan.fullTarget} L.`}
              </p>
              <p className="text-xs font-semibold text-slate-700 mt-1 m-0">
                {when}
              </p>
            </div>

            {/* Dynamic Status Message Based on Water Collected */}
            <div className={`p-3 rounded-xl border ${homeStatusMessage.boxBg} space-y-1 transition-all duration-300`}>
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${homeStatusMessage.tagBg} flex items-center gap-1`}>
                  <span>{homeStatusMessage.emoji}</span>
                  <span>{homeStatusMessage.badge}</span>
                </span>
                <span className="text-[11px] font-bold opacity-75">
                  {progressPct}% {t.home.targetGoalSuffix}
                </span>
              </div>
              <p className="text-xs font-semibold leading-relaxed m-0 text-slate-900">
                {homeStatusMessage.message}
              </p>
            </div>

            {/* Daily Consumption Breakdown Cards */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="p-2.5 sm:p-3 rounded-xl border border-sky-200/80 bg-sky-50/60">
                <span className="text-[11px] font-bold text-sky-900 block flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-600" />
                  {t.home.drinking}
                </span>
                <span className="text-lg font-black text-sky-700 block mt-0.5">
                  {plan.daily.potable.toFixed(1)} L/day
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                  {t.home.drinkingDesc}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/80">
                <span className="text-[11px] font-bold text-slate-800 block flex items-center gap-1">
                  <Shield className="w-3 h-3 text-slate-500" />
                  {t.home.household}
                </span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">
                  {plan.daily.domestic.toFixed(0)} L/day
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                  {t.home.householdDesc}
                </span>
              </div>
            </div>

            {/* Dengue Safe Storage Alert */}
            <div className="p-2.5 sm:p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 text-[11px] text-emerald-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {t.home.dengueTitle}
              </div>
              <p className="m-0 leading-relaxed text-emerald-900 text-[11px]">
                {t.home.dengueDesc}
              </p>
            </div>
          </div>

          {/* Storage Progress & Days Left Mini Readiness Widget (Directly synced with Storage) */}
          <div className="p-4 sm:p-4.5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Droplets className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block leading-tight">
                    {t.home.readinessTitle}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {homeStatusMessage.quickTip}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${homeStatusMessage.tagBg}`}>
                {household.stored} L / {targetGoal} L
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span className="text-slate-600">
                  {t.home.supplyOnHand}{' '}
                  {wholeDaysOnHand >= 1 ? (
                    <strong className="text-slate-900 font-black">
                      ~{wholeDaysOnHand} {wholeDaysOnHand === 1 ? (lang === 'en' ? 'day' : 'araw') : t.home.days}
                    </strong>
                  ) : (
                    <span className="text-rose-600 font-extrabold">
                      {household.stored === 0
                        ? (lang === 'en' ? '0 L' : '0 L')
                        : (lang === 'en' ? 'Under 1 day' : 'Kulang sa 1 araw')}
                    </span>
                  )}
                </span>
                <span className="text-sky-700 font-extrabold">
                  {progressPct}% {t.home.targetGoalSuffix}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200/80 p-0.5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${homeStatusMessage.barColor} transition-all duration-300`}
                  style={{
                    width: `${Math.min(100, Math.max(household.stored > 0 ? 5 : 0, progressPct))}%`,
                  }}
                />
              </div>
            </div>

            {/* Live Guidance Tip */}
            <div className="text-[11px] font-medium text-slate-700 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2">
              <span className="text-sm shrink-0">{homeStatusMessage.emoji}</span>
              <span className="leading-snug">{homeStatusMessage.guidance}</span>
            </div>

            {/* Quick Log Buttons (Direct State Update) */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  {t.home.quickLog}
                </span>
                {onSelectTab && (
                  <button
                    type="button"
                    onClick={() => onSelectTab('plan')}
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-800 cursor-pointer flex items-center gap-0.5"
                  >
                    <span>{t.home.viewStorageDetails}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  className="py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-all cursor-pointer active:scale-95"
                  onClick={() => setHousehold({ ...household, stored: household.stored + 5 })}
                >
                  +5 L
                </button>
                <button
                  type="button"
                  className="py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-all cursor-pointer active:scale-95"
                  onClick={() => setHousehold({ ...household, stored: household.stored + 20 })}
                >
                  +20 L
                </button>
                <button
                  type="button"
                  className="py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-all cursor-pointer active:scale-95"
                  onClick={() => setHousehold({ ...household, stored: household.stored + 50 })}
                >
                  +50 L
                </button>
                <button
                  type="button"
                  className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer active:scale-95"
                  onClick={() => setHousehold({ ...household, stored: 0 })}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Storage Plan & Pacing */}
      {tab === 'plan' && (
        <div className="space-y-3.5">
          {/* Visual Drum Gauge Card */}
          <div className="p-4 sm:p-4.5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                {lang === 'en' ? 'Water Storage' : 'Imbakan ng Tubig'}
              </span>
              <span className="text-xs font-extrabold text-sky-700">
                {household.stored} L {lang === 'en' ? 'stored' : 'imbak'}
              </span>
            </div>

            <div className="flex items-center justify-around py-2">
              <DrumGauge stored={household.stored} low={lo} high={hi} capacity={plan.capacity} en={lang === 'en'} />
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">
                    {lang === 'en' ? 'Stored' : 'Naimbak'}
                  </span>
                  <strong className="text-xl font-black text-sky-700">{household.stored} L</strong>
                  <span className="text-[11px] text-slate-500 font-semibold block">
                    {wholeDaysOnHand >= 1
                      ? `~${wholeDaysOnHand} ${wholeDaysOnHand === 1 ? (lang === 'en' ? 'day' : 'araw') : t.home.days}`
                      : (household.stored === 0
                          ? (lang === 'en' ? '0 L' : '0 L')
                          : (lang === 'en' ? 'Under 1 day' : 'Kulang sa 1 araw'))}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">
                    {lang === 'en' ? 'Target' : 'Target'}
                  </span>
                  <strong className="text-sm font-bold text-slate-900">{lo === hi ? lo : `${lo}–${hi}`} L</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">
                    {lang === 'en' ? 'Capacity' : 'Kapasidad'}
                  </span>
                  <strong className="text-sm font-bold text-slate-600">{plan.capacity} L</strong>
                </div>
              </div>
            </div>

            {/* Paced storage schedule */}
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-800 block">
                {lang === 'en' ? 'Storage Guide' : 'Gabay sa Pag-iipon'}
              </span>
              {household.stored >= plan.storable ? (
                <p className="text-xs font-bold text-emerald-800 m-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {plan.shortfall > 0
                    ? lang === 'en'
                      ? `Containers full. You still need about ${plan.shortfall} L more: add containers or use a refill point.`
                      : `Puno na ang lalagyan. Kulang pa ng mga ${plan.shortfall} L: magdagdag ng lalagyan o gumamit ng igiban.`
                    : lang === 'en' ? 'Target reached! Keep containers sealed.' : 'Naabot ang target! Panatilihing nakatakip.'}
                </p>
              ) : (
                <p className="text-sm font-black text-slate-900 m-0">
                  {lang === 'en'
                    ? `${plan.urgent ? 'Store what you can today, then add' : 'Add'} ${plan.litersEvery3Days} L every 3 days`
                    : `${plan.urgent ? 'Mag-ipon na ngayon ng kaya mo, tapos magdagdag ng' : 'Magdagdag ng'} ${plan.litersEvery3Days} L kada 3 araw`}
                </p>
              )}
              {fillBy && !cond.hindsight && (
                <span className="text-[11px] text-slate-500 block">
                  {lang === 'en' ? 'Target date: ' : 'Target na petsa: '}
                  {fillBy.toLocaleDateString(lang === 'en' ? 'en-US' : 'en-PH', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>

            {/* Quick Log Buttons */}
            <div className="space-y-1.5 pt-0.5">
              <span className="text-[11px] font-bold text-slate-600 block">
                {lang === 'en' ? 'Add Water Stored:' : 'Magdagdag ng Naimbak:'}
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  className="py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-colors cursor-pointer"
                  onClick={() => setHousehold({ ...household, stored: household.stored + 5 })}
                >
                  +5 L
                </button>
                <button
                  type="button"
                  className="py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-colors cursor-pointer"
                  onClick={() => setHousehold({ ...household, stored: household.stored + 20 })}
                >
                  +20 L
                </button>
                <button
                  type="button"
                  className="py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-colors cursor-pointer"
                  onClick={() => setHousehold({ ...household, stored: household.stored + 50 })}
                >
                  +50 L
                </button>
                <button
                  type="button"
                  className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                  onClick={() => setHousehold({ ...household, stored: 0 })}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Dynamic Water Containers Card */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block leading-tight">
                    {lang === 'en'
                      ? `Your Containers (${activeContainers.length})`
                      : `Iyong mga Lalagyan (${activeContainers.length})`}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'en'
                      ? `Total Capacity: ${plan.capacity} Liters`
                      : `Kabuuang Kapasidad: ${plan.capacity} Litro`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsManagingContainers(!isManagingContainers)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 cursor-pointer transition-colors flex items-center gap-1"
              >
                {isManagingContainers
                  ? (lang === 'en' ? 'Done' : 'Tapos')
                  : (lang === 'en' ? '+ Manage' : '+ Pamahalaan')}
              </button>
            </div>

            {/* Overview chip pills if collapsed */}
            {!isManagingContainers ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {activeContainers.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700"
                  >
                    <span className="text-sky-700">{item.count}x</span>
                    <span>{item.name}</span>
                    <span className="text-[11px] text-slate-400 font-semibold">({item.liters * item.count} L)</span>
                  </span>
                ))}
              </div>
            ) : (
              /* Expanded Manager with steppers, presets, and custom adder */
              <div className="space-y-3 pt-1 animate-in fade-in">
                {/* Active container stepper list */}
                <div className="space-y-1.5">
                  {activeContainers.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ContainerBadgeIcon liters={item.liters} />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 block truncate leading-tight">
                            {item.name}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {lang === 'en'
                              ? `${item.liters} L each · Total: ${item.liters * item.count} L`
                              : `${item.liters} L bawat isa · Kabuuan: ${item.liters * item.count} L`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => updateActiveContainerCount(item.id, -1)}
                            className="w-5.5 h-5.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="w-5 text-center font-bold text-xs text-slate-900">
                            {item.count}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateActiveContainerCount(item.id, 1)}
                            className="w-5.5 h-5.5 rounded-md bg-sky-600 text-white flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeActiveContainer(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    {lang === 'en' ? 'Quick Add Presets' : 'Mabilisang Preset'}
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {CONTAINER_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => addActivePreset(preset.name, preset.liters)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-sky-50 text-left cursor-pointer transition-all flex flex-col"
                      >
                        <span className="text-[11px] font-bold text-slate-900 truncate">
                          {preset.name}
                        </span>
                        <span className="text-[11px] text-sky-700 font-semibold">
                          +{preset.liters} L
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Container Adder */}
                <div className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/60 space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-sky-900 block">
                    {lang === 'en' ? 'Add Custom Container' : 'Magdagdag ng Custom Container'}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      placeholder={lang === 'en' ? 'Name (e.g. Basin, Tub)' : 'Pangalan (hal. Palanggana, Timba)'}
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder={lang === 'en' ? 'Liters (e.g. 35)' : 'Litro (hal. 35)'}
                      value={customLiters}
                      onChange={(e) => setCustomLiters(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!customName.trim() || Number(customLiters) <= 0}
                    onClick={handleAddActiveCustom}
                    className="w-full py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{lang === 'en' ? 'Add Custom Container' : 'Idagdag ang Container'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Smart AI Water Allocation & Guidance (Based on actual stored water, family profile, and climate data) */}
          <div className="p-4 sm:p-4.5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3.5">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 m-0">
                  {t.storage.aiAllocationTitle}
                </h4>
              </div>
              <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${aiStorageDiagnosis.badgeBg}`}>
                {aiStorageDiagnosis.badge}
              </span>
            </div>

            {/* Smart Daily Quota Breakdown */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                {lang === 'en'
                  ? `Recommended Daily Allocation (${household.members.length} Members)`
                  : `Tamang Arawang Alokasyon (${household.members.length} Tao sa Bahay)`}
              </span>

              {/* Category 1: Drinking & Cooking */}
              <div className="p-3 rounded-xl border border-sky-200/80 bg-sky-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-sky-600 text-white flex items-center justify-center shrink-0">
                      <Droplets className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-black text-slate-900 block leading-tight">
                        {t.storage.catPotable}
                      </strong>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {t.storage.catPotableSub}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-sky-700 bg-white px-2 py-0.5 rounded-md border border-sky-200">
                    {drinkingLiters.toFixed(1)} L / day
                  </span>
                </div>

                {/* Context sub-allocations */}
                <div className="flex flex-wrap gap-1 pt-0.5 text-[11px] font-bold text-slate-600">
                  <span className="px-1.5 py-0.5 bg-white rounded border border-sky-100">
                    {t.storage.catPotableTagSphere}
                  </span>
                  {(hasBaby || hasFormula) && (
                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-200">
                      {t.storage.catPotableTagBaby}
                    </span>
                  )}
                  {(hasPregnant || hasLactating) && (
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                      {t.storage.catPotableTagMaternal}
                    </span>
                  )}
                  {heatIndex >= 33 && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">
                      {t.storage.catPotableTagHeat(
                        ((heatIndex >= 42 ? 1 : 0.5) * household.members.length).toFixed(1),
                        household.lgu,
                        heatIndex
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Category 2: Hygiene & Bathing */}
              <div className="p-3 rounded-xl border border-indigo-200/80 bg-indigo-50/40 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-black text-slate-900 block leading-tight">
                        {t.storage.catHygiene}
                      </strong>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {t.storage.catHygieneSub(household.members.length)}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                    ~{hygieneLiters} L / day
                  </span>
                </div>
              </div>

              {/* Category 3: Sanitation & Cleaning */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-slate-700 text-white flex items-center justify-center shrink-0">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-black text-slate-900 block leading-tight">
                        {t.storage.catSanitation}
                      </strong>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {t.storage.catSanitationSub}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    ~{sanitationLiters} L / day
                  </span>
                </div>
              </div>
            </div>

            {/* AI Action Plan Based on Stored Level */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                {t.storage.actionPlanTitle}
              </span>

              <div className="space-y-1.5">
                {aiStorageDiagnosis.priorityOrder.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs flex items-start gap-2.5 text-xs"
                  >
                    <div className="w-5 h-5 rounded-md bg-sky-100 text-sky-700 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="m-0 text-slate-800 font-medium leading-snug">
                      {tip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <RefillPoints town={household.lgu} barangay={household.barangay ?? ''} lang={lang} />
        </div>
      )}

      {tab === 'alerts' && (
        <AlertsView alerts={alerts} plan={plan} cond={cond} stored={household.stored} lang={lang}
          onOpenPlan={() => onSelectTab?.('plan')} onOpenCheckIn={() => onSelectTab?.('checkin')}
          onSeen={(ids) => {
            const seen = new Set(household.seenAlerts ?? []);
            if (ids.every((id) => seen.has(id))) return;
            setHousehold({ ...household, seenAlerts: [...new Set([...seen, ...ids])].slice(-50) });
          }} />
      )}

      {/* Screen 4: Post-Event Check-In */}
      {tab === 'checkin' && <CheckIn household={household} setHousehold={setHousehold} lang={lang} />}
    </div>
  );
}

// ---------- Mobile Post-Event Check-In Component ----------

function CheckIn({
  household,
  setHousehold,
  lang,
}: {
  household: Household;
  setHousehold: (h: Household) => void;
  lang: Language;
}) {
  const en = lang === 'en';
  const [answer, setAnswer] = useState<CheckInAnswer | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const options: [CheckInAnswer, string, string][] = en
    ? [
        ['short', 'Ran short early', 'Our stored water ran out before supply came back.'],
        ['fine', 'Lasted about right', 'Just enough for drinking, cooking and washing.'],
        ['extra', 'Had water left over', 'We can store a little less next time.'],
      ]
    : [
        ['short', 'Naubos nang maaga', 'Naubos ang naipong tubig bago bumalik ang supply.'],
        ['fine', 'Sakto lang', 'Sapat para sa inumin, luto, at paghuhugas.'],
        ['extra', 'May natira pa', 'Puwedeng bawasan nang kaunti ang ipon sa susunod.'],
      ];

  const save = () => {
    if (!answer) return;
    const next = calibrationFromAnswer(household.calibration, answer);
    setHousehold({ ...household, calibration: next, alertSeverity: undefined });
    const change = Math.round((next / household.calibration - 1) * 100);
    setSaved(
      change > 0
        ? en ? `Saved. Your next target is ${change}% higher.` : `Na-save. Mas mataas nang ${change}% ang susunod mong target.`
        : change < 0
          ? en ? `Saved. Your next target is ${-change}% lower.` : `Na-save. Mas mababa nang ${-change}% ang susunod mong target.`
          : en ? 'Saved. Your target stays the same.' : 'Na-save. Pareho pa rin ang target mo.'
    );
  };

  return (
    <div className="space-y-3.5">
      <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-1">
        <h2 className="text-lg font-black text-slate-900 m-0">{en ? 'Did your stored water last?' : 'Tumagal ba ang naipon ninyong tubig?'}</h2>
        <p className="text-xs text-slate-600 m-0 leading-relaxed">
          {en ? 'Think of the last dry spell or water cut. Your answer adjusts your next target.' : 'Isipin ang huling tagtuyot o pagkawala ng tubig. Iaayon namin dito ang susunod mong target.'}
        </p>
      </div>

      <div role="radiogroup" aria-label={en ? 'Did your stored water last?' : 'Tumagal ba ang naipon ninyong tubig?'} className="space-y-2">
        {options.map(([id, title, sub]) => (
          <button key={id} type="button" role="radio" aria-checked={answer === id}
            onClick={() => { setAnswer(id); setSaved(null); }}
            className={`w-full p-3.5 rounded-2xl border-2 bg-white flex items-center gap-3 text-left cursor-pointer transition-colors ${answer === id ? 'border-sky-600' : 'border-slate-200'}`}>
            <span className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${answer === id ? 'border-sky-600' : 'border-slate-300'}`}>
              {answer === id && <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />}
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-900">{title}</span>
              <span className="block text-xs text-slate-500">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 m-0 px-1">{en ? 'Saved only on this phone.' : 'Sa phone na ito lang naka-save.'}</p>

      <button
        type="button"
        disabled={!answer}
        className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-sm font-extrabold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
        onClick={save}
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>{en ? 'Save my answer' : 'I-save ang sagot'}</span>
      </button>

      {saved && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium">
          {saved}
        </div>
      )}
    </div>
  );
}
