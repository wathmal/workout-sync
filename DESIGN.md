# Workout Sync Design System: The Training Log

**Version 1.0 · Photo → Hevy Workout Pipeline**

---

## 1. Creative North Star: "The Training Log"

Workout Sync is a **training log** — a quiet, premium space where a session captured on paper or whiteboard becomes a clean, structured record in Hevy. Sets and reps are not flashcards to be flipped; they are entries worth reviewing, correcting, and committing with care.

This system rejects two common patterns in fitness apps:

- **Bro gamification** — leaderboards, screaming PR badges, neon flame icons, pumping iron mascots. Workout Sync treats the lifter as a serious adult.
- **Sterile spreadsheet utility** — bare grids, tiny fonts, dense rows of numbers. Workout Sync treats a session log with editorial respect.

We aim for the feeling of a high-end magazine that happens to read your handwriting. Each exercise gets typographic weight. Each match suggestion gets attentive review. Each successful sync is acknowledged without theatrics.

### Three guiding principles

1. **The exercise is the hero.** On any screen featuring an exercise, the exercise name is the largest, most confident element. Match score, equipment tag, set/rep grid — everything else orbits it.
2. **Boundaries through tone, not lines.** Sections separate by surface-color shifts. We do not draw 1px borders to group rows of sets.
3. **Asymmetry over uniformity.** When multiple exercises share a screen, the one currently being reviewed earns more space. Identical grids feel like spreadsheets; varied rhythm feels like an editorial layout.

---

## 2. Foundations

### 2.1 Color

#### Brand colors (theme-invariant)

| Token                    | Hex                                                 | Usage                                                 |
|--------------------------|-----------------------------------------------------|-------------------------------------------------------|
| `brand-primary`          | `#9100D0`                                           | Brand purple — icons, active states, accents          |
| `brand-primary-light`    | `#AE33ED`                                           | Gradient terminus, hover states                       |
| `brand-primary-gradient` | `linear-gradient(135deg, #9100D0 0%, #AE33ED 100%)` | Hero CTAs (Upload, Sync), primary actions             |
| `brand-secondary`        | `#006C4C`                                           | Match confidence bars, sync success (light theme)     |
| `brand-secondary-light`  | `#4DD4A3`                                           | Match confidence (dark theme), positive states        |
| `brand-tertiary`         | `#FF7849`                                           | Sync-complete celebration moment                      |
| `brand-tertiary-light`   | `#FFA882`                                           | Tertiary on dark surfaces                             |

The **tertiary coral** is reserved exclusively for the sync-complete moment — the brief flourish when all exercises have pushed to Hevy successfully. No streaks, no PR badges, no decorative use. If you find yourself reaching for tertiary in a static UI element, you are using it wrong.

#### Semantic colors

| Token              | Light     | Dark      | Usage                                          |
|--------------------|-----------|-----------|------------------------------------------------|
| `semantic-success` | `#006C4C` | `#4DD4A3` | Successful exercise sync, match confirmed      |
| `semantic-warning` | `#B8860B` | `#F5C150` | Low-confidence match, mock-data fallback       |
| `semantic-error`   | `#BA1A1A` | `#FF6B6B` | Sync failure, Groq vision error, no API key    |
| `semantic-info`    | `#0066CC` | `#5BA3F5` | Tooltips, hints, EXIF date notes               |

The mock-data fallback banner (when `GROQ_API_KEY` is missing) uses `semantic-warning` background at 12% opacity with `semantic-warning` text and icon.

#### Surface hierarchy (four layers)

Use surfaces as **stacked tones**, not bordered boxes. Each layer should be perceived as physically resting on the layer below.

| Layer              | Light                    | Dark                  | Purpose                                   |
|--------------------|--------------------------|-----------------------|-------------------------------------------|
| `surface-base`     | `#FCF9F8`                | `#0D0D0D`             | The page canvas                           |
| `surface-low`      | `#F6F3F2`                | `#161616`             | Large grouping sections (set/rep grids)   |
| `surface-card`     | `#FFFFFF`                | `#1F1F1F`             | Standard cards (exercise rows)            |
| `surface-elevated` | `#FFFFFF`                | `#232323`             | Hero cards (current review, sync status)  |
| `surface-glass`    | `rgba(255,255,255,0.85)` | `rgba(40,40,40,0.85)` | Floating elements with backdrop-blur 16px |

#### Text colors

