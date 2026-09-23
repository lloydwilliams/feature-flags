import { useState, type FormEvent } from 'react'
import { datadogLogs } from '@datadog/browser-logs'
import { datadogRum } from '@datadog/browser-rum'
import { startAiScan, type AiScanResult } from './aiScan'
import { ApiError } from './api'

export interface AiScanPageProps {
  /** Signed-in identity and chosen site, forwarded as the flag context. */
  email: string
  site: string
  onBack: () => void
  onSignOut: () => void
}

/** Exclusive upper bound on the scan amount. Matches the API's own validation. */
const MAX_AMOUNT = 1000

/**
 * Digits only, so decimals ("12.5"), signs ("-3"), and exponents ("1e3") are
 * rejected as not whole numbers rather than silently truncated by Number().
 */
const WHOLE_NUMBER = /^\d+$/

/**
 * Validates the scan amount, returning the error to show or null when valid.
 */
function validateAmount(raw: string): string | null {
  const trimmed = raw.trim()

  if (trimmed.length === 0) return 'Enter a number to scan.'
  if (!WHOLE_NUMBER.test(trimmed)) {
    return 'Enter a whole number - no decimals, signs, or letters.'
  }
  if (Number(trimmed) >= MAX_AMOUNT) {
    return `Enter a number less than ${MAX_AMOUNT}.`
  }

  return null
}

/**
 * Reached from the "AI Scan Assist" button on the new feature page.
 *
 * A distinct screen rather than a panel on that page, so RUM records it as its
 * own view - App starts "AI Scan Assist" in RUM when this becomes the active
 * view. Gated on `show-ai-scan` and, because it hangs off the new feature, on
 * `show-new-feature` too; App re-checks both on every render.
 *
 * Reaching this screen only means the browser-side flag was on. Whether a scan
 * actually runs is decided by the API, which evaluates `show-ai-scan`
 * server-side for this site - so a site can see the button and still be told
 * the feature is not available there.
 */
export function AiScanPage({
  email,
  site,
  onBack,
  onSignOut,
}: AiScanPageProps) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AiScanResult | null>(null)

  async function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const found = validateAmount(amount)
    setError(found)
    if (found) {
      // Clear any previous outcome, so a stale message cannot sit alongside an
      // error about the current input.
      setResult(null)
      return
    }

    const value = Number(amount.trim())
    setResult(null)
    setPending(true)

    try {
      const scan = await startAiScan(value, email, site)

      // Logs SDK, so this arrives in Datadog Logs rather than only the console.
      // Amount and site are duplicated into the context, where they are
      // queryable as attributes instead of parsed out of the message.
      datadogLogs.logger.info(
        scan.enabled
          ? `AI scan completed for ${value}`
          : `AI scan unavailable at site ${site}`,
        { scan_type: 'ai', amount: value, site, enabled: scan.enabled },
      )

      // Only a scan that actually ran is a completed scan; a gated-off site
      // would otherwise inflate this action's count with non-events.
      if (scan.enabled) {
        datadogRum.addAction('Scan Completed', {
          scan_type: 'ai',
          amount: value,
          site,
        })
      }

      setResult(scan)
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : String(caught)
      const status = caught instanceof ApiError ? caught.status : null

      // Same level split as sign-in: a 4xx is a rejection the API handled,
      // anything else is a fault.
      if (status !== null && status < 500) {
        datadogLogs.logger.warn('AI scan rejected by the API', {
          scan_type: 'ai',
          amount: value,
          site,
          status,
        })
      } else {
        datadogLogs.logger.error(
          'AI scan failed calling the API',
          { scan_type: 'ai', amount: value, site, status },
          caught instanceof Error ? caught : undefined,
        )
      }

      setError(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="panel">
      <h1>AI Scan Assist</h1>

      <p className="congrats">SmartPick AI Scan Ready!</p>

      {/* noValidate so this component is the single source of validation
          truth, matching LoginPage: one styled, screen-reader-visible error
          instead of native browser bubbles. */}
      <form
        className="form"
        onSubmit={handleScan}
        noValidate
        aria-busy={pending || undefined}
      >
        <label className="field">
          <span>Number to scan</span>
          {/*
            type="text" with a numeric keypad hint rather than type="number":
            a number input hands back an empty string for input like "12.5e",
            which would report "enter a number" for something the user did
            type. Keeping the raw text lets validateAmount explain the real
            problem.
          */}
          <input
            type="text"
            inputMode="numeric"
            name="amount"
            // Same as the login fields: without this, RUM reports clicks here
            // as "Masked Element".
            data-dd-action-name="Scan amount field"
            value={amount}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'amount-error' : undefined}
            onChange={(event) => {
              setAmount(event.target.value)
              setError(null)
            }}
            placeholder={`0 - ${MAX_AMOUNT - 1}`}
            disabled={pending}
          />
          {error && (
            <span className="field-error" id="amount-error" role="alert">
              {error}
            </span>
          )}
        </label>

        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Scanning…' : 'Scan'}
        </button>
      </form>

      {result && (
        <p
          className={result.enabled ? 'status status--ok' : 'status status--warn'}
          role="status"
        >
          {result.message}
        </p>
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
