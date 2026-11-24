import { useEffect, useState } from 'preact/hooks'
import { Link } from 'preact-router'
import { fetchResidentBillings } from '../lib/billing.ts'
import type { ResidentBillingsResult } from '../lib/billing.ts'
import { fetchResidentProfile } from '../lib/residentProfile.ts'
import type {
  ResidentProfile,
  AdmissionEntry,
  AllergyEntry,
  VitalSignsEntry,
} from '../lib/residentProfile.ts'
import { formatBeds } from '../lib/rooms.ts'
import { formatMoney } from '../lib/formData.ts'
import { GqlError } from '../lib/gql.ts'
import { SignInPrompt } from '../components/SignInPrompt.tsx'
import { ChargeBreakdown } from '../components/ChargeBreakdown.tsx'
import './ResidentRecord.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: string }
  | { status: 'ready'; result: ResidentBillingsResult; profile: ResidentProfile }

/** One label/value pair rendered by `FieldList`/`EntryList`'s detail line. */
interface EntryDetail {
  label: string
  value: string | null
}

/** One row rendered by `EntryList` — a multi-entry section's single entry. */
interface Entry {
  key: string | number
  primary?: string | null
  details: EntryDetail[]
}

/**
 * Renders a label/value grid for single-entry sections (Demographics). Fields
 * with a `null`/empty value are skipped entirely — never rendered as a label
 * with nothing after it. Shows `emptyText` when every field is empty.
 */
