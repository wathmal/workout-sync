# `data/`

Scratch space for workout file analysis + social share cards. Two buckets:

```
data/
├── README.md       ← this file                         (tracked)
├── design.md       ← share-card design spec             (tracked)
├── activities/     ← Garmin source + analysis           (gitignored)
└── cards/          ← generated share images + html      (gitignored)
```

Only `README.md` + `design.md` are committed. `activities/` (personal training
data + binaries) and `cards/` (generated artifacts) are gitignored — kept local,
regenerated on demand.

## `activities/`

Raw Garmin `.fit` exports + their analysis writeups. Paired by **Garmin activity ID**:

```
<garminActivityId>_<slug>.fit    raw Garmin export
<garminActivityId>_<slug>.md     analysis (splits, pace, HR)
```

The activity ID is a **global sequential counter, not a date** — higher ID = uploaded
later, so files sort chronologically but you can't read a date off the number. The real
date lives inside the `.fit` at `session.start_time` (also stated in the analysis `.md`).

Current:
- `23061293322_solo_sim` — Hyrox solo sim, 29 May 2026
- `23072685436_400m_sprint` — 400m YGIG ×3, 30 May 2026

Parse with Python `fitparse` (`pip install fitparse`).

## `cards/`

Social/Instagram share cards built to `../design.md`. Per card: a self-contained
`.html` (inline CSS/SVG, Google-fonts `@import`) + exported `.png`.

```
<slug>-<date>[-shape].html        author at 1×
<slug>-<date>[-shape].png          1× render
<slug>-<date>[-shape]@2x.png       2× export (IG-ready)
<slug>-<date>[-shape]@4x.png       4× export (archive)
```

Render via headless Chrome / Playwright. `file://` is blocked, so serve over HTTP first:

```bash
python3 -m http.server 8741 &     # serve repo root
```

**Playwright (preview, 1×)** — drives the MCP/scripted browser:

```js
await page.goto('http://localhost:8741/data/cards/<slug>-<date>.html');
await page.setViewportSize({ width: 1080, height: 1080 });  // match canvas
await page.evaluate(() => document.fonts.ready);            // wait for webfonts
await page.screenshot({ path: '.tmp/screenshots/<slug>.png' });
```

**Hi-res export (`@Nx`)** — headless shell with device-scale-factor (1080² → 2160² at 2×):

```bash
chrome-headless-shell --headless --force-device-scale-factor=2 \
  --window-size=1080,1080 --virtual-time-budget=5000 \
  --screenshot=data/cards/<slug>-<date>@2x.png \
  http://localhost:8741/data/cards/<slug>-<date>.html
```

`@Nx` alternatively via `transform:scale(N)` + `N×` body in the HTML. Preview renders go to
`.tmp/screenshots/`; ship finals here. Full pipeline + tokens in `../design.md`.
