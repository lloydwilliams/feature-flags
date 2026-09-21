import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { OpenFeatureProvider } from '@openfeature/react-sdk'
import App from './App'
import { initializeFlags } from './flags'
import './index.css'

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
