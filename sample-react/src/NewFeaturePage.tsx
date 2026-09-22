import forklift from './images/forklift.jpg'

export interface NewFeaturePageProps {
  /**
   * `show-ai-scan`, resolved once in App and passed down the same way
   * SignedInPage receives `show-new-feature`. A flag of its own, so the AI scan
   * screen can go to a subset of the users who already have this page.
   */
  showAiScan: boolean
  onOpenAiScan: () => void
  onBack: () => void
  onSignOut: () => void
}

/**
 * The gated feature itself. Only reachable while `show-new-feature` is on -
 * App re-checks the flag on every render, so turning it off returns anyone
 * sitting on this page to the landing view.
 */
export function NewFeaturePage({
  showAiScan,
  onOpenAiScan,
  onBack,
  onSignOut,
}: NewFeaturePageProps) {
  return (
    <section className="panel">
      <h1>New feature</h1>

      <img
        className="feature-image"
        src={forklift}
        alt="Forklift in a warehouse"
        width="480"
        height="262"
      />

      <p className="congrats">
        Congratulations you have accessed our new feature!
      </p>

      {showAiScan && (
        <button type="button" className="button" onClick={onOpenAiScan}>
          AI Scan Assist
        </button>
      )}

      <div className="actions">
        <button type="button" className="button button--quiet" onClick={onBack}>
          Back
        </button>
        <button type="button" className="button" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </section>
  )
}
