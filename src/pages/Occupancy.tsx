import { useEffect, useState } from 'preact/hooks'
import { gql } from '../lib/gql.ts'
import './Occupancy.css'

// Demo Unit community + the "Setup: Rooms" multi-entry form, confirmed live
// against Jen's Sandbox (see this task's summary). Rent Roll (task 7) reuses
// the same unit/form ids and the resident topId captured below.
const DEMO_UNIT_ID = '111000___148502'
const ROOMS_FORM_ID = '1000001__FID_rooms'

const LABEL_ROOM_NAME = 'Room Name'
const LABEL_RESIDENTS = 'Resident/s in room'
const LABEL_NUMBER_OF_BEDS = 'Number of Beds'
const LABEL_OPEN_BEDS = '# Open Beds'
const LABEL_RESIDENTS_IN_ROOM = '# Residents in Room'
const LABEL_ROOM_AVAILABLE = 'Room Available'

const FIELD_IDS = [
  '1000101___2196517', // Room Name
  '1000101___2195672', // Resident/s in room
  '1000101___2109128', // Number of Beds
  '1000101__GID_26672850', // # Open Beds
  '1000101__GID_2672849', // # Residents in Room
  '1000101___2195689', // Room Available
]

const OCCUPANCY_QUERY = `
  query($formId: String!, $unitId: String, $fields: [String!]) {
    formEntries(formId: $formId, unitId: $unitId, count: 100) {
      size
      totalSize
      rows {
        formEntry {
          displayName
          data(fields: $fields) { name value valueAsString }
        }
      }
    }
  }
`

interface FormEntryDataItem {
  name: string
  /**
   * The `/gql` JSON scalar: arrives as the field's *native* JS type, not a
   * string to re-parse — a NUMBER field is a real `number`, a BOOLEAN a real
   * `boolean`, and the resident RELATIONSHIP field an already-parsed array of
   * `{topId, id, displayName}` objects. Confirmed live against Jen's Sandbox;
   * calling `JSON.parse()` on this throws (it isn't a string) and silently
   * swallows every resident/bed/availability value.
   */
  value: unknown
  valueAsString: string
}

interface FormEntryRow {
  formEntry: {
    displayName: string
    data: FormEntryDataItem[]
  }
}

interface OccupancyQueryResponse {
  formEntries: {
    size: number
    totalSize: number
    rows: FormEntryRow[]
  }
}

interface Room {
  key: string
  roomName: string
  /** Real resident name(s) extracted from valueAsString's link text — never the JSON displayName. */
  residentNames: string[]
  /** Kept for task 7 (Rent Roll), which looks up billing per resident topId. */
  residentTopIds: string[]
  numberOfBeds: number | null
  openBeds: number | null
  residentsInRoomCount: number | null
  roomAvailable: boolean | null
}

function getField(data: FormEntryDataItem[], label: string): FormEntryDataItem | undefined {
  return data.find((item) => item.name === label)
}

function parseIntOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  if (typeof value === 'string' && value !== '') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

function parseBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

/** The RELATIONSHIP field's `value` is already a real array (not JSON text); `[]` when vacant. */
function parseResidentTopIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (entry && typeof entry === 'object' && 'topId' in entry ? String((entry as { topId: unknown }).topId) : null))
    .filter((topId): topId is string => topId !== null)
}

/**
 * `valueAsString` for the resident relationship field is an HTML string whose
 * link text is the resident's real display name (the JSON `value`'s
 * `displayName` is an internal worksheet label, not a person's name — never
 * use that one). Extracted by reading `.textContent` off a detached element,
 * never by rendering the HTML string directly.
 */
function extractResidentNames(valueAsString: string | undefined): string[] {
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

function parseRoom(row: FormEntryRow, index: number): Room {
  const data = row.formEntry.data
  const residentsField = getField(data, LABEL_RESIDENTS)

  const roomNameValue = getField(data, LABEL_ROOM_NAME)?.value

  return {
    key: `${row.formEntry.displayName}-${index}`,
    roomName: (typeof roomNameValue === 'string' && roomNameValue) || row.formEntry.displayName || `Room ${index + 1}`,
    residentNames: extractResidentNames(residentsField?.valueAsString),
    residentTopIds: parseResidentTopIds(residentsField?.value),
    numberOfBeds: parseIntOrNull(getField(data, LABEL_NUMBER_OF_BEDS)?.value),
    openBeds: parseIntOrNull(getField(data, LABEL_OPEN_BEDS)?.value),
    residentsInRoomCount: parseIntOrNull(getField(data, LABEL_RESIDENTS_IN_ROOM)?.value),
    roomAvailable: parseBooleanOrNull(getField(data, LABEL_ROOM_AVAILABLE)?.value),
  }
}

/** Real numeric-aware sort — plain string sort would misorder "9" after "10". */
function compareRoomNamesNaturally(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function formatBeds(room: Room): string {
  const { numberOfBeds, openBeds } = room
  if (numberOfBeds === null && openBeds === null) return 'Bed count unavailable'
  if (numberOfBeds === null) return `${openBeds} bed(s) open`
  if (openBeds === null) return `? of ${numberOfBeds} beds open`
  return `${openBeds} of ${numberOfBeds} beds open`
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rooms: Room[] }

export function Occupancy() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    gql<OccupancyQueryResponse>(OCCUPANCY_QUERY, {
      formId: ROOMS_FORM_ID,
      unitId: DEMO_UNIT_ID,
      fields: FIELD_IDS,
    })
      .then((data) => {
        if (cancelled) return
        const rooms = data.formEntries.rows
          .map((row, index) => parseRoom(row, index))
          .sort((a, b) => compareRoomNamesNaturally(a.roomName, b.roomName))
        setState({ status: 'ready', rooms })
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
      <div class="occupancy-page">
        <h2>Occupancy</h2>
        <p>Loading rooms…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div class="occupancy-page">
        <h2>Occupancy</h2>
        <p class="occupancy-error">Could not load occupancy data: {state.message}</p>
      </div>
    )
  }

  const { rooms } = state

  if (rooms.length === 0) {
    return (
      <div class="occupancy-page">
        <h2>Occupancy</h2>
        <p>No rooms configured for this community yet.</p>
      </div>
    )
  }

  const occupiedCount = rooms.filter((room) => room.residentNames.length > 0).length

  return (
    <div class="occupancy-page">
      <h2>Occupancy</h2>
      <p class="occupancy-summary">
        {occupiedCount} of {rooms.length} rooms occupied
      </p>
      <table class="occupancy-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Status</th>
            <th>Resident(s)</th>
            <th>Beds</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const occupied = room.residentNames.length > 0
            // Room Available is expected to be the opposite of "occupied"; flag it
            // rather than hide it when the recorded field disagrees with the
            // derived occupancy (per task spec's edge case).
            const mismatch = room.roomAvailable !== null && room.roomAvailable === occupied

            return (
              <tr key={room.key}>
                <td>{room.roomName}</td>
                <td>
                  <span class={occupied ? 'status-occupied' : 'status-vacant'}>
                    {occupied ? 'Occupied' : 'Vacant'}
                  </span>
                  {mismatch && (
                    <span class="status-mismatch">
                      {' '}
                      (Room Available field says {room.roomAvailable ? 'available' : 'not available'})
                    </span>
                  )}
                </td>
                <td>{occupied ? room.residentNames.join(', ') : '—'}</td>
                <td>{formatBeds(room)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