| Token            | Light     | Dark      | Usage                                       |
|------------------|-----------|-----------|---------------------------------------------|
| `text-primary`   | `#1C1B1B` | `#F5F3F0` | Headlines, exercise names, set numbers      |
| `text-secondary` | `#5F5E5A` | `#C8C5C0` | Definitions, equipment tags, set details    |
| `text-tertiary`  | `#888780` | `#A3A09A` | Section labels, metadata, EXIF date         |
| `text-muted`     | `#B4B2A9` | `#6B6864` | Placeholders, disabled, "no data" notes     |
| `text-on-brand`  | `#FFFFFF` | `#FFFFFF` | Text on gradient buttons or primary fills   |

**Never use pure black (`#000000`) or pure white (`#FFFFFF`) for text.** Warm off-tones (`#1C1B1B` / `#F5F3F0`) maintain editorial softness that distinguishes Workout Sync from utilitarian spreadsheet apps.

#### The "No-Line" rule

Prohibit `1px solid` borders for sectioning, grouping, or separating cards. If a card needs definition, place it on a one-shade-darker surface. If two list items (or two set rows) need separation, use 16px of vertical gap.

The only acceptable borders are:

- **Focus rings** on inputs and interactive elements (`2px solid brand-primary` at 60% opacity)
- **Featured-card accents** for marking the currently reviewed exercise (`2px solid brand-primary`)
- **Ghost borders** as accessibility fallback (`outline-variant` at 15% opacity, never 100%)

### 2.2 Typography

#### Type families

- **Space Grotesk** — Display and Headline scales. The expressive, technical voice of the brand.
- **Inter** — Title, Body, and Label scales. Maximum legibility for definitions, equipment tags, and dense grids.
- **`ui-monospace, "SF Mono", "JetBrains Mono", monospace`** — Set/rep/weight notation and match confidence scores only.

#### Type scale

The scale uses **two values** per token: `mobile / web`. Mobile values tuned for ~380px viewports; web values tuned for ≥1024px.

| Token         | Family        | Weight | Size (mobile / web) | Letter-spacing    | Use                                |
|---------------|---------------|--------|---------------------|-------------------|------------------------------------|
| `display-lg`  | Space Grotesk | 500    | 48px / 72px         | -1.5px            | Exercise name on focused review    |
| `display-md`  | Space Grotesk | 500    | 36px / 56px         | -1.2px            | Sync progress percentage, set totals |
| `display-sm`  | Space Grotesk | 500    | 28px / 40px         | -0.8px            | Page-level greetings, workout date |
| `headline-lg` | Space Grotesk | 500    | 22px / 32px         | -0.5px            | Exercise card titles               |
| `headline-md` | Space Grotesk | 500    | 18px / 24px         | -0.3px            | Section titles ("Sets", "Match")   |
| `headline-sm` | Space Grotesk | 500    | 16px / 20px         | -0.2px            | Compact card titles                |
| `title-lg`    | Inter         | 500    | 16px / 18px         | 0                 | Buttons, prominent labels          |
| `title-md`    | Inter         | 500    | 14px / 16px         | 0                 | List item titles, set row labels   |
| `title-sm`    | Inter         | 500    | 13px / 14px         | 0                 | Compact labels                     |
| `body-lg`     | Inter         | 400    | 16px / 18px         | 0                 | Reading paragraphs                 |
| `body-md`     | Inter         | 400    | 14px / 16px         | 0                 | Equipment tags, descriptions       |
| `body-sm`     | Inter         | 400    | 13px / 14px         | 0                 | Metadata, captions, EXIF date      |
| `label-lg`    | Inter         | 600    | 12px / 13px         | 1px (uppercase)   | Category headers                   |
| `label-md`    | Inter         | 600    | 10px / 11px         | 1.2px (uppercase) | Section overlines                  |
| `label-sm`    | Inter         | 600    | 9px / 10px          | 1.4px (uppercase) | Micro-labels, badges               |
| `mono-md`     | Mono          | 400    | 14px / 16px         | 0                 | Set/rep/weight grid cells          |
| `mono-sm`     | Mono          | 400    | 12px / 13px         | 0                 | Match score numbers, RPE values    |

#### The "one display moment" rule

Each screen gets **one** `display-*` element. Multiple display-scale items compete for attention and flatten hierarchy. On Home, that's the greeting. On Upload, that's the workout date. On Review, that's the current exercise name. On Sync, that's the progress percentage. Choose the hero, then let everything else recede to headline scale or smaller.

#### Editorial call-out pattern

