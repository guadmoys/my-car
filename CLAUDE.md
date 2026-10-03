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

## Code layout

- **Store.** `composables/useCarStore.ts` is only a facade. State and logic live in `composables/store/*`, one module per
  concern (state, car, maintenance, fuel, expenses, documents, reminders, masters, components, trips, derived, backupData,
  csvImport). Modules import `state` and a few of each other, never the facade, so there are no cycles; keep it that way.
- **Importing a backup.** Nothing in a file is trusted: `utils/backup/backupValidation.ts` (`cleanBackupRecords`) checks every
  record before it can replace the database, drops damaged, duplicate or orphaned ones (counted and shown to the user),
  repairs what it safely can, keeps unknown fields, and `importData` refuses files from a newer format version. When you add
  a field to a stored type, add it to the matching cleaner, and `importRoundTrip.test.ts` will tell you if it is lost.
- **Utils are grouped by concern.** `utils/security/` (app lock, vault, secret prompt), `utils/backup/` (snapshots, export,
  schedule, validation, cloud sync), `utils/alerts/` (alert engine, dispatcher, store, notifications, `.ics`) and
  `utils/money/` (budget, currency, costs, warranties, recurring, receipts, CSV); the rest stay flat in `utils/`.
- **Dashboard logic lives in composables.** `Dashboard.vue` only wires the tabs and sheets together: data in/out is
  `useDataTransfer`, badge/low-fuel/budget/alert-cycle watchers are `useDashboardAlerts`, and the add/edit/delete
  handlers are grouped by sheet family (`useRecordSheets`, `useMaintenanceSheets`, `useFuelSheets`), all behind the
  shared double-tap lock `submitOnce` (`useSubmitOnce`). New handlers go into the matching composable, not the component.
- **Pure logic.** Anything algorithmic belongs in `utils/` as a function that takes its inputs explicitly (see
  `maintenance.ts`, `fuelAnalytics.ts`, `alerts.ts`): it is then testable on its own and usable for any car, not just the
  active one. `composables/__tests__/fuelAnalytics.golden.test.ts` snapshots the real store output so a refactor can't
  silently change a number.
- **Loading.** `Dashboard.vue` loads every tab except the home one, and every sheet, with `lazy()` (async components),
  and warms them when the browser is idle. The PDF library (`jspdf`) is imported only inside `generateReportPdf`, and
  `tesseract.js`/`hash-wasm` only when used. Don't import these statically.

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
  `utils/money/costStructure.ts` powers «Куда уходят деньги», `utils/money/expensesCsv.ts` the full CSV export, and the PDF
  report prints the lines too.
- **Recurring expenses.** `Expense.recurrence` lives only on the newest entry of a series;
  `utils/money/recurring.ts` (`materializeRecurring`, idempotent) creates owed entries on load and after each save.
- **Budget** is a per-device monthly limit (`utils/money/budget.ts`, localStorage, set in Settings → Бюджет), shown on
  the home screen. **Warranties** (`utils/money/warranty.ts`) and **master stats** (`utils/money/masterStats.ts`, via
  `masterId` on expenses/ТО and `MasterPicker.vue`) are derived, never stored. Damage photos use
  `Expense.photos` + `PhotoGalleryField.vue`.
- **Alerts.** `checkAndNotifyBudget` (80% and 100%, once per month per level) and `checkAndNotifyWarranties`
  (≤30 days, once per part) live in `utils/alerts/notifications.ts` and are wired in `Dashboard.vue` like the other checks.
  The budget also travels in the backup (`BackupData.settings`), applied only after a successful import.
- **Entering expenses fast.** `ExpenseFormSheet` has a quick-entry line (`utils/money/expenseQuickEntry.ts`: «осаго 12000»,
  «ремонт бампера 45к») and «Заполнить по чеку» (`utils/money/receiptOcr.ts` → lazy `tesseract.js`, parsing in
  `utils/money/receiptText.ts`; needs a connection once to fetch language data, fails softly offline).
  `Expense.itemId` links an expense to a maintenance item and shows in that item's screen.
