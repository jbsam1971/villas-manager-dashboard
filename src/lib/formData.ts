// Shared `/gql` `formEntries` field-parsing helpers used by multiple report
// pages (Occupancy, Rent Roll). See lib/gql.ts for the underlying fetch
// wrapper and the native-JS-type gotcha this all exists to respect: the
// `/gql` JSON `value` arrives as the field's *native* type (number, boolean,
// or an already-parsed relationship array) — never a JSON string to
// re-`JSON.parse()`, and never string-compared against 'true'/'false'.

export interface FormEntryDataItem {
  name: string
  value: unknown
  valueAsString: string
}

export function getField(data: FormEntryDataItem[], label: string): FormEntryDataItem | undefined {
  return data.find((item) => item.name === label)
}

export function parseIntOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  if (typeof value === 'string' && value !== '') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export function parseBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

/**
 * Strips HTML markup from a string the same safe way for every form: build a
 * detached element, read `.textContent`, never render the HTML string
 * directly. Shared by `extractTextFromHtml` (valueAsString HTML) and
 * `getOptionText` (an option's displayName can itself contain markup —
 * confirmed live: a "Type of Contact" option's displayName was literally
 * `<FONT color=red>Emergency contact</FONT>`, not plain text).
 */
function stripHtml(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html
  return container.textContent?.trim() ?? ''
}

/**
 * Extracts real display text out of a relationship/rich-text field's
 * `valueAsString` HTML (e.g. link text), the same safe way for every form:
 * build a detached element, read `.textContent`, never render the HTML
 * string directly (it can contain entities like `&rarr;` and tags like
 * `<b>`). Returns one entry per `<a>` if any are present, else the plain
 * text content.
 */
export function extractTextFromHtml(valueAsString: string | undefined): string[] {
  if (!valueAsString) return []
  const container = document.createElement('div')
  container.innerHTML = valueAsString
  const anchors = Array.from(container.querySelectorAll('a'))
  if (anchors.length > 0) {
    return anchors.map((a) => a.textContent?.trim() ?? '').filter((name) => name.length > 0)
  }
  const text = container.textContent?.trim() ?? ''
  return text.length > 0 ? [text] : []
}

interface OptionValue {
  displayName?: string
}

function isOptionValue(value: unknown): value is OptionValue {
  return typeof value === 'object' && value !== null && 'displayName' in value
}

/**
 * Reads display text from an option/single-select/relationship field. For
 * these fields `valueAsString` is NOT reliably a display label — confirmed
 * live against Jen's Sandbox's Gender field, whose `valueAsString` is the raw
 * option topId (e.g. `"1000013___340077"`) while `value.displayName` is the
 * real label (`"Female"`); a multi-select field's `value` is an array of such
 * objects (confirmed against a Role field holding several values), joined
 * here with `, `. Each `displayName` is passed through `stripHtml` — some
 * options' displayName is itself HTML (confirmed live, see `stripHtml`'s doc
 * comment), never rendered raw. Falls back to `valueAsString` for a field
 * whose `value` isn't an option object/array (a plain text, date, or number
 * field), so this is safe to use in place of reading `valueAsString` directly
 * on any field whose type isn't otherwise known in advance.
 */
export function getOptionText(field: FormEntryDataItem | undefined): string | null {
  const value = field?.value
  if (Array.isArray(value)) {
    const names = value
      .filter(isOptionValue)
      .map((v) => (v.displayName ? stripHtml(v.displayName) : ''))
      .filter((name) => name.length > 0)
    return names.length > 0 ? names.join(', ') : null
  }
  if (isOptionValue(value)) {
    const text = value.displayName ? stripHtml(value.displayName) : ''
    return text.length > 0 ? text : null
  }
  const fallback = field?.valueAsString
  return fallback && fallback.trim() !== '' ? fallback : null
}

/**
 * Parses a pre-formatted money string such as `"$300.00"` or the accounting
 * negative form `"$(500.00)"` (meaning -$500.00 — confirmed against a real
 * row in Jen's Sandbox) into a signed number. Deliberately parses
 * `valueAsString` rather than the raw NUMBER `value` for Cost fields: the
 * parenthesized-negative sign is only confirmed correct on the formatted
 * string, not on the raw number.
 */
export function parseMoneyOrNull(valueAsString: string | undefined): number | null {
  if (!valueAsString) return null
  const trimmed = valueAsString.trim()
  if (trimmed === '') return null
  const isParenNegative = /^\$?\(.*\)$/.test(trimmed)
  const digitsOnly = trimmed.replace(/[^0-9.]/g, '')
  if (digitsOnly === '') return null
  const magnitude = Number.parseFloat(digitsOnly)
  if (Number.isNaN(magnitude)) return null
  return isParenNegative ? -magnitude : magnitude
}

/** Formats a signed dollar amount for display, e.g. `300` -> `"$300.00"`, `-500` -> `"-$500.00"`. */
export function formatMoney(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return amount < 0 ? `-$${formatted}` : `$${formatted}`
}
