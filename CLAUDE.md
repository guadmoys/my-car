# my-car — design system

"Моя машина" is an offline-first car maintenance PWA (Vue 3 + TypeScript + IndexedDB),
built on **Ionic Framework for Vue** (`@ionic/vue`). The visual language is **stock
Ionic** — Ionic's own `ios`/`md` mode auto-detection, Ionic's shape and motion defaults,
Ionic's component set. Any new screen or component should be assembled from real Ionic
components (`IonPage`, `IonList`/`IonItem`, `IonModal`, `IonButton`, …) rather than
hand-rolled markup — don't reinvent a card, a pill button, or a switch when an Ionic
component already is one.

## Theming (`src/theme/variables.css`, `src/main.ts`)

Colors are Ionic's standard CSS-variable theming contract, not ad-hoc hex values:

```css
--ion-color-primary / -secondary / -tertiary / -success / -warning / -danger / -medium / -light / -dark
/* each with -rgb / -contrast / -contrast-rgb / -shade / -tint, per
   https://ionicframework.com/docs/theming/css-variables */
```

`variables.css` maps this app's palette onto that contract (primary = blue, success =
green, warning/tertiary = orange, danger = red) plus three status colors used for
maintenance state (`.ion-color-due`, `.ion-color-soon`, `.ion-color-ok`, aliasing
danger/tertiary/success) — use `color="due"` etc. rather than a literal hex or an old
`var(--red)`-style token (those tokens no longer exist). `main.ts` imports the full
`@ionic/vue/css/*` bundle plus `theme/variables.css`; `src/style.css` is now just the
handful of resets Ionic's own CSS doesn't cover (currently just `.sr-only`). Never
hardcode a color in a component — use an Ionic `color` prop or an `--ion-color-*` var.

Ionic auto-picks `ios` or `md` mode per platform — that's intentional; don't force a
mode.

## Navigation shape

- **Tabs are manual, not router-driven.** This app has no `vue-router` — `Dashboard.vue`
  holds a plain `activeTab` ref and conditionally renders one of the four tab screens
  (`DashboardTab`, `MaintenanceTab`, `FuelTab`, `SettingsTab`) inside a single `IonPage`,
  with `TabBar.vue` rendering a real `IonTabBar`/`IonTabButton`/`IonIcon` row wired to
  that ref via `@click` (not `IonTabs`, which requires a router outlet). Each tab
  component is a template *fragment* — `<ion-header>` + `<ion-content>` as sibling root
  nodes, no wrapping `<ion-page>` of its own — so swapping the active one swaps both the
  header and the content together while `TabBar` stays mounted underneath as the page's
  last child.
- **Sheets/modals are `IonModal`**, controlled the same way the old custom sheets were:
  a parent `v-if="show"` mounts the component, which renders
  `<ion-modal :is-open="true" @did-dismiss="emit('close')">`. Compact single-field sheets
  (`MileageSheet`, `CostEditSheet`) use `:breakpoints="[0, 1]" :initial-breakpoint="1"`
  for a bottom-sheet feel; longer forms (`FuelSheet`, `EditItemModal`, `AddCarSheet`,
  `CarSwitcherSheet`, `PickerSheet`, `CarPassportSheet`, `EventsHistorySheet`) use a
  plain full modal. Header is always `IonHeader`/`IonToolbar` with plain-text
  `IonButton`s in `IonButtons` (`slot="start"` Cancel/Закрыть, `slot="end"` Готово) —
  that's Ionic's own modal header convention, don't pill-ify it.
- **Swipeable row actions use `IonItemSliding`** (`IonItemOptions`/`IonItemOption` on
  one or both sides), always paired with a visible fallback control on the row itself
  (a button/toggle) — never swipe-only. See `MaintenanceCard.vue` / `FuelTab.vue`'s
  fuel-entry rows.
- **Grouped lists are `IonList inset` + `IonItem`/`IonLabel`/`IonNote`**, matching
  Ionic's own Settings-style grouped list — this replaces the old hand-styled `.group`/
  `.card` containers everywhere (`SettingsTab.vue`, `DashboardTab.vue`,
  `SettingsTab.vue`'s forms, etc).

## Feedback & state

- Every meaningful state-changing tap still gets a haptic via `src/utils/haptics.ts`
  (`haptic('tap' | 'success' | 'warning' | 'delete')`) — toggles, tab changes, deletes,
  marking something done. Vibration is best-effort (`navigator.vibrate`), never required
  for correctness.
- Toasts go through `ToastHost.vue`, which renders one real `IonToast` per entry from
  `useToast.ts` (`is-open`, `message`, `duration`, and a Отменить-style action via the
  `buttons` prop) — always route new "undoable action" flows through that composable
  rather than a one-off notification.
- Loading state is `IonSkeletonText :animated="true"` blocks (`SplashSkeleton.vue`),
  never a bare blank screen.

## Charts

- Loaded the `dataviz` skill's method for any new chart — form first, color last, validate
  categorical palettes. In this app specifically: **trend-over-time data is a line/area
  chart**, not bars (bars read as noise when values are close together — this was a real
  user complaint, don't regress it). The chart body itself stays custom inline SVG (not
  an Ionic component — Ionic doesn't have a charting primitive), wrapped in an `IonCard`:
  single-hue line (`var(--ion-color-primary)`) with a soft gradient fill under it,
  status-colored dots at each point when a per-point good/bad judgement exists
  (`--ion-color-success`/`--ion-color-danger`, reusing the app's existing status colors —
  never invent new series colors), tap-to-reveal exact value below the chart instead of
  a hover tooltip (mobile-first, no hover). See `ConsumptionChart.vue` /
  `MonthlySpendChart.vue`.

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
  export). Icons come from `ionicons/icons` (`import { xOutline } from 'ionicons/icons'`)
  — don't hand-draw a new inline SVG glyph or reach for emoji where a real Ionicon fits.
- Run `npm run typecheck` before considering any change done — the project has no test
  suite, so type-checking + manual verification (dev server + Playwright screenshots) is
  the bar.