Pair a `label-md` (uppercase, letter-spaced) directly above a `display-*` or `headline-lg` to create the signature editorial overline effect. Used for:

- "TUESDAY EVENING" → "Good evening, Sasi"
- "MAY 5 · WORKOUT" → "Upper body, push"
- "MATCH · 87/100" → "Bench Press (Barbell)"

#### Mono notation

Set/rep/weight values, match confidence numbers, and RPE always use the monospace family. Examples:

- `4×8 @ 60kg`
- `87/100` (match score)
- `RPE 8`

When a low-confidence match is highlighted, the score number inherits `semantic-warning` — never struck through, never crossed out. Manual overrides shift to `text-primary` to signal user-confirmed state.

### 2.3 Spacing

A 4px-based scale. Use named tokens, not raw pixel values.

| Token       | Value | Common use                      |
|-------------|-------|---------------------------------|
| `space-2xs` | 4px   | Icon-to-text gaps               |
| `space-xs`  | 8px   | Chip padding, set-cell padding  |
| `space-sm`  | 12px  | Card-internal padding           |
| `space-md`  | 16px  | Standard gap between elements   |
| `space-lg`  | 20px  | Card-to-card vertical rhythm    |
| `space-xl`  | 24px  | Section spacing on mobile       |
| `space-2xl` | 32px  | Section spacing on web          |
| `space-3xl` | 48px  | Page-level breathing room       |
| `space-4xl` | 64px  | Hero section padding (web only) |

**Mobile** caps outer container padding at `space-lg` (20px). Going larger eats screen real estate on small phones.

**Web** opens up to `space-3xl`–`space-4xl` for outer padding on hero sections, and uses `space-xl`–`space-2xl` for section gaps.

### 2.4 Radius

| Token         | Value | Use                                    |
|---------------|-------|----------------------------------------|
| `radius-sm`   | 8px   | Set-cell corners, equipment chips      |
| `radius-md`   | 12px  | Inputs, compact cards                  |
| `radius-lg`   | 18px  | Standard exercise cards                |
| `radius-xl`   | 24px  | Hero review cards, photo preview frame |
| `radius-full` | 999px | Buttons, avatar, glass nav, pill chips |

Cards on mobile lean toward `radius-lg` (18px). Cards on web can use `radius-xl` (24px) for a more editorial feel given the larger canvas.

### 2.5 Elevation: tonal layering

Workout Sync rejects standard drop-shadow elevation in favor of **tonal stacking**. To make a card feel elevated, place it on a surface one shade darker (light theme) or one shade lighter (dark theme).

```
Light:  surface-base → surface-low → surface-card → surface-elevated
        #FCF9F8     →  #F6F3F2    →  #FFFFFF     →  #FFFFFF
Dark:   surface-base → surface-low → surface-card → surface-elevated
        #0D0D0D     →  #161616    →  #1F1F1F     →  #232323
```

#### When ambient shadow is required

For genuinely floating elements (dragged exercise re-order handles, popovers, the photo-preview lightbox), use a soft glow:

- **Light theme:** `box-shadow: 0 16px 40px -10px rgba(28, 27, 27, 0.10)`
- **Dark theme:** `box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.40)`

Never a sharp drop shadow. Never a dark smudge.

#### Glassmorphism

Reserved for floating-on-content surfaces — bottom navigation bar, sync-progress sticky overlay, photo upload drag-state banner. Specifications:

```css
background: var(--surface-glass);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border-radius: var(--radius-full); /* for nav */
```

### 2.6 Motion

| Token               | Easing                         | Duration | Use                                 |
|---------------------|--------------------------------|----------|-------------------------------------|
| `motion-fast`       | `cubic-bezier(0.4, 0, 0.2, 1)` | 150ms    | Hover states, tap feedback          |
| `motion-standard`   | `cubic-bezier(0.4, 0, 0.2, 1)` | 200ms    | Most state changes                  |
| `motion-emphasized` | `cubic-bezier(0.2, 0, 0, 1)`   | 300ms    | Page transitions, expand collapse   |
| `motion-decelerate` | `cubic-bezier(0, 0, 0.2, 1)`   | 250ms    | Elements entering view, score reveal |
| `motion-sync-pulse` | ease-in-out                    | 1500ms   | Active per-exercise sync (infinite) |

**Reduced motion** — when `prefers-reduced-motion: reduce` is set, replace expand/collapse with crossfades, disable sync-pulse animation, and shorten all durations to `motion-fast`.

---

