// AquaReady Internationalization (i18n) Engine
// Default: English ('en'). Option to switch to Tagalog ('tl').

export type Language = 'en' | 'tl';

export interface Translations {
  tabs: {
    home: string;
    plan: string;
    alerts: string;
    profile: string;
    provincial: string;
  };
  header: {
    liveFeed: string;
    offlineReady: string;
    appTitle: string;
    appSubtitle: string;
    switchLangTooltip: string;
    signout: string;
    about: string;
    rerunSplash: string;
  };
  home: {
    greeting: string;
    membersLabel: (count: number) => string;
    pagasaAlert: string;
    waterToStore: string;
    storeLiters: (lo: number, hi: number) => string;
    noDrySpell: string;
    drySpellUnderway: string;
    waterSupplyScarce: (months: number, dateLabel?: string | null) => string;
    drinking: string;
    drinkingDesc: string;
    household: string;
    householdDesc: string;
    dengueTitle: string;
    dengueDesc: string;
    readinessTitle: string;
    supplyOnHand: string;
    days: string;
    targetGoalSuffix: string;
    quickLog: string;
    viewStorageDetails: string;
    reset: string;
    statusEmpty: {
      badge: string;
      title: string;
      message: (drinkingL: string, lgu: string) => string;
      quickTip: string;
      guidance: (drinkingL: string) => string;
    };
    statusCritical: {
      badge: (days: number) => string;
      title: string;
      message: (stored: number, days: number) => string;
      quickTip: (days: number) => string;
      guidance: string;
    };
    statusLow: {
      badge: (days: number) => string;
      title: string;
      message: (stored: number, days: number) => string;
      quickTip: (days: number) => string;
      guidance: (litersEvery3Days: number) => string;
    };
    statusGood: {
      badge: (days: number) => string;
      title: string;
      message: (stored: number, days: number, pct: number) => string;
      quickTip: (pct: number, stored: number, target: number) => string;
      guidance: (target: number) => string;
    };
    statusOptimal: {
      badge: (days: number) => string;
      title: string;
      message: (stored: number, pct: number, days: number, lgu: string) => string;
      quickTip: string;
      guidance: string;
    };
  };
  storage: {
    title: string;
    subtitle: string;
    inventoryTitle: string;
    addContainer: string;
    capacityTotal: string;
    storedOnHand: string;
    daysOfSupply: (days: number) => string;
    quickAddPrompt: string;
    aiAllocationTitle: string;
    aiAllocationSubtitle: string;
    catPotable: string;
    catPotableSub: string;
    catPotableTagSphere: string;
    catPotableTagBaby: string;
    catPotableTagMaternal: string;
    catPotableTagHeat: (bufferL: string, lgu: string, heatIndex: number) => string;
    catHygiene: string;
    catHygieneSub: (count: number) => string;
    catSanitation: string;
    catSanitationSub: string;
    actionPlanTitle: string;
    tipsEmpty: string[];
    tipsLow: (drinkingL: string, liters3Days: number) => string[];
    tipsBuilding: (liters3Days: number, storable: number) => string[];
    tipsOptimal: string[];
  };
  profile: {
    title: string;
    subtitle: string;
    familyName: string;
    familyNamePlaceholder: string;
    municipality: string;
    barangay: string;
    whoLivesWithYou: string;
    infant: string;
    child: string;
    adult: string;
    elderly: string;
    vulnerabilities: string;
    pregnant: string;
    lactating: string;
    formulaFed: string;
    healthFlag: string;
    saveProfile: string;
    cancel: string;
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    tabs: {
      home: 'Home',
      plan: 'Storage',
      alerts: 'Alerts',
      profile: 'Check-In',
      provincial: 'Province',
    },
    header: {
      liveFeed: 'Live Feed',
      offlineReady: 'Offline Ready',
      appTitle: 'AquaReady',
      appSubtitle: 'Household Water Planning App',
      switchLangTooltip: 'Palitan sa Tagalog / Filipino',
      signout: 'Sign Out / Reset Profile',
      about: 'About and sources',
      rerunSplash: 'Re-run splash animation',
    },
    home: {
      greeting: 'Santos Family',
      membersLabel: (count) => `${count} member${count === 1 ? '' : 's'}`,
      pagasaAlert: 'PAGASA Alert',
      waterToStore: 'Water to Store',
      storeLiters: (lo, hi) => (lo === hi ? `Store ${lo} L` : `Store ${lo}–${hi} L`),
      noDrySpell: 'No dry spell expected in current PAGASA forecast window.',
      drySpellUnderway: 'A dry spell is already underway in your municipality.',
      waterSupplyScarce: (months, dateLabel) =>
        `Water supply scarce in about ${months} month${months === 1 ? '' : 's'}${
          dateLabel ? ` (${dateLabel})` : ''
        }.`,
      drinking: 'Drinking',
      drinkingDesc: 'Drinking & cooking',
      household: 'Household',
      householdDesc: 'Bathing & cleaning',
      dengueTitle: 'Keep Water Drums Covered',
      dengueDesc: 'Keep drums tightly covered with a lid or screen to prevent mosquito breeding.',
      readinessTitle: 'Current Water Readiness',
      supplyOnHand: 'Supply on hand:',
      days: 'days',
      targetGoalSuffix: 'of Target Goal',
      quickLog: 'Quick Log Stored Water:',
      viewStorageDetails: 'View Storage Details',
      reset: 'Reset',
      statusEmpty: {
        badge: '0 L · No Buffer',
        title: 'No Stored Water',
        message: (drinkingL, lgu) =>
          `Critical: Your household has no water stored yet. Store at least ${drinkingL} L for drinking and food prep before supply disruptions in ${lgu}.`,
        quickTip: 'Start storing drinking water today.',
        guidance: (drinkingL) =>
          `Your household strictly requires ${drinkingL} L daily for safe drinking and cooking.`,
      },
      statusCritical: {
        badge: (days) => (days < 1 ? 'Critical · Under 1 Day' : `Critical · ${days} Day${days > 1 ? 's' : ''}`),
        title: 'Critical Water Reserve',
        message: (stored, days) =>
          days < 1
            ? `You have ${stored} L stored (under 1 whole day of supply). Sufficient only for drinking and basic cooking. Strictly postpone laundry or deep cleaning.`
            : `You have ${stored} L stored (~${days} day${days > 1 ? 's' : ''} of supply). Sufficient only for drinking and basic cooking. Strictly postpone laundry or deep cleaning.`,
        quickTip: (days) => (days < 1 ? 'Under 1 day of water. Prioritize drinking.' : `~${days} day${days > 1 ? 's' : ''} of water. Prioritize drinking.`),
        guidance: 'Do not use drinking water for toilet flushing or washing.',
      },
      statusLow: {
        badge: (days) => (days < 1 ? 'Low Buffer · Under 1 Day' : `Low Buffer · ${days} Day${days > 1 ? 's' : ''}`),
        title: 'Low Water Reserve',
        message: (stored, days) =>
          days < 1
            ? `You have ${stored} L stored (under 1 whole day of supply). Enough for drinking, but continue storing water to build your safe 3-day emergency buffer.`
            : `You have ${stored} L stored (~${days} day${days > 1 ? 's' : ''} of supply). Enough for drinking, but continue storing water to build your safe 3-day emergency buffer.`,
        quickTip: (days) => (days < 1 ? 'Under 1 day of supply. Add more storage buffer.' : `~${days} day${days > 1 ? 's' : ''} of supply. Add more storage buffer.`),
        guidance: (litersEvery3Days) =>
          `Add ${litersEvery3Days} L over the next 3 days to build an adequate reserve.`,
      },
      statusGood: {
        badge: (days) => `Good Progress · ${days} Days`,
        title: 'Steady Storage Pacing',
        message: (stored, days, pct) =>
          `Great progress! You have ${stored} L stored (~${days} day${days > 1 ? 's' : ''} of supply, ${pct}% of target). Your family has a solid drinking and hygiene buffer.`,
        quickTip: (pct, stored, target) =>
          `At ${pct}% of your target goal (${stored} L / ${target} L).`,
        guidance: (target) =>
          `Keep adding water gradually until reaching the ${target} L total target.`,
      },
      statusOptimal: {
        badge: (days) => `Ready & Safe · ${days} Days`,
        title: 'Storage Goal Reached!',
        message: (stored, pct, days, lgu) =>
          `Outstanding! Your household reached ${stored} L (${pct}% of goal, ~${days} days of supply). You are fully prepared against water shortages in ${lgu}.`,
        quickTip: '100% goal reached! Keep containers sealed.',
        guidance: 'Keep containers tightly covered and rotate stored water every 2 weeks.',
      },
    },
    storage: {
      title: 'Water Storage & Containers',
      subtitle: 'Manage containers and smart allocation quota',
      inventoryTitle: 'Your Storage Containers',
      addContainer: 'Add Container',
      capacityTotal: 'Total Container Capacity',
      storedOnHand: 'Stored Water on Hand',
      daysOfSupply: (days) => (days < 1 ? 'Under 1 day of supply' : `~${days} day${days > 1 ? 's' : ''} of supply`),
      quickAddPrompt: 'Quick Log Stored Water:',
      aiAllocationTitle: 'How to use your water each day',
      aiAllocationSubtitle: 'Based on your family size and how hot it is',
      catPotable: 'Drinking & cooking',
      catPotableSub: 'Never use this water for washing',
      catPotableTagSphere: '3 L per person',
      catPotableTagBaby: '+1 L baby food/formula',
      catPotableTagMaternal: 'extra for pregnant or breastfeeding',
      catPotableTagHeat: (bufferL, _lgu, heatIndex) =>
        `+${bufferL} L because it's very hot (${heatIndex}°C)`,
      catHygiene: 'Bathing & washing up',
      catHygieneSub: (count) => `Bucket-and-dipper or sponge bath for ${count} people`,
      catSanitation: 'Cleaning & Toilet Flushing',
      catSanitationSub: 'Use leftover wash water for flushing',
      actionPlanTitle: 'What to do next',
      tipsEmpty: [
        'Store safe potable water immediately in clean food-grade jugs or containers',
        'Avoid washing laundry using newly fetched drinking water',
        'Cover first filled drums with screens or tight lids to stop dengue mosquitoes',
      ],
      tipsLow: (drinkingL, liters3Days) => [
        `Safeguard ${drinkingL} L/day strictly for drinking and cooking only`,
        'Use bucket-and-dipper (sponge bath) for bathing to conserve water',
        `Add ${liters3Days} L over the next 3 days to build an emergency buffer`,
      ],
      tipsBuilding: (liters3Days, storable) => [
        `Keep pacing active: Add ${liters3Days} L every 3 days toward ${storable} L`,
        'Rotate older stored water first (First-in, First-out)',
        'Recycle laundry rinse water for toilet flushing and floor cleaning',
      ],
      tipsOptimal: [
        'Keep all containers tightly covered and sealed against dengue mosquitoes',
        'Rotate stored water every 2 weeks to maintain fresh drinking supply',
        'Share emergency surplus with vulnerable neighbors if shortages occur',
      ],
    },
    profile: {
      title: 'Household Profile',
      subtitle: 'Customize family members and location for personalized water targets',
      familyName: 'Family Name',
      familyNamePlaceholder: 'e.g. Santos Family',
      municipality: 'Municipality / City',
      barangay: 'Barangay (Optional)',
      whoLivesWithYou: 'Who lives with you?',
      infant: 'Infant (0–2 yrs)',
      child: 'Child (3–12 yrs)',
      adult: 'Adult (13–59 yrs)',
      elderly: 'Senior (60+ yrs)',
      vulnerabilities: 'Special Hydration Needs',
      pregnant: 'Pregnant',
      lactating: 'Breastfeeding / Nursing',
      formulaFed: 'Formula-Fed Infant',
      healthFlag: 'Medical / Vulnerability Flag',
      saveProfile: 'Save Profile',
      cancel: 'Cancel',
    },
  },
  tl: {
    tabs: {
      home: 'Home',
      plan: 'Imbakan',
      alerts: 'Abiso',
      profile: 'Check-In',
      provincial: 'Lalawigan',
    },
    header: {
      liveFeed: 'Live Feed',
      offlineReady: 'Offline Ready',
      appTitle: 'AquaReady',
      appSubtitle: 'Household Water Planning App',
      switchLangTooltip: 'Switch to English',
      signout: 'Mag-sign Out / I-reset ang Profile',
      about: 'Tungkol at pinagkunan',
      rerunSplash: 'Ulitin ang loading animation',
    },
    home: {
      greeting: 'Santos Family',
      membersLabel: (count) => `${count} miyembro`,
      pagasaAlert: 'PAGASA Alert',
      waterToStore: 'Tubig na Dapat Iimbak',
      storeLiters: (lo, hi) => (lo === hi ? `Mag-imbak ng ${lo} L` : `Mag-imbak ng ${lo}–${hi} L`),
      noDrySpell: 'Walang inaasahang dry spell sa kasalukuyang PAGASA window.',
      drySpellUnderway: 'Kasalukuyan nang may dry spell sa inyong bayan.',
      waterSupplyScarce: (months, dateLabel) =>
        `Maaaring magkulang ang tubig sa loob ng mga ${months} buwan${
          dateLabel ? ` (${dateLabel})` : ''
        }.`,
      drinking: 'Inumin',
      drinkingDesc: 'Inumin at pagluluto',
      household: 'Gawaing Bahay',
      householdDesc: 'Paliligo at paglilinis',
      dengueTitle: 'Panatilihing Nakatakip ang mga Drum',
      dengueDesc: 'Tiyaking may takip o screen ang mga drum upang hindi pamugaran ng lamok.',
      readinessTitle: 'Kasalukuyang Kahandaan sa Tubig',
      supplyOnHand: 'Kasalukuyang suplay:',
      days: 'araw',
      targetGoalSuffix: 'ng Target Goal',
      quickLog: 'Mabilisang Pag-tala:',
      viewStorageDetails: 'Tingnan ang Storage Details',
      reset: 'I-reset',
      statusEmpty: {
        badge: '0 L · Walang Imbak',
        title: 'Walang Nakaimbak na Tubig',
        message: (drinkingL, lgu) =>
          `Kritikal: Wala pang nakaimbak na tubig ang inyong pamilya. Mag-imbak agad ng kahit ${drinkingL} L para sa inumin at pagkain bago magka-aberya sa suplay sa ${lgu}.`,
        quickTip: 'Magsimulang mag-ipon para sa inumin ngayong araw.',
        guidance: (drinkingL) =>
          `Kailangan ng inyong pamilya ng ${drinkingL} L bawat araw para sa ligtas na inumin at luto.`,
      },
      statusCritical: {
        badge: (days) => (days < 1 ? 'Kritikal · Kulang sa 1 Araw' : `Kritikal · ${days} Araw`),
        title: 'Kritikal ang Reserba ng Tubig',
        message: (stored, days) =>
          days < 1
            ? `May ${stored} L nang naimbak (hindi aabot ng 1 buong araw). Sapat lamang ito sa inumin at kaunting luto. Mahigpit na ipagpaliban muna ang paggamit sa paglalaba o paglilinis.`
            : `May ${stored} L nang naimbak (~${days} araw na suplay). Sapat lamang ito sa inumin at kaunting luto. Mahigpit na ipagpaliban muna ang paggamit sa paglalaba o paglilinis.`,
        quickTip: (days) => (days < 1 ? 'Kulang sa 1 buong araw ang tatagal. Unahin ang inumin.' : `~${days} araw lang ang tatagal. Unahin ang inumin.`),
        guidance: 'Mahigpit na ipagbawal ang pagbuhos nito sa banyo o labada.',
      },
      statusLow: {
        badge: (days) => (days < 1 ? 'Mababa · Kulang sa 1 Araw' : `Mababa · ${days} Araw`),
        title: 'Mababa Pa ang Reserba',
        message: (stored, days) =>
          days < 1
            ? `Nakaipon ka na ng ${stored} L (hindi aabot ng 1 buong araw). Sapat na ito sa inumin ng pamilya pero kailangan pang mag-ipon para maabot ang 3-araw na emergency buffer.`
            : `Nakaipon ka na ng ${stored} L (~${days} araw na suplay). Sapat na ito sa inumin ng pamilya pero kailangan pang mag-ipon para maabot ang 3-araw na emergency buffer.`,
        quickTip: (days) => (days < 1 ? 'Kulang sa 1 araw ang suplay. Magdagdag pa ng imbak.' : `May ~${days} araw na suplay. Magdagdag pa ng imbak.`),
        guidance: (litersEvery3Days) =>
          `Magdagdag pa ng ${litersEvery3Days} L para magkaroon ng sapat na 3-araw na buffer.`,
      },
      statusGood: {
        badge: (days) => `Maganda ang Simula · ${days} Araw`,
        title: 'Maayos ang Pacing ng Pag-iipon',
        message: (stored, days, pct) =>
          `Magandang balita! May ${stored} L ka nang naimbak (~${days} araw na suplay, ${pct}% ng target). Ligtas na ang inumin at paliligo ng pamilya sa loob ng ilang araw.`,
        quickTip: (pct, stored, target) =>
          `Nasa ${pct}% ka na ng target goal (${stored} L / ${target} L).`,
        guidance: (target) =>
          `Ipagpatuloy ang pag-iipon hanggang maabot ang ${target} L na kabuuang target.`,
      },
      statusOptimal: {
        badge: (days) => `Handa at Ligtas · ${days} Araw`,
        title: 'Kumpleto at Handa ang Imbak!',
        message: (stored, pct, days, lgu) =>
          `Napakagaling! Naabot na ng inyong pamilya ang ${stored} L (${pct}% ng goal, ~${days} araw na suplay). Handa na kayo laban sa kakulangan ng tubig sa ${lgu}.`,
        quickTip: 'Naabot ang 100% target! Panatilihing may takip ang mga drum.',
        guidance: 'Panatilihing nakatakip ang mga lalagyan at i-rotate ang tubig bawat 2 linggo.',
      },
    },
    storage: {
      title: 'Imbakan at Lalagyan ng Tubig',
      subtitle: 'Mga lalagyan at matalinong alokasyon ng tubig',
      inventoryTitle: 'Listahan ng mga Lalagyan',
      addContainer: 'Magdagdag ng Lalagyan',
      capacityTotal: 'Kabuuang Kapasidad ng Imbakan',
      storedOnHand: 'Kasalukuyang Naimbak na Tubig',
      daysOfSupply: (days) => (days < 1 ? 'Kulang sa 1 araw na suplay' : `~${days} araw na suplay`),
      quickAddPrompt: 'Mabilisang Pag-tala:',
      aiAllocationTitle: 'Paano gamitin ang tubig bawat araw',
      aiAllocationSubtitle: 'Batay sa laki ng pamilya at sa init ng panahon',
      catPotable: 'Inumin at pagluluto',
      catPotableSub: 'Huwag gamitin sa paghuhugas',
      catPotableTagSphere: '3 L bawat tao',
      catPotableTagBaby: '+1 L baby food/formula',
      catPotableTagMaternal: 'dagdag para sa buntis o nagpapasuso',
      catPotableTagHeat: (bufferL, _lgu, heatIndex) =>
        `+${bufferL} L dahil sobrang init (${heatIndex}°C)`,
      catHygiene: 'Paliligo at paghuhugas',
      catHygieneSub: (count) => `Tabo-timba o sponge bath para sa ${count} tao`,
      catSanitation: 'Paghuhugas at Pambuhos sa Banyo',
      catSanitationSub: 'Gamitin ang pinaghugasang tubig pang-flush',
      actionPlanTitle: 'Susunod na gagawin',
      tipsEmpty: [
        'Magtabi agad ng safe drinking water sa malinis na galon o lalagyan',
        'Iwasan munang maglaba gamit ang bagong ipon na inuming tubig',
        'Tiyaking may takip ang unang drum na pupunuin laban sa dengue',
      ],
      tipsLow: (drinkingL, liters3Days) => [
        `Mahigpit na protektahan ang ${drinkingL} L/day para sa inumin lamang`,
        'Gamitin ang tabo-timba (sponge bath) sa paliligo para makatipid',
        `Magdagdag ng ${liters3Days} L sa susunod na 3 araw para umabot sa target`,
      ],
      tipsBuilding: (liters3Days, storable) => [
        `Ipagpatuloy ang pag-iipon: Mag-add ng ${liters3Days} L kada 3 araw patungo sa ${storable} L`,
        'Gamitin muna ang lumang naimbak na tubig (First-in, First-out)',
        'I-recycle ang pinagbanlawan ng labada pambuhos sa inidoro',
      ],
      tipsOptimal: [
        'Panatilihing selyado ang lahat ng drum at timba laban sa lamok',
        'Mag-rotate ng tubig bawat 2 linggo upang manatiling sariwa',
        'Ibahagi ang dagdag na supply kung may kapitbahay na kinakapos',
      ],
    },
    profile: {
      title: 'Household Profile',
      subtitle: 'I-setup ang impormasyon ng pamilya para sa tamang target ng tubig',
      familyName: 'Pangalan ng Pamilya',
      familyNamePlaceholder: 'hal. Santos Family',
      municipality: 'Bayan / Lungsod',
      barangay: 'Barangay (Opsyonal)',
      whoLivesWithYou: 'Sino ang kasama mo sa bahay?',
      infant: 'Sanggol (0–2 taon)',
      child: 'Bata (3–12 taon)',
      adult: 'Matanda / May Trabaho (13–59 taon)',
      elderly: 'Senior Citizen (60+ taon)',
      vulnerabilities: 'Espesyal na Pangangailangan sa Tubig',
      pregnant: 'Buntis',
      lactating: 'Nagpapasuso ng sanggol',
      formulaFed: 'Sanggol na naka-formula milk',
      healthFlag: 'May karamdaman / Maintenance',
      saveProfile: 'I-save ang Profile',
      cancel: 'Kanselahin',
    },
  },
};
