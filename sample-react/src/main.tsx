import { datadogRum } from '@datadog/browser-rum'
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { OpenFeatureProvider } from '@openfeature/react-sdk'
import App from './App'
import { initializeFlags } from './flags'
import './index.css'

datadogRum.init({
    applicationId: import.meta.env.VITE_DD_APPLICATION_ID || '',
    clientToken: import.meta.env.VITE_DD_CLIENT_TOKEN || '',
    site: import.meta.env.VITE_DD_SITE || 'datadoghq.com',
    service: 'sample-react',
    env: import.meta.env.VITE_DD_ENV || 'dev',
    version: '0.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
})

// Register the provider before the first render, per the Datadog docs.
initializeFlags()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element in index.html')

createRoot(rootElement).render(
  <StrictMode>
    <Suspense fallback={<p className="app">Loading flags…</p>}>
      <OpenFeatureProvider suspendUntilReady>
        <App />
      </OpenFeatureProvider>
    </Suspense>
  </StrictMode>,
)
