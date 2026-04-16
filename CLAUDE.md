# Beer Approval Index (BAI)

A parody Bloomberg-style trading terminal that produces a single live "Beer Approval Index" (BAI) score telling you whether to have a pint tonight. Single-page React app, mobile-first, deliberately dense and dry.

## Aesthetic intent

- Bloomberg / old-school CRT terminal cosplay. **Commit to this** — don't soften it with friendly UI affordances.
- Phosphor amber (`#ffb000`) on near-black (`#0a0a0a`). Green (`#00ff66`) for positive, red (`#ff3344`) for negative.
- Monospace throughout. Scanline overlay on the main quote panel. Subtle text-shadow glow on key numbers.
- Dense, financial-data layout. Small text (9-11px). Tabular numerals on every number.
- Tone: dry, slightly clinical, treating "should I have a beer" as a serious financial concern. The disclaimer copy ("NOT FINANCIAL ADVICE. NOT MEDICAL ADVICE. NOT, FRANKLY, ANY KIND OF ADVICE.") sets the register.

## Scoring model

Base index is 50. Eight components add or subtract, then the result is clamped 0–100.

| Key | Component        | Range                                              |
|-----|------------------|----------------------------------------------------|
| DWI | Day-of-week      | -22 (Mon) to +38 (Fri)                             |
| TIM | Time-of-day      | -20 (pre-noon) to +18 (18:00–22:00)                |
| WTH | Weather          | 0 (grey) to +22 (snow → cosy)                      |
| PAY | Days since payday| -15 (skint) to +15 (just paid)                     |
| OBL | Tomorrow AM      | -25 (early start) to +8 (free)                     |
| SOC | Tonight's plans  | -4 (committed) to +14 (uncommitted)                |
| PHY | Physique factor  | -30 (gym-skipping pint week) to +12 (training, dry)|
| MKT | Live market noise| -8 to +8, drifts every 1.4s                        |

PHY scaling is deliberately punitive on pints to make the joke land:
- pint 1: free
- pints 2–4: -3 each
- pints 5+: -5 each
- workouts: +3 each, no cap on the bonus side until clamp

Verdict bands:
- 0–25 → **SOBER** (red) · STAND DOWN
- 26–50 → **SENSIBLE** (amber) · PROCEED W/ CAUTION
- 51–75 → **SCHOONER** (green) · CLEARED FOR PINT
- 76–100 → **SEND IT** (bright green) · STRONG BUY

## External data sources

All free, no API keys, CORS-friendly:

- **Open-Meteo** (`api.open-meteo.com/v1/forecast`) — current temperature + WMO weather code. WMO codes are mapped to 5 buckets in `wmoToWeather()`.
- **BigDataCloud** (`api.bigdatacloud.net/data/reverse-geocode-client`) — reverse geocode lat/lng → city name.
- **ipapi.co** (`/json`) — fallback location if browser geolocation fails or is declined.

Order of preference for location: browser `navigator.geolocation` (8s timeout) → ipapi.co IP lookup. Live data is non-blocking — app stays fully usable in NO FEED state, manual weather selection still works.

`weatherSource` state machine: `loading` → `live` | `error`. User tapping a weather button transitions to `manual` and live updates won't override. Refresh button forces back to live.

## Code conventions

- Single JSX file currently (`src/App.jsx`). Splitting into modules is welcome — keep `computeComponents`, `computeBAI`, `getVerdict`, and `wmoToWeather` pure and easily unit-testable.
- Tailwind core utilities + inline styles for the precise terminal colors. The artifact constraint required this; in a real Tailwind config you should promote the colors to theme tokens:
  ```js
  // tailwind.config.js
  theme: { extend: { colors: {
    phosphor: { amber: '#ffb000', dim: '#7a5500', green: '#00ff66', red: '#ff3344' },
    terminal: { bg: '#0a0a0a', panel: '#121212', border: '#2a2a2a' }
  }}}
  ```
- lucide-react for icons. No other UI component libraries.
- No bright/playful UI affordances. No rounded corners on data panels. No drop shadows that aren't CRT-glow.

## Constraints relaxed vs. the original artifact

The artifact ran inside Claude.ai sandbox restrictions. In Claude Code these are gone:

- **Browser storage** is available. Use `localStorage` for: weekly pint/workout counters with auto-rollover each Monday, last manual weather override, BAI history.
- **External fonts** are fine. Recommend JetBrains Mono or IBM Plex Mono for genuine terminal feel.
- **Real backend** is possible if longitudinal pint data needs to sync across devices. Probably overkill — localStorage is enough.
- **Build-time tooling** is available — split files, add tests, add TypeScript if desired.

## Ideas backlog

- Weekly auto-rollover for PHY inputs (Monday 04:00 UTC reset, persisted).
- BAI history chart — real plotted scores over the last 7 / 30 / 90 days, not just an intraday random walk.
- Configurable verdict thresholds (some drinkers want stricter bands).
- Mansfield Town form scraped from BBC Sport as a special ticker headline.
- Sound option: subtle Bloomberg-style click on noise updates. Off by default.
- PWA manifest + service worker so it installs on the homescreen.
- Share card generator: render current BAI as a 1200×630 image for sending to mates.
- "Calibration mode" — user logs actual decision (had pint Y/N) and the verdict that day. Train the weights against personal ground truth.

## Bootstrap

```bash
npm create vite@latest beer-index -- --template react
cd beer-index
npm install
npm install lucide-react
npm install -D tailwindcss@latest postcss autoprefixer
npx tailwindcss init -p
```

Then:
1. Add Tailwind directives to `src/index.css`
2. Set Tailwind `content: ['./index.html', './src/**/*.{js,jsx}']`
3. Drop the existing `beer-index.jsx` in as `src/App.jsx`
4. `npm run dev`

## Things to leave alone

- The Bloomberg aesthetic. Don't add light mode. Don't add gradients beyond the existing sparkline fade. Don't replace the monospace font with a humanist sans.
- The disclaimer copy.
- The verdict labels (SOBER / SENSIBLE / SCHOONER / SEND IT) — these are part of the joke.
