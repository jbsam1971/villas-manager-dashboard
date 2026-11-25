// Real BlueStep data layer for the eMAR med-pass page (EmarMedPass.tsx),
// replacing src/lib/placeholders/emar.ts's 100%-sample resident/med data.
// Confirmed live against Jen's Sandbox (U142196), Demo Unit `111000___148502`,
// 2026-11-25. Does NOT touch placeholders/emar.ts, which stays as-is for
// reference/history.
//
// ARCHITECTURE — read this before changing anything below:
//
// 1. BlueStep pre-creates one MAR row per resident, per medication, per
//    scheduled admin time, per day — including FUTURE days (confirmed: real
//    rows exist dated two days ahead of "today"). "Today's med pass" is
//    therefore not a distinct query — it's every MAR row for the unit whose
//    Creation Date matches today, filtered client-side. There is no
//    `createFormRow` in this feature: charting a dose is always
//    `updateFormRow` against an existing pre-created row.
//
// 2. *** THE COLUMN-NAME GOTCHA *** `formEntries(...).data(fields: [...])`'s
//    returned item's `.name` is the field's COLUMN NAME, not its label.
//    These are usually identical, which is why nothing broke before — but on
//    this very form, the "Qty Admin" field's `describe_form` label is
//    literally not what a live read returns in `data[].name`
//    ("Quantity Administered"). Always match `getField(data, X)`'s `X`
//    against a column name confirmed by a live read (see the per-field
//    comments below), never blindly against a schema tool's `label`.
//
// 3. SCOPE CUTS for this pass (deliberate, do not try to fix — see the
//    task's own notes): no controlled-substance/witness flagging on real
//    data (that classification lives on the Medications form and isn't
//    joined here, so every real dose skips the witness step); no "looks
//    like" pill description; no real vitals numeric threshold rule (real
//    data only says a dose NEEDS vitals recorded, not what the hold rule is).
//    Also no DOB/care-level/allergy/swallow/24-hour-alert data — none of
//    that is sourced from the MAR form or rooms.ts, and reading the
//    resident's full record to backfill it is out of scope for this pass.
//    EmarMedPass.tsx hides those UI bits when the data is empty rather than
//    fabricating placeholder clinical values.

import { gql, GqlError } from './gql.ts'
import { DEMO_UNIT_ID, fetchRooms, resolveResidentRecordTopIds } from './rooms.ts'
import { getField, getOptionText, extractTextFromHtml } from './formData.ts'
import type { FormEntryDataItem } from './formData.ts'
import type { SignatureRecord } from './placeholders/signatures.ts'

const MAR_FORM_ID = '1000001___1115023'

// Confirmed live field ids + the exact `data[].name` (columnName) each one
// returns — see the gotcha above. Comments show the schema tool's `label`
// only where it differs from the columnName actually seen live.
const FIELD_CREATION_DATE = '1000101___199797' // "Creation Date"
const FIELD_SCHED_ADMIN_TIME = '1000101___199799' // "Sched Admin Time"
const FIELD_MEDICATION = '1000101___2197663' // "Medication" (RELATIONSHIP)
const FIELD_DOSAGE = '1000101___199801' // "Dosage"
const FIELD_RT_OF_ADMIN = '1000101___2245847' // "Rt of Admin"
const FIELD_DATE_TIME_ADMINISTERED = '1000101___199803' // "Date/Time Administered"
const FIELD_EXCEPTION = '1000101___2200798' // "Exception"
const FIELD_INSTRUCTIONS = '1000101___199807' // "Instructions"
const FIELD_NOTES = '1000101___226800' // "Notes"
const FIELD_QUANTITY_ADMINISTERED = '1000101___2606751' // label "Qty Admin", columnName "Quantity Administered"
const FIELD_RECORD_VITALS = '1000101___2203765' // "Record Vitals"

const FIELD_IDS = [
  FIELD_CREATION_DATE,
  FIELD_SCHED_ADMIN_TIME,
  FIELD_MEDICATION,
  FIELD_DOSAGE,
  FIELD_RT_OF_ADMIN,
  FIELD_DATE_TIME_ADMINISTERED,
  FIELD_EXCEPTION,
  FIELD_INSTRUCTIONS,
  FIELD_NOTES,
  FIELD_QUANTITY_ADMINISTERED,
  FIELD_RECORD_VITALS,
]

