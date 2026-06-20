# Fitness Dashboard — Design System

**Version 0.4 · Responsive (mobile PWA + desktop) · Single-user**

Trimmed Voqi design system for personal fitness dashboard. Tokens (color, type, spacing) inherit Voqi Foundations v1.1 so dashboard read as same product family.

Doc capture **foundations and decisions**, not implementation. Token values here = foundation; component specs (pixel paddings, exact heights, opacity) live in code. Need `surface-card` value? Read here. Need exact padding of race-timeline label box? Read `dashboard.html`.

---

## 1. Principles

Dashboard answer three questions at glance:

- **What needs attention?** What's left this week.
- **What's this week?** Planned, done, stale muscles, weekly progress.
- **What's the year?** Race calendar, body comp trends, body over time.

Three principles follow:

1. **Three horizons, one panel.** Every block answer question at one time scale. Layout put them close so scan "today" → "this week" → "this year" without context-switch. Overview page canonical: timeline (year) → weekly agenda (week) → body shape + trend chart (today + trend).

2. **Surface, don't alarm.** Dashboard tell what true. No yell ("OVERDUE!"), no celebrate ("YOU CRUSHED IT!"), no shame ("missed three workouts"). Stale muscles = amber, not red. Days till race = number, not flame. Calories over target = warning, not error. Information = deliverable. You decide.

3. **Hierarchy through tone and space, not lines.** Sections separate by surface-color shifts (tables = only exception). Block that matter most this week take more space. Identical 3-up grids flatten hierarchy; varied rhythm read editorial.

Plus one posture rule from Voqi admin:

> **Vertical real estate = scarcest resource.** Every block earn height. Chrome with no data (decorative filter bars, page sub-headers, status rows restating other surfaces) folded into top nav or cut.

---

## 2. Foundations

### 2.1 Color

#### Brand

| Token | Hex | Usage |
|---|---|---|
| `brand-primary` | `#9100D0` | Deep violet. Icons + headings on light. Gradient start. |
| `brand-accent` | `#AE33ED` | Lighter violet. Active states on dark. Gradient end. |
| `brand-gradient` | `linear-gradient(135deg, #9100D0 0%, #AE33ED 100%)` | Single, rare primary action. |
| `brand-mark` | `#CF57FF` | Logo SVG only — never product UI. |

**Gradient sacred.** Same angle, same stops, everywhere. One gradient element per page max. Mark most important action in context: Sync, Save Workout, Log Meal, Refresh.

#### Semantic

| Token | Light | Dark | Usage |
|---|---|---|---|
| `semantic-success` | `#006C4C` | `#4DD4A3` | Goals hit, positive deltas |
| `semantic-warning` | `#8C6500` | `#FFC94A` | Stale muscle, calorie surplus |
| `semantic-error` | `#BA1A1A` | `#FF6B6B` | Sync failure, blown deadline |
| `semantic-info` | `#0066CC` | `#5BA3F5` | Tooltips, neutral notes |

#### Surface hierarchy

Stacked tones, not bordered boxes. Each layer rest visually on one below.

| Layer | Light | Dark | Purpose |
|---|---|---|---|
| `surface-base` | `#FCF9F8` | `#0D0D0D` | Page canvas |
| `surface-low` | `#F4EFE8` | `#161616` | Section break / table header |
| `surface-card` | `#FFFFFF` | `#1F1F1F` | Standard cards, table rows |
| `surface-elevated` | `#FFFFFF` + `shadow-sm` | `#232323` | Hero cards, focal blocks |
| `surface-chip` | `#EDE8E0` | `#2E2E2E` | Icon buttons, inactive chips |
| `surface-disabled` | `#E3DDD2` | `#3A3A3A` | Disabled affordances |

#### Text

