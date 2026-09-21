import forklift from './images/forklift.jpg'
import type { Site } from './sites'

export interface SignedInPageProps {
  email: string
  site: Site | null
  /**
   * Resolved once in App and passed down, so the gate here and the route guard
   * there can never disagree about one decision.
   */
  showNewFeature: boolean
  onOpenNewFeature: () => void
  onSignOut: () => void
}

/**
 * Post-login landing view.
 *
 * The forklift and its entry button are gated together on `show-new-feature`,
 * so with the flag off there is no trace of the feature to discover.
 */
export function SignedInPage({
  email,
  site,
  showNewFeature,
  onOpenNewFeature,
  onSignOut,
}: SignedInPageProps) {
  return (
    <section className="panel">
      <h1>Signed in</h1>
      <p className="muted">
        RUM user set to <code>{email}</code>
        {site ? (
          <>
            {' · site '}
            <code>{site}</code>
          </>
        ) : null}
      </p>

      {showNewFeature && (
        <div className="feature-block">
          <img
            className="feature-image"
            src={forklift}
            alt="Forklift in a warehouse"
            width="480"
            height="262"
          />
          <button type="button" className="button" onClick={onOpenNewFeature}>
            New Feature
          </button>
        </div>
      )}

      <button type="button" className="button button--quiet" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  )
}
