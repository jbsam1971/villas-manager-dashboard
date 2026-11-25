import { useEffect, useState } from 'preact/hooks'
import { getEmarCartInfo, getReasonOptions, getSignatureKey } from '../lib/placeholders/emar.ts'
import { fetchTodaysMedPass, chartDose, buildAttestationNote } from '../lib/emarData.ts'
import type { EmarResident, MedFlag, MedFlagTone, ScheduledMed, PrnMed } from '../lib/emarData.ts'
import { GqlError } from '../lib/gql.ts'
import { SignInPrompt } from '../components/SignInPrompt.tsx'
import {
  ATTESTATION_TEXT,
  MAX_PIN_ATTEMPTS,
  getSignedInStaff,
  getWitnessOptions,
  makeSignature,
  verifyPin,
} from '../lib/placeholders/signatures.ts'
import type { SignatureRecord, StaffMember } from '../lib/placeholders/signatures.ts'
import './EmarMedPass.css'

// Direct port of the reviewed Design artifact mockup (eMAR · med pass and
// monthly MAR, project/MAR.dc.html), now wired to REAL BlueStep data — see
// src/lib/emarData.ts for the fetch/mutation layer and its header comment
// for the pre-created-rows architecture, the columnName-vs-label gotcha, and
// the deliberate scope cuts (no CS/witness flagging on real data, no "looks
// like" pill, no real vitals threshold, no DOB/allergy/swallow/alert data —
// this page hides those UI bits rather than fabricate them). Resident
// switching, vitals-recorded gating, the inline reason picker, the cart-wide
// pass tally, and the monthly MAR grid's day fill are still local useState —
// only the underlying resident/med data and the Give/Refused/Held charting
// action are real now. `src/lib/placeholders/emar.ts` is still used for the
// cart/shift chrome (cart label, signed-in-staff line, reason-option
// strings, signature-key legend) since none of that has a documented real
// data source in this org and replacing it is out of this task's scope.
// Full-bleed workflow page: renders its own header/layout from the top, same
// pattern as CareStaffShift.tsx — not wrapped in the manager sidebar shell.
// Wiring this to a real `/mar` route is out of scope here.

type ChartStatus = 'given' | 'refused' | 'held'

interface ChartEntry {
  status: ChartStatus
  at: string
  by: string
  why?: string
  /** Present once this session's own sign-off flow produced it; absent for a dose seeded as already-charted straight
   *  from the real MAR row's own fields on load (see emarData.ts's `alreadyCharted`) — we have no real signature to
   *  show for those, just the row's own Date/Time Administered/Exception values. */
  signature?: SignatureRecord
  /** Controlled-substance second signer, if this entry required one. */
  witness?: SignatureRecord
}

type ChartedState = Record<string, ChartEntry>

/** What a correction left behind once the corrected entry is cleared and the med re-opens for re-charting. */
interface CorrectionNote {
  original: ChartEntry
  correctedBy: SignatureRecord
  correctedAt: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: string }
  | { status: 'ready'; residents: EmarResident[] }

/** Enough to replay a failed chartDose() call from the "Retry save" button without re-asking for a PIN. */
interface ChartAttempt {
  med: ScheduledMed
  status: ChartStatus
  reason?: string
  signature: SignatureRecord
  witness?: SignatureRecord
}

type TabKey = 'pass' | 'mar'

type ReasonPickerState = { medId: string; kind: 'refuse' | 'hold' } | null

// --- Electronic signature / PIN sign-off -----------------------------------
//
// Every Give/Refused/Held/PRN action, and every Undo (a "correction"), routes
// through one shared sign-off panel rather than committing immediately. The
// PendingAction union below is what that panel is "doing" right now; it
// carries just enough display info (action label, reason, med name/dose,
// whether a witness is required) plus the bit of identifying info needed to
// commit once PIN(s) are verified.

interface PendingActionBase {
  actionLabel: string
  reason?: string
  medName: string
  medDose: string
  isControlledSubstance: boolean
}

interface ScheduledPendingAction extends PendingActionBase {
  kind: 'scheduled'
  medId: string
  status: ChartStatus
}

interface PrnPendingAction extends PendingActionBase {
  kind: 'prn'
  prnName: string
}

interface CorrectionPendingAction extends PendingActionBase {
  kind: 'correction'
  medId: string
  original: ChartEntry
}

type PendingAction = ScheduledPendingAction | PrnPendingAction | CorrectionPendingAction

type SignOffStep = 'primary' | 'witness'

interface SignOffState {
  step: SignOffStep
  pin: string
  attempts: number
  locked: boolean
  error: string | null
  primarySignature: SignatureRecord | null
  witnessStaffId: string
  witnessPin: string
  witnessAttempts: number
  witnessLocked: boolean
  witnessError: string | null
}

function initialSignOffState(): SignOffState {
  return {
    step: 'primary',
    pin: '',
    attempts: 0,
    locked: false,
    error: null,
    primarySignature: null,
    witnessStaffId: '',
    witnessPin: '',
    witnessAttempts: 0,
    witnessLocked: false,
    witnessError: null,
  }
}

/** Human-readable label for a charted entry's action + reason — used in the sign-off panel and the correction note. */
function describeEntry(entry: ChartEntry): string {
  if (entry.status === 'given') return 'Given'
  if (entry.status === 'refused') return `Refused${entry.why ? ` · ${entry.why}` : ''}`
  return `Held${entry.why ? ` · ${entry.why}` : ''}`
}

const GIVEN_INITIALS = ['LM', 'AR', 'KW', 'BO']

