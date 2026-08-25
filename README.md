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