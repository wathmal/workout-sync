# Share Card — Design Spec

Spec for social/Instagram workout share images. Derived from `hyrox-solo-sim-*` cards. Dark, data-dense, monospace-numeric, single yellow accent.

## Sizes

| Variant | Canvas | Ratio | Use |
|---------|--------|-------|-----|
| **Vertical** | 1080 × 1920 | 9:16 | IG Story / Reel, full segment table + chart |
| **Square** | 1080 × 1080 | 1:1 | IG feed post, condensed (hero + stats + chart, no full table) |

**Export scale.** Author at 1×. For retina PNG, wrap card in `transform:scale(N);transform-origin:top left` and set `html,body` to `N×` canvas. Ship `@2x` (2160px) for feed, `@4x` for archive.

## Tokens

```
bg-gradient   radial-gradient(120% 55% at 50% 0%, #161611 0%, #000 58%)
bg-solid      #000
accent        #FFE000   (run, totals, kickers, badges, max marker)
text          #fff
text-dim      #bbb / #888 / #777 / #666   (descending de-emphasis)
station        #555 (dot), #fff (label)
hairline      #2a2a2a (section), #161616 (row), #1c1c1c (stat divider)
zones         Z1 #9aa0a6 · Z2 #4a90e2 · Z3 #7cb342 · Z4 #e8842a · Z5 #d23b3b  (@15% fill)
```

Fonts (Google): **Space Grotesk** 500/700 — kickers, labels, zone tags. **Space Mono** 400/700 — all numbers/times/data (tabular). **Inter** 400–800 — body, segment names, notes.

`font-variant-numeric: tabular-nums` on all numeric columns.

## Type scale (vertical, 1×)

| Role | Font | Size / spec |
|------|------|-------------|
| Kicker | Grotesk 700 | 24px, letter-spacing 7px, uppercase, accent |
| Hero | Mono 700 | 148px, line-height .92, tracking -4px |
| Hero sub | Inter 500 | 22px, uppercase, dim |
| Badge | Grotesk 700 | 21px, accent bg / black text, radius 6 |
| Stat value | Mono 700 | 37px · label 16px dim uppercase |
| Table cell | Mono 400 | 25px · segment Inter 700 26px · elapsed 22px dim |
| Total row | Mono 700 | 27px, 2px accent top border |
| Chart heading | Grotesk 700 | 20px, tracking 4px, accent |
| Footer | Inter 500 | 17px, dim |

## Anatomy — Vertical (top → bottom)

1. **Kicker** — activity name, uppercase tracked.
2. **Hero** — primary metric (total time), oversized mono.
3. **Hero sub** — label + accent badge (e.g. "est ~1:37").
4. **Stat strip** — 5 cells, flex equal, hairline top+bottom, dividers between. (km, kcal, avg pace, avg bpm, max bpm.)
5. **Segment table** — cols: Segment | Pace/Time (r) | Elapsed (r) | HR avg/max (r).
   - Row type sets color: `run` → segment accent + accent dot; `station`/active → segment white + grey dot.
   - Optional `%` badge inline on segment (partial-distance note).
   - **Total** row: accent top border, elapsed in accent.
6. **Note** — asterisk caveats, dim, accent `<b>` for figures.
7. **HR chart** (`margin-top:auto`, pinned bottom) — SVG: Z1–Z5 banded backgrounds + tags, gridline bpm labels, per-segment vertical dividers (run tick accent / station grey), dashed AVG line, MAX dot (white/red ring), **flat yellow HR polyline (no glow)**.
8. **Footer** — legend (■ run / ■ station) + count + date, dim.

Card padding `44px 50px 32px`, vertical flex column.

## Square adaptation (1080×1080)

Fixed height forces cuts. Keep brand DNA, drop the long table.

- **Keep:** kicker, hero, hero sub/badge, 5-stat strip, HR chart, footer.
- **Replace table with** either: (a) compact split summary (≤4 rows: Run / Station / fastest / slowest), or (b) drop table entirely and enlarge chart.
- Reduce hero to ~120px; padding `40px 44px 28px`.
- Chart SVG viewBox stays wide; scale to width (~992px).
- Never shrink type below: kicker 22 / stat 32 / footer 15.

## HR chart (required, all variants)

- **HR zone bands ALWAYS shown** — same as the hyrox card. Z1–Z5 horizontal bands fill the plot, each `fill-opacity:0.15`, with a small zone tag (`Z1`…`Z5`, Grotesk 700, on a `#000`@45% chip) anchored left. Bands use the zone token colors.
- **Bands are equal height** (plot ÷ 5) — Z5 same height as the rest, never a sliver. Y is a zone-normalized (piecewise-linear) scale: each zone's bpm range maps into its own equal band, so the HR line stays in the correct zone while every band reads equally. Boundary lines carry left-edge bpm labels (Mono, dim). Default thresholds (override per athlete): Z1<118 · Z2 118–137 · Z3 138–156 · Z4 157–176 · Z5 ≥177.
- **No glow by default.** Polyline is a flat `stroke:#FFE000; stroke-width:2.4–2.6` line — do **not** attach `filter`/`feGaussianBlur`. (A glow filter may be added only on explicit request.)
- Also draw: dashed AVG line + label, MAX dot (white fill / red ring) + label, per-segment vertical dividers with run/station tick labels (run accent, station grey).
- Zone bands are the chart's color system; the HR line + run/station ticks ride on top. Bands are functional, never decorative.

## Data semantics

- **run vs station** is the core visual binary — always accent vs neutral, everywhere (dot, label, chart tick).
- Numbers are sacred → always Space Mono, tabular, right-aligned in tables.
- One accent only. No second hue except HR-zone bands (functional, never decorative).
- Caveats/estimates live in the dim note, never in the hero.

## Render pipeline

HTML/CSS card → headless screenshot (Playwright `page.setViewportSize` to canvas, `element.screenshot()` or full-page). Fonts must load before capture (`waitForFunction(document.fonts.ready)`). Output PNG. Save renders to `.tmp/screenshots/`, ship final to `data/cards/` (source `.fit` + analysis live in `data/activities/`).
