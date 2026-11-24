// Shared /gql client helper for the manager dashboard SPA.
//
// Per bluestep-reference's git-site-spa.md, a Git Site's data surface is
// same-origin at runtime: a session-authenticated GraphQL API at `/gql`
// (cookie auth), with the CSRF token read from the `B6P-CSRF-TOKEN` response
// header of a request to `/csrf-token`. This project is read-only in v1 (no
// mutations — see requirements.md's Out of scope), but every call still
// carries the CSRF header so a future mutation can reuse `gql()` unchanged.

interface GqlErrorEntry {
  message: string
  extensions?: { code?: string; [key: string]: unknown }
  [key: string]: unknown
}

interface GqlResponseBody<T> {
  data?: T
  errors?: GqlErrorEntry[]
}

/**
 * Thrown by `gql()` on a GraphQL-level error. `code` is the first error
 * entry's `extensions.code` (e.g. `"UNAUTHENTICATED"`) when present, so
 * callers can show a sign-in prompt for that case instead of raw error text.
 */
export class GqlError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'GqlError'
    this.code = code
  }
}

let cachedCsrfToken: string | null = null
let inFlightCsrfToken: Promise<string> | null = null

async function requestCsrfToken(): Promise<string> {
  // HEAD is the lighter request; fall back to GET if the endpoint rejects it.
  // Not yet confirmed live which method /csrf-token actually supports — see
  // this task's summary for the flag to a human reviewer.
  let response = await fetch('/csrf-token', {
    method: 'HEAD',
    credentials: 'same-origin',
  })

  if (response.status === 405) {
    response = await fetch('/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
    })
  }

  const token = response.headers.get('B6P-CSRF-TOKEN')
  if (!token) {
    throw new Error(
      `Could not read a B6P-CSRF-TOKEN header from /csrf-token (status ${response.status}).`
    )
  }
  return token
}

/**
 * Fetches the CSRF token from `/csrf-token`, caching it in module scope so a
 * page session fetches it once rather than once per query. A failed fetch is
 * not cached, so the next call retries.
 */
export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken
  }
  if (!inFlightCsrfToken) {
    inFlightCsrfToken = requestCsrfToken()
      .then((token) => {
        cachedCsrfToken = token
        return token
      })
      .finally(() => {
        inFlightCsrfToken = null
      })
  }
  return inFlightCsrfToken
}

function clearCachedCsrfToken(): void {
  cachedCsrfToken = null
}

async function postGql(query: string, variables: Record<string, unknown> | undefined, token: string): Promise<Response> {
  return fetch('/gql', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'B6P-CSRF-TOKEN': token,
    },
    body: JSON.stringify({ query, variables }),
  })
}

/**
 * Typed thin wrapper around the session-authenticated `/gql` GraphQL
 * endpoint. Resolves with the `data` payload on success; throws a single
 * `Error` (the GraphQL `errors` array's messages, joined) on failure, so
 * callers get either `data` or a thrown error and never have to check an
 * `errors` array themselves.
 */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await getCsrfToken()
  let response = await postGql(query, variables, token)

  if (response.status === 403) {
    // Per bluestep-reference's gql-in-a-tab.md: a 403 here usually means a
    // missing/stale CSRF token rather than a GraphQL-level error. Refresh the
    // token once and retry before giving up.
    clearCachedCsrfToken()
    const freshToken = await getCsrfToken()
    response = await postGql(query, variables, freshToken)
  }

  let body: GqlResponseBody<T>
  try {
    body = (await response.json()) as GqlResponseBody<T>
  } catch {
    throw new Error(`/gql returned a non-JSON response (status ${response.status} ${response.statusText}).`)
  }

  if (body.errors && body.errors.length > 0) {
    throw new GqlError(body.errors.map((e) => e.message).join('; '), body.errors[0]?.extensions?.code)
  }

  if (body.data === undefined) {
    throw new Error(`/gql returned no data and no errors (status ${response.status}).`)
  }

  return body.data
}