| Token | Light | Dark | Usage |
|---|---|---|---|
| `text-primary` | `#1C1B1B` | `#F5F3F0` | Headlines, hero numbers, primary UI |
| `text-secondary` | `#5F5E5A` | `#C8C5C0` | Body paragraphs, supporting copy |
| `text-tertiary` | `#888780` | `#A3A09A` | Overlines, metadata |
| `text-muted` | `#B4B2A9` | `#6B6864` | Placeholders, timestamps |
| `text-on-brand` | `#FFFFFF` | `#FFFFFF` | Text on gradient fills only |

**Never pure black (`#000000`) or pure white (`#FFFFFF`) for text.** Warm off-tones non-negotiable.

#### Data visualization

Charts use fixed ordered palette. Brand purple always series 1.

| Token | Light | Dark | Typical use |
|---|---|---|---|
| `data-1` | `#9100D0` | `#AE33ED` | Body fat %, primary series |
| `data-2` | `#006C4C` | `#4DD4A3` | Body weight, lean mass |
| `data-3` | `#0066CC` | `#5BA3F5` | Tertiary / prior-cycle compare |
| `data-4` | `#8C6500` | `#FFC94A` | Amber accent |
| `data-5` | `#7C5295` | `#A484C7` | Moving average |
| `data-6` | `#5F5E5A` | `#A3A09A` | Goal / neutral baseline |

### 2.2 The no-line rule

Default to surface-color shifts for sectioning, not 1px lines. Borders allowed only when functional:

- Focus rings on interactive elements
- Featured / selected cards (2px brand-primary) — one card type that earn visible border because border carry semantic meaning ("selected", "today")
- Table row separators — explicit exception (see §3)
- Ghost borders as a11y fallback at 15% opacity

### 2.3 Typography

#### Families

- **Space Grotesk** — Display + Headline. Brand voice.
- **Inter** — Title, Body, Label. Workhorse.
- **Space Mono** — Numerics, tabular figures, units. Same design family as Space Grotesk, so typographic voice unified across proportional + monospace.

#### Type scale

Declared in `rem` (1rem = 16px). No viewport branching.

| Token | Family | Weight | Size | Use |
|---|---|---|---|---|
| `display-lg` | Space Grotesk | 500 | 3rem · 48px | Page-level hero metric |
| `display-md` | Space Grotesk | 500 | 2.25rem · 36px | KPI tile value |
| `headline-lg` | Space Grotesk | 500 | 1.5rem · 24px | Section headers |
| `headline-md` | Space Grotesk | 500 | 1.25rem · 20px | Card titles |
| `title` | Inter | 500 | 1rem · 16px | Buttons, labels |
| `body` | Inter | 400 | 0.9375rem · 15px | Default body |
| `body-sm` | Inter | 400 | 0.8125rem · 13px | Metadata, captions |
| `label` | Inter | 600 | 0.6875rem · 11px | Uppercase overlines |
| `numeric` | Space Mono | 500 | inherit | Tabular figures |
| `mono-sm` | Space Mono | 400 | 0.8125rem · 13px | Timestamps, set notation |

Line heights: display 1.05 · headline 1.15 · title 1.3 · body 1.5.

#### Three typography rules

**One display moment per page.** Each page get one `display-*` element. Multiple display-scale items compete for attention.

**Editorial overline.** Pair `label` uppercase directly above `display-*` or `headline-lg`. Signature move — e.g. "MONDAY · WEEK 14 · MAY 13" above "Push day."

**Numerics always tabular.** Body fat %, weights, reps, calories, dates — all Space Mono with tabular figures. Columns of numbers align even as values change.

### 2.4 Spacing

4px-based scale: `space-2xs` (4) · `space-xs` (8) · `space-sm` (12) · `space-md` (16) · `space-lg` (20) · `space-xl` (24) · `space-2xl` (32) · `space-3xl` (48).

Page outer padding at `space-xl`–`space-2xl`. Marketing-scale (space-4xl through space-6xl) intentionally absent.

### 2.5 Radius

