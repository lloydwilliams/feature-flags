import { useState, type FormEvent } from 'react'
import { datadogLogs } from '@datadog/browser-logs'
import { datadogRum } from '@datadog/browser-rum'

export interface AiScanPageProps {
  onBack: () => void
  onSignOut: () => void
}

/** Exclusive upper bound on the scan amount. */
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
 */
export function AiScanPage({ onBack, onSignOut }: AiScanPageProps) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState<number | null>(null)

  function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const found = validateAmount(amount)
    setError(found)
    if (found) {
      // Clear any previous success, so the completion message can never sit
      // alongside an error about the current input.
      setScanned(null)
      return
    }

    const value = Number(amount.trim())

    // Logs SDK, so this arrives in Datadog Logs rather than only the console.
    // The amount is duplicated into the log context, where it is queryable as
    // an attribute instead of having to be parsed out of the message.
    datadogLogs.logger.info(`AI scan completed for ${value}`, {
      scan_type: 'ai',
      amount: value,
    })

    datadogRum.addAction('scan_completed', { scan_type: 'ai', amount: value })

    setScanned(value)
  }

  return (
    <section className="panel">
      <h1>AI Scan Assist</h1>

      <p className="congrats">SmartPick AI Scan Ready!</p>

      {/* noValidate so this component is the single source of validation
          truth, matching LoginPage: one styled, screen-reader-visible error
          instead of native browser bubbles. */}
      <form className="form" onSubmit={handleScan} noValidate>
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
            value={amount}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'amount-error' : undefined}
            onChange={(event) => {
              setAmount(event.target.value)
              setError(null)
            }}
            placeholder={`0 - ${MAX_AMOUNT - 1}`}
          />
          {error && (
            <span className="field-error" id="amount-error" role="alert">
              {error}
            </span>
          )}
        </label>

        <button type="submit" className="button">
          Scan
        </button>
      </form>

      {scanned !== null && (
        <p className="status status--ok" role="status">
          Scan complete — scanned {scanned}.
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