## 3. Components

### 3.1 Buttons

Workout Sync has three button tiers. Use them deliberately.

#### Primary (gradient pill)

Reserved for the **most important action on the screen**. Examples: "Upload Workout", "Process Photo", "Sync to Hevy", "+ Add Exercise".

```
Background:   brand-primary-gradient
Text:         text-on-brand, title-lg, weight 500
Padding:      14px 24px (mobile) / 16px 28px (web)
Radius:       radius-full
Hover (web):  saturation +10%, never a dark overlay
Active:       scale(0.98), 100ms
Disabled:     opacity 40%, no gradient shift
```

If you have two primary buttons on a single screen, one of them is wrong. Demote the lesser action to secondary. The Upload page primary is "Process Photo"; the Review page primary is "Sync to Hevy". Never both at once.

#### Secondary (ghost)

Standard recurring actions. Examples: "Re-upload photo", "Edit exercise", "Cancel", "Skip this match".

```
Background:   transparent
Border:       1.5px solid brand-primary at 25% opacity
Text:         brand-primary (light) / brand-primary-light (dark), title-lg
Padding:      same as primary
Radius:       radius-full
Hover:        border opacity → 50%
```

#### Tertiary (text-only)

Inline actions, "See all matches", "Reset", quiet links.

```
Background:   transparent, no border
Text:         brand-primary, title-md, weight 500
Padding:      8px 12px
Hover:        text-decoration: underline
```

#### Icon button

Square icon-only buttons for navigation, edit-toggle, dismiss, re-order handles.

```
Background:   surface-card
Size:         36px × 36px (mobile) / 32px × 32px (web)
Radius:       radius-full
Icon:         16px stroke-2, text-primary
```

### 3.2 Inputs

#### Text input & search

Used for exercise name override, set/rep/weight cells, and the exercise search combobox.

```
Background:    surface-card (no border)
Padding:       12px 16px
Radius:        radius-full (search) / radius-md (form fields, set cells)
Text:          body-md, text-primary (mono-md for numeric set cells)
Placeholder:   text-muted
Focus:         box-shadow: 0 0 0 2px brand-primary at 60% opacity
Error:         box-shadow: 0 0 0 2px semantic-error
```

The exercise-search combobox always has a leading 16px search icon at `text-tertiary` color. Set/rep/weight cells right-align numeric input and use `mono-md`.

#### Date picker (workout date override)

Pill chip showing the EXIF-extracted date with a chevron. Tappable to override.

```
Background:    surface-low
Padding:       6px 12px
Radius:        radius-full
Text:          label-md, text-primary
Suffix:        small "EXIF" or "MANUAL" tag at label-sm, text-tertiary
```

### 3.3 Chips & Badges

#### Match-mode filter chip

Used when showing fuzzy / vector / both match results.

```
Default:  background: surface-low, text: text-secondary
Active:   background: text-primary (inverted), text: surface-base
Padding:  6px 14px
Radius:   radius-full
Text:     title-sm
```

Chips on dark theme invert: active state uses `surface-base` background with `text-primary` text.

#### Equipment badge

A compact indicator next to an exercise name. Always uses `label-sm` uppercase with letter-spacing.

```
Background:  surface-low (subtle) or transparent
Text:        text-tertiary, label-sm
Padding:     3px 8px
Radius:      radius-sm
```

Examples: `BARBELL`, `DUMBBELL`, `MACHINE`, `BODYWEIGHT`. The "official" Hevy-catalog tag uses `brand-primary` text color to tie back to the brand without dominating.

#### Sync status badge

Shows per-exercise sync state during the Hevy push.

```
Pending:    background: surface-low,    text: text-tertiary,   icon: clock
Syncing:    background: surface-low,    text: brand-primary,   icon: spinner (motion-sync-pulse)
Success:    background: success at 12%, text: semantic-success, icon: check
Error:      background: error at 12%,   text: semantic-error,  icon: alert
Padding:    4px 10px, radius-full, label-sm
```

### 3.4 Cards

#### Standard card

```
Background:  surface-card
Padding:     16px (mobile) / 20px (web)
Radius:      radius-lg
No border, no shadow.
```

#### Hero card (the focal card on a screen)

Used for the currently reviewed exercise on the Review page and the active sync status on the Sync page.

```
Background:  surface-elevated
Padding:     20px (mobile) / 28px (web)
Radius:      radius-xl
Optional:    radial gradient corner accent at 15% brand-primary opacity
```