- **Overviews.** «Месяц к месяцу» (`utils/money/monthComparison.ts`) and «Детали и работы» (`PartsHistorySheet.vue`,
  `utils/money/partsList.ts`) on the расход tab.

## App lock

`utils/security/appLock.ts` gates the UI with a PIN stored as a salted PBKDF2-SHA-256 hash (300k iterations, `my-car-lock-iterations`)
and an optional WebAuthn step. PINs saved by older versions (plain salted SHA-256, no iteration key) still verify and are
rehashed on the next successful unlock. Five wrong attempts start a pause (30 s, doubling, capped at 15 min) that
`LockScreen.vue` shows as a countdown. It is a UI gate, not encryption of the IndexedDB data.

## Encryption at rest (opt-in)

Settings → «Шифрование данных» (`VaultSetupSheet`/`VaultManageSheet`, logic in `utils/security/vault.ts` + `utils/security/vaultActions.ts`).
- **Keys.** One random AES-256-GCM data key encrypts every record. It is stored only wrapped: once under the
  passphrase (Argon2id via `hash-wasm`, 64 MiB × 3) and once under a 160-bit recovery code. Lose both and the data is
  gone — there is no backdoor. While unlocked it lives in memory as a non-extractable `CryptoKey`.
- **Storage seam.** Only `db/database.ts` seals/opens records (`seal`/`open`): a sealed row is `{id, carId?, e, iv, ct}`,
  bound to `store:id` as AAD. Plain rows still read, so an interrupted migration is resumable
  (`resumeInterruptedMigration`) and `reencryptAll` is idempotent and one transaction. Never await crypto inside an
  IndexedDB transaction — seal first, then write.
- **Everything that could leak is covered.** Local snapshots (`autoBackup.ts`, cleared on enable), the JSON export and cloud
  payload (`serializeBackup`/`encryptBackup`, openable with passphrase or recovery code anywhere), and the Yandex token.
  CSV/PDF exports stay plain files, so `Dashboard.vue` asks first when encryption is on.
- **App flow.** With the vault on, `App.vue` loads nothing until `VaultUnlockScreen` emits `unlock`; the screen PIN is
  disabled and biometrics can't unlock (they hold no key). Auto-lock drops the key after the chosen time in the background.
  `onVaultStateChange` may only *raise* the lock — the unlock screen decides when it is done.

## Notifications & backups

- **Alert engine.** `utils/alerts/alerts.ts` turns every car's data into alerts (`computeAlerts`: ТО by mileage/date/pace, dated
  and odometer reminders, document expiry, warranties) with *stable keys* that embed what resets them (last service,
  expiry date), so nothing needs manual "notified" clean-up. `utils/alerts/alertDispatcher.ts` (`runAlertCycle`) runs over **all**
  cars, delivers what is newly due once (grouped per car, soon → due escalates), and writes the upcoming ones to a small
  plain database (`utils/alerts/alertStore.ts`, `my-car-alerts`). The first run is silent. Triggered from `composables/useAlerts.ts`
  at startup, on returning to the app, and (debounced) on data changes. Low fuel and budget keep their own checks.
- **Background.** `public/sw-extra.js` (pulled into the generated worker by `workbox.importScripts`) answers
  `periodicsync` (Chromium, installed PWA only) from that schedule and handles notification taps. iOS has no background
  path, so Settings also offers **deadlines as .ics** (`buildIcsCalendar`), which rings at the OS level. While encryption is
  on the schedule is never written and the background check is off.
- **Backups off the device.** `utils/backup/backupSchedule.ts` decides when to remind (default weekly, a clock that starts when
  data first exists, "later" = 1 day, cloud sync counts); `utils/backup/backupExport.ts` saves via a chosen folder
  (File System Access, written without a tap while permission lasts, newest 10 kept), else the share sheet, else a
  download. `composables/useBackup.ts` drives the home banner and the Settings section. Files are encrypted when the vault is on.

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