`radius-sm` (6) · `radius-md` (10) · `radius-card` (14) · `radius-lg` (18) · `radius-xl` (20) · `radius-full` (999).

Default `radius-card` for standard cards — slightly squarer than mobile, keep dashboard reading utilitarian not soft. `radius-lg` only on hero/focal cards.

### 2.6 Elevation

**Tonal stacking default.** Place elevated elements on surface one shade darker (light) or lighter (dark) than parent. Drop shadows reserved for genuinely floating UI — dropdowns, popovers, modals. Dark mode use tonal stacking exclusively; no shadows on standard cards.

### 2.7 Motion

`motion-fast` (120ms) · `motion-standard` (200ms) · `motion-emphasized` (320ms) · `motion-decelerate` (250ms). All use `cubic-bezier` easings tuned fast in, soft out.

**Anti-CLS rule.** When block swap content (tab variant, async load), siblings below must not shift. Reserve slot via `min-height` sized to tallest variant.

Honor `prefers-reduced-motion: reduce`: replace transitions with crossfades, shorten durations to `motion-fast`.

---

## 3. Components

Components described by what they are + what they do — not exact paddings. Dashboard mock = visual reference; this section = vocabulary.

### Buttons

Three tiers. **Primary** use gradient, reserved for single most important action on screen. **Secondary** = common neutral filled button. **Tertiary** = text-only for quiet inline actions. Plus compact **icon button** for table inline actions + toolbar controls.

One primary per page. If two, one wrong.

### Inputs

Minimal chrome — soft border, no fill, brand-primary focus ring at 60% opacity. Numeric cells (reps, weight, calories) right-align + use `numeric` font. Search use `⌘K` keyboard hint pill on right to reinforce keyboard-first ethos.

### Cards

Three variants: **standard** (default container), **hero** (focal block, elevated surface, slightly larger radius), **featured** (only card type with visible border — 2px brand-primary, only when semantically meaningful: selected, today, next).

Cards don't draw lines around children. Internal grouping via surface-color steps or spacing.

### Tables

One place no-line rule don't apply. Row separators at 10% opacity necessary past ~30 rows — surface stepping alone can't carry structure. Numeric cells use tabular figures + right-align. Compact variant exist for long history views.

### Pills, chips, badges

Status pills = read-only indicators with small label + tinted background (typically semantic color at 15% opacity). Always pair color with text so meaning survive color-blindness.

Filter chips toggleable. Active state invert (light becomes dark or vice versa) instead of brand color — keep gradient sacred for actual actions.

Tags = small categorical labels (Push, Pull, Hyrox) with tinted text color + neutral background.

### Charts

Use data palette (`data-1` through `data-6`). Gridlines at 8% opacity, horizontal only. End-of-line markers (dot + soft halo) on latest data point. No vertical grid, no chart-junk decoration.

Range selectors live as chip groups (7d / 30d / 90d / All) in chart's top-right corner.

### Modal & drawer

Modals centered, sized small / default / large, used for brief detail or confirm flows. Drawers slide from right, used for extended detail on row (workout, food entry, race detail).

---

## 4. Fitness primitives

Components unique to this dashboard. Each described by what make it different from generic component — mock + code carry layout details.

### Race / event timeline

**Horizontal date-axis** timeline of upcoming competitions. Events plotted at actual date positions on continuous month axis — not scrollable card strip.

Axis-based chosen over card scroll because temporal *distance* = single most useful question ("how packed is next quarter?"). Scroll-snap card strip flatten all events to equal width and lose signal.

Closest event ("NEXT") emphasized: 2px brand-primary border on label box, soft radial glow, larger glowing dot on axis. Urgency-color rule: countdown under 14 days, "Nd" countdown number turn amber; under 7 days, error red. (*Label box* never change — only inline number.)

### Weekly agenda

7-column grid showing Monday through Sunday for current week. Today's column get brand-accent tinted background + accent dot beside day-of-week label.

