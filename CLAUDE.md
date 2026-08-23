# my-car — design system

"Моя машина" is an offline-first car maintenance PWA (Vue 3 + TypeScript + IndexedDB).
The visual language is **iOS chrome + Instagram-style interaction accents**: iOS-style
grouped lists and sheets for structure, but every stand-alone action, chip, and identity
element uses Instagram's shapes — full pills, circular avatars, floating chrome, snappy
motion. Any new screen or component should read as part of the same app as the rest.
When building something new, match the patterns below instead of inventing new shapes.

## Design tokens (`src/style.css`)

All colors and shape/motion tokens live in `:root` (with a `prefers-color-scheme: dark`
override block for colors). Never hardcode a hex color, radius, or transition timing in
a component — reference the token.

```css
--blue / --green / --orange / --red / --yellow   /* accent + status colors */
--bg / --bg-elevated / --bg-grouped / --card       /* surfaces, light+dark aware */
--text / --text-secondary / --text-tertiary        /* ink, never use color for identity-only text */
--separator / --card-border / --fill-secondary / --shadow

--radius-pill   /* 999px — every stand-alone CTA button, chip, search bar, avatar */
--radius-lg     /* 20px — cards, sheets, chart cards, hero cards */
--radius-md     /* 14px — form input groups (.group), non-button containers */
--radius-sm     /* 10px — small inline elements */

--motion-spring /* cubic-bezier(0.32, 0.72, 0, 1) — sheet slide-up, spring-feel motion */
--motion-fast   /* 0.15s ease — fades, opacity/color transitions */

--ring-attention /* orange→red gradient — "needs attention" story-ring around an avatar */
```

## Shape rules — the Instagram signature

- **Any full-width or standalone action button is a pill**: `border-radius: var(--radius-pill)`.
  This includes primary CTAs (`.submit`, `.add-item`, `.add-car`, `.add-part`), outlined
  secondary buttons (`.backup-btn`, `.reset`, `.calendar-btn`, `.delete`), and small chip-style
  buttons (`.done` on a maintenance card). Never use `14px`/`16px` rounded-rect for a button —
  that reads as iOS Settings, not this app's accent language.
- **Cards, sheets, and chart panels use `var(--radius-lg)` (20px)**. Bottom sheets round only
  the top corners: `var(--radius-lg) var(--radius-lg) 0 0`.
- **Filter/period chips are pills**: small height (~30px) + `var(--radius-pill)`, inactive =
  `var(--fill-secondary)` background with `--text-secondary` text, active = solid `--blue`
  background with white text. See `.filter-chip` / `.period-chip` in MaintenanceTab.vue /
  FuelTab.vue for the reference implementation.
- **Search bars are full pills**, not soft-rounded rects (`MaintenanceTab.vue` `.search-row`).
- **Identity is always a circular avatar**, never a plain icon or bare text: a car gets a
  colored circle with its make's first letter (gradient `var(--blue)`→`#0040dd`, white bold
  text). This appears in the `TabBar` (replacing the settings icon), `CarSwitcherSheet` (each
  car row), and `SummaryCard` (next to the make/model line). Reuse this exact style — don't
  invent a second avatar treatment.
- **Story ring**: when an avatar represents something that needs attention (e.g. due/soon
  maintenance items > 0), wrap it in a ring using `var(--ring-attention)` — a 4px-larger circle
  behind the avatar, gradient background, avatar centered on top. See `TabBar.vue`
  `.avatar-ring.attention`. Plain state = no ring background (transparent).

## Floating chrome

- **Bottom nav is a floating pill**, not an edge-to-edge bar: `position: fixed`, `left/right: 16px`
  margin, rounded `30px` capsule, blurred translucent background
  (`color-mix(in srgb, var(--bg-elevated) 90%, transparent)` + `backdrop-filter: blur(24px)`),
  icon-only tabs (no text labels), active tab = rounded pill highlight behind the icon
  (`color-mix(in srgb, var(--blue) 14%, transparent)`). See `TabBar.vue`.
- **Toasts** float above the nav (`bottom: calc(78px + var(--safe-bottom))`), dark translucent
  pill-ish card, optional bold-blue action label on the right (used for undo). See
  `ToastHost.vue` / `useToast.ts` — always route new "undoable action" flows through this
  composable rather than a one-off notification.
- **Sheets** (bottom modals) slide up with `var(--motion-spring)`, rounded top corners only,
  plain-text "Cancel / Done" header buttons (not filled) — this is the one place that stays
  iOS-native, don't pill-ify the header buttons.

## Motion & feedback

- Tab switches animate with a 0.16s fade + 6px vertical slide (`Dashboard.vue`
  `.tab-fade-*`), `mode="out-in"`.
- Every meaningful state-changing tap gets a haptic via `src/utils/haptics.ts`
  (`haptic('tap' | 'success' | 'warning' | 'delete')`) — toggles, tab changes, deletes,
  marking something done, and the moment a swipe gesture crosses its action threshold
  (armed feedback, not just on release). Vibration is best-effort (`navigator.vibrate`),
  never required for correctness.
- Destructive/committing actions on a list row are a **swipe gesture** first, with a
  visible button as the accessible fallback — never swipe-only. Reuse `SwipeRow.vue`
  (`leftAction`/`rightAction` props, each `{ label, colorVar, onTrigger }`); don't hand-roll
  pointer-event dragging again.
- Loading state is a shimmering skeleton (`SplashSkeleton.vue` pattern: gradient sweep
  `linear-gradient(100deg, fill 40%, transparent 55%, fill 70%)` animated via
  `background-position`), never a bare blank screen.

## Charts

- Loaded the `dataviz` skill's method for any new chart — form first, color last, validate
  categorical palettes. In this app specifically: **trend-over-time data is a line/area
  chart**, not bars (bars read as noise when values are close together — this was a real
  user complaint, don't regress it). Style: single-hue line (`var(--blue)`) with a soft
  gradient fill under it, status-colored dots at each point when a per-point good/bad
  judgement exists (green/red, reusing the app's existing status colors — never invent new
  series colors), tap-to-reveal exact value below the chart instead of a hover tooltip
  (mobile-first, no hover). See `ConsumptionChart.vue` / `MonthlySpendChart.vue`.

## Versioning

- `package.json`'s `version` field is the single source of truth. It's injected at build
  time as `__APP_VERSION__` (see `vite.config.ts` / `src/vite-env.d.ts`) and shown to the
  user in Settings → «Обновления» (`SettingsTab.vue`), so a bump is the only way anyone can
  tell a deployed build actually contains a given PR's changes.
- **Every PR that changes app behavior must bump this version**, following semver by
  complexity/impact:
  - **patch** (`x.y.Z`) — small fixes, copy/style tweaks, refactors with no user-visible
    change.
  - **minor** (`x.Y.0`) — new features, new screens/components, non-breaking behavior
    changes.
  - **major** (`X.0.0`) — breaking changes (data format, IndexedDB schema, removed
    features).
- PRs that only touch docs, CI config, or tooling with zero effect on the shipped app may
  skip the bump.

## Conventions

- All UI copy is Russian; code, comments, identifiers stay English.
- Currency is ₽, dates formatted with `toLocaleDateString('ru-RU', …)`.
- Reuse existing composables/utils instead of duplicating logic:
  `useCarStore` (all data), `useToast` (undo/notices), `haptics.ts`, `ics.ts` (calendar
  export), `SwipeRow.vue` (swipe actions).
- Run `npm run typecheck` before considering any change done — the project has no test
  suite, so type-checking + manual verification (dev server + Playwright screenshots) is
  the bar.
