import { useEffect, useState } from 'preact/hooks'
import { Link } from 'preact-router'
import { fetchResidentBillings } from '../lib/billing.ts'
import type { ResidentBillingsResult } from '../lib/billing.ts'
import { formatBeds } from '../lib/rooms.ts'
import { formatMoney } from '../lib/formData.ts'
import { GqlError } from '../lib/gql.ts'
import { SignInPrompt } from '../components/SignInPrompt.tsx'
import { ChargeBreakdown } from '../components/ChargeBreakdown.tsx'
import './ResidentRecord.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: string }
  | { status: 'ready'; result: ResidentBillingsResult }

// `preact-router` passes matched path params (e.g. `:id`) as props on the
// routed component. `id` is typed optional since the router's own typing
// doesn't guarantee it's present, but in practice it always is when this
// component is reached via the `/residents/:id` route.
export function ResidentRecord({ id }: { id?: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetchResidentBillings()
      .then((result) => {
        if (cancelled) return
        setState({ status: 'ready', result })
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
      <div class="resident-record-page">
        <h2>Resident</h2>
        <p>Loading resident…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div class="resident-record-page">
        <h2>Resident</h2>
        {state.code === 'UNAUTHENTICATED' ? (
          <SignInPrompt />
        ) : (
          <p class="resident-record-error">Could not load resident data: {state.message}</p>
        )}
      </div>
    )
  }

  const { rooms, billings } = state.result
  const billing = billings.find((b) => b.residentTopId === id)

  if (!billing) {
    return (
      <div class="resident-record-page">
        <h2>Resident not found</h2>
        <p class="resident-record-not-found">
          We couldn't find a resident matching this link — they may have moved out, or the link may
          be out of date.
        </p>
        <Link class="resident-record-back-link" href="/residents">
          Back to Residents
        </Link>
      </div>
    )
  }

  const room = rooms.find((r) => r.roomName === billing.roomName)

  return (
    <div class="resident-record-page">
      <div class="resident-record-header-card">
        <h2 class="resident-record-name">{billing.residentName}</h2>
        <p class="resident-record-meta">
          <span>{billing.roomName}</span>
          {room && <span> · {formatBeds(room)}</span>}
        </p>
      </div>
      <div class="resident-record-billing-card">
        <h3>Billing</h3>
        <div class="resident-record-charges">
          <ChargeBreakdown billing={billing} />
        </div>
        <div class="resident-record-total">
          <span class="resident-record-total-label">Total</span>
          <span class="resident-record-total-value">{formatMoney(billing.total)}</span>
        </div>
      </div>
    </div>
  )
}
