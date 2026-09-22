export interface AiScanPageProps {
  onBack: () => void
  onSignOut: () => void
}

/**
 * Reached from the "AI Scan Assist" button on the new feature page.
 *
 * A distinct screen rather than a panel on that page, so RUM records it as its
 * own view - App starts "AI Scan Assist" in RUM when this becomes the active
 * view. Gated on `show-ai-scan` and, because it hangs off the new feature, on
 * `show-new-feature` too; App re-checks both on every render.
 */
export function AiScanPage({ onBack, onSignOut }: AiScanPageProps) {
  return (
    <section className="panel">
      <h1>AI Scan Assist</h1>

      <p className="congrats">SmartPick AI Scan Ready!</p>

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