#### Featured/active card

The only card type that gets a visible border — and only because it carries semantic meaning ("this exercise is currently being reviewed/synced").

```
Background:  surface-card
Border:      2px solid brand-primary
Radius:      radius-lg
Optional:    badge top-right ("Reviewing", "Syncing")
```

### 3.5 Workout primitives (Workout Sync–specific)

#### Exercise card — hero variant

Full editorial treatment. Used on the Review page for the currently expanded exercise.

```
Container:        surface-elevated, radius-xl, padding-xl
Overline:         label-md uppercase ("MATCH · 87/100" or "MANUAL OVERRIDE")
                  color: brand-primary (auto match) or text-tertiary (manual)
Exercise name:    display-md or display-lg, Space Grotesk, weight 500
Equipment tag:    body-sm, text-tertiary, alongside name
Match-confidence: bar at top-right (see 3.7)
Set grid:         see set/rep editor row below
Optional:         alternate matches as collapsible list under "Other matches"
```

#### Exercise row — compact

Used in lists where many exercises appear and only the title + set summary matter at a glance. The default Review-page row state (until tapped to expand into hero).

```
Container:     surface-card, radius-lg, padding-md
Exercise name: headline-sm, Space Grotesk
Set summary:   mono-sm, text-secondary, right-aligned ("4×8 @ 60kg")
Match score:   label-sm uppercase, color by confidence band:
                 ≥85: text-tertiary (quiet, high confidence)
                 60–84: semantic-warning
                 <60: semantic-error
Tap target:    full row (44px min height)
```

Compact rows separate by **16px gap, never by horizontal rules**.

#### Workout summary card

The top-of-page card on Review showing date, total exercises, total sets, total volume.

```
Container:    surface-elevated, radius-xl, padding-xl
Overline:     label-md ("MAY 5 · WORKOUT") — date pulled from EXIF
Title:        display-sm or headline-lg ("Upper body, push")
Stats row:    three mono-md cells separated by space-md:
                 "6 exercises"   "18 sets"   "8,420 kg"
              labels in label-sm, text-tertiary above each number
```

#### Set/rep editor row

A single set inside an exercise card. The atomic editable unit.

```
Container:    transparent (sits on surface-elevated)
Padding:      6px 0
Layout:       4-column flex on mobile, 5-column on web (adds RPE)
              [#]  [reps]  [weight]  [unit toggle]  [RPE?]
Set number:   label-sm uppercase, text-tertiary ("SET 1")
Reps:         mono-md cell, surface-low background, radius-sm
Weight:       mono-md cell, surface-low background, radius-sm
Unit:         pill chip (kg/lb), surface-low, label-md
RPE:          mono-sm cell (web only), surface-low, optional
Separator:    space-xs vertical gap between sets — no rules
```

When a cell is being edited, focus ring is the standard 2px brand-primary at 60%. Validation errors swap focus ring to `semantic-error`.

#### Photo upload zone

The hero on the Upload page. Two states.

```
Empty:
  Container:   surface-low (dashed not allowed — use solid tone)
  Radius:      radius-xl
  Min height:  240px (mobile) / 320px (web)
  Padding:     space-3xl
  Center:      camera icon (32px, text-tertiary), then
               headline-md "Drop a workout photo"
               body-sm "JPEG, PNG, HEIC · up to 20 MB"
  Drag-over:   surface tint shifts to brand-primary at 8%
               border becomes 2px brand-primary (drag state — exception
               to the no-line rule, only while actively dragging)

Filled (preview):
  Container:   surface-elevated, radius-xl
  Image:       fill container, object-fit cover
  Overlay:     glass surface chip top-right with file name + size
  Action:      tertiary "Replace photo" button below
```

#### Hevy connection card

Used on Home and Sync to show the connected Hevy account state.

```
Container:    surface-card, radius-lg, padding-md
Layout:       avatar/icon left + text middle + status chip right
Avatar:       32px circle, brand-primary at 12% background, mono-md initial
Name:         title-md, text-primary
Subtitle:     body-sm, text-tertiary ("Last sync: 2 days ago")
Chip:         sync status badge (see 3.3)
```

Disconnected state replaces the chip with a primary gradient button: "Connect Hevy".

### 3.6 Photo & sync primitives

#### Upload CTA — hero gradient

Primary action on the Home page and the empty Upload state. Uses the gradient.

