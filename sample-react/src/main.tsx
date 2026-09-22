import { datadogLogs } from '@datadog/browser-logs'
import { datadogRum } from '@datadog/browser-rum'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OpenFeatureProvider } from '@openfeature/react-sdk'
import App from './App'
import { initializeFlags } from './flags'
import './index.css'

// Shared by both SDKs so service/env/version cannot drift apart, which would
// split this app's telemetry across two identities in Datadog.
const DD_CLIENT_TOKEN = import.meta.env.VITE_DD_CLIENT_TOKEN || ''
const DD_SITE = import.meta.env.VITE_DD_SITE || 'datadoghq.com'
const DD_ENV = import.meta.env.VITE_DD_ENV || 'dev'
const DD_SERVICE = 'sample-react'
const DD_VERSION = '0.0.0'

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
