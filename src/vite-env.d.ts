/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected at build time from package.json's `version` field. See vite.config.ts. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Google Cloud OAuth 2.0 Client ID used for the Google Drive cloud backup. See .env.example. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Yandex OAuth app Client ID used for the Yandex Disk cloud backup. See .env.example. */
  readonly VITE_YANDEX_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