```
Idle:
  Size:        full-width on mobile / fixed 280px on web
  Background:  brand-primary-gradient
  Icon:        camera glyph, 20px, white
  Label:       "Upload Workout", title-lg
  Padding:     16px 28px
  Radius:      radius-full

Processing (after photo selected, during Groq call):
  Background:  brand-primary-gradient
  Icon:        replaced with circular loader (2.5px stroke, white)
  Label:       "Reading your workout…"

Complete:
  Auto-navigates to Review. Brief 200ms fade-out.
```

#### Sync CTA — hero gradient

Primary action on the Review page bottom. Same visual spec as Upload CTA.

```
Idle:
  Label:       "Sync to Hevy"
  Icon:        upload-cloud glyph, 20px, white

Syncing (sequential per exercise):
  Replaced by full-width sync-progress card (see below).
  CTA itself disappears.

Complete:
  Sync-complete celebration moment fires (see 3.7).
```

#### Sync-progress indicator

Replaces the Sync CTA while the per-exercise push is running. Sequential, ~1.5s per exercise.

```
Container:    surface-elevated, radius-xl, padding-lg
Heading:      label-md "SYNCING TO HEVY"
Number:       display-md, mono ("3 / 6")
Bar:          brand-secondary track at 15% opacity, fills proportional
              height 6px, radius-full, motion-decelerate on each tick
Current line: title-md, text-secondary
              "Bench Press (Barbell)" — currently pushing
Done list:    body-sm, text-tertiary, with check icons
              fades in as each completes
Pulse:        currently-syncing exercise row in the list above pulses
              its background at brand-primary 6% (motion-sync-pulse)
```

If a single exercise fails, its row shifts to `semantic-error` background at 8%, an inline retry button appears, and the overall progress continues. The completion celebration only fires when **all** exercises succeed.

#### Match-confidence bar

Shows fuzzy/vector match score (0–150 scale, threshold ≥60). Uses the **monochromatic green track** pattern.

```
Track:    brand-secondary at 15% opacity (light) / 12% darker green (dark)
          height 6px, radius-full
Bar:      brand-secondary, fills width % equal to (score / 150 × 100)
          motion-decelerate animation on appear
Label:    score number in mono-md, brand-secondary
          "/150" suffix in body-sm, text-muted
```

Below threshold (<60), the bar shifts to `semantic-warning` and a "Low confidence" label appears in `label-sm`.

### 3.7 Sync-complete celebration

The **only** moment that uses `brand-tertiary` (coral). Fires once per session when every exercise has pushed to Hevy successfully.

```
Container:   replaces sync-progress card in place
Background:  surface-elevated with radial gradient corner accent
             at 15% brand-tertiary opacity (top-right)
Icon:        check-circle, 32px, brand-tertiary
Heading:     display-sm "Synced to Hevy"
Subtitle:    body-md, text-secondary, "6 exercises · 18 sets"
Action:      tertiary "Open in Hevy" link + secondary "Done"
Animation:   motion-decelerate, 250ms — single quiet appearance.
             No confetti. No spring. No sound.
```

When `prefers-reduced-motion` is set, replace with instant appearance and skip the radial accent fade-in.

If even one exercise failed, the celebration does **not** fire. Show a `semantic-warning` card listing failed exercises with retry buttons instead. Coral is for real wins only.

### 3.8 Navigation

#### Mobile: glass bottom nav

```
Container:    glass surface (rgba + backdrop-blur 16px)
Position:     fixed bottom, 14px from edges
Padding:      10px 16px
Radius:       radius-full
Items:        3 navigation items (Home, Upload, History — or Home/Upload/Settings),
              evenly spaced

Active item:
  Icon:  filled, brand-primary, 16px
  Label: label-sm, brand-primary, weight 500

Inactive item:
  Icon:  outlined, text-tertiary, 16px
  Label: label-sm, text-tertiary
```

The nav floats over content with a 24px safe area below it. Content scrolls underneath; the blur reveals movement without obscuring legibility.

During an active sync, the nav is hidden — sync flow is non-interruptible at the navigation level.

#### Web: left sidebar

```
Width:        240px
Background:   surface-low
Padding:      24px 16px

Logo:         top, 32px height
Nav items:    32px tall, radius-md, padding 8px 12px
              icon + title-md
Active item:  background: brand-primary at 12% opacity
              icon + text: brand-primary
Hover:        background: surface-card
```

The sidebar sticks to the viewport. Main content area starts at 240px left margin and is centered with max-width 1200px.

---

## 4. Layout & Composition

### 4.1 Mobile layout patterns

