# my-car

## Cloud backup (optional)

Settings → «Облако» can back up your data to Google Drive or Yandex Disk, with
auto-sync in the background plus a manual "sync now" and "restore from cloud".
This is entirely optional — the app works fully offline without it, and each
provider stays hidden/disabled until it's configured.

To enable one or both providers, copy `.env.example` to `.env.local` and follow
the instructions inside to register an OAuth Client ID with Google and/or
Yandex, then rebuild. No backend is involved — both providers authenticate
straight from the browser and store the backup in an app-private folder
(`appDataFolder` on Drive, `app:/` on Disk) that the app can read but the rest
of the user's cloud storage can't see.
## Development

```sh
npm install
npm run dev        # dev server
npm run typecheck  # vue-tsc
npm test           # vitest unit tests (pure utils: mileage, thresholds, parsers, CSV, summaries, backups)
npm run build      # typecheck + production build
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests and a build on every
pull request; the Pages deploy also runs the tests before building.

## Data safety

- The app keeps a rolling set of local snapshots in a separate IndexedDB
  database (one per day, last 3) plus a copy taken right before every import
  or cloud restore (last 2). Restore any of them from Settings → «Автокопии».
- Cloud backup is optional (see above), and JSON/CSV/PDF export is always
  available from Settings.

## Known limits

- Reminders fire while the app is open or when it is next launched; a PWA can't
  reliably wake itself in the background without a push server, which this
  offline-first app intentionally doesn't have. Use the calendar export for
  hard deadlines.
- Distances are kilometres and volumes are litres. The currency symbol is
  configurable (Settings → «Оформление») but amounts are not converted.
