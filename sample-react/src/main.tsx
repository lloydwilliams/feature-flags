import { datadogLogs } from '@datadog/browser-logs'
import { datadogRum } from '@datadog/browser-rum'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OpenFeatureProvider } from '@openfeature/react-sdk'
import App from './App'
import { initializeFlags } from './flags'
import { API_BASE_URL } from './api'
import './index.css'

// Shared by both SDKs so service/env/version cannot drift apart, which would
// split this app's telemetry across two identities in Datadog.
const DD_CLIENT_TOKEN = import.meta.env.VITE_DD_CLIENT_TOKEN || ''
const DD_SITE = import.meta.env.VITE_DD_SITE || 'datadoghq.com'
const DD_ENV = import.meta.env.VITE_DD_ENV || 'dev'
const DD_SERVICE = 'sample-react'
// Matches package.json and the -Ddd.version the Java tracer reports, so RUM,
// Logs, and APM all tag the same release.
const DD_VERSION = '1.0.0'

// Logs first, so console output emitted during RUM's own initialization is
// still captured. Log-to-RUM correlation is resolved when each log is sent,
// not at init, so this ordering does not cost us the session linkage.
datadogLogs.init({
  clientToken: DD_CLIENT_TOKEN,
  site: DD_SITE,
  service: DD_SERVICE,
  env: DD_ENV,
  version: DD_VERSION,
  // Sends console.log/debug/info/warn/error to Datadog as log records.
  forwardConsoleLogs: 'all',
  // Uncaught exceptions and failed network requests.
  forwardErrorsToLogs: true,
  // Reporting API: CSP violations, deprecations, interventions.
  forwardReports: 'all',
  sessionSampleRate: 100,
})

datadogRum.init({
  applicationId: import.meta.env.VITE_DD_APPLICATION_ID || '',
  clientToken: DD_CLIENT_TOKEN,
  site: DD_SITE,
  service: DD_SERVICE,
  env: DD_ENV,
  version: DD_VERSION,
  sessionSampleRate: 100,
  sessionReplaySampleRate: 20,
  // App owns view creation via startView(). Without this, RUM would also
  // create its own initial "/" view, duplicating every session's first screen.
  trackViewsManually: true,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input',
  // Required for startOperation/succeedOperation to emit operation vitals.
  enableExperimentalFeatures: ['feature_operation_vital'],
  // Connects RUM resources to APM traces: the SDK injects trace headers into
  // matching requests, and the Java tracer on sample-java-api continues the
  // trace it finds, so a click and its backend span land in one flame graph.
  //
  // Only the API origin is listed. A broader match - localhost on any port, say
  // - would attach headers to Vite's own dev-server requests, where they buy
  // nothing and force a CORS preflight on every module fetch.
  //
  // Both propagators are sent: `datadog` (x-datadog-* headers) is what the
  // Datadog Java tracer reads natively, and `tracecontext` (W3C `traceparent`)
  // keeps this working against an OpenTelemetry-instrumented backend. For a
  // deployed API, `match` also accepts a RegExp or a predicate:
  //   /^https:\/\/[^/]+\.my-api-domain\.com/
  //   (url) => url.startsWith('https://api.example.com')
  allowedTracingUrls: [
    { match: API_BASE_URL, propagatorTypes: ['datadog', 'tracecontext'] },
  ],
})

// Register the provider before the first render, per the Datadog docs.
initializeFlags()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element in index.html')

// Deliberately not using <Suspense> + suspendUntilReady. React 19 rejects the
// SDK's suspense implementation with a "conditional use()" error on every
// render. Every flag has a default and <ProviderStatusNotice> reports
// readiness, so rendering immediately and re-rendering when the provider
// resolves is both quieter and faster to first paint.
createRoot(rootElement).render(
  <StrictMode>
    <OpenFeatureProvider>
      <App />
    </OpenFeatureProvider>
  </StrictMode>,
)
