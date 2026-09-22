import forklift from './images/forklift.jpg'
import type { Site } from './sites'
import type { UserProfile } from './userProfile'

export interface SignedInPageProps {
  email: string
  site: Site | null
  /** Result of the getUserProfile call made at sign-in; null if it failed. */
  profile: UserProfile | null
  /** Why the profile call failed, when it did. */
  profileError: string | null
  /**
   * Resolved once in App and passed down, so the gate here and the route guard
   * there can never disagree about one decision.
   */
  showNewFeature: boolean
  onOpenNewFeature: () => void
  onSignOut: () => void
}

/** "2021-03-15" -> "15 March 2021", without pulling in a date library. */
function formatMemberSince(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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
  profile,
  profileError,
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

      {profile ? (
        <div className="profile-card">
          <h2>{profile.displayName}</h2>
          <p className="muted">
            {profile.jobTitle} · {profile.department}
          </p>
          <dl className="profile-details">
            <dt>Email</dt>
            <dd>{profile.email}</dd>
            <dt>Location</dt>
            <dd>{profile.location}</dd>
            <dt>Member since</dt>
            <dd>{formatMemberSince(profile.memberSince)}</dd>
            <dt>Roles</dt>
            <dd>{profile.roles.join(', ')}</dd>
          </dl>
          <p className="muted">
            from <code>GET /api/users/profile</code>
          </p>
        </div>
      ) : (
        <p className="status status--error">
          Profile unavailable — {profileError ?? 'unknown error'}
        </p>
      )}

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