function FieldList({ fields, emptyText }: { fields: EntryDetail[]; emptyText: string }) {
  const present = fields.filter((f) => f.value !== null && f.value !== '')
  if (present.length === 0) {
    return <p class="resident-record-empty">{emptyText}</p>
  }
  return (
    <div class="resident-record-field-list">
      {present.map((f) => (
        <div class="resident-record-field-row" key={f.label}>
          <span class="resident-record-field-label">{f.label}</span>
          <span class="resident-record-field-value">{f.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Renders a compact "Label: value · Label: value" line, skipping empty values. */
function EntryDetails({ details }: { details: EntryDetail[] }) {
  const present = details.filter((d) => d.value !== null && d.value !== '')
  if (present.length === 0) return null
  return (
    <span class="resident-record-entry-secondary">
      {present.map((d, i) => (
        <span key={d.label}>
          {i > 0 ? ' · ' : ''}
          {d.label}: {d.value}
        </span>
      ))}
    </span>
  )
}

/**
 * Renders a multi-entry section (Admission, Diagnoses, Care Team, Contacts,
 * Vital Signs history) as a list of rows, each a primary line plus a
 * secondary detail line. Shows `emptyText` when `items` is empty.
 */
function EntryList({ items, emptyText }: { items: Entry[]; emptyText: string }) {
  if (items.length === 0) {
    return <p class="resident-record-empty">{emptyText}</p>
  }
  return (
    <ul class="resident-record-entry-list">
      {items.map((item) => (
        <li key={item.key}>
          {item.primary && <span class="resident-record-entry-primary">{item.primary}</span>}
          <EntryDetails details={item.details} />
        </li>
      ))}
    </ul>
  )
}

/** Allergies get their own renderer so Severity can get a pill treatment. */
function AllergiesSection({ allergies }: { allergies: AllergyEntry[] }) {
  if (allergies.length === 0) {
    return <p class="resident-record-empty">No allergies recorded.</p>
  }
  return (
    <ul class="resident-record-entry-list">
      {allergies.map((a, i) => (
        <li key={i}>
          {a.allergyName && <span class="resident-record-entry-primary">{a.allergyName}</span>}
          {a.severity && <span class="resident-record-severity-pill">{a.severity}</span>}
          <EntryDetails details={[{ label: 'Onset', value: a.onsetDate }]} />
        </li>
      ))}
    </ul>
  )
}

/** Shared field list for one Vital Signs reading (used for both the latest reading and history rows). */
function vitalDetails(v: VitalSignsEntry): EntryDetail[] {
  return [
    { label: 'Blood Pressure', value: v.bloodPressure },
    { label: 'Heart Rate', value: v.heartRate },
    { label: 'Temperature', value: v.temperature },
    { label: 'Respiratory Rate', value: v.respiratoryRate },
    { label: 'Weight', value: v.weight },
    { label: 'Glucose', value: v.glucose },
    { label: 'O2 Sats', value: v.o2Sats },
  ]
}

/**
 * Vital Signs is the one section with a "prominent latest reading" layout:
 * `vitalSigns[0]` (already sorted most-recent-first by the data layer) is
 * shown as a stat grid with its Date/Time Taken as a caption; any remaining
 * readings are shown below as a compact history list.
 */
function VitalSignsSection({ vitalSigns }: { vitalSigns: VitalSignsEntry[] }) {
  if (vitalSigns.length === 0) {
    return <p class="resident-record-empty">No vital signs recorded.</p>
  }
  const [latest, ...history] = vitalSigns
  const latestDetails = vitalDetails(latest).filter((d) => d.value !== null && d.value !== '')

  return (
    <div class="resident-record-vitals">
      <div class="resident-record-vitals-latest">
        {latestDetails.map((d) => (
          <div class="resident-record-vital-stat" key={d.label}>
            <span class="resident-record-vital-stat-label">{d.label}</span>
            <span class="resident-record-vital-stat-value">{d.value}</span>
          </div>
        ))}
      </div>
      {latest.dateTimeTaken && <p class="resident-record-vitals-caption">Taken {latest.dateTimeTaken}</p>}
      {history.length > 0 && (
        <EntryList
          items={history.map((v, i) => ({ key: i, primary: v.dateTimeTaken || null, details: vitalDetails(v) }))}
          emptyText=""
        />
      )}
    </div>
  )
}

// `preact-router` passes matched path params (e.g. `:id`) as props on the
// routed component. `id` is typed optional since the router's own typing
// doesn't guarantee it's present, but in practice it always is when this
// component is reached via the `/residents/:id` route.
export function ResidentRecord({ id }: { id?: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    Promise.all([fetchResidentBillings(), fetchResidentProfile(id ?? '')])
      .then(([result, profile]) => {
        if (cancelled) return
        setState({ status: 'ready', result, profile })
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
  }, [id])

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
  const { profile } = state
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
      <div class="resident-record-card resident-record-header-card">
        <h2 class="resident-record-name">{billing.residentName}</h2>
        <p class="resident-record-meta">
          <span>{billing.roomName}</span>
          {room && <span> · {formatBeds(room)}</span>}
        </p>
      </div>
      <div class="resident-record-card resident-record-billing-card">
        <h3>Billing</h3>
        <div class="resident-record-charges">
          <ChargeBreakdown billing={billing} />
        </div>
        <div class="resident-record-total">
          <span class="resident-record-total-label">Total</span>
          <span class="resident-record-total-value">{formatMoney(billing.total)}</span>
        </div>
      </div>

      <div class="resident-record-card resident-record-section-card">
        <h3>Demographics</h3>
        <FieldList
          fields={[
            { label: 'Gender', value: profile.demographics?.gender ?? null },
            { label: 'Birth Date', value: profile.demographics?.birthDate ?? null },
            { label: 'Religion', value: profile.demographics?.religion ?? null },
            { label: 'Marital Status', value: profile.demographics?.maritalStatus ?? null },
            { label: 'Hospital', value: profile.demographics?.hospital ?? null },
          ]}
          emptyText="No demographic information recorded."
        />
      </div>

      <div class="resident-record-card resident-record-section-card">
        <h3>Admission</h3>
        <EntryList
          items={profile.admissions.map((a: AdmissionEntry, i) => ({
            key: i,
            primary: a.dateTime || null,
            details: [{ label: 'Admission Type', value: a.admissionType }],
          }))}
          emptyText="No admission records."
        />
      </div>

      <div class="resident-record-card resident-record-section-card">
        <h3>Diagnoses</h3>
        <EntryList
          items={profile.diagnoses.map((d, i) => ({
            key: i,
            primary: d.diagnosis ? (d.isPrimary ? `${d.diagnosis} (Primary)` : d.diagnosis) : null,
            details: [
              { label: 'Start', value: d.start },
              { label: 'End', value: d.end },
            ],
          }))}
          emptyText="No diagnoses recorded."
        />
      </div>

      <div class="resident-record-card resident-record-section-card">
        <h3>Allergies</h3>
        <AllergiesSection allergies={profile.allergies} />
      </div>

      <div class="resident-record-card resident-record-section-card">
        <h3>Vital Signs</h3>
        <VitalSignsSection vitalSigns={profile.vitalSigns} />
      </div>

      <div class="resident-record-card resident-record-section-card">
        <h3>Care Team</h3>
        <EntryList
          items={profile.providers.map((p, i) => ({
            key: i,
            primary: p.provider,
            details: [{ label: 'Role', value: p.role }],
          }))}
          emptyText="No care team members recorded."
        />
      </div>

      <div class="resident-record-card resident-record-section-card">
        <h3>Contacts</h3>
        <EntryList
          items={profile.contacts.map((c, i) => ({
            key: c.contactOrder ?? i,
            primary: c.fullName,
            details: [
              { label: 'Relationship', value: c.relationship },
              { label: 'Type', value: c.contactType },
              { label: 'Home', value: c.homePhone },
              { label: 'Cell', value: c.cellPhone },
              { label: 'Work', value: c.workPhone },
              { label: 'Email', value: c.email },
            ],
          }))}
          emptyText="No contacts recorded."
        />
      </div>
    </div>
  )
}
