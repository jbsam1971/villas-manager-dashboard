import type { ResidentBilling } from '../lib/billing.ts'
import { formatMoney } from '../lib/formData.ts'

export function ChargeBreakdown({ billing }: { billing: ResidentBilling }) {
  const hasCharges = billing.activeRecurringCharges.length > 0 || billing.ancillaryCharges.length > 0

  return (
    <>
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
    </>
  )
}
