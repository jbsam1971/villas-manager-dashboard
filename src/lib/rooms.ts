// Shared Demo Unit "Setup: Rooms" fetch/parse. Used by both the Occupancy
// report (task 6) and the Rent Roll report (task 7, which needs each room's
// resident topId to look up billing). Query/field ids confirmed live against
// Jen's Sandbox during task 6 — see Occupancy.tsx's git history for that
// discovery.

import { gql } from './gql.ts'
import { getField, parseIntOrNull, parseBooleanOrNull, extractTextFromHtml } from './formData.ts'
import type { FormEntryDataItem } from './formData.ts'

export const DEMO_UNIT_ID = '111000___148502'
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

const ROOMS_QUERY = `
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

interface RoomRow {
  formEntry: {
    displayName: string
    data: FormEntryDataItem[]
  }
}

interface RoomsQueryResponse {
  formEntries: {
    size: number
    totalSize: number
    rows: RoomRow[]
  }
}

export interface Room {
  key: string
  roomName: string
  /** Real resident name(s) extracted from valueAsString's link text — never the JSON displayName. */
  residentNames: string[]
  /** Parallel to residentNames; the Rent Roll report looks up billing per resident by this topId. */
  residentTopIds: string[]
  numberOfBeds: number | null
  openBeds: number | null
  residentsInRoomCount: number | null
  roomAvailable: boolean | null
}

/** The RELATIONSHIP field's `value` is already a real array (not JSON text); `[]` when vacant. */
function parseResidentTopIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (entry && typeof entry === 'object' && 'topId' in entry ? String((entry as { topId: unknown }).topId) : null))
    .filter((topId): topId is string => topId !== null)
}

function parseRoom(row: RoomRow, index: number): Room {
  const data = row.formEntry.data
  const residentsField = getField(data, LABEL_RESIDENTS)
  const roomNameValue = getField(data, LABEL_ROOM_NAME)?.value

  return {
    key: `${row.formEntry.displayName}-${index}`,
    roomName: (typeof roomNameValue === 'string' && roomNameValue) || row.formEntry.displayName || `Room ${index + 1}`,
    residentNames: extractTextFromHtml(residentsField?.valueAsString),
    residentTopIds: parseResidentTopIds(residentsField?.value),
    numberOfBeds: parseIntOrNull(getField(data, LABEL_NUMBER_OF_BEDS)?.value),
    openBeds: parseIntOrNull(getField(data, LABEL_OPEN_BEDS)?.value),
    residentsInRoomCount: parseIntOrNull(getField(data, LABEL_RESIDENTS_IN_ROOM)?.value),
    roomAvailable: parseBooleanOrNull(getField(data, LABEL_ROOM_AVAILABLE)?.value),
  }
}

/** Real numeric-aware sort — plain string sort would misorder "9" after "10". */
export function compareRoomNamesNaturally(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** Fetches every room in the Demo Unit community, parsed and naturally sorted by room name. */
export async function fetchRooms(): Promise<Room[]> {
  const data = await gql<RoomsQueryResponse>(ROOMS_QUERY, {
    formId: ROOMS_FORM_ID,
    unitId: DEMO_UNIT_ID,
    fields: FIELD_IDS,
  })
  return data.formEntries.rows
    .map((row, index) => parseRoom(row, index))
    .sort((a, b) => compareRoomNamesNaturally(a.roomName, b.roomName))
}

interface RemoteObjectResolution {
  topId: string
  record?: { baseEntry: { topId: string } }
}

interface RemoteObjectsResponse {
  remoteObjects: RemoteObjectResolution[]
}

const RESOLVE_RESIDENT_RECORDS_QUERY = `
  query($ids: [String!]!) {
    remoteObjects(ids: $ids) {
      topId
      ... on FormRowInterface { record { baseEntry { topId } } }
    }
  }
`

/**
 * `Room.residentTopIds` (the "Resident/s in room" field's `value`) is NOT the
 * resident's own record — confirmed live against Jen's Sandbox: it's the
 * topId of an "Individual Worksheet" FormRow scoped to that room assignment
 * (`remoteObject(id).displayName` reads e.g. `"Individual Worksheet: Demo
 * Unit→107"`). The resident's actual record — the one Recurring/Ancillary
 * Charges are attached to, and the one `record.baseEntry.topId` on a charge
 * row matches — is that FormRow's **owning record**, one level up.
 *
 * This resolves a batch of those worksheet-row topIds to their owning
 * record's topId in one `remoteObjects` call, returned as a
 * worksheetTopId -> residentRecordTopId map. An id that fails to resolve
 * (unexpected shape, deleted row, etc.) is simply left out of the map rather
 * than thrown — callers should treat a missing entry the same as "no billing
 * data for this room" instead of crashing the page over one bad row.
 */
export async function resolveResidentRecordTopIds(worksheetTopIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(worksheetTopIds))
  if (uniqueIds.length === 0) return new Map()

  const data = await gql<RemoteObjectsResponse>(RESOLVE_RESIDENT_RECORDS_QUERY, { ids: uniqueIds })
  const map = new Map<string, string>()
  for (const obj of data.remoteObjects) {
    const resolved = obj.record?.baseEntry?.topId
    if (resolved) map.set(obj.topId, resolved)
  }
  return map
}