#### Page structure

```
[Status bar — system]
[Header — 56px tall, surface-base]
  Left:    icon button (back/menu) or empty
  Center:  page title, title-lg
  Right:   avatar (28px) or icon button

[Tonal break — surface shifts to surface-low here]
[Editorial overline — label-md uppercase]
[Display moment — display-sm or display-md]
[Content sections]

[Bottom safe area — 80px reserved for floating nav]
```

#### Vertical rhythm

Between major sections, use `space-xl` (24px). Within sections, use `space-md` (16px) between cards. Inside cards, use `space-sm` to `space-md` for internal padding. Set rows inside an exercise card use `space-xs` (8px).

#### Asymmetry on mobile

Mobile is one-column, but vertical asymmetry is still possible:

- **Hero exercise + compact rows** — the currently reviewed exercise gets a tall, full-width hero card. Other exercises collapse to compact rows half the height. This is the dominant Review-page pattern.
- **Photo preview + metadata** — on Upload, the preview spans full width as a hero, then EXIF date + file info collapse to a compact row beneath.

### 4.2 Web layout patterns

#### Page structure

```
[Sidebar — 240px fixed]
[Main content — flex 1, max-width 1200px, centered]
  [Page header — 80px tall]
    Title + actions
  [Section: hero — full-width editorial moment]
  [Section: content grid — 2 or 3 columns]
  [Section: secondary content]
```

#### Multi-column grids

Web allows true asymmetric grids using fractional widths:

- **60/40 split** — hero exercise card 60%, exercise list 40% (Review page)
- **50/50** — photo preview 50%, EXIF + processing status 50% (Upload page)
- **Avoid 33/33/33** — three identical columns flatten hierarchy

Use a 12-column grid as the underlying system. Components snap to spans of 4, 5, 6, 7, or 8 columns. Spans of 3 are only used for compact metric cells (workout summary stats) or set-grid cells.

#### Responsive breakpoints

| Breakpoint | Width           | Layout                                                  |
|------------|-----------------|---------------------------------------------------------|
| Mobile     | < 640px         | Single column, bottom nav, hero exercise expands inline |
| Tablet     | 640px – 1024px  | Two column where appropriate, bottom nav                |
| Desktop    | 1024px – 1440px | Sidebar + 60/40 review split                            |
| Wide       | > 1440px        | Same as desktop, no further widening of content         |

Content max-width caps at 1200px even on wide screens. Generous side padding fills the rest. Reading paragraphs cap at 720px width to maintain comfortable line lengths.

### 4.3 Screen-level patterns

#### Home (`app/page.tsx`)

- Editorial overline ("TUESDAY EVENING") + display-sm greeting
- Hevy connection card
- Primary gradient CTA: "Upload Workout"
- Tertiary link: "View past syncs" (if/when history added)

#### Upload (`app/upload/`)

- Editorial overline ("STEP 1 · CAPTURE") + display-sm "Add your workout photo"
- Photo upload zone (hero)
- Once photo selected: EXIF date pill + manual override
- Primary gradient CTA: "Process Photo"
- Mock-data warning banner if `GROQ_API_KEY` missing (semantic-warning)

#### Review (`app/review/`)

- Workout summary card (hero) — date, exercise count, set count, volume
- Exercise list — currently active one in hero variant, others as compact rows
- Match-confidence bar visible per exercise; low-confidence rows surface a "Search exercises" combobox inline
- Set/rep editor row inside hero exercise card
- Primary gradient CTA fixed bottom on mobile, inline on web: "Sync to Hevy"

#### Sync (`app/sync/`)

- Sync-progress indicator (replaces CTA)
- Per-exercise rows below with status badges
- On completion: sync-complete celebration replaces progress card
- On partial failure: warning card with retry actions

### 4.4 The asymmetry rule

If three exercises (or three items) on a screen are related but unequal in importance:

- **Don't** give them equal width / height / treatment.
- **Do** let the most relevant one (currently reviewed, currently syncing) take 60% of the canvas, and let the others share the remaining 40%.

Identical grids feel like spreadsheets. Editorial layouts breathe.

---

## 5. Iconography

Workout Sync uses **outlined icons at 2px stroke weight** as the default. Filled variants are reserved for active navigation states only.

- **Library:** Lucide (or equivalent open-source set), modified to match stroke weight
- **Sizing:** 16px (inline), 20px (buttons), 24px (headers), 32px+ (decorative)
- **Color:** inherits from surrounding text by default — never explicitly colored unless semantically meaningful