Each column hold session chips with colored category label (Push, Pull, Legs, Hyrox, Run). Done / missed / scheduled states = pills inside each chip — never strikethroughs, never opacity tricks.

### Muscle-group heatmap

Front + back anatomical SVG silhouettes with each muscle group as separate path. Volume load over trailing 7 days maps to five-bucket color scale:

1. **Above average** — success green
2. **At average** — `data-1` at mid-opacity
3. **Slightly below** — `data-1` at low-opacity
4. **Well below** — warning amber
5. **Untouched 7d+** — disabled grey

Heatmap don't moralize. No "you're failing" red or "you're winning" celebration green. Warning amber reserved for actually-stale muscles (7+ days), not "below your weekly average". Information surface, not coach.

Lives on Training, not Overview (moved out in v0.2).

### Body render card

Two variants of same container.

**Full variant** lives on Body page at aspect-ratio 4:5 — body fill frame as primary subject. **Preview variant** lives on Overview at fixed height (no aspect-ratio constraint) so can share row with trend chart without forcing row 650+ px tall.

Both variants share same chrome: 3D/2D/Compare segment control top-left, three icon buttons top-right (toggle measurements, screenshot, fullscreen), measured-on date pill bottom-left, and either "Open full view" (preview) or "Compare with…" (full) bottom-right.

Measurement pins = small dots on body with leader lines to label boxes off to side. Pins for "key" measurements (chest, waist) get hollow halo ring to distinguish; lesser pins (bicep, hip, thigh) drop ring to reduce visual noise.

### Body composition trend

Line chart with two variants: **single-series** (BF % only) + **dual-axis** (BF % + weight kg). Dual-axis = default on Overview.

In dual-axis variant, both Y axes (BF left, kg right) map to same four horizontal gridlines — values chosen so each series has reasonable headroom. Shared gridlines let both series read against same visual baseline without one dominating.

**Why dual-axis, not separate charts or stacked.** Separate charts double vertical space + obscure correlation. Stacked charts imply two series sum to something, which BF % and kg don't. Same-baseline dual-axis let you trace whether lines move together — when both descend in parallel = clean cut; when weight drops faster than BF, losing muscle.

Both series use solid 2px strokes. v0.1 spec called for dashed weight; retracted. Two solid lines on different colors read more cleanly + legend disambiguates color.

### Measurement entry row

Row with label · numeric input · auto-computed delta · save action. Save button normally secondary; when input has unsaved changes, swap to brand gradient. Only allowed "primary moves with intent" pattern on dashboard — primary action become prominent exactly when meaningful change to commit.

### Strength workout entry

Compact set-grid editor tying into Hevy sync. Exercise picker on top, set grid with reps/weight/RPE columns, per-exercise sync status pill in top-right. Synced exercises show success pill; failed exercises get inline retry button.

### Calorie entry

Two modes: photo + text. Photo mode auto-extract food + calorie estimate from uploaded image; text mode parse free-form description. Either path land in same downstream editable fields, with "auto-detected ↔ edited" pill as small honesty signal — at glance you can tell which entries you trusted model on + which you corrected.

### Calorie summary strip

KPI-style strip showing day-total calories + macro micro-bars (protein / carbs / fat). When daily calories exceed target by more than ~200, delta turn warning amber — not error red. Exceeding calories on single day = information, not failure.

---

## 5. Layout & navigation

### Surfaces & responsive model

Two **co-equal** shells. Neither primary — same tokens, same components, same data; only layout density + nav chrome differ. A component spec is "done" only when it reads correctly in **both** shells.

Shell chosen server-side by user-agent (`proxy.ts` sets the `x-shell` header; `?shell=m|d` overrides and sticks via cookie):

