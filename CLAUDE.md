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

## Documents

Everything that is a paper — СТС/ПТС, driver's licence, insurance, tech inspection, tax,
plus the old car photo gallery — lives in the `documents` store (`CarDocument` in
`types.ts`, UI in `DocumentsSheet.vue`/`DocumentFormSheet.vue`, opened from Settings →
«Документы» and the dashboard card). A document with an `expiryDate` gets a due/soon status
(30 days) and a notification via `checkAndNotifyDocuments`. Expenses are costs only: they no
longer carry renewal dates. `migrateLegacyToDocuments` (`utils/documents.ts`) is idempotent
and moves the legacy `Car.stsNumber`/`Car.photos`/`Expense.renewalDate` on startup and on
import of old backups — don't reintroduce those fields in the UI.

## Expenses, breakdowns & money features

- **Chronological feeds.** «Все события» (`EventsHistorySheet`) and «Прочие расходы» (`ExpenseListSheet`)
  are one newest-first list split only by month headers (`utils/monthLabel.ts`) — never regrouped by kind.
  `TimelineEvent` has three kinds: `fuel`, `service`, `expense` (expenses have `mileage: null`).
- **Breakdown (`ExpenseItem`: part / labor / other).** Optional `items` on `Expense` and `HistoryEntry`;
  the total (`amount`/`cost`) stays the source of truth and the lines are informational. Edited through the
  shared `CostBreakdownEditor.vue` (expense form, ТО edit, «Выполнено»); a part can carry `warrantyMonths`.
  `utils/costStructure.ts` powers «Куда уходят деньги», `utils/expensesCsv.ts` the full CSV export, and the PDF
  report prints the lines too.
- **Recurring expenses.** `Expense.recurrence` lives only on the newest entry of a series;
  `utils/recurring.ts` (`materializeRecurring`, idempotent) creates owed entries on load and after each save.
- **Budget** is a per-device monthly limit (`utils/budget.ts`, localStorage, set in Settings → Бюджет), shown on
  the home screen. **Warranties** (`utils/warranty.ts`) and **master stats** (`utils/masterStats.ts`, via
  `masterId` on expenses/ТО and `MasterPicker.vue`) are derived, never stored. Damage photos use
  `Expense.photos` + `PhotoGalleryField.vue`.
- **Alerts.** `checkAndNotifyBudget` (80% and 100%, once per month per level) and `checkAndNotifyWarranties`
  (≤30 days, once per part) live in `utils/notifications.ts` and are wired in `Dashboard.vue` like the other checks.
  The budget also travels in the backup (`BackupData.settings`), applied only after a successful import.
- **Entering expenses fast.** `ExpenseFormSheet` has a quick-entry line (`utils/expenseQuickEntry.ts`: «осаго 12000»,
  «ремонт бампера 45к») and «Заполнить по чеку» (`utils/receiptOcr.ts` → lazy `tesseract.js`, parsing in
  `utils/receiptText.ts`; needs a connection once to fetch language data, fails softly offline).
  `Expense.itemId` links an expense to a maintenance item and shows in that item's screen.
- **Overviews.** «Месяц к месяцу» (`utils/monthComparison.ts`) and «Детали и работы» (`PartsHistorySheet.vue`,
  `utils/partsList.ts`) on the расход tab.

## App lock

`utils/appLock.ts` gates the UI with a PIN stored as a salted PBKDF2-SHA-256 hash (300k iterations, `my-car-lock-iterations`)
and an optional WebAuthn step. PINs saved by older versions (plain salted SHA-256, no iteration key) still verify and are
rehashed on the next successful unlock. Five wrong attempts start a pause (30 s, doubling, capped at 15 min) that
`LockScreen.vue` shows as a countdown. It is a UI gate, not encryption of the IndexedDB data.

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
- Run `npm run typecheck` and `npm test` (vitest; pure utils plus the store against
  `fake-indexeddb`) before considering any change done, then verify UI changes manually
  (dev server + Playwright screenshots). Fix a bug together with a test that fails without it.
