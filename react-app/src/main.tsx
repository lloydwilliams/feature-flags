import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { demoContext } from './demo-identity'
import { FeatureFlagProvider } from './flags'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeatureFlagProvider context={demoContext}>
      <App />
    </FeatureFlagProvider>
  </StrictMode>,
)