- **Desktop shell** — horizontal top nav + footer. Content column max-width 1400px, centered, `space-2xl` outer padding. Nominal 1920 × 1080, minimum 1440 × 900. Multi-column asymmetric grids (see splits below); below ~1100px multi-column rows collapse to single-column stacks.
- **Mobile PWA shell** — installable, standalone, **portrait** (`manifest.ts`: `display: standalone`, `orientation: portrait`, theme `#0D0D0D`). Phone-first: 480px max-width centered container, mobile top-bar + fixed bottom tab nav, `100dvh` height, `env(safe-area-inset-*)` honored, content padding clamps down to `space-md`. Multi-column grids stack to single column; component-level reflow at `@media (max-width: 600px)`.

Tablets land on the **desktop** shell by design — iPadOS Safari reports a desktop UA, and the mobile shell is phone-class only.

> Legacy `ViewportGuard` (desktop-only "use the mobile app" refusal below 760px) is **retired** — it predates the mobile shell and is no longer wired in. Don't reintroduce a hard viewport refusal; both surfaces render.

### Navigation

Each shell carries its own nav; both expose the same sections.

**Desktop — horizontal top nav.**

Persistent 64px horizontal bar — **not** sidebar. Bar carry wordmark, six section tabs (Overview · Training · Body · Nutrition · Timeline · Settings), search (Cmd+K), date range control, Refresh primary action, theme toggle, avatar.

Horizontal chosen over sidebar because:

1. Dashboard content wide (timeline, weekly agenda, dual chart row) + benefit from full content width.
2. Only six top-level sections — fit comfortably as tabs without crowding.
3. Voqi admin surface use same pattern; cross-surface consistency reduce friction.

Active tab use 2px brand-accent underline replacing nav's bottom border in tab's slot — no fill, no pill.

If 7th section ever added, drop search to icon-only before reflowing tabs.

**Mobile — top-bar + bottom tab nav.**

Phone shell splits nav in two: a slim top-bar (wordmark + theme toggle) and a fixed bottom tab bar inside the safe-area inset. Bottom bar carries the primary sections as icon + label tabs (Overview · Workout · Food · Races); active tab uses brand-accent icon + label, inactive muted. Thumb-reachable navigation is why sections live at the bottom, not the top. `main` reserves `calc(56px + safe-area-inset-bottom)` bottom padding so content never hides behind the bar. Secondary destinations (Settings, search) fold into the top-bar / a section, not the tab row — keep the bar at four to five tabs.

### Page chrome

No page sub-header — content begin immediately under top nav. Each page has heading row (editorial overline + display-lg headline on left, contextual meta on right) then vertical stack of sections.

### Multi-column grids

Asymmetric grids over symmetric. Use 12-column underlying grid; components snap to spans of 4 / 5 / 6 / 7 / 8.

Common splits:

- **40 / 60** — body render preview + dual-axis trend chart
- **60 / 40** — body render full + measurements list
- **66 / 34** — strength entry + muscle heatmap

Avoid 33 / 33 / 33 — three identical columns flatten hierarchy.

7-column weekly agenda = canonical equal-grid case — one column per weekday, equal width = structure.

### Page archetypes

**Overview** — what's now, what's coming.
1. Page heading
2. Race timeline (full width) — long horizon
3. Weekly agenda (full width) — short horizon
4. Body preview + composition trend (40 / 60) — current state

No KPI strip. 4-tile metric strip removed in v0.2 for focused content blocks; relevant numbers surface contextually in heading meta + chart headers.

**Training** — schedule, strength log, muscle map.

**Body** — render, measurements, composition.

**Nutrition** — calorie summary strip, calorie entry, day's log, trend.

**Timeline** — expanded race timeline + per-event detail cards.

**Settings** — plain forms for units, theme override, Hevy connection.

### The asymmetry rule

When three items on page related but unequal in importance, don't give equal width or height. Let one that matter most this week take 60% of canvas.

Identical grids feel like spreadsheets. Asymmetric grids feel editorial.

---

## 6. Iconography

Lucide icons exclusively, 2px stroke. No alternative libraries.

