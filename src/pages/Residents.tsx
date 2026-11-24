import { useEffect, useState } from 'preact/hooks'
import { Link } from 'preact-router'
import { fetchResidentBillings } from '../lib/billing.ts'
import type { ResidentBilling } from '../lib/billing.ts'
import { GqlError } from '../lib/gql.ts'
import { SignInPrompt } from '../components/SignInPrompt.tsx'
import './Residents.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: string }
  | { status: 'ready'; billings: ResidentBilling[] }

export function Residents() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetchResidentBillings()
      .then(({ billings }) => {
        if (cancelled) return
        setState({ status: 'ready', billings })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          code: err instanceof GqlError ? err.code : undefined,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div class="residents-page">
        <h2>Residents</h2>
        <p>Loading residents…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div class="residents-page">
        <h2>Residents</h2>
        {state.code === 'UNAUTHENTICATED' ? (
          <SignInPrompt />
        ) : (
          <p class="residents-error">Could not load resident data: {state.message}</p>
        )}
      </div>
    )
  }

  const { billings } = state

  if (billings.length === 0) {
    return (
      <div class="residents-page">
        <h2>Residents</h2>
        <p>No residents configured for this community yet.</p>
      </div>
    )
  }

  return (
    <div class="residents-page">
      <h2>Residents</h2>
      <div class="residents-card">
        {billings.map((billing) => (
          <Link key={billing.key} class="residents-row" href={`/residents/${billing.residentTopId}`}>
            <span class="residents-row-main">
              <span class="residents-row-name">{billing.residentName}</span>
              <span class="residents-row-room">{billing.roomName}</span>
            </span>
            <span class="residents-row-chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
