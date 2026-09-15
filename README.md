# AirAgain

A web-based **Air Quality Index (AQI) monitor** for Nepal and India, built on the
Indian CPCB standard. It shows live air quality, explains what it means for your
health, and applies real statistical analysis — forecasting, model evaluation,
regression, and a cross-border early-warning study.

**Live:** https://airagain.netlify.app

---

## What it does

- **Live AQI** for 26 cities (12 Nepal, 14 India) from the World Air Quality Index network
- **CPCB AQI engine** — five pollutants (PM2.5, PM10, NO₂, CO, NH₃) converted to
  sub-indices and combined by the official "worst pollutant wins" rule
- **Plain-language health advice** and an illustration that changes with the air
- **Interactive map** with colour-coded stations
- **Trends** over the last week or month, with two-city comparison
- **3-day forecast** with uncertainty bands
- **Forecast evaluation** — walk-forward backtesting with MAE, RMSE, and a naive
  persistence baseline, so the model's accuracy is reported honestly
- **Seasonal analysis** — which pollutant dominates, and how that shifts between
  winter smog and pre-monsoon dust
- **Cross-border early warning** — cross-correlation testing whether Delhi's air
  quality leads Kathmandu's by a few days
- **Statistics & error analysis** — mean, median, standard error, 95% confidence intervals
- **Weather regression** — linear and polynomial models predicting AQI from
  temperature and humidity, with R² and an overfitting guard
- **Accounts & alerts** — Google sign-in, opt-in email alerts when a city crosses
  a chosen threshold, and a feedback form

---

## Project structure

```
airagain/
├── index.html              Page structure (markup only)
├── css/
│   └── styles.css          Theme tokens, layout, components, light/dark mode
├── js/
│   ├── config.js           Public configuration (Supabase URL + anon key)
│   ├── data.js             Cities, CPCB breakpoints, AQI engine, history, live API
│   ├── analysis.js         Statistics, regression, forecasting, backtesting, correlation
│   ├── doodles.js          AQI-reactive illustrations (inline SVG)
│   ├── ui.js               State, routing, and all rendering
│   └── backend.js          Supabase: login, alert opt-in, feedback
└── supabase/
    ├── schema.sql          Database tables + row-level security
    └── functions/
        ├── aqi-alerts/     Scheduled checker that sends threshold alerts
        └── unsubscribe/    One-click unsubscribe endpoint
```

---

## Tech

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript, CSS, HTML — no framework, no build step |
| Charts | Chart.js |
| Map | Leaflet + OpenStreetMap |
| Live data | World Air Quality Index (aqicn.org) API |
| Auth & database | Supabase (PostgreSQL, Google OAuth, Row Level Security) |
| Scheduled jobs | Supabase Edge Functions (TypeScript/Deno) |
| Email | Resend |
| Hosting | Netlify |

Built deliberately without a frontend framework: the app has no build step, no
dependency tree, and loads as plain static files.

---

## The mathematics

**AQI sub-index** — each pollutant concentration is mapped onto a 0–500 scale by
linear interpolation within its CPCB breakpoint band:

```
sub-index = ((I_high − I_low) / (C_high − C_low)) × (C − C_low) + I_low
```

The overall AQI is the **maximum** of the five sub-indices, because air is only as
healthy as its most harmful component.

**Error analysis** — the standard error of the mean and a 95% confidence interval:

```
SEM = s / √n          95% CI = x̄ ± 1.96 × SEM
```

**Regression** — ordinary least squares solved from scratch via the normal
equations (no maths library), for both a linear and a degree-2 polynomial model,
reported with R².

**Forecast evaluation** — walk-forward validation: for each past day, predict it
using only prior days, then compare to what actually happened. Reported as MAE and
RMSE alongside a persistence ("tomorrow = today") baseline and a skill score.

**Cross-border lag** — Pearson correlation between two cities' daily AQI at each
day-offset; the peak offset is the apparent lead time.

---

## Data honesty

Live **current** AQI comes from real monitoring stations, and cities are clearly
marked *Live* or *Sample*. Cities without a nearby station fall back to
representative sample values rather than showing nothing.

**Historical features** — trends, forecast, backtesting, seasonal analysis, the
regression, and the cross-border study — currently run on generated sample history,
because the free data tier provides current readings rather than multi-year
archives. These sections are labelled accordingly in the interface. The analysis
methods are real and correct; feeding them real historical data would produce real
findings with no code changes.

---

## Running locally

Because the project is split into multiple files, open it through a local server
rather than double-clicking:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Notes

- The Supabase **anon key** in `config.js` is public by design and protected by
  Row Level Security. The `service_role` key is never included here.
- Email alerts require deploying the Supabase Edge Functions and configuring
  Resend — see `supabase/` and the setup guide.
