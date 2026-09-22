import { useEffect, useRef, useState } from 'react'
import { datadogRum } from '@datadog/browser-rum'
import {
  useBooleanFlagDetails,
  useBooleanFlagValue,
  useOpenFeatureClientStatus,
} from '@openfeature/react-sdk'
import { ProviderStatus } from '@openfeature/web-sdk'
import ddLogo from './images/dd_icon_rgb.png'
import { AiScanPage } from './AiScanPage'
import { LoginPage } from './LoginPage'
import { NewFeaturePage } from './NewFeaturePage'
import { SignedInPage } from './SignedInPage'
import {
  datadogEnv,
  datadogSite,
  identifyUser,
  isConfigured,
  missingConfig,
  readFlagSnapshot,
  resetUserContext,
} from './flags'
import type { Site } from './sites'
import { fetchUserProfile, type UserProfile } from './userProfile'

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

/**
 * Development aid: shows how a flag resolved. `reason` distinguishes a flag
 * that is off from one that does not exist in Datadog yet.
 */
function FlagReadout({ flagKey }: { flagKey: string }) {
  const details = useBooleanFlagDetails(flagKey, false)

  return (
    <p className="flag-readout">
      <code>{flagKey}</code> = <strong>{String(details.value)}</strong>
      {' · reason '}
      <code>{details.reason ?? 'unknown'}</code>
      {details.errorCode ? (
        <>
          {' · error '}
          <code>{details.errorCode}</code>
        </>
      ) : null}
    </p>
  )
}

type View = 'home' | 'new-feature' | 'ai-scan'

/** Which screen is actually on display, after the flag guard is applied. */
type ActiveView = 'login' | 'signed-in' | 'new-feature' | 'ai-scan'

/** Names reported to Datadog RUM via startView. */
const RUM_VIEW_NAMES: Record<ActiveView, string> = {
  login: 'Login',
  'signed-in': 'Signed In',
  'new-feature': 'New Feature',
  'ai-scan': 'AI Scan Assist',
}

export default function App() {
  // Both default to false, so nothing gated appears if the flag is missing or
  // the provider is unavailable.
  const showDatadogLogo = useBooleanFlagValue('show-datadog-logo', false)
  const showNewFeature = useBooleanFlagValue('show-new-feature', false)

  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [signedInSite, setSignedInSite] = useState<Site | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [view, setView] = useState<View>('home')

  async function handleSignIn(email: string, site: Site) {
    // The real backend call for sign-in: sample-java-api's getUserProfile,
    // keyed on the email just entered. LoginPage shows its pending state for as
    // long as this takes.
    //
    // A failure here does not block sign-in - the flag demo still needs to work
    // when the Java API is not running - so the error is carried to the
    // signed-in page instead of thrown back at the form.
    let fetched: UserProfile | null = null
    let failure: string | null = null
    try {
      fetched = await fetchUserProfile(email)
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
      console.error('[api] getUserProfile failed', error)
    }

    // `site` lands as a custom user attribute, queryable in RUM as `usr.site`.
    // Unrelated to the SDK's own `site` init option (datadoghq.com).
    datadogRum.setUser({ id: email, email, site })

    // The account comes from the profile response, so it can only be set once
    // that call has succeeded. `id` is the only field RUM requires; `name` and
    // `plan` arrive as `account.name` and `account.plan`.
    if (fetched) {
      datadogRum.setAccount({
        id: fetched.account.id,
        name: fetched.account.name,
        plan: fetched.account.plan,
      })
    }

    // Make the same identity available to flag targeting. Awaited so the
    // provider has refetched its configuration for this user before we render
    // gated UI - otherwise the first paint shows the anonymous evaluation and
    // visibly flips a moment later.
    await identifyUser(email, site)

    // Sign-in and all flag work are now complete, so this reports the final
    // values rather than the anonymous ones. Forwarded to Datadog as `info`
    // by the Logs SDK. Site is included because it drives targeting; the email
    // is not, to keep it out of log text where it is harder to redact than in
    // the RUM user context.
    const snapshot = readFlagSnapshot()
    console.info(
      `[flags] sign-in complete for site "${site}" — ` +
        snapshot
          .map((flag) => `${flag.key}=${flag.value} (${flag.reason})`)
          .join(', '),
    )

    setSignedInAs(email)
    setSignedInSite(site)
    setProfile(fetched)
    setProfileError(failure)
    setView('home')
  }

  async function handleSignOut() {
    datadogRum.clearUser()
    datadogRum.clearAccount()
    setSignedInAs(null)
    setSignedInSite(null)
    setProfile(null)
    setProfileError(null)
    setView('home')
    await resetUserContext()
  }

  // View switching by state rather than a router: four screens but no URLs
  // yet. Swap in react-router when real routes are needed.
  //
  // `showNewFeature` is re-checked here on every render, so turning the flag
  // off acts as a kill switch and returns anyone already on the new feature or
  // AI scan page to home.
  //
  // Derived once and used for both rendering and the RUM view name, so the two
  // cannot disagree about which screen the user is on.
  const activeView: ActiveView = !signedInAs
    ? 'login'
    : (view === 'new-feature' || view === 'ai-scan') && showNewFeature
      ? view
      : 'signed-in'

  // Without a router the URL never changes, so RUM would otherwise report
  // every screen under a single "/" view. startView (not setViewName) is what
  // produces distinct views: setViewName only renames the current one, leaving
  // view.id unchanged and the screens indistinguishable in RUM.
  //
  // The ref guards against starting the same view twice - StrictMode
  // double-invokes effects in development, which would otherwise duplicate
  // every view.
  const startedViewName = useRef<string | null>(null)
  useEffect(() => {
    const name = RUM_VIEW_NAMES[activeView]
    if (startedViewName.current === name) return
    startedViewName.current = name
    datadogRum.startView(name)
  }, [activeView])

  function currentView() {
    switch (activeView) {
      case 'login':
        return <LoginPage onSignIn={handleSignIn} />
      case 'new-feature':
        return (
          <NewFeaturePage
            showNewFeature={showNewFeature}
            onOpenAiScan={() => setView('ai-scan')}
            onBack={() => setView('home')}
            onSignOut={handleSignOut}
          />
        )
      case 'ai-scan':
        return (
          <AiScanPage
            onBack={() => setView('new-feature')}
            onSignOut={handleSignOut}
          />
        )
      case 'signed-in':
        return (
          <SignedInPage
            email={signedInAs!}
            site={signedInSite}
            profile={profile}
            profileError={profileError}
            showNewFeature={showNewFeature}
            onOpenNewFeature={() => setView('new-feature')}
            onSignOut={handleSignOut}
          />
        )
    }
  }

  return (
    <main className="app">
      {showDatadogLogo && (
        <img
          className="logo"
          src={ddLogo}
          alt="Datadog"
          width="96"
          height="103"
        />
      )}

      {currentView()}

      <ProviderStatusNotice />
      <FlagReadout flagKey="show-datadog-logo" />
      <FlagReadout flagKey="show-new-feature" />
    </main>
  )
}
