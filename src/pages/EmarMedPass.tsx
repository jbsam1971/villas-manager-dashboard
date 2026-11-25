import { useState } from 'preact/hooks'
import {
  getEmarCartInfo,
  getEmarQueue,
  getInitialChartedState,
  getReasonOptions,
  getSignatureKey,
} from '../lib/placeholders/emar.ts'
import type { EmarResident, MedFlag, MedFlagTone, ScheduledMed, PrnMed } from '../lib/placeholders/emar.ts'
import './EmarMedPass.css'

// Direct port of the reviewed Design artifact mockup (eMAR · med pass and
// monthly MAR, project/MAR.dc.html). Pure sample-data page — see
// src/lib/placeholders/emar.ts. No /gql call, no fetch; every interactive
// bit here (resident switching, vitals recording, give/refuse/hold with the
// inline reason picker, undo, the cart-wide pass tally, the monthly MAR
// grid's day fill) is local useState, matching the mockup's own reactive
// behavior. Full-bleed workflow page: renders its own header/layout from the
// top, same pattern as CareStaffShift.tsx — not wrapped in the manager
// sidebar shell. Wiring this to a real `/mar` route is out of scope here.

type ChartStatus = 'given' | 'refused' | 'held'

interface ChartEntry {
  status: ChartStatus
  at: string
  by: string
  why?: string
}

type ChartedState = Record<string, ChartEntry>

type TabKey = 'pass' | 'mar'

type ReasonPickerState = { medId: string; kind: 'refuse' | 'hold' } | null

const GIVEN_INITIALS = ['LM', 'AR', 'KW', 'BO']