Icons inherit color from surrounding text. No emoji in production UI except user-typed notes.

Custom fitness glyphs (barbell, dumbbell, kettlebell, plate, run, row, ski, sled — Hyrox set) follow same outline-first style at 2px stroke + live alongside Lucide set.

---

## 7. Accessibility

- Body text contrast ≥ 4.5:1. Large text ≥ 3:1. UI components ≥ 3:1. Token pairings pre-validated.
- Every interactive element has visible focus state — double ring (surface + brand-primary) for visibility on any background.
- Keyboard nav everywhere: Cmd+K global search, Esc to close, arrow keys for grids, Enter to open, `/` to focus search.
- Color independence: status pair icon with text; muscle heatmap pair color with hover label + separate text list; body-fat direction pair color with explicit arrow.
- Reduced motion honored: transitions become crossfades, durations shorten to `motion-fast`.
- Type in `rem` so browser font-size scale whole UI.

---

## 8. Do's and Don'ts

### Do

- Embrace tonal layering. Surface shifts handle most grouping needs.
- Pick one display moment per page. Earn it.
- Reserve gradient. Belong on most important action.
- Tabular numerics for every aligned number.
- Let active week / next race / today's session take more space than rest.
- Default to dark. Most lifters check dashboard in low light.
- Treat muscle heatmap + timeline as **information surfaces**, not motivational tools.

### Don't

- Don't use 1px borders to group cards. Tables only.
- Don't use pure black or pure white for text.
- Don't put two primary gradient buttons on same screen.
- Don't fire "celebration" UI for routine logging. No confetti when log meal, no flame when finish workout. Quiet.
- Don't decorate with shadows on dark mode. Tonal stack instead.
- Don't add bro gamification. No PR streaks with flames, no leaderboards, no mascots, no "you crushed it!" banners.
- Don't gridify related but unequal items into 33 / 33 / 33 columns.
- Don't auto-color "down is bad" — body fat going down good, body weight going down depend on goal. Map color to intent, not raw delta direction.

---

## 9. Implementation

Tokens implemented as CSS custom properties with theme switching at document root. Default theme follow `prefers-color-scheme`; persist manual override in localStorage.

Suggested stack (not prescriptive): React + Tailwind v4 with tokens under `@theme`; shadcn/ui primitives swapped to use these tokens; Recharts or visx for charts; react-day-picker for calendar; Lucide React for icons; three.js or model-viewer for 3D body render. Renderer sit inside Body card frame; everything around it (segment control, overlays, pins) = regular DOM.

---

## Changelog

- **v0.4 (mobile PWA)** — Reframed from desktop-only to **co-equal responsive**. Documented the two server-switched shells (desktop top-nav vs phone-first portrait PWA with top-bar + bottom tab nav), the `x-shell` UA switch + `?shell=` override, the 480px mobile container, `@media (max-width: 600px)` reflow convention, and safe-area handling. Retired the `ViewportGuard` sub-760px refusal. Tablets stay on desktop shell by design.
- **v0.3 (philosophy pass)** — Stripped component-level pixel specs. Tokens stay (foundations), principles stay, key decisions stay (horizontal nav, dual-axis chart, body preview vs full, axis-based timeline, no KPI strip on Overview, etc.). Component sections rewritten as 1–2 paragraph descriptions of what each component is + what's distinctive. `dashboard.html` mock = visual reference; this doc = vocabulary.
- **v0.2 (mock reconcile)** — Reconciled spec to shipped mock: axis-based race timeline (not scroll cards), body render full + preview variants, dual-axis trend chart, horizontal top nav (not sidebar), KPI strip removed from Overview, muscle heatmap moved to Training.
- **v0.1** — Initial draft. Derived from Voqi Foundations v1.1 with mobile, marketing, pronunciation-specific patterns cut; fitness primitives added.

---

*Fitness Dashboard Design · v0.4 · Derived from Voqi Foundations v1.1*