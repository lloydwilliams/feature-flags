import { isValidValue } from './define'
import type { FlagRegistry, FlagValue } from './types'

export const OVERRIDE_STORAGE_KEY = 'ff:overrides'
const URL_PREFIX = 'ff_'
const URL_RESET_PARAM = 'ff_reset'

type Overrides = Record<string, FlagValue>

/** Coerces a URL/string value into a `FlagValue`. */
function parseValue(raw: string): FlagValue {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  return raw
}

/** Drops unknown keys and values a flag cannot legally take. */
function sanitize(registry: FlagRegistry, candidate: unknown): Overrides {
  if (candidate === null || typeof candidate !== 'object') return {}

  const result: Overrides = {}
  for (const [key, value] of Object.entries(candidate)) {
    const definition = registry[key]
    if (definition && isValidValue(definition, value)) {
      result[key] = value
    }
  }
  return result
}

export function readStoredOverrides(registry: FlagRegistry): Overrides {
  try {
    const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY)
    return raw ? sanitize(registry, JSON.parse(raw)) : {}
  } catch {
    // Private-mode localStorage, or corrupt JSON. Overrides are a dev
    // convenience, so degrade to none rather than throwing.
    return {}
  }
}

export function writeStoredOverrides(overrides: Overrides): void {
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(OVERRIDE_STORAGE_KEY)
    } else {
      localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides))
    }
  } catch {
    // Ignore: nothing useful to do if storage is unavailable.
  }
}

/**
 * Reads `?ff_<key>=<value>` params.
 *
 * These are deliberately *not* persisted: a shared debug link should stop
 * applying as soon as you navigate away. Use the dev panel for sticky changes.
 * `?ff_reset=1` clears persisted overrides.
 */
export function readUrlOverrides(
  registry: FlagRegistry,
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): { overrides: Overrides; reset: boolean } {
  const params = new URLSearchParams(search)
  const candidate: Record<string, FlagValue> = {}

  for (const [param, raw] of params.entries()) {
    if (param === URL_RESET_PARAM || !param.startsWith(URL_PREFIX)) continue
    candidate[param.slice(URL_PREFIX.length)] = parseValue(raw)
  }

  return {
    overrides: sanitize(registry, candidate),
    reset: params.get(URL_RESET_PARAM) === '1',
  }
}
