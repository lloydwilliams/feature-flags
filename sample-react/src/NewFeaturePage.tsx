import forklift from './images/forklift.jpg'

export interface NewFeaturePageProps {
  /**
   * Resolved once in App and passed down, same as on SignedInPage. Reaching
   * this page already implies the flag is on, so this gate is belt and braces:
   * it keeps the button and App's route guard reading the one decision.
   */
  showNewFeature: boolean
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
  showNewFeature,
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

      {showNewFeature && (
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