// The MAR form has 174,000+ total rows across every past and future day (confirmed live) — far too
// many to page through and filter client-side (an earlier version of this query did exactly that
// with a flat count:500 and silently found zero rows for today, since today's ~70 rows are a tiny
// fraction of the total and aren't guaranteed to be anywhere near the front of an unfiltered
// result). Filter server-side on Creation Date instead, confirmed live: `QueryFilterInput.value`
// wants `MM/DD/YYYY` (matches the bluestep-reference date-format.md gotcha for addSearch; `YYYY/MM/DD`
// silently fails here too, untested but assumed consistent) and a `>=` / `<` pair across midnight
// boundaries correctly narrows to exactly one day (confirmed: 68 rows for 11/25/2026 vs 174,679 total).
const MAR_QUERY = `
  query($formId: String!, $unitId: String, $fields: [String!], $filter: [QueryFilterInput!]) {
    formEntries(formId: $formId, unitId: $unitId, count: 500, filter: $filter) {
      size
      totalSize
      rows {
        formEntry {
          id
          topId
          rowVersion
          record { baseEntry { topId } }
          data(fields: $fields) { name value valueAsString }
        }
      }
    }
  }
`

/** `MM/DD/YYYY`, zero-padded — the exact format `QueryFilterInput.value` requires for a DATE field (confirmed live). */
function formatDateForFilter(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${date.getFullYear()}`
}

interface MarRow {
  formEntry: {
    id: string
    topId: string
    rowVersion: number
    record: { baseEntry: { topId: string } }
    data: FormEntryDataItem[]
  }
}

interface MarQueryResponse {
  formEntries: {
    size: number
    totalSize: number
    rows: MarRow[]
  }
}

const UPDATE_MAR_ROW_MUTATION = `
  mutation($id: String!, $v: JSON!, $ver: Int) {
    updateFormRow(id: $id, fieldValues: $v, expectedVersion: $ver) { id rowVersion }
  }
`

interface UpdateFormRowResponse {
  updateFormRow: { id: string; rowVersion: number }
}

// --- Shapes consumed by EmarMedPass.tsx -------------------------------------
//
// Kept close to placeholders/emar.ts's EmarResident/ScheduledMed/PrnMed so
// the page's existing JSX mostly keeps working, with real-data-only
// additions (rowId identity for charting, the real Sched Admin Time/Route
// text, which vitals are needed) and the documented scope cuts reflected as
// empty/null rather than fabricated.

export type MedFlagTone = 'risk' | 'warn' | 'cs' | 'neutral'

export interface MedFlag {
  text: string
  tone: MedFlagTone
}

export interface ScheduledMed {
  /** The MAR row's own id — same value as its topId. This IS the chartable unit; pass straight to chartDose(). */
  id: string
  rowVersion: number
  name: string
  dose: string
  /** The real, pre-composed "Instructions" sentence, e.g. "Administer 1 Tablet (1 MG) Oral (PO) at Bedtime". */
  sig: string
  /** Not available from documented real-data sources on this form — left blank rather than fabricated. */
  reason: string
  /** "Looks like" pill text doesn't exist in real data — always blank; the page hides this when blank. */
  looks: string
  needsVitals: boolean
  /** e.g. ["Blood Pressure", "Heart Rate"] when needsVitals — which real vitals this dose's gate asks for. */
  vitalsNeeded: string[]
  /** Always [] for real data — no CS/late-dose/hold-threshold flagging is joined in this pass (see scope cuts). */
  flags: MedFlag[]
  schedAdminTime: string | null
  routeOfAdmin: string | null
  /** Non-null when this row already has a Date/Time Administered value on load (charted earlier, by anyone). */
  alreadyCharted: {
    status: 'given' | 'refused' | 'held'
    at: string
    exceptionText: string | null
  } | null
}

export interface PrnMed {
  name: string
  dose: string
  sig: string
  last: string
  ok: boolean
}

export interface EmarResident {
  key: string
  residentTopId: string
  initials: string
  full: string
  name: string
  room: string
  dob: string
  level: string
  allergies: string
  swallow: string
  alerts: string
  /** Derived from pending meds' Record Vitals field — `need` only; no real reading/threshold exists (see scope cuts). */
  vitals: { need: string } | null
  meds: ScheduledMed[]
  /** Always [] — the real MAR data has no documented way to distinguish a PRN row from a scheduled one in this pass. */
  prns: PrnMed[]
}

export interface TodaysMedPassResult {
  residents: EmarResident[]
}

// --- Parsing helpers ---------------------------------------------------------

interface RawBsDate {
  year: number
  month: number // 0-indexed, confirmed live
  dayOfMonth: number
}

function isRawBsDate(value: unknown): value is RawBsDate {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RawBsDate).year === 'number' &&
    typeof (value as RawBsDate).month === 'number' &&
    typeof (value as RawBsDate).dayOfMonth === 'number'
  )
}

function isSameLocalDay(value: unknown, now: Date): boolean {
  if (!isRawBsDate(value)) return false
  // JS's own Date.getMonth() is also 0-indexed, so this compares directly —
  // no re-indexing needed on either side.
  return value.year === now.getFullYear() && value.month === now.getMonth() && value.dayOfMonth === now.getDate()
}

/** The Medications form's row displayName is e.g. "Medications: Gabapentin 100mg" — strip that prefix if present. */
function stripMedicationsPrefix(name: string): string {
  const prefix = 'Medications: '
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

function parseMedicationName(field: FormEntryDataItem | undefined): string {
  const names = extractTextFromHtml(field?.valueAsString)
  const first = names[0]
  return first ? stripMedicationsPrefix(first) : 'Medication'
}

/** "Refused" / "Med on hold" / etc -> our own 3-way status. A guess (not specified by the live schema discovery):
 *  anything except "Med on hold" is treated as a refusal-type exception for display purposes. */
function statusFromExceptionText(exceptionText: string | null): 'given' | 'refused' | 'held' {
  if (!exceptionText) return 'given'
  if (exceptionText === 'Med on hold') return 'held'
  return 'refused'
}

function parseScheduledMed(row: MarRow): ScheduledMed {
  const data = row.formEntry.data
  const administeredField = getField(data, 'Date/Time Administered')
  const exceptionText = getOptionText(getField(data, 'Exception'))
  const vitalsText = getOptionText(getField(data, 'Record Vitals'))
  const vitalsNeeded = vitalsText ? vitalsText.split(', ') : []
  const administeredAt = administeredField?.valueAsString ?? null

  return {
    id: row.formEntry.id,
    rowVersion: row.formEntry.rowVersion,
    name: parseMedicationName(getField(data, 'Medication')),
    dose: getField(data, 'Dosage')?.valueAsString ?? '',
    sig: getField(data, 'Instructions')?.valueAsString ?? '',
    reason: '',
    looks: '',
    needsVitals: vitalsNeeded.length > 0,
    vitalsNeeded,
    flags: [],
    schedAdminTime: getOptionText(getField(data, 'Sched Admin Time')),
    routeOfAdmin: getOptionText(getField(data, 'Rt of Admin')),
    alreadyCharted:
      administeredField?.value != null && administeredAt
        ? { status: statusFromExceptionText(exceptionText), at: administeredAt, exceptionText }
        : null,
  }
}

function initialsFromFullName(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** "James Whitehorse" -> "J. Whitehorse" — matches placeholders/emar.ts's abbreviated display name convention. */
function abbreviateName(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return fullName
  const last = parts[parts.length - 1]
  return `${parts[0][0]}. ${last}`
}

/**
 * Fetches today's real med pass for the Demo Unit: resolves the unit's real
 * residents via rooms.ts's fetchRooms() -> resolveResidentRecordTopIds()
 * two-step (same pattern as residentProfile.ts/billing.ts), fetches MAR rows
 * for the unit, filters client-side to rows whose Creation Date is today and
 * whose owning record is one of the unit's real residents, then groups them
 * per resident.
 *
 * "Today" is computed from `new Date()` at call time, never hardcoded.
 */
export async function fetchTodaysMedPass(): Promise<TodaysMedPassResult> {
  const rooms = await fetchRooms()
  const occupiedRooms = rooms.filter((room) => room.residentTopIds.length > 0)
  const worksheetTopIds = occupiedRooms.flatMap((room) => room.residentTopIds)
  const residentRecordTopIds = await resolveResidentRecordTopIds(worksheetTopIds)

  // Build residentRecordTopId -> { name, room } for every resolved resident,
  // same join billing.ts does for charges.
  const residentInfoByRecordTopId = new Map<string, { name: string; room: string }>()
  occupiedRooms.forEach((room) => {
    room.residentTopIds.forEach((worksheetTopId, index) => {
      const recordTopId = residentRecordTopIds.get(worksheetTopId)
      if (!recordTopId) return
      const name = room.residentNames[index] ?? room.residentNames[0] ?? `Resident ${index + 1}`
      residentInfoByRecordTopId.set(recordTopId, { name, room: room.roomName })
    })
  })

  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const marData = await gql<MarQueryResponse>(MAR_QUERY, {
    formId: MAR_FORM_ID,
    unitId: DEMO_UNIT_ID,
    fields: FIELD_IDS,
    filter: [
      { fieldId: FIELD_CREATION_DATE, operation: '>=', value: formatDateForFilter(now) },
      { fieldId: FIELD_CREATION_DATE, operation: '<', value: formatDateForFilter(tomorrow) },
    ],
  })

  // The server-side filter above already narrows to today — isSameLocalDay here is a cheap
  // defensive double-check (e.g. against a filter edge case at a day boundary), not the primary
  // mechanism; it never has to page through the form's other 174,000+ rows to do it.
  const todaysRows = marData.formEntries.rows.filter((row) => {
    const creationDate = getField(row.formEntry.data, 'Creation Date')?.value
    if (!isSameLocalDay(creationDate, now)) return false
    return residentInfoByRecordTopId.has(row.formEntry.record.baseEntry.topId)
  })

  const medsByResident = new Map<string, ScheduledMed[]>()
  for (const row of todaysRows) {
    const recordTopId = row.formEntry.record.baseEntry.topId
    const med = parseScheduledMed(row)
    const list = medsByResident.get(recordTopId)
    if (list) {
      list.push(med)
    } else {
      medsByResident.set(recordTopId, [med])
    }
  }

  const residents: EmarResident[] = []
  for (const [recordTopId, info] of residentInfoByRecordTopId.entries()) {
    const meds = medsByResident.get(recordTopId) ?? []
    if (meds.length === 0) continue // no doses scheduled today for this resident — leave them off the pass

    const pendingVitalsNeeded = meds
      .filter((m) => m.needsVitals && !m.alreadyCharted)
      .flatMap((m) => m.vitalsNeeded)
    const uniqueVitalsNeeded = Array.from(new Set(pendingVitalsNeeded))

    residents.push({
      key: recordTopId,
      residentTopId: recordTopId,
      initials: initialsFromFullName(info.name),
      full: info.name,
      name: abbreviateName(info.name),
      room: info.room,
      dob: '',
      level: '',
      allergies: '',
      swallow: '',
      alerts: '',
      vitals: uniqueVitalsNeeded.length > 0 ? { need: uniqueVitalsNeeded.join(', ') } : null,
      meds,
      prns: [],
    })
  }

  return { residents }
}

// --- Charting (the real mutation) -------------------------------------------

/** Mirrors placeholders/emar.ts's getReasonOptions('refuse'|'hold') UI strings -> the MAR form's real Exception options.
 *  The real Exception field's ONLY options are: "Refused", "Med on hold", "PRN not needed", "Absent", "Sleeping",
 *  "Medication unavailable", "Other" — there's no exact 1:1 mapping, so each pick below is the nearest real option,
 *  chosen by clinical judgment:
 *   - "Said no, will re-offer" -> "Refused" (plain resident refusal)
 *   - "Asleep"                 -> "Sleeping" (exact real option)
 *   - "Spit out"                -> "Refused" (still a refusal, just physical)
 *   - "Nausea"                  -> "Refused" (resident-driven refusal; no symptom-specific option exists)
 *   - "Outside hold parameters" -> "Med on hold" (clinical hold)
 *   - "Nurse instruction"       -> "Med on hold" (directed hold)
 *   - "Out of stock"            -> "Medication unavailable" (exact fit)
 *   - "Resident away"           -> "Absent" (exact real option)
 *   - "Other" (either kind)     -> "Other"
 *
 *  IMPORTANT: a SINGLE_OPTION_LIST field is NOT written with its display label — confirmed live
 *  the hard way: writing the plain label "Refused" was silently ignored (the mutation reported
 *  success and Date/Time Administered/Notes saved, but Exception stayed null — no error surfaced,
 *  so this is easy to miss). The real write value is the option's short EXPORT CODE, found via
 *  `remoteObjects(ids: [fieldId]) { ... on RelateFieldWrapper { listOptions { listItems { topId
 *  value displayName } } } }`: Refused="R", Med on hold="H", PRN not needed="P", Absent="A",
 *  Sleeping="S", Medication unavailable="M", Other="O". The map below stores those codes directly. */
const REASON_TO_EXCEPTION: Record<string, string> = {
  'Said no, will re-offer': 'R', // Refused
  Asleep: 'S', // Sleeping
  'Spit out': 'R', // Refused
  Nausea: 'R', // Refused
  'Outside hold parameters': 'H', // Med on hold
  'Nurse instruction': 'H', // Med on hold
  'Out of stock': 'M', // Medication unavailable
  'Resident away': 'A', // Absent
  Other: 'O', // Other
}

export function mapReasonToExceptionOption(reason: string): string {
  return REASON_TO_EXCEPTION[reason] ?? 'O' // Other
}

/**
 * Low-level mutation wrapper — calls `updateFormRow` via the shared `gql()`
 * wrapper and returns the updated row's id/rowVersion. Throws `GqlError` (or
 * a plain `Error`) on failure; callers decide how to show it. Per BlueStep's
 * own docs a `PRECONDITION`-coded failure here names the field and the
 * accepted value shape, which matters since two of the written field formats
 * below are best-effort/untested (see chartDose's doc comment).
 */
export async function chartMarRow(
  rowId: string,
  expectedVersion: number,
  fieldValues: Record<string, unknown>
): Promise<{ id: string; rowVersion: number }> {
  const data = await gql<UpdateFormRowResponse>(UPDATE_MAR_ROW_MUTATION, {
    id: rowId,
    v: fieldValues,
    ver: expectedVersion,
  })
  return data.updateFormRow
}

export interface ChartDoseParams {
  med: ScheduledMed
  status: 'given' | 'refused' | 'held'
  /** The UI's existing free-text reason string from getReasonOptions('refuse'|'hold') — undefined for a normal Give. */
  reason?: string
  /** Pre-composed attestation text for the Notes field (who signed, when, signature id, witness) — see buildAttestationNote(). */
  notes: string
}

/**
 * Charts one dose: `updateFormRow` on the MAR row's OWN existing row (never
 * createFormRow — see this module's header). Only writes what the task spec
 * calls out: Date/Time Administered, Exception (null for a normal Give), and
 * Notes. Qty Admin / other fields are deliberately left untouched.
 *
 * Write-value formats for the two fields this org's schema discovery did NOT
 * confirm live (best-effort, per the task's own direction to let a
 * PRECONDITION error reveal the real accepted shape rather than guessing
 * further):
 *  - Date/Time Administered: ISO-8601 via `Date.prototype.toISOString()`.
 *  - Exception: the option's plain export string (e.g. `"Refused"`), not an
 *    option-object shape — chosen because every other SINGLE_OPTION_LIST
 *    write path in this codebase (there are none yet; this is the first
 *    mutation) has no precedent either way, and the plain string is the
 *    simpler of the two plausible shapes to try first.
 */
export async function chartDose(params: ChartDoseParams): Promise<{ id: string; rowVersion: number }> {
  const { med, status, reason, notes } = params

  const fieldValues: Record<string, unknown> = {
    [FIELD_DATE_TIME_ADMINISTERED]: new Date().toISOString(),
    [FIELD_EXCEPTION]: status === 'given' ? null : mapReasonToExceptionOption(reason ?? 'Other'),
    [FIELD_NOTES]: notes,
  }

  return chartMarRow(med.id, med.rowVersion, fieldValues)
}

/** Composes the Notes-field attestation text — our stand-in for the real Signature field (see this module's header:
 *  we never attempt to write FIELD "Signature" itself, it's the platform's own native signature-capture UI). */
export function buildAttestationNote(statusLabel: string, signature: SignatureRecord, witness?: SignatureRecord): string {
  let text = `${statusLabel} — signed by ${signature.fullName}, ${signature.credential} at ${signature.signedAt} (PIN verified, ID ${signature.signatureId}).`
  if (witness) {
    text += ` Witnessed by ${witness.fullName}, ${witness.credential} at ${witness.signedAt} (ID ${witness.signatureId}).`
  }
  return text
}

export { GqlError }
