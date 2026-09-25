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
  /** Release tag for RUM and Logs. Defaults to 1.0.0. */
  readonly VITE_DD_VERSION?: string
  /** sample-java-api origin. Defaults to http://localhost:8080. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
