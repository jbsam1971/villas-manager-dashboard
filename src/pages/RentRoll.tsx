import { useEffect, useState } from 'preact/hooks'
import { gql } from '../lib/gql.ts'
import { DEMO_UNIT_ID, fetchRooms, resolveResidentRecordTopIds } from '../lib/rooms.ts'
import type { Room } from '../lib/rooms.ts'
import { getField, extractTextFromHtml, parseMoneyOrNull, formatMoney } from '../lib/formData.ts'
import type { FormEntryDataItem } from '../lib/formData.ts'
import './RentRoll.css'

// Multi-entry billing forms on each resident's record, confirmed live against
// Jen's Sandbox for this task (see this task's summary). Both forms are
// scoped by `unitId` the same way Setup: Rooms is in lib/rooms.ts.
const RECURRING_FORM_ID = '1000001__FID_recurringCharges'
const ANCILLARY_FORM_ID = '1000001__FID_ancillaryCharges'

const LABEL_CHARGE = 'Charge'
const LABEL_COST = 'Cost'
const LABEL_STATUS = 'Status'
const LABEL_CHARGE_DATE = 'Charge Date'

// Recurring Charges form: the RELATIONSHIP "Charge" field (link text is the
// real charge name; the JSON value's displayName is not), the NUMBER "Cost"
// field (parsed from valueAsString — see parseMoneyOrNull), and the BOOLEAN
// "Status" field (true = current/active row; false = historical/superseded —
// confirmed empirically, not guessed. Only `=== true` rows count.).
const RECURRING_FIELD_IDS = [
  '1000101___2185597', // Charge (RELATIONSHIP)
  '1000101___2080076', // Cost (NUMBER)
  '1000101___2386443', // Status (BOOLEAN)
]

// Ancillary Charges form: a DATE "Charge Date", a plain TEXT "Charge" field
// (id 1000101___2261548 — deliberately NOT the other RELATIONSHIP field also
// labeled "Charge" on this form; that field's id is simply never requested
// here, so there is no label collision in the response), and a NUMBER "Cost".
// This org's ancillary data is sparse/one-time billing with no active flag —
// every row for a resident is listed, never filtered by date.
const ANCILLARY_FIELD_IDS = [
  '1000101___2261533', // Charge Date (DATE)
  '1000101___2261548', // Charge (TEXT, plain string)
  '1000101___2261547', // Cost (NUMBER)
]

const CHARGES_QUERY = `
  query($formId: String!, $unitId: String, $fields: [String!]) {
    formEntries(formId: $formId, unitId: $unitId, count: 100) {
      rows {
        formEntry {
          record { baseEntry { topId } }
          data(fields: $fields) { name value valueAsString }
        }
      }
    }
  }
`

interface ChargeRow {
  formEntry: {
    record: { baseEntry: { topId: string } }
    data: FormEntryDataItem[]
  }
}

interface ChargesQueryResponse {
  formEntries: {
    rows: ChargeRow[]
  }
}

interface RecurringCharge {
  residentTopId: string
  chargeName: string
  cost: number
  /** true = current/active row; false = historical/superseded. Only true rows bill. */
  active: boolean
}

interface AncillaryCharge {
  residentTopId: string
  date: string
  chargeName: string
  cost: number
}

function parseRecurringCharge(row: ChargeRow): RecurringCharge {
  const data = row.formEntry.data
  const chargeField = getField(data, LABEL_CHARGE)
  const costField = getField(data, LABEL_COST)
  const statusField = getField(data, LABEL_STATUS)

  return {
    residentTopId: row.formEntry.record.baseEntry.topId,
    chargeName: extractTextFromHtml(chargeField?.valueAsString)[0] ?? 'Charge',
    cost: parseMoneyOrNull(costField?.valueAsString) ?? 0,
    // Status's `value` is a native boolean — compare `=== true`, never a string compare.
    active: statusField?.value === true,
  }
}

