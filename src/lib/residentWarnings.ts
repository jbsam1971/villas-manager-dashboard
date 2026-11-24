// Real "Residents to watch" data: BlueStep's own auto-generated clinical
// warnings (form `1000001__FID_clientDashWarn`, "Resident Dashboard
// Warnings") — confirmed live against Jen's Sandbox this session: real
// entries like "High Resp Rate" / "Low O2" / "Low BP" / "Low Glucose", one
// row per flagged reading, each linked to a resident via the same
// `record.baseEntry.topId` key billing.ts/residentProfile.ts already resolve
// through `resolveResidentRecordTopIds`.
//
// Honest scope note: the mockup's "Last assessed" column has no real
// equivalent confirmed in this org (no generic "assessment" event exists on
// the forms checked so far) — this uses the most recent warning's own `Date`
// field instead, which is a genuine date tied to why the resident is
// flagged, not a fabricated "assessment" date. "Care level" similarly has no
// confirmed field yet, so it's left blank rather than invented.

import { gql } from './gql.ts'
import { DEMO_UNIT_ID, fetchRooms, resolveResidentRecordTopIds } from './rooms.ts'
import { getField } from './formData.ts'
import type { FormEntryDataItem } from './formData.ts'

const WARNINGS_FORM_ID = '1000001__FID_clientDashWarn'
const LABEL_DATE = 'Date'
const LABEL_SHORT_WARNING = 'Short Warning'

const WARNINGS_QUERY = `
  query($formId: String!, $unitId: String) {
    formEntries(formId: $formId, unitId: $unitId, count: 100) {
      rows {
        formEntry {
          record { baseEntry { topId } }
          data { name valueAsString }
        }
      }
    }
  }
`

interface WarningRow {
  formEntry: {
    record: { baseEntry: { topId: string } }
    data: FormEntryDataItem[]
  } | null
}

interface WarningsQueryResponse {
  formEntries: {
    rows: WarningRow[]
  }
}

/** `MM/DD/YYYY` (the only date shape confirmed live for this field) → Date, or null if unparseable. */
function parseUsDate(value: string | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value)
  if (!match) return null
  const [, month, day, year] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface ResidentToWatch {
  /** The route id this app already uses for a resident (the worksheet row topId). */
  residentTopId: string
  name: string
  room: string
  /** Real "Short Warning" texts from BlueStep's own generated warnings for this resident. */
  signals: string[]
  /** The most recent warning's own Date — see this file's header comment on what this does and doesn't mean. */
  lastWarningDate: string | null
  /** True when the most recent warning is more than 30 days old (a judgment-call threshold, not platform data). */
  overdue: boolean
}

/**
 * Residents with at least one active BlueStep dashboard warning, newest
 * warning first per resident. Only residents with a warning are returned —
 * this mirrors the original mockup's "flagged" framing, not a full roster.
 */
export async function fetchResidentsToWatch(): Promise<ResidentToWatch[]> {
  const rooms = await fetchRooms()
  const occupiedWorksheetTopIds = rooms.flatMap((room) => room.residentTopIds)
  const residentRecordTopIds = await resolveResidentRecordTopIds(occupiedWorksheetTopIds)

  const warningsData = await gql<WarningsQueryResponse>(WARNINGS_QUERY, {
    formId: WARNINGS_FORM_ID,
    unitId: DEMO_UNIT_ID,
  })

  const warningsByResident = new Map<string, { shortWarning: string; date: Date | null }[]>()
  for (const row of warningsData.formEntries.rows) {
    const residentId = row.formEntry?.record?.baseEntry?.topId
    if (!residentId || !row.formEntry) continue
    const shortWarning = getField(row.formEntry.data, LABEL_SHORT_WARNING)?.valueAsString
    if (!shortWarning) continue
    const date = parseUsDate(getField(row.formEntry.data, LABEL_DATE)?.valueAsString)
    const list = warningsByResident.get(residentId) ?? []
    list.push({ shortWarning, date })
    warningsByResident.set(residentId, list)
  }

  const now = new Date()
  const results: ResidentToWatch[] = []

  rooms.forEach((room) => {
    room.residentTopIds.forEach((worksheetTopId, index) => {
      const residentRecordTopId = residentRecordTopIds.get(worksheetTopId) ?? worksheetTopId
      const warnings = warningsByResident.get(residentRecordTopId)
      if (!warnings || warnings.length === 0) return

      // Newest first, so [0] is the most recent warning.
      warnings.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
      const latest = warnings[0]
      const daysSinceLatest = latest.date ? Math.floor((now.getTime() - latest.date.getTime()) / 86_400_000) : null

      results.push({
        residentTopId: worksheetTopId,
        name: room.residentNames[index] ?? room.residentNames[0] ?? `Resident ${index + 1}`,
        room: room.roomName,
        signals: warnings.map((w) => w.shortWarning),
        lastWarningDate: latest.date ? formatDate(latest.date) : null,
        overdue: daysSinceLatest === null || daysSinceLatest > 30,
      })
    })
  })

  return results
}
