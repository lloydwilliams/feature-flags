import { useState, type FormEvent } from 'react'
import { datadogRum } from '@datadog/browser-rum'
import { SITES, type Site } from './sites'

/**
 * Pragmatic email check.
 *
 * Deliberately stricter than the browser's `type="email"`, which accepts bare
 * hosts like `a@b`. Requires a dotted domain with a 2+ character TLD. Does not
 * attempt full RFC 5322 (quoted local parts, IP-literal domains) - that is a
 * famously impractical regex and wrong for a login form.
 */
const EMAIL_PATTERN =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  // Guard against pathologically long input before the regex sees it.
  if (trimmed.length === 0 || trimmed.length > 254) return false
  return EMAIL_PATTERN.test(trimmed)
}

interface Errors {
  email?: string
  password?: string
  site?: string
}

export interface LoginPageProps {
  /**
   * Called with a validated, trimmed email and the chosen site. May be async;
   * the form shows a pending state until it settles.
   */
  onSignIn: (email: string, site: Site) => void | Promise<void>
}

/**
 * Sample login form. A successful submit hands the validated email upward,
 * where it becomes the Datadog RUM identity and the key for the backend's
 * getUserProfile call.
 *
 * The password is never logged, sent anywhere, or retained after submit.
 */
export function LoginPage({ onSignIn }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [site, setSite] = useState<Site | ''>('')
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const [sessionNote, setSessionNote] = useState<string | null>(null)

  function validate(): Errors {
    const next: Errors = {}

    if (email.trim().length === 0) {
      next.email = 'Email is required.'
    } else if (!isValidEmail(email)) {
      next.email = 'Enter a valid email address, for example jane@example.com.'
    }

    if (password.length === 0) next.password = 'Password is required.'
    if (site === '') next.site = 'Select a site.'

    return next
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    // validate() guarantees a site was chosen; this narrows `Site | ''` to
    // `Site` without a cast.
    if (site === '') return

    setPassword('')
    setPending(true)
    try {
      await onSignIn(email.trim(), site)
    } finally {
      // On success this component unmounts, making the update a no-op. It
      // matters on failure, so the form becomes usable again.
      setPending(false)
    }
  }

  /**
   * Ends the current RUM session. Datadog starts a fresh one on the next user
   * interaction rather than immediately, so we report the id we just retired
   * instead of claiming a new one already exists.
   */
  function handleNewSession() {
    const previous = datadogRum.getInternalContext()?.session_id
    datadogRum.stopSession()
    setSessionNote(
      previous
        ? `Ended session ${previous.slice(0, 8)}… — the next click starts a new one.`
        : 'Session ended — the next click starts a new one.',
    )
  }

  /** Clears one field's error as soon as the user edits it. */
  function clearError(field: keyof Errors) {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  return (
    <section className="panel">
      <h1>Sign in</h1>

      {/*
        noValidate so this component is the single source of validation truth:
        one consistent, styled, screen-reader-visible error style instead of
        native browser bubbles for some fields and inline text for others.
      */}
      <form
        className="form"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={pending || undefined}
      >
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            onChange={(event) => {
              setEmail(event.target.value)
              clearError('email')
            }}
            placeholder="jane@example.com"
            disabled={pending}
          />
          {errors.email && (
            <span className="field-error" id="email-error" role="alert">
              {errors.email}
            </span>
          )}
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-error' : undefined}
            onChange={(event) => {
              setPassword(event.target.value)
              clearError('password')
            }}
            data-dd-privacy="mask"
            disabled={pending}
          />
          {errors.password && (
            <span className="field-error" id="password-error" role="alert">
              {errors.password}
            </span>
          )}
        </label>

        <label className="field">
          <span>Site</span>
          <select
            name="site"
            value={site}
            aria-invalid={errors.site ? true : undefined}
            aria-describedby={errors.site ? 'site-error' : undefined}
            onChange={(event) => {
              setSite(event.target.value as Site)
              clearError('site')
            }}
            disabled={pending}
          >
            <option value="" disabled>
              Select a site
            </option>
            {SITES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {errors.site && (
            <span className="field-error" id="site-error" role="alert">
              {errors.site}
            </span>
          )}
        </label>

        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="session-tools">
        <button
          type="button"
          className="button button--quiet button--small"
          onClick={handleNewSession}
        >
          New Datadog session
        </button>
        {sessionNote && <p className="session-note">{sessionNote}</p>}
      </div>
    </section>
  )
}