// MONTH_LABEL/TODAY_DAY/DAYS used to be hardcoded to the mockup's sample
// date (Nov 24, 2026) — MonthlyMar below now computes them from the real
// current date so "today"'s outlined column lines up with the real
// chartedState it renders.

/** "Nov 24, 2026 at 8:12 AM" — matches the sample data's own timestamp format. */
function formatChartTime(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'short' })
  const day = date.getDate()
  const year = date.getFullYear()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${month} ${day}, ${year} at ${time}`
}

/** "Luis Martinez, Med tech" -> "LM" — used to label who charted a dose on the MAR grid's today column. */
function initialsFromBy(by: string): string {
  const namePart = by.split(',')[0]?.trim() ?? by
  return namePart
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function flagClass(tone: MedFlagTone): string {
  return `emar-flag emar-flag-${tone}`
}

function FlagPill({ flag }: { flag: MedFlag }) {
  return <span class={flagClass(flag.tone)}>{flag.text}</span>
}

function Mark({ checked }: { checked: boolean }) {
  return (
    <span class={checked ? 'emar-mark emar-mark-checked' : 'emar-mark'} aria-hidden="true">
      {checked && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M4 12l5 5 11-11" />
        </svg>
      )}
    </span>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function IconBarcode() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path
        stroke-linecap="round"
        d="M4 5v14M7.5 5v14M9.5 5v14M13 5v14M15.5 5v14M17 5v14M20 5v14"
      />
    </svg>
  )
}

/** The signature block shown on a charted med/PRN card, and (subordinate) under it for a controlled-substance witness. */
function SignatureBlock({ signature, witness }: { signature: SignatureRecord; witness?: SignatureRecord }) {
  return (
    <div class="emar-signature-block">
      <p class="emar-signature-name">{signature.fullName}</p>
      <p class="emar-signature-meta">
        Signed by {signature.fullName}, {signature.credential} · {signature.signedAt}
      </p>
      <p class="emar-signature-caption">Electronic signature · PIN verified · ID {signature.signatureId}</p>
      {witness && (
        <div class="emar-signature-witness">
          <p class="emar-signature-name emar-signature-name-witness">{witness.fullName}</p>
          <p class="emar-signature-meta emar-signature-meta-witness">
            Witnessed by {witness.fullName}, {witness.credential} · {witness.signedAt}
          </p>
          <p class="emar-signature-caption emar-signature-caption-witness">
            Electronic signature · PIN verified · ID {witness.signatureId}
          </p>
        </div>
      )}
    </div>
  )
}

function SignOffModal({
  action,
  state,
  signedInStaff,
  witnessOptions,
  onPinChange,
  onSubmitPrimary,
  onWitnessSelect,
  onWitnessPinChange,
  onSubmitWitness,
  onCancel,
}: {
  action: PendingAction
  state: SignOffState
  signedInStaff: StaffMember
  witnessOptions: StaffMember[]
  onPinChange: (value: string) => void
  onSubmitPrimary: () => void
  onWitnessSelect: (staffId: string) => void
  onWitnessPinChange: (value: string) => void
  onSubmitWitness: () => void
  onCancel: () => void
}) {
  const now = formatChartTime(new Date())
  const isWitnessStep = state.step === 'witness'

  return (
    <div class="emar-signoff-overlay" role="presentation">
      <div class="emar-signoff-panel" role="dialog" aria-modal="true" aria-label="Electronic signature sign-off">
        <h3 class="emar-signoff-title">{isWitnessStep ? 'Witness sign-off' : 'Electronic signature'}</h3>

        <div class="emar-signoff-summary">
          <p class="emar-signoff-action">
            {action.actionLabel}
            {action.reason ? ` · ${action.reason}` : ''}
          </p>
          <p class="emar-signoff-med">
            {action.medName} <span class="emar-signoff-dose">{action.medDose}</span>
          </p>
          {action.kind === 'correction' && (
            <p class="emar-signoff-original">
              Originally: {describeEntry(action.original)} · signed by {action.original.by} · {action.original.at}
            </p>
          )}
        </div>

        {!isWitnessStep ? (
          <>
            <p class="emar-signoff-signer">
              Signing as{' '}
              <strong>
                {signedInStaff.fullName}, {signedInStaff.credential}
              </strong>
            </p>
            <p class="emar-signoff-time">{now}</p>
            <p class="emar-signoff-attestation">{ATTESTATION_TEXT}</p>
            <p class="emar-signoff-demo-hint">
              Demo only — there's no real authentication backend yet. Enter PIN <strong>1234</strong> to continue.
            </p>

            {state.locked ? (
              <p class="emar-signoff-locked-banner">
                Locked after {MAX_PIN_ATTEMPTS} incorrect tries. A supervisor has been notified. (placeholder)
              </p>
            ) : (
              <>
                <label class="emar-signoff-pin-label" for="emar-signoff-pin">
                  4-digit PIN
                </label>
                <input
                  id="emar-signoff-pin"
                  class="emar-signoff-pin-input"
                  type="password"
                  inputMode="numeric"
                  autocomplete="off"
                  maxLength={4}
                  value={state.pin}
                  onInput={(e) => onPinChange((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4))}
                />
                {state.error && <p class="emar-signoff-error">{state.error}</p>}
                {state.attempts > 0 && (
                  <p class="emar-signoff-attempts">
                    {state.attempts} of {MAX_PIN_ATTEMPTS} attempts used
                  </p>
                )}
              </>
            )}

            <div class="emar-signoff-actions">
              <button type="button" class="emar-btn emar-btn-outline" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                class="emar-btn emar-btn-give"
                disabled={state.locked || state.pin.length !== 4}
                onClick={onSubmitPrimary}
              >
                Confirm signature
              </button>
            </div>
          </>
        ) : (
          <>
            <p class="emar-signoff-signer">This is a controlled substance — a second staff member must witness.</p>
            <label class="emar-signoff-pin-label" for="emar-signoff-witness-select">
              Witness
            </label>
            <select
              id="emar-signoff-witness-select"
              class="emar-signoff-witness-select"
              value={state.witnessStaffId}
              onChange={(e) => onWitnessSelect((e.target as HTMLSelectElement).value)}
            >
              <option value="">Select a witness</option>
              {witnessOptions.map((s) => (
                <option value={s.staffId} key={s.staffId}>
                  {s.fullName}, {s.credential}
                </option>
              ))}
            </select>
            <p class="emar-signoff-time">{now}</p>
            <p class="emar-signoff-attestation">{ATTESTATION_TEXT}</p>
            <p class="emar-signoff-demo-hint">
              Demo only — there's no real authentication backend yet. Enter PIN <strong>1234</strong> to continue.
            </p>

            {state.witnessLocked ? (
              <p class="emar-signoff-locked-banner">
                Locked after {MAX_PIN_ATTEMPTS} incorrect tries. A supervisor has been notified. (placeholder)
              </p>
            ) : (
              <>
                <label class="emar-signoff-pin-label" for="emar-signoff-witness-pin">
                  Witness 4-digit PIN
                </label>
                <input
                  id="emar-signoff-witness-pin"
                  class="emar-signoff-pin-input"
                  type="password"
                  inputMode="numeric"
                  autocomplete="off"
                  maxLength={4}
                  disabled={!state.witnessStaffId}
                  value={state.witnessPin}
                  onInput={(e) =>
                    onWitnessPinChange((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4))
                  }
                />
                {state.witnessError && <p class="emar-signoff-error">{state.witnessError}</p>}
                {state.witnessAttempts > 0 && (
                  <p class="emar-signoff-attempts">
                    {state.witnessAttempts} of {MAX_PIN_ATTEMPTS} attempts used
                  </p>
                )}
              </>
            )}

            <div class="emar-signoff-actions">
              <button type="button" class="emar-btn emar-btn-outline" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                class="emar-btn emar-btn-give"
                disabled={state.witnessLocked || !state.witnessStaffId || state.witnessPin.length !== 4}
                onClick={onSubmitWitness}
              >
                Confirm witness signature
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface RightsTileData {
  label: string
  checked: boolean
  note: string
  warn: boolean
}

function RightsTile({ tile }: { tile: RightsTileData }) {
  return (
    <div class={tile.warn ? 'emar-rights-tile emar-rights-tile-warn' : 'emar-rights-tile'}>
      <Mark checked={tile.checked} />
      <div class="emar-rights-tile-body">
        <p class="emar-rights-tile-label">{tile.label}</p>
        <p class="emar-rights-tile-note">{tile.note}</p>
      </div>
    </div>
  )
}

export function EmarMedPass() {
  const cartInfo = getEmarCartInfo()

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [selKey, setSelKey] = useState<string | null>(null)
  const [chartedState, setChartedState] = useState<ChartedState>({})
  const [prnChartedState, setPrnChartedState] = useState<ChartedState>({})
  const [correctionNotes, setCorrectionNotes] = useState<Record<string, CorrectionNote>>({})
  const [vitalsRecorded, setVitalsRecorded] = useState<Record<string, boolean>>({})
  const [tab, setTab] = useState<TabKey>('pass')
  const [openPicker, setOpenPicker] = useState<ReasonPickerState>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [signOff, setSignOff] = useState<SignOffState>(initialSignOffState())
  /** Med ids with a chartDose() mutation currently in flight — drives the "Saving…" line on that med's card. */
  const [savingMedIds, setSavingMedIds] = useState<Set<string>>(new Set())
  /** Med id -> last chartDose() failure message, cleared on a new attempt or a successful retry. */
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  const [lastAttempts, setLastAttempts] = useState<Record<string, ChartAttempt>>({})

  const signedInStaff = getSignedInStaff()

  useEffect(() => {
    let cancelled = false
    setLoadState({ status: 'loading' })

    fetchTodaysMedPass()
      .then(({ residents }) => {
        if (cancelled) return
        setLoadState({ status: 'ready', residents })
        setSelKey(residents[0]?.key ?? null)

        // Seed local charted state from any dose that already has a real
        // Date/Time Administered value on load (charted earlier today, by
        // this page or anyone else) — see emarData.ts's `alreadyCharted`.
        const seeded: ChartedState = {}
        residents.forEach((r) => {
          r.meds.forEach((m) => {
            if (m.alreadyCharted) {
              seeded[m.id] = {
                status: m.alreadyCharted.status,
                at: m.alreadyCharted.at,
                by: 'Charted on record',
                why: m.alreadyCharted.exceptionText ?? undefined,
              }
            }
          })
        })
        setChartedState(seeded)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          code: err instanceof GqlError ? err.code : undefined,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loadState.status === 'loading') {
    return (
      <div class="emar-page">
        <p class="emar-page-footer">Loading today's med pass…</p>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div class="emar-page">
        {loadState.code === 'UNAUTHENTICATED' ? (
          <SignInPrompt />
        ) : (
          <p class="emar-page-footer">Could not load today's med pass: {loadState.message}</p>
        )}
      </div>
    )
  }

  const { residents } = loadState

  if (residents.length === 0) {
    return (
      <div class="emar-page">
        <p class="emar-page-footer">No residents with doses scheduled today for this unit.</p>
      </div>
    )
  }

  const selResident = residents.find((r) => r.key === selKey) ?? residents[0]

  // Cart-wide pass tally — across every resident's scheduled meds, not just the selected one.
  const passTotal = residents.reduce((sum, r) => sum + r.meds.length, 0)
  const passDone = residents.reduce((sum, r) => sum + r.meds.filter((m) => chartedState[m.id]).length, 0)
  const passPercent = passTotal > 0 ? (passDone / passTotal) * 100 : 0

  function selectResident(key: string) {
    setSelKey(key)
    setOpenPicker(null)
  }

  function recordVitals(residentKey: string) {
    setVitalsRecorded((prev) => ({ ...prev, [residentKey]: true }))
  }

  // --- Sign-off flow ---
  //
  // Clicking Give/Refused/Held/Give PRN/Undo no longer charts anything
  // directly — it opens the shared sign-off panel via openSignOff(). Only a
  // successful PIN (plus witness PIN, for controlled substances) calls
  // commitAction(), which does what chartMed()/undoMed() used to do, now
  // also attaching the electronic signature(s).

  function openSignOff(action: PendingAction) {
    setPendingAction(action)
    setSignOff(initialSignOffState())
  }

  function closeSignOff() {
    setPendingAction(null)
    setSignOff(initialSignOffState())
  }

  /** Builds the Notes-field attestation text and calls chartDose(), tracking per-med saving/error UI state. Shared by
   *  commitAction (first attempt) and retryChartedDose (after a failure) so a retry replays with the same signature
   *  rather than re-asking for a PIN. */
  function saveChartedDose(medId: string, attempt: ChartAttempt) {
    setLastAttempts((prev) => ({ ...prev, [medId]: attempt }))
    setSavingMedIds((prev) => new Set(prev).add(medId))
    setSaveErrors((prev) => {
      const next = { ...prev }
      delete next[medId]
      return next
    })

    const statusLabel =
      attempt.status === 'given'
        ? 'Given'
        : attempt.status === 'refused'
          ? `Refused${attempt.reason ? ` · ${attempt.reason}` : ''}`
          : `Held${attempt.reason ? ` · ${attempt.reason}` : ''}`
    const notes = buildAttestationNote(statusLabel, attempt.signature, attempt.witness)

    chartDose({ med: attempt.med, status: attempt.status, reason: attempt.reason, notes })
      .then(() => {
        setSavingMedIds((prev) => {
          const next = new Set(prev)
          next.delete(medId)
          return next
        })
      })
      .catch((err: unknown) => {
        setSavingMedIds((prev) => {
          const next = new Set(prev)
          next.delete(medId)
          return next
        })
        setSaveErrors((prev) => ({ ...prev, [medId]: err instanceof Error ? err.message : String(err) }))
      })
  }

  function retryChartedDose(medId: string) {
    const attempt = lastAttempts[medId]
    if (attempt) saveChartedDose(medId, attempt)
  }

  function commitAction(action: PendingAction, signature: SignatureRecord, witness?: SignatureRecord) {
    const at = formatChartTime(new Date())

    if (action.kind === 'scheduled') {
      setChartedState((prev) => ({
        ...prev,
        [action.medId]: { status: action.status, at, by: cartInfo.signedInAs, why: action.reason, signature, witness },
      }))
      setCorrectionNotes((prev) => {
        const next = { ...prev }
        delete next[action.medId]
        return next
      })
      setOpenPicker(null)

      // This is the one real behavior change on sign-off: save the dose back
      // to the platform's own MAR row via updateFormRow, never createFormRow.
      const med = residents.flatMap((r) => r.meds).find((m) => m.id === action.medId)
      if (med) {
        saveChartedDose(action.medId, { med, status: action.status, reason: action.reason, signature, witness })
      }
    } else if (action.kind === 'prn') {
      // Local-only: the real MAR data has no documented PRN row (see
      // emarData.ts), so selResident.prns is always [] and this branch is
      // presently unreachable from real data — left in place for shape
      // compatibility in case a PRN data source gets joined in later.
      setPrnChartedState((prev) => ({
        ...prev,
        [action.prnName]: { status: 'given', at, by: cartInfo.signedInAs, signature, witness },
      }))
    } else {
      // Correction/Undo stays LOCAL-ONLY for this pass — it reverts the UI's
      // own chartedState but does NOT clear the real MAR row's Date/Time
      // Administered / Exception / Notes fields on the platform. Wiring a
      // real "uncharge" mutation was outside this task's asked-for scope
      // (Give/Refused/Held saving); flagged as a known follow-up.
      setChartedState((prev) => {
        const next = { ...prev }
        delete next[action.medId]
        return next
      })
      setCorrectionNotes((prev) => ({
        ...prev,
        [action.medId]: { original: action.original, correctedBy: signature, correctedAt: at },
      }))
    }

    closeSignOff()
  }

  function submitPrimaryPin() {
    if (!pendingAction || signOff.locked) return

    if (verifyPin(signedInStaff.staffId, signOff.pin)) {
      const signature = makeSignature(signedInStaff, formatChartTime(new Date()))
      if (pendingAction.isControlledSubstance) {
        setSignOff((prev) => ({ ...prev, step: 'witness', primarySignature: signature, pin: '', error: null }))
      } else {
        commitAction(pendingAction, signature)
      }
      return
    }

    setSignOff((prev) => {
      const attempts = prev.attempts + 1
      const locked = attempts >= MAX_PIN_ATTEMPTS
      return { ...prev, attempts, locked, pin: '', error: locked ? null : 'Incorrect PIN. Try again.' }
    })
  }

  function submitWitnessPin() {
    if (!pendingAction || signOff.witnessLocked || !signOff.witnessStaffId || !signOff.primarySignature) return

    if (verifyPin(signOff.witnessStaffId, signOff.witnessPin)) {
      const witnessStaff = getWitnessOptions(signedInStaff.staffId).find((s) => s.staffId === signOff.witnessStaffId)
      if (!witnessStaff) return
      const witnessSignature = makeSignature(witnessStaff, formatChartTime(new Date()))
      commitAction(pendingAction, signOff.primarySignature, witnessSignature)
      return
    }

    setSignOff((prev) => {
      const witnessAttempts = prev.witnessAttempts + 1
      const witnessLocked = witnessAttempts >= MAX_PIN_ATTEMPTS
      return {
        ...prev,
        witnessAttempts,
        witnessLocked,
        witnessPin: '',
        witnessError: witnessLocked ? null : 'Incorrect PIN. Try again.',
      }
    })
  }

  function startCorrection(med: ScheduledMed, entry: ChartEntry) {
    openSignOff({
      kind: 'correction',
      medId: med.id,
      original: entry,
      actionLabel: 'Correct this entry',
      medName: med.name,
      medDose: med.dose,
      isControlledSubstance: med.flags.some((f) => f.tone === 'cs'),
    })
  }

  function togglePicker(medId: string, kind: 'refuse' | 'hold') {
    setOpenPicker((prev) => (prev && prev.medId === medId && prev.kind === kind ? null : { medId, kind }))
  }

  function nextResident() {
    const idx = residents.findIndex((r) => r.key === selKey)
    const next = residents[(idx + 1) % residents.length]
    setSelKey(next.key)
    setOpenPicker(null)
    setTab('pass')
  }

  const vitalsDoneForSel = !!vitalsRecorded[selResident.key]
  const nextMed = selResident.meds.find((m) => !chartedState[m.id]) ?? null
  const vitalsBlocked = !!nextMed?.needsVitals && !vitalsDoneForSel

  const rightsTiles: RightsTileData[] = [
    { label: 'Resident', checked: true, note: 'Photo + wristband', warn: false },
    { label: 'Medication', checked: !!nextMed, note: nextMed ? nextMed.name : '—', warn: false },
    { label: 'Dose', checked: !!nextMed, note: nextMed ? nextMed.dose : '—', warn: false },
    {
      label: 'Route',
      checked: !!nextMed,
      note: nextMed ? nextMed.routeOfAdmin ?? 'Not recorded' : '—',
      warn: false,
    },
    { label: 'Time', checked: !!nextMed, note: nextMed ? nextMed.schedAdminTime ?? 'Not recorded' : '—', warn: false },
    {
      label: 'Reason',
      checked: !!nextMed && !vitalsBlocked,
      // Real data has no documented clinical "reason" field for a dose — "Not recorded" rather than fabricating one.
      note: !nextMed ? '—' : vitalsBlocked ? 'Vitals needed' : nextMed.reason || 'Not recorded',
      warn: !!nextMed && vitalsBlocked,
    },
    { label: 'Documentation', checked: false, note: 'Added after charting', warn: false },
    { label: 'Response', checked: false, note: 'Added after charting', warn: false },
  ]

  const selDoneCount = selResident.meds.filter((m) => chartedState[m.id]).length

  return (
    <div class="emar-page">
      <header class="emar-header">
        <div class="emar-header-left">
          <span class="emar-eyebrow">{cartInfo.cartLabel}</span>
          <h1 class="emar-title">{cartInfo.passLabel}</h1>
        </div>

        <div class="emar-header-mid">
          <span class="emar-pass-line">
            {passDone} of {passTotal} doses charted · {cartInfo.minutesLeft} min left
          </span>
          <div
            class="emar-pass-track"
            role="img"
            aria-label={`${passDone} of ${passTotal} doses charted this pass`}
          >
            <span class="emar-pass-fill" style={{ width: `${passPercent}%` }} />
          </div>
        </div>

        <div class="emar-header-sync">
          <span class="emar-sync-dot" aria-hidden="true" />
          Signed in: {cartInfo.signedInAs} · synced
        </div>

        <div class="emar-header-actions">
          <button type="button" class="emar-btn emar-btn-outline-dark">
            Scan wristband
          </button>
          <button type="button" class="emar-btn emar-btn-outline-dark">
            <IconLock />
            Lock screen
          </button>
        </div>
      </header>

      <div class="emar-body">
        <aside class="emar-aside" aria-label="Residents due this pass">
          <div class="emar-aside-header">
            <span class="emar-aside-label">Due this pass</span>
            <span class="emar-aside-sub">By room</span>
          </div>

          <div class="emar-resident-list">
            {residents.map((r) => {
              const dueMeds = r.meds.filter((m) => !chartedState[m.id])
              const allCharted = dueMeds.length === 0
              const hasLate = dueMeds.some((m) => m.flags.some((f) => f.text.startsWith('Late') || f.text.startsWith('Missed')))
              const selected = r.key === selResident.key
              return (
                <button
                  type="button"
                  key={r.key}
                  class={selected ? 'emar-resident-row emar-resident-row-selected' : 'emar-resident-row'}
                  aria-pressed={selected}
                  onClick={() => selectResident(r.key)}
                >
                  <span class="emar-resident-avatar" aria-hidden="true">
                    {r.initials}
                  </span>
                  <span class="emar-resident-info">
                    <span class="emar-resident-line">
                      <span class="emar-resident-name">{r.name}</span>
                      <span class="emar-resident-room">{r.room}</span>
                    </span>
                    <span class={allCharted ? 'emar-resident-status emar-resident-status-ok' : 'emar-resident-status'}>
                      {allCharted ? 'All doses charted' : `${dueMeds.length} of ${r.meds.length} due`}
                      {!allCharted && hasLate && <span class="emar-resident-late"> · late dose</span>}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <p class="emar-aside-caption">Residents leave this list when every dose for the pass is charted.</p>
        </aside>

        <main class="emar-main">
          <section class="emar-resident-header" aria-label="Resident">
            <div class="emar-photo" aria-hidden="true">
              <span class="emar-photo-initials">{selResident.initials}</span>
              <span class="emar-photo-label">PHOTO</span>
            </div>

            <div class="emar-resident-id">
              <h2 class="emar-resident-fullname">{selResident.full}</h2>
              {/* DOB/care-level aren't sourced from the MAR/rooms data this page fetches — shown only when present,
                  never fabricated. See emarData.ts's header comment for the documented scope cut. */}
              <p class="emar-resident-meta">
                Room {selResident.room}
                {selResident.dob && ` · DOB ${selResident.dob}`}
                {selResident.level && ` · ${selResident.level}`}
              </p>
              {(selResident.allergies || selResident.swallow) && (
                <div class="emar-pill-row">
                  {selResident.allergies && (
                    <span class="emar-pill emar-pill-allergy">Allergies: {selResident.allergies}</span>
                  )}
                  {selResident.swallow && <span class="emar-pill emar-pill-neutral">{selResident.swallow}</span>}
                </div>
              )}
              {selResident.alerts && <p class="emar-resident-alerts">Last 24 hours: {selResident.alerts}</p>}
            </div>

            {selResident.vitals === null ? (
              <div class="emar-vitals-box">
                <p class="emar-vitals-line">No vitals required for this resident's doses today</p>
              </div>
            ) : vitalsDoneForSel ? (
              <div class="emar-vitals-box">
                <p class="emar-vitals-line">Vitals recorded this pass</p>
              </div>
            ) : (
              <div class="emar-vitals-box emar-vitals-box-warn">
                <p class="emar-vitals-line">{selResident.vitals.need} needed</p>
                <button type="button" class="emar-btn emar-btn-outline" onClick={() => recordVitals(selResident.key)}>
                  Record vitals
                </button>
              </div>
            )}
          </section>

          <div class="emar-tabs" role="tablist" aria-label="Views">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'pass'}
              class={tab === 'pass' ? 'emar-tab emar-tab-active' : 'emar-tab'}
              onClick={() => setTab('pass')}
            >
              Med pass
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'mar'}
              class={tab === 'mar' ? 'emar-tab emar-tab-active' : 'emar-tab'}
              onClick={() => setTab('mar')}
            >
              Monthly MAR
            </button>
          </div>

          {tab === 'pass' ? (
            <>
              <section class="emar-rights-panel" aria-label="Rights check for the next dose">
                <p class="emar-rights-headline">
                  {nextMed ? (
                    <>
                      Checking before you give: <strong>{nextMed.name} {nextMed.dose}</strong>
                    </>
                  ) : (
                    'All doses charted'
                  )}
                </p>
                <label class="emar-visually-hidden" for="emar-scan-input">
                  Scan medication barcode
                </label>
                <div class="emar-scan-input">
                  <IconBarcode />
                  <input id="emar-scan-input" type="text" placeholder="Scan pharmacy label" />
                </div>
                <div class="emar-rights-grid">
                  {rightsTiles.map((tile) => (
                    <RightsTile tile={tile} key={tile.label} />
                  ))}
                </div>
              </section>

              <section class="emar-scheduled" aria-label="Scheduled medications">
                <div class="emar-section-header">
                  <h3 class="emar-section-title">Scheduled · 8 AM</h3>
                  <span class="emar-section-note">
                    {selDoneCount} of {selResident.meds.length} charted
                  </span>
                </div>

                <div class="emar-med-list">
                  {selResident.meds.map((med) => {
                    const entry = chartedState[med.id]
                    const blockedByVitals = !!med.needsVitals && !vitalsDoneForSel
                    const pickerOpen = openPicker && openPicker.medId === med.id

                    const isControlledSubstance = med.flags.some((f) => f.tone === 'cs')
                    const correctionNote = correctionNotes[med.id]

                    return (
                      <div class="emar-med-card" key={med.id}>
                        {entry ? (
                          <div class="emar-med-charted">
                            <div class="emar-med-charted-main">
                              <span class={`emar-status-pill emar-status-pill-${entry.status}`}>
                                {entry.status === 'given' && '✓ Given'}
                                {entry.status === 'refused' && `Refused · ${entry.why}`}
                                {entry.status === 'held' && `Held · ${entry.why}`}
                              </span>
                              {entry.signature ? (
                                <SignatureBlock signature={entry.signature} witness={entry.witness} />
                              ) : (
                                <p class="emar-med-signed">
                                  Signed by {entry.by} · {entry.at}
                                </p>
                              )}
                              {savingMedIds.has(med.id) && <p class="emar-med-saving">Saving to BlueStep…</p>}
                              {saveErrors[med.id] && (
                                <div class="emar-med-save-error">
                                  <p class="emar-med-save-error-text">
                                    Could not save this to BlueStep: {saveErrors[med.id]}
                                  </p>
                                  <button
                                    type="button"
                                    class="emar-btn emar-btn-outline"
                                    onClick={() => retryChartedDose(med.id)}
                                  >
                                    Retry save
                                  </button>
                                </div>
                              )}
                            </div>
                            <button type="button" class="emar-undo-btn" onClick={() => startCorrection(med, entry)}>
                              Undo
                            </button>
                          </div>
                        ) : (
                          <>
                            {correctionNote && (
                              <p class="emar-correction-note">
                                Originally charted: {describeEntry(correctionNote.original)}, signed by{' '}
                                {correctionNote.original.by} · {correctionNote.original.at} — corrected by{' '}
                                {correctionNote.correctedBy.fullName} · {correctionNote.correctedAt}
                              </p>
                            )}
                            <div class="emar-med-open">
                              <div class="emar-med-info">
                                <p class="emar-med-name">
                                  {med.name} <span class="emar-med-dose">{med.dose}</span>
                                </p>
                                <p class="emar-med-sig">{med.sig}</p>
                                {(med.reason || med.looks) && (
                                  <p class="emar-med-reason">
                                    {med.reason && `For ${med.reason}`}
                                    {med.reason && med.looks && ' · '}
                                    {med.looks && `Looks like: ${med.looks}`}
                                  </p>
                                )}
                                {med.flags.length > 0 && (
                                  <div class="emar-flag-row">
                                    {med.flags.map((f) => (
                                      <FlagPill flag={f} key={f.text} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div class="emar-med-actions">
                                <button
                                  type="button"
                                  class="emar-btn emar-btn-give"
                                  disabled={blockedByVitals}
                                  onClick={() =>
                                    openSignOff({
                                      kind: 'scheduled',
                                      medId: med.id,
                                      status: 'given',
                                      actionLabel: 'Give',
                                      medName: med.name,
                                      medDose: med.dose,
                                      isControlledSubstance,
                                    })
                                  }
                                >
                                  {blockedByVitals ? 'Vitals first' : 'Give'}
                                </button>
                                <button
                                  type="button"
                                  class="emar-btn emar-btn-outline"
                                  onClick={() => togglePicker(med.id, 'refuse')}
                                >
                                  Refused
                                </button>
                                <button
                                  type="button"
                                  class="emar-btn emar-btn-outline"
                                  onClick={() => togglePicker(med.id, 'hold')}
                                >
                                  Hold
                                </button>
                              </div>
                            </div>
                            {pickerOpen && (
                              <div
                                class="emar-reason-picker"
                                role="group"
                                aria-label={openPicker!.kind === 'refuse' ? 'Reason for refusal' : 'Reason for hold'}
                              >
                                {getReasonOptions(openPicker!.kind).map((reason) => (
                                  <button
                                    type="button"
                                    class="emar-reason-chip"
                                    onClick={() =>
                                      openSignOff({
                                        kind: 'scheduled',
                                        medId: med.id,
                                        status: openPicker!.kind === 'refuse' ? 'refused' : 'held',
                                        reason,
                                        actionLabel: openPicker!.kind === 'refuse' ? 'Refused' : 'Held',
                                        medName: med.name,
                                        medDose: med.dose,
                                        isControlledSubstance,
                                      })
                                    }
                                    key={reason}
                                  >
                                    {reason}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              <section class="emar-prn" aria-label="As-needed medications">
                <h3 class="emar-section-title">As needed (PRN)</h3>
                {selResident.prns.length === 0 ? (
                  <p class="emar-prn-empty">No PRN medications ordered.</p>
                ) : (
                  <div class="emar-prn-list">
                    {selResident.prns.map((prn) => (
                      <PrnRow
                        prn={prn}
                        entry={prnChartedState[prn.name]}
                        key={prn.name}
                        onGive={() =>
                          openSignOff({
                            kind: 'prn',
                            prnName: prn.name,
                            actionLabel: 'Give PRN',
                            medName: prn.name,
                            medDose: prn.dose,
                            isControlledSubstance: false,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>

              <div class="emar-footer-row">
                <p class="emar-disclaimer">
                  Charting is time-stamped to you. Refused and held doses go to the nurse's exception queue.
                </p>
                <button type="button" class="emar-btn emar-btn-give" onClick={nextResident}>
                  Next resident →
                </button>
              </div>
            </>
          ) : (
            <MonthlyMar resident={selResident} chartedState={chartedState} />
          )}

          <p class="emar-page-footer">
            Live BlueStep data for Jen's Sandbox. Charting a dose saves for real — pick a resident, record vitals,
            then give, refuse or hold doses.
          </p>
        </main>
      </div>

      {pendingAction && (
        <SignOffModal
          action={pendingAction}
          state={signOff}
          signedInStaff={signedInStaff}
          witnessOptions={getWitnessOptions(signedInStaff.staffId)}
          onPinChange={(value) => setSignOff((prev) => ({ ...prev, pin: value, error: null }))}
          onSubmitPrimary={submitPrimaryPin}
          onWitnessSelect={(staffId) =>
            setSignOff((prev) => ({ ...prev, witnessStaffId: staffId, witnessPin: '', witnessError: null }))
          }
          onWitnessPinChange={(value) => setSignOff((prev) => ({ ...prev, witnessPin: value, witnessError: null }))}
          onSubmitWitness={submitWitnessPin}
          onCancel={closeSignOff}
        />
      )}
    </div>
  )
}

function PrnRow({ prn, entry, onGive }: { prn: PrnMed; entry?: ChartEntry; onGive: () => void }) {
  return (
    <div class="emar-prn-row">
      <div class="emar-prn-info">
        <p class="emar-prn-name">
          {prn.name} <span class="emar-prn-dose">{prn.dose}</span>
        </p>
        <p class="emar-prn-sig">{prn.sig}</p>
        <p class={prn.ok ? 'emar-prn-last emar-prn-last-ok' : 'emar-prn-last emar-prn-last-wait'}>{prn.last}</p>
        {entry?.signature && <SignatureBlock signature={entry.signature} witness={entry.witness} />}
      </div>
      <button
        type="button"
        class={entry ? 'emar-btn emar-btn-disabled' : prn.ok ? 'emar-btn emar-btn-outline' : 'emar-btn emar-btn-disabled'}
        disabled={!!entry || !prn.ok}
        onClick={onGive}
      >
        {entry ? 'Given' : prn.ok ? 'Give PRN' : 'Not yet'}
      </button>
    </div>
  )
}

// Past days are a deterministic fill pattern for visual variety only — there's no real
// sign-off data behind them, so (unlike today's column) those cells stay non-interactive.
function pastDayCell(day: number, medIndex: number, med: ScheduledMed): { text: string; tone: 'given' | 'refused' | 'held' | 'missed' } {
  const v = (day * 7 + medIndex * 13 + med.id.length * 3) % 23
  if (v === 0) return { text: 'R', tone: 'refused' }
  if (v === 5 && medIndex % 2 === 0) return { text: 'H', tone: 'held' }
  if (v === 11 && med.id === 'dl-1') return { text: 'M', tone: 'missed' }
  return { text: GIVEN_INITIALS[(day + medIndex) % 4], tone: 'given' }
}

function todayCell(med: ScheduledMed, chartedState: ChartedState): { text: string; tone: 'given' | 'refused' | 'held' | 'blank' } {
  const entry = chartedState[med.id]
  if (!entry) return { text: '', tone: 'blank' }
  if (entry.status === 'given') return { text: initialsFromBy(entry.by), tone: 'given' }
  if (entry.status === 'refused') return { text: 'R', tone: 'refused' }
  return { text: 'H', tone: 'held' }
}

function marCellClass(tone: 'given' | 'refused' | 'held' | 'missed' | 'blank', isToday: boolean): string {
  let cls = 'emar-mar-cell'
  if (tone === 'refused') cls += ' emar-mar-cell-refused'
  if (tone === 'held') cls += ' emar-mar-cell-held'
  if (tone === 'missed') cls += ' emar-mar-cell-missed'
  if (isToday) cls += ' emar-mar-cell-today'
  return cls
}

interface MarPopoverState {
  medId: string
  top: number
  left: number
}

function MonthlyMar({ resident, chartedState }: { resident: EmarResident; chartedState: ChartedState }) {
  const [popover, setPopover] = useState<MarPopoverState | null>(null)
  const openEntry = popover ? chartedState[popover.medId] : undefined

  const now = new Date()
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const todayDay = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <section class="emar-mar-section" aria-label="Monthly MAR">
      <p class="emar-mar-caption">
        {monthLabel} · {resident.full}
      </p>
      <p class="emar-mar-legend">Initials = given · R = refused · H = held · M = missed · today outlined</p>

      <div class="emar-mar-wrap">
        <table class="emar-mar-table">
          <thead>
            <tr>
              <th class="emar-mar-corner">Medication</th>
              {days.map((d) => (
                <th class={d === todayDay ? 'emar-mar-daynum emar-mar-daynum-today' : 'emar-mar-daynum'} key={d}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resident.meds.map((med, medIndex) => (
              <tr key={med.id}>
                <th scope="row" class="emar-mar-rowhead">
                  {med.name} {med.schedAdminTime ? `· ${med.schedAdminTime}` : ''}
                </th>
                {days.map((d) => {
                  if (d < todayDay) {
                    const cell = pastDayCell(d, medIndex, med)
                    return (
                      <td class={marCellClass(cell.tone, false)} key={d}>
                        {cell.text}
                      </td>
                    )
                  }
                  if (d === todayDay) {
                    const cell = todayCell(med, chartedState)
                    const entry = chartedState[med.id]
                    const hasSignOff = !!entry?.signature
                    const popoverOpen = hasSignOff && popover?.medId === med.id

                    return (
                      <td class={marCellClass(cell.tone, true)} key={d}>
                        {hasSignOff ? (
                          <button
                            type="button"
                            class="emar-mar-cell-btn"
                            aria-haspopup="dialog"
                            aria-expanded={popoverOpen}
                            onClick={(e) => {
                              if (popover?.medId === med.id) {
                                setPopover(null)
                                return
                              }
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setPopover({ medId: med.id, top: rect.bottom + 4, left: rect.left })
                            }}
                          >
                            {cell.text}
                          </button>
                        ) : (
                          cell.text
                        )}
                      </td>
                    )
                  }
                  return <td class="emar-mar-cell emar-mar-cell-future" key={d} />
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p class="emar-mar-signature">
        {getSignatureKey()} Tap any cell to see the full sign-off with date and time.
      </p>

      <div class="emar-mar-links">
        <a href="#">Print MAR for survey</a>
        <a href="#">PRN history</a>
        <a href="#">Vitals trend</a>
      </div>

      {popover && openEntry?.signature && (
        <>
          <button
            type="button"
            class="emar-mar-popover-backdrop"
            aria-label="Close sign-off details"
            onClick={() => setPopover(null)}
          />
          <div
            class="emar-mar-popover"
            role="dialog"
            aria-label="Sign-off details"
            style={{ position: 'fixed', top: `${popover.top}px`, left: `${popover.left}px` }}
          >
            <p class="emar-mar-popover-line">
              <strong>{describeEntry(openEntry)}</strong>
            </p>
            <p class="emar-mar-popover-line">
              {openEntry.signature.fullName}, {openEntry.signature.credential}
            </p>
            <p class="emar-mar-popover-line">Signed {openEntry.signature.signedAt}</p>
            <p class="emar-mar-popover-line">
              ID {openEntry.signature.signatureId} · {openEntry.signature.method}
            </p>
            {openEntry.witness && (
              <p class="emar-mar-popover-line emar-mar-popover-witness">
                Witnessed by {openEntry.witness.fullName}, {openEntry.witness.credential} · {openEntry.witness.signedAt}{' '}
                · ID {openEntry.witness.signatureId}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
