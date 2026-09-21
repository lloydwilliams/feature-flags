import { useState } from 'react'
import { useFlagAdmin } from './hooks'
import './FlagPanel.css'
import type { Evaluation, FlagDefinition, FlagValue } from './types'

function ReasonBadge({ evaluation }: { evaluation: Evaluation }) {
  const { reason, ruleIndex, bucket } = evaluation
  const detail =
    reason === 'rule'
      ? `rule ${ruleIndex}`
      : bucket !== undefined
        ? `${reason} · bucket ${bucket}`
        : reason

  return (
    <span className={`ff-badge ff-badge--${reason}`} title={detail}>
      {detail}
    </span>
  )
}

interface ControlProps {
  flagKey: string
  definition: FlagDefinition
  value: FlagValue
  onChange: (value: FlagValue) => void
}

function Control({ flagKey, definition, value, onChange }: ControlProps) {
  switch (definition.kind) {
    case 'boolean':
      return (
        <label className="ff-switch">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{value === true ? 'on' : 'off'}</span>
        </label>
      )
    case 'variant':
      return (
        <select
          className="ff-select"
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {definition.variants?.map((variant) => (
            <option key={String(variant)} value={String(variant)}>
              {String(variant)}
            </option>
          ))}
        </select>
      )
    case 'number':
      return (
        <input
          className="ff-number"
          type="number"
          value={Number(value)}
          aria-label={`${flagKey} value`}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(next)
          }}
        />
      )
  }
}

export interface FlagPanelProps {
  /** Defaults to dev builds only - the panel should not ship to production. */
  enabled?: boolean
}

/**
 * Floating dev panel for inspecting and overriding flags at runtime.
 *
 * Overrides persist in localStorage and sync across tabs. Flags forced via a
 * `?ff_*` URL param are shown locked, since the URL outranks the panel.
 */
export function FlagPanel({ enabled = import.meta.env.DEV }: FlagPanelProps) {
  const [open, setOpen] = useState(false)
  const {
    registry,
    evaluations,
    overrides,
    urlOverrides,
    sourceStatus,
    setOverride,
    clearOverride,
    clearAllOverrides,
  } = useFlagAdmin()

  if (!enabled) return null

  const overrideCount = Object.keys(overrides).length

  return (
    <div className="ff-panel-root">
      {open && (
        <section className="ff-panel" aria-label="Feature flags">
          <header className="ff-panel__head">
            <h2>Feature flags</h2>
            <div className="ff-panel__head-actions">
              {sourceStatus !== 'idle' && (
                <span className={`ff-source ff-source--${sourceStatus}`}>
                  source: {sourceStatus}
                </span>
              )}
              <button
                type="button"
                className="ff-link"
                onClick={clearAllOverrides}
                disabled={overrideCount === 0}
              >
                Reset all
              </button>
            </div>
          </header>

          <ul className="ff-list">
            {Object.entries(registry).map(([key, definition]) => {
              const evaluation = evaluations[key]
              const lockedByUrl = key in urlOverrides
              return (
                <li key={key} className="ff-row">
                  <div className="ff-row__main">
                    <code className="ff-key">{key}</code>
                    <ReasonBadge evaluation={evaluation} />
                    {lockedByUrl && (
                      <span
                        className="ff-badge ff-badge--url"
                        title="Forced by a ?ff_ URL param, which outranks this panel"
                      >
                        url
                      </span>
                    )}
                  </div>
                  <p className="ff-desc">{definition.description}</p>
                  <div className="ff-row__controls">
                    <fieldset disabled={lockedByUrl} className="ff-fieldset">
                      <Control
                        flagKey={key}
                        definition={definition}
                        value={evaluation.value}
                        onChange={(value) => setOverride(key, value)}
                      />
                    </fieldset>
                    {key in overrides && (
                      <button
                        type="button"
                        className="ff-link"
                        onClick={() => clearOverride(key)}
                      >
                        clear
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <button
        type="button"
        className="ff-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Flags
        {overrideCount > 0 && <span className="ff-count">{overrideCount}</span>}
      </button>
    </div>
  )
}