const MONTH_LABEL = 'November 2026'
const TODAY_DAY = 24
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1)

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
  const residents = getEmarQueue()

  const [selKey, setSelKey] = useState(residents[0].key)
  const [chartedState, setChartedState] = useState<ChartedState>(getInitialChartedState())
  const [vitalsRecorded, setVitalsRecorded] = useState<Record<string, boolean>>({})
  const [tab, setTab] = useState<TabKey>('pass')
  const [openPicker, setOpenPicker] = useState<ReasonPickerState>(null)

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

  function chartMed(medId: string, status: ChartStatus, why?: string) {
    setChartedState((prev) => ({
      ...prev,
      [medId]: { status, at: formatChartTime(new Date()), by: cartInfo.signedInAs, why },
    }))
    setOpenPicker(null)
  }

  function undoMed(medId: string) {
    setChartedState((prev) => {
      const next = { ...prev }
      delete next[medId]
      return next
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
      note: nextMed ? (nextMed.dose.includes('units') ? 'Under the skin' : 'By mouth') : '—',
      warn: false,
    },
    { label: 'Time', checked: !!nextMed, note: nextMed ? 'Within 7:00 – 9:00 AM window' : '—', warn: false },
    {
      label: 'Reason',
      checked: !!nextMed && !vitalsBlocked,
      note: !nextMed ? '—' : vitalsBlocked ? 'Vitals needed' : nextMed.reason,
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

          <p class="emar-aside-caption">
            Residents leave this list when every dose for the pass is charted. On leave of absence: A. Brooks (125B).
          </p>
        </aside>

        <main class="emar-main">
          <section class="emar-resident-header" aria-label="Resident">
            <div class="emar-photo" aria-hidden="true">
              <span class="emar-photo-initials">{selResident.initials}</span>
              <span class="emar-photo-label">PHOTO</span>
            </div>

            <div class="emar-resident-id">
              <h2 class="emar-resident-fullname">{selResident.full}</h2>
              <p class="emar-resident-meta">
                Room {selResident.room} · DOB {selResident.dob} · {selResident.level}
              </p>
              <div class="emar-pill-row">
                <span class="emar-pill emar-pill-allergy">Allergies: {selResident.allergies}</span>
                <span class="emar-pill emar-pill-neutral">{selResident.swallow}</span>
              </div>
              <p class="emar-resident-alerts">Last 24 hours: {selResident.alerts}</p>
            </div>

            {selResident.vitals === null ? (
              <div class="emar-vitals-box">
                <p class="emar-vitals-line">None required this pass</p>
                <p class="emar-vitals-note">Last BP 132/80 yesterday 4 PM</p>
              </div>
            ) : vitalsDoneForSel ? (
              <div class="emar-vitals-box">
                <p class="emar-vitals-line">{selResident.vitals.got}</p>
              </div>
            ) : (
              <div class="emar-vitals-box emar-vitals-box-warn">
                <p class="emar-vitals-line">{selResident.vitals.need} needed</p>
                <button type="button" class="emar-btn emar-btn-outline" onClick={() => recordVitals(selResident.key)}>
                  Record {selResident.vitals.need.toLowerCase()}
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
                              <p class="emar-med-signed">
                                Signed by {entry.by} · {entry.at}
                              </p>
                            </div>
                            <button type="button" class="emar-undo-btn" onClick={() => undoMed(med.id)}>
                              Undo
                            </button>
                          </div>
                        ) : (
                          <>
                            <div class="emar-med-open">
                              <div class="emar-med-info">
                                <p class="emar-med-name">
                                  {med.name} <span class="emar-med-dose">{med.dose}</span>
                                </p>
                                <p class="emar-med-sig">{med.sig}</p>
                                <p class="emar-med-reason">
                                  For {med.reason} · Looks like: {med.looks}
                                </p>
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
                                  onClick={() => chartMed(med.id, 'given')}
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
                                    onClick={() => chartMed(med.id, openPicker!.kind === 'refuse' ? 'refused' : 'held', reason)}
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
                      <PrnRow prn={prn} key={prn.name} />
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
            Sample data for design review. Try it: pick a resident, record vitals, then give, refuse or hold doses.
          </p>
        </main>
      </div>
    </div>
  )
}

function PrnRow({ prn }: { prn: PrnMed }) {
  return (
    <div class="emar-prn-row">
      <div class="emar-prn-info">
        <p class="emar-prn-name">
          {prn.name} <span class="emar-prn-dose">{prn.dose}</span>
        </p>
        <p class="emar-prn-sig">{prn.sig}</p>
        <p class={prn.ok ? 'emar-prn-last emar-prn-last-ok' : 'emar-prn-last emar-prn-last-wait'}>{prn.last}</p>
      </div>
      <button type="button" class={prn.ok ? 'emar-btn emar-btn-outline' : 'emar-btn emar-btn-disabled'} disabled={!prn.ok}>
        {prn.ok ? 'Give PRN' : 'Not yet'}
      </button>
    </div>
  )
}

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

function MonthlyMar({ resident, chartedState }: { resident: EmarResident; chartedState: ChartedState }) {
  return (
    <section class="emar-mar-section" aria-label="Monthly MAR">
      <p class="emar-mar-caption">
        {MONTH_LABEL} · {resident.full}
      </p>
      <p class="emar-mar-legend">Initials = given · R = refused · H = held · M = missed · today outlined</p>

      <div class="emar-mar-wrap">
        <table class="emar-mar-table">
          <thead>
            <tr>
              <th class="emar-mar-corner">Medication</th>
              {DAYS.map((d) => (
                <th class={d === TODAY_DAY ? 'emar-mar-daynum emar-mar-daynum-today' : 'emar-mar-daynum'} key={d}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resident.meds.map((med, medIndex) => (
              <tr key={med.id}>
                <th scope="row" class="emar-mar-rowhead">
                  {med.name} · 8 AM
                </th>
                {DAYS.map((d) => {
                  if (d < TODAY_DAY) {
                    const cell = pastDayCell(d, medIndex, med)
                    return (
                      <td class={marCellClass(cell.tone, false)} key={d}>
                        {cell.text}
                      </td>
                    )
                  }
                  if (d === TODAY_DAY) {
                    const cell = todayCell(med, chartedState)
                    return (
                      <td class={marCellClass(cell.tone, true)} key={d}>
                        {cell.text}
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
    </section>
  )
}
