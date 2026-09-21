import { useOpenFeatureClientStatus } from '@openfeature/react-sdk'
import { ProviderStatus } from '@openfeature/web-sdk'
import { datadogEnv, datadogSite, isConfigured, missingConfig } from './flags'

/**
 * Reports the provider's real status, not just whether config was present.
 * A valid-looking clientToken that Datadog rejects surfaces as ERROR here.
 */
function ProviderStatusNotice() {
  const status = useOpenFeatureClientStatus()

  if (!isConfigured) {
    return (
      <p className="status status--warn">
        Datadog provider not registered. Add {missingConfig.join(' and ')} to{' '}
        <code>.env.local</code>, then restart the dev server. Flags return their
        defaults until then.
      </p>
    )
  }

  if (status === ProviderStatus.ERROR || status === ProviderStatus.FATAL) {
    return (
      <p className="status status--error">
        Provider failed to initialize (<code>{status}</code>). Check the console
        — a 401 means the <code>VITE_DD_CLIENT_TOKEN</code> or{' '}
        <code>VITE_DD_APPLICATION_ID</code> is wrong. Flags return their
        defaults.
      </p>
    )
  }

  if (status === ProviderStatus.READY) {
    return (
      <p className="status status--ok">
        Provider ready — site <code>{datadogSite}</code>, env{' '}
        <code>{datadogEnv}</code>
      </p>
    )
  }

  return (
    <p className="status status--warn">
      Provider status: <code>{status}</code>
    </p>
  )
}

export default function App() {
  return (
    <main className="app">
      <h1>Hello World</h1>
      <p>Sample React app using OpenFeature with Datadog Feature Flags.</p>
      <ProviderStatusNotice />
    </main>
  )
}