Common icons in this app: camera, upload-cloud, check-circle, alert-triangle, search, edit-2, trash, chevron-down, dumbbell (custom), barbell (custom). Custom equipment glyphs follow the same outline-first style.

**No emoji in production UI.** The single exception is user-typed exercise notes, where emoji is the user's choice.

---

## 6. Accessibility

### Contrast

- **Body text:** ≥ 4.5:1 against its background (WCAG AA)
- **Large text** (≥ 18px or 14px bold): ≥ 3:1 (WCAG AA Large)
- **UI components and icons:** ≥ 3:1 against adjacent surfaces

Token pairings in this system are pre-validated for AA compliance in both themes. Verify any custom combination before shipping.

### Touch targets

- Mobile: 44 × 44 px minimum (Apple HIG)
- Web: 32 × 32 px minimum (mouse precision allows smaller)

Set/rep cells must meet the mobile minimum even though they look compact — expand the tap area with negative margin if the visible cell is smaller.

### Focus states

Every interactive element must have a visible focus state. Default:

```
box-shadow: 0 0 0 2px var(--surface-base),
            0 0 0 4px var(--brand-primary);
```

The double ring ensures visibility on any background.

### Status communication

Sync state must work for users who can't see color:

- **Sync status** always pairs an icon with text (clock + "Pending", check + "Synced", alert + "Failed").
- **Match confidence** always pairs the bar with a numeric score and a confidence label below threshold.
- **Mock-data fallback banner** uses both color and a leading icon plus explicit text.

### Reduced motion

Honor `prefers-reduced-motion: reduce`:

- Expand/collapse → crossfade
- Sync-pulse → static surface tint
- Score reveal animation → instant appearance
- Sync-complete celebration → still uses tertiary color but no fade-in / spring

### Color independence

Never encode meaning in color alone. Match confidence needs the numeric score. Sync status needs an icon and text. Errors need a written reason.

---

## 7. Do's and Don'ts

### Do

- **Embrace white space.** If a screen feels crowded, increase padding before adding dividers.
- **Use tonal stepping.** Surface shifts handle 90% of grouping needs.
- **Mix type scales.** A `label-md` directly above a `display-lg` is a signature editorial move.
- **Pick one display moment per screen.** Earn it; don't dilute it.
- **Reserve the gradient.** It belongs on the most important action (Upload, Sync), not on every button.
- **Reserve coral/tertiary for the sync-complete moment.** Nothing else, ever.
- **Asymmetry over uniformity.** Hero cards, mixed widths, varied vertical rhythm.

### Don't

- **Don't use 1px borders to group set rows.** Use a surface shift or 16px gap.
- **Don't use pure black or pure white for text.** Warm off-tones only.
- **Don't put two primary gradient buttons on the same screen.** Upload page CTA and Review page CTA never coexist.
- **Don't size every heading large.** Hierarchy collapses when everything competes.
- **Don't decorate with shadows.** If you want elevation, use tone.
- **Don't separate exercises with horizontal rules.** Use 16px of vertical gap.
- **Don't rigidly grid related exercises.** Let the active one take more space.
- **Don't add bro gamification.** No PR badges, no flame icons, no leaderboards, no mascots.
- **Don't use coral outside the sync-complete celebration.** Static UI never uses tertiary.
- **Don't fire the celebration on partial sync.** Coral is for real wins.

---

## 8. Implementation notes

### Design tokens

Tokens should be implemented as CSS custom properties in `app/globals.css` under Tailwind v4's `@theme` directive, with theme switching at the document root:

```css
:root[data-theme="light"] {
    --surface-base: #FCF9F8;
    --surface-low: #F6F3F2;
    --text-primary: #1C1B1B;
    /* ... */
}

:root[data-theme="dark"] {
    --surface-base: #0D0D0D;
    --surface-low: #161616;
    --text-primary: #F5F3F0;
    /* ... */
}
```

shadcn components (`components/ui/`) consume tokens through the New York theme config (`components.json`). When adding a new shadcn component, replace its default neutral palette with our token names rather than its built-in CSS variables.

### Theme defaults

- **Web:** follow system theme by default via `prefers-color-scheme`. Persist user override in local storage.

### Versioning

This document is versioned alongside the codebase. Every change to a token, scale, or component spec requires a version bump and changelog entry. Components are considered stable once they appear in two consecutive minor versions without modification.

---

*The Training Log · Workout Sync Design System · v1.0*