function parseAncillaryCharge(row: ChargeRow): AncillaryCharge {
  const data = row.formEntry.data
  const dateField = getField(data, LABEL_CHARGE_DATE)
  const chargeField = getField(data, LABEL_CHARGE)
  const costField = getField(data, LABEL_COST)
  const chargeValue = chargeField?.value

  return {
    residentTopId: row.formEntry.record.baseEntry.topId,
    date: dateField?.valueAsString ?? '',
    // This "Charge" field is plain TEXT (no HTML to strip) — use `value` directly.
    chargeName: (typeof chargeValue === 'string' && chargeValue) || chargeField?.valueAsString || 'Charge',
    cost: parseMoneyOrNull(costField?.valueAsString) ?? 0,
  }
}

function groupByResident<T extends { residentTopId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const list = map.get(item.residentTopId)
    if (list) {
      list.push(item)
    } else {
      map.set(item.residentTopId, [item])
    }
  }
  return map
}

interface ResidentBilling {
  key: string
  roomName: string
  residentName: string
  activeRecurringCharges: RecurringCharge[]
  ancillaryCharges: AncillaryCharge[]
  total: number
}

function buildResidentBillings(
  rooms: Room[],
  recurringByResident: Map<string, RecurringCharge[]>,
  ancillaryByResident: Map<string, AncillaryCharge[]>,
  residentRecordTopIds: Map<string, string>
): ResidentBilling[] {
  const billings: ResidentBilling[] = []

  rooms
    .filter((room) => room.residentTopIds.length > 0)
    .forEach((room) => {
      room.residentTopIds.forEach((topId, index) => {
        const residentName = room.residentNames[index] ?? room.residentNames[0] ?? `Resident ${index + 1}`
        // `topId` here is the "Individual Worksheet" row the room assignment
        // points at, NOT the resident's own record — resolve it first (see
        // resolveResidentRecordTopIds's doc comment). A room whose worksheet
        // row didn't resolve (unexpected shape) falls back to `topId` itself,
        // which simply won't match any charge and renders as "no charges" —
        // the same safe behavior as a resident with genuinely no billing.
        const residentRecordTopId = residentRecordTopIds.get(topId) ?? topId
        const activeRecurringCharges = (recurringByResident.get(residentRecordTopId) ?? []).filter((c) => c.active)
        const ancillaryCharges = ancillaryByResident.get(residentRecordTopId) ?? []
        const activeRecurringTotal = activeRecurringCharges.reduce((sum, c) => sum + c.cost, 0)
        const ancillaryTotal = ancillaryCharges.reduce((sum, c) => sum + c.cost, 0)

        billings.push({
          key: `${room.key}-${topId}`,
          roomName: room.roomName,
          residentName,
          activeRecurringCharges,
          ancillaryCharges,
          total: activeRecurringTotal + ancillaryTotal,
        })
      })
    })

  return billings
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; billings: ResidentBilling[] }

export function RentRoll() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    Promise.all([
      fetchRooms(),
      gql<ChargesQueryResponse>(CHARGES_QUERY, {
        formId: RECURRING_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: RECURRING_FIELD_IDS,
      }),
      gql<ChargesQueryResponse>(CHARGES_QUERY, {
        formId: ANCILLARY_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: ANCILLARY_FIELD_IDS,
      }),
    ])
      .then(async ([rooms, recurringData, ancillaryData]) => {
        if (cancelled) return
        const occupiedWorksheetTopIds = rooms.flatMap((room) => room.residentTopIds)
        const residentRecordTopIds = await resolveResidentRecordTopIds(occupiedWorksheetTopIds)
        if (cancelled) return
        const recurringByResident = groupByResident(recurringData.formEntries.rows.map(parseRecurringCharge))
        const ancillaryByResident = groupByResident(ancillaryData.formEntries.rows.map(parseAncillaryCharge))
        const billings = buildResidentBillings(rooms, recurringByResident, ancillaryByResident, residentRecordTopIds)
        setState({ status: 'ready', billings })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
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
        <p class="rent-roll-error">Could not load rent roll data: {state.message}</p>
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
  )
}
