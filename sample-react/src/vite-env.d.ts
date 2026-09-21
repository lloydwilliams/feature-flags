/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** RUM application ID. Must match the app ID given to the RUM SDK. */
  readonly VITE_DD_APPLICATION_ID?: string
  /** Datadog client token. Not a secret to the browser, but keep it out of git. */
  readonly VITE_DD_CLIENT_TOKEN?: string
  /** e.g. datadoghq.com, datadoghq.eu */
  readonly VITE_DD_SITE?: string
  /** e.g. dev, staging, prod */
  readonly VITE_DD_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
