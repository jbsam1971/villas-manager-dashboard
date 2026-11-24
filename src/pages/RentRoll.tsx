import { useEffect, useState } from 'preact/hooks'
import { fetchResidentBillings } from '../lib/billing.ts'
import type { ResidentBilling } from '../lib/billing.ts'
import { formatMoney } from '../lib/formData.ts'
import { GqlError } from '../lib/gql.ts'
import { SignInPrompt } from '../components/SignInPrompt.tsx'
import './RentRoll.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: string }
  | { status: 'ready'; billings: ResidentBilling[] }

export function RentRoll() {
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
      <div class="rent-roll-page">
        <h2>Rent Roll</h2>
        <p>Loading charges…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div class="rent-roll-page">
        <h2>Rent Roll</h2>
        {state.code === 'UNAUTHENTICATED' ? (
          <SignInPrompt />
        ) : (
          <p class="rent-roll-error">Could not load rent roll data: {state.message}</p>
        )}
      </div>
    )
  }

  const { billings } = state

  if (billings.length === 0) {
    return (
      <div class="rent-roll-page">
        <h2>Rent Roll</h2>
        <p>No occupied units to bill right now.</p>
      </div>
    )
  }

  const grandTotal = billings.reduce((sum, b) => sum + b.total, 0)

  return (
    <div class="rent-roll-page">
      <h2>Rent Roll</h2>
      <div class="rent-roll-card">
        <table class="rent-roll-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Resident</th>
              <th>Charges</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {billings.map((billing) => {
              const hasCharges = billing.activeRecurringCharges.length > 0 || billing.ancillaryCharges.length > 0

              return (
                <tr key={billing.key}>
                  <td>{billing.roomName}</td>
                  <td>{billing.residentName}</td>
                  <td>
                    {!hasCharges && <span class="rent-roll-no-charges">No charges recorded</span>}
                    {billing.activeRecurringCharges.length > 0 && (
                      <ul class="rent-roll-charge-list">
                        {billing.activeRecurringCharges.map((charge, i) => (
                          <li key={`recurring-${i}`}>
                            {charge.chargeName} — {formatMoney(charge.cost)}/mo
                          </li>
                        ))}
                      </ul>
                    )}
                    {billing.ancillaryCharges.length > 0 && (
                      <ul class="rent-roll-charge-list">
                        {billing.ancillaryCharges.map((charge, i) => (
                          <li key={`ancillary-${i}`}>
                            {charge.chargeName} ({charge.date}) — {formatMoney(charge.cost)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>{formatMoney(billing.total)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} class="rent-roll-grand-total-label">
                Grand total
              </td>
              <td class="rent-roll-grand-total-value">{formatMoney(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
