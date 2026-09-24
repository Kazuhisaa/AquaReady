# AquaReady

**Household water plan for El Niño dry spells, Isabela Province pilot.**

A family enters their town, who lives with them, and what water containers they have. AquaReady tells them:

- **how much water to store**, as a range (e.g. *Store 440–625 L*),
- **when to start and how fast** (e.g. *add 20 L every 3 days*),
- **when the risk in their town goes up**, and why, in plain Filipino or English.

It runs in the browser, **works offline**, and can be **installed on a phone like an app** (PWA). There is no backend and no database: the household profile stays on the phone, and the climate data ships inside the app.

---

## Contents

1. [Install and run (step by step)](#1-install-and-run-step-by-step)
2. [Using the app (what to click)](#2-using-the-app-what-to-click)
3. [Open it on your phone](#3-open-it-on-your-phone)
4. [Deploy it online and install it as an app](#4-deploy-it-online-and-install-it-as-an-app)
5. [Checks before you push code](#5-checks-before-you-push-code)
6. [Refresh the climate data](#6-refresh-the-climate-data)
7. [How the risk and the target are computed](#7-how-the-risk-and-the-target-are-computed)
8. [Code map](#8-code-map)
9. [Troubleshooting](#9-troubleshooting)
10. [Known limits](#10-known-limits)

---

## 1. Install and run (step by step)

### What you need first

| Tool | Version | Check with | Get it |
|---|---|---|---|
| **Node.js** (includes npm) | 20 or newer | `node -v` | https://nodejs.org (LTS) |
| **Git** | any | `git --version` | https://git-scm.com |

### Get the code

```bash
git clone https://github.com/Kazuhisaa/AquaReady.git
cd AquaReady
```

### Install the dependencies

```bash
npm install
```

This takes a minute the first time and creates a `node_modules/` folder (never commit it).

### Start the app

```bash
npm run dev
```

The terminal prints an address, usually **http://localhost:5173**. Open it in Chrome or Edge. The page reloads by itself whenever you save a file.

Stop the server with `Ctrl + C`.

---

## 2. Using the app (what to click)

On a computer the app is shown inside a phone-shaped frame, the way it looks on a real phone.

### First screen: household setup

- **Fastest:** click **"Quick Demo: Load Santos Family (Ilagan)"** at the bottom. It fills in a sample family of 4.
- **Or** fill in the 4 setup steps: town and barangay, family members (age and special needs such as pregnant or breastfeeding), your water containers, and privacy consent.

### The 4 tabs at the bottom

| Tab | What it shows |
|---|---|
| **Home** | Risk level for your town, how many liters to store, days of water on hand, quick **+5 / +20 / +50 L** buttons to log water you added |
| **Storage** | Your storage plan ("add X L every 3 days"), target date, your containers (add or remove your own), how to split water per day, and **water refill points** near you, where you can also report a water point, or that there is none |
| **Alerts** (bell) | Rain chart for your town vs. a usual month, and your alerts: risk warning, reminders to add water, "is the dry spell over?" prompt. **Tap the risk alert** to see *why* and *what to do*, with the data sources under **"Paano namin nalaman? / How do we know?"** |
| **Check-In** | After a dry spell or water cut: "Did your stored water last?" Your answer adjusts your next target (+15% if you ran short; −5% if you had extra, but never below the standard amount) |

### Buttons in the top bar

| Button | What it does |
|---|---|
| 🕰️ clock icon | **Time machine**: replays the real **2023–24 El Niño** month by month (slider July 2023 → June 2024). Shows when the AI first warned vs. when the dry spell actually hit your town. Click **"Back to today"** to leave. |
| **EN / TL** | Switch between English and Filipino |
| ⓘ | About and data sources |
| ↪ (exit icon) | Sign out and **erase** the household profile on this device (asks to confirm first) |

### Link under the phone frame

- **Install App**: shown only when the browser allows installing (see section 4).

### Try a different town

On the Home tab, tap the pencil ✏️ next to the family name, and change the municipality. Good examples with the current data: **Maconacon** (high risk, coastal, sea-level warning), **Delfin Albano** (high), **Ilagan** (low). In the time machine, **Cabagan** shows the AI warning 2 months before the 2023 dry spell.

---

## 3. Open it on your phone

**Same Wi-Fi as your computer (for testing):**

```bash
npm run dev -- --host
```

The terminal also prints a **Network** address such as `http://192.168.1.23:5173`. Open that on your phone's browser. (If it doesn't load, allow Node through your computer's firewall.)

This is enough to use the app on the phone, but **installing it as an app and offline mode need HTTPS**, which means deploying it (next section).

---

## 4. Deploy it online and install it as an app

### Build the production version

```bash
npm run build     # creates the dist/ folder
npm run preview   # serves dist/ at http://localhost:4173 to test it
```

The offline service worker only runs in this production build, not in `npm run dev`.

### Put it online (free), recommended: Vercel or Netlify

**Vercel**
1. Go to https://vercel.com and sign in with GitHub.
2. **Add New → Project → Import** `Kazuhisaa/AquaReady`.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. **Deploy**. You get an `https://….vercel.app` link. Every push to `main` redeploys automatically.

**Netlify**: same idea. **Add new site → Import from GitHub**, build command `npm run build`, publish directory `dist`.

> GitHub Pages is **not** recommended as-is: it serves the app under `/AquaReady/`, while the app and its service worker expect to be at the site root `/`.

### Install on a phone

Open the HTTPS link on the phone, then:
- **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).
- **iPhone (Safari):** Share button → **Add to Home Screen**.

After opening it once online, it keeps working with no signal.

---

## 5. Checks before you push code

```bash
npm run check:aquaready   # self-checks for every formula and the alert rules
npm run lint              # code style (oxlint)
npm run build             # also type-checks the whole app
```

All three should pass with no errors.

---

## 6. Refresh the climate data

The data in `src/data/` is a snapshot. Refresh it about **once a month** (ECMWF publishes a new seasonal forecast monthly):

```bash
npm run data    # downloads fresh data → src/data/isabelaRisk.json
npm run train   # re-trains the AI risk model → src/data/riskModel.json
```

- No API keys needed.
- The free Open-Meteo API has hourly and daily limits, so a full run from scratch can take **1–2 hours**. The script waits out the limits by itself; just leave it running.
- Downloads are cached in `.cache/` (not committed). If the script stops, run it again and it continues where it left off. Delete `.cache/` to force completely fresh data.
- **PAGASA's El Niño status has no API.** It is typed in by hand in `ADVISORY` at the top of `scripts/fetch-data.mjs`. Check https://www.pagasa.dost.gov.ph/climate/el-nino-la-nina/monitoring and update it when PAGASA issues a new advisory.
- Commit the two updated JSON files afterwards.
- If the data is more than **35 days** old, the app shows a yellow **"This forecast may be out of date"** warning. Refresh before any demo.

### Adding real water refill points

`src/data/refillPoints.json` is empty because no LGU/NGO list exists yet. When you get one, add entries like this and the Storage tab lists them for that town (same barangay first):

```json
[
  {
    "town": "Ilagan",
    "barangay": "Alibagu",
    "name": "Barangay Alibagu deep well",
    "kind": "well",
    "drinkingSafe": false,
    "hours": "6 AM – 6 PM",
    "source": "Ilagan MDRRMO, 2026"
  }
]
```

`kind` is one of `refilling`, `well`, `tap`. `town` must match the town names in `src/data/isabelaMunicipalities.ts`. Reports that families make in the app stay on their own phone for now.

### Data sources

| Data | Source |
|---|---|
| 6-month rain forecast (50+ member ensemble) | ECMWF SEAS5, via Open-Meteo seasonal API |
| Normal rain 1991–2020, observed rain, root-zone soil moisture | ERA5, via Open-Meteo archive API |
| Feels-like temperature | ERA5 + Open-Meteo forecast |
| 2041–2050 dry-season rain and temperature change | CMIP6 EC-Earth3P-HR, via Open-Meteo climate API |
| El Niño strength (ONI) | NOAA Climate Prediction Center |
| Sea level by 2050 (4 coastal towns) | IPCC AR6, NASA Sea Level Projection Tool |
| El Niño advisory level | PAGASA (entered by hand, see above) |
| Town list and 2020 population | PSA 2020 census |

---

## 7. How the risk and the target are computed

All formulas live in `src/services/aquaready.ts` and are tested by `npm run check:aquaready`.

### Risk: chance of a dry spell in the next 3 months

```
risk = ½ × AI model probability + ½ × ECMWF ensemble probability
```

- A **dry spell** uses PAGASA's definition: 3 months in a row below 80% of normal rain, or 2 months in a row below 40%.
- **AI model** (`scripts/train-model.ts`): logistic regression trained on Isabela's 1991–2012 rain and soil records. It only uses what is known at the time (El Niño index, last 3 months' rain, soil moisture, season), never future rain. Model settings were chosen on 2005–2012, then it was tested **once** on years it never saw (2013–2020, 2023–2026).
- **ECMWF probability:** the share of the 51 forecast ensemble members that reach a dry spell.
- Risk bands: **low** < 30%, **medium** 30–60%, **high** ≥ 60%.

**Honest test results** (also shown in the app under "How do we know?"):

| Metric | Result |
|---|---|
| AUC | 0.69 (moderate) |
| Brier skill vs. guessing from averages | +0.02 (only slightly better) |
| 2023–24 El Niño | warned 4 of 5 affected areas 1–2 months early; missed Dinapigue |

That is why the AI is only half of the score and is combined with ECMWF.

### Water target

- **Essential tier (what to store):** 7.5 L per person per day (Sphere survival minimum: drinking, cooking, basic washing), adjusted for age, pregnancy, breastfeeding, formula-fed babies, health needs and extreme heat.
- **× reserve days:** 3 days at low risk up to 14 days at high risk.
- Shown as a **range** (×0.85 to ×1.20), never a single number.
- The **full tier** (15 L per person per day, with bathing and cleaning) is shown as a stretch goal.
- **Pacing:** the gap between stored water and the target is spread over 3-day steps, finishing 3 days before the dry spell starts, rounded to 5 L.
- **Check-in** multiplies the household's own factor by ×1.15 (ran short) or ×0.95 (had extra), kept between 1.0 and 1.5.

---

## 8. Code map

```
index.html                     page shell, manifest link
public/
  sw.js                        service worker (offline cache)
  manifest.json, icons/        PWA install info and icons
src/
  main.tsx                     entry point, registers the service worker
  pwa.ts                       service worker registration + "Install App" prompt
  services/
    aquaready.ts               all formulas: water need, risk, target, pacing, check-in
    i18n.ts                    English / Filipino text
  data/
    isabelaRisk.json           climate data for 37 towns (generated by npm run data)
    riskModel.json             trained AI model + test results (generated by npm run train)
    refillPoints.json          known water refill points (empty until LGU/NGO data is added)
    isabelaMunicipalities.ts   town list, population, coastal flag
  aquaready/
    AquaReadyApp.tsx           app shell: header, tabs, alerts, time machine
    HouseholdPanel.tsx         setup wizard, Home, Storage, Check-In screens
    AlertsView.tsx             Alerts tab + rain chart
    RisksView.tsx              "why / what to do / how do we know" detail
    alerts.ts                  rules for which alerts appear
    ReplayBar.tsx              time machine controls (2023–24 replay)
    scenario.ts                turns the data JSON into model inputs (live or replay month)
    Visuals.tsx                rain chart, drum gauge
    RefillPoints.tsx           refill points list + "report a water point / no water point"
scripts/
  fetch-data.mjs               downloads and prepares the climate data
  train-model.ts               trains and tests the AI model
  aquaready.check.ts           self-checks
```

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `npm: command not found` | Install Node.js (section 1), then open a new terminal |
| Errors during `npm install` | Check `node -v` is 20 or newer. Delete `node_modules/` and run `npm install` again |
| `Port 5173 is in use` | Another dev server is running. Stop it, or use the new port Vite prints |
| Phone can't open the Network address | Same Wi-Fi? Run with `-- --host`. Allow Node through the computer's firewall |
| Production site shows an old version | The service worker cached it. Refresh once more, or in Chrome DevTools → Application → Service Workers → **Unregister**, then reload |
| No "Install app" option | Needs HTTPS (deploy it, section 4) and a supported browser (Chrome/Edge on Android, Safari on iPhone) |
| `npm run data` says "rate-limited" | Normal. It waits and continues by itself. "Daily limit reached" means run it again tomorrow; nothing is lost |
| Want to start over as a new user | Click the exit icon in the top bar, or clear the site's data in the browser |

---

## 10. Known limits

- **Notifications appear only when the app is opened.** Alerts while the app is closed need a push server (Web Push), which this pilot doesn't have.
- **No database:** the profile lives on one phone and is lost if browser data is cleared. Phase 2 (a dashboard for LGUs and NGOs) would need an opt-in backend.
- **Risk is per municipality.** No open climate data exists at the barangay level.
- **The AI model is moderate** (see section 7) and the ECMWF forecast only reaches about 6 months ahead, so the peak dry months (March–May) are often not covered yet.
- Risk is based on rain. Actual water shortages also depend on water districts, dams and wells, which the app has no data for.
