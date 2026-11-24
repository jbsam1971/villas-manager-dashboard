import { useEffect, useState } from 'preact/hooks'
import { Link } from 'preact-router'
import {
  getOvernightSummary,
  getAttentionCards,
  getKpiTiles,
  getOccupancyWeeks,
  getUnitsBreakdown,
  getLeasingSummary,
  getFallsHeatmap,
  getMedPassByShift,
  getStaffingToday,
  getSurveyReadiness,
  getOpenIncidentReports,
  getRecentIncidents,
  getHospitalTransfers,
} from '../lib/placeholders/morningHuddle.ts'
import type { Tone } from '../lib/placeholders/morningHuddle.ts'
import { fetchRooms } from '../lib/rooms.ts'
import { fetchResidentsToWatch } from '../lib/residentWarnings.ts'
import type { ResidentToWatch } from '../lib/residentWarnings.ts'
import { GqlError } from '../lib/gql.ts'
import { SignInPrompt } from '../components/SignInPrompt.tsx'
import './Dashboard.css'

// Most of this page is still the sample-data port of the reviewed Design
// artifact mockup (Direction A · deepBLU) — every number from
// src/lib/placeholders/morningHuddle.ts is still rendered synchronously and
// is clearly labeled sample data. Two pieces are now wired to real BlueStep
// data (see the `useEffect` below): the resident count in the header, and
// the "Residents to watch" panel, backed by BlueStep's own auto-generated
// dashboard-warning entries (lib/residentWarnings.ts) — confirmed live
// against Jen's Sandbox this session. Everything else (KPIs, occupancy
// trend, units breakdown, falls heat map, med pass, staffing, survey
// readiness, incidents, hospital transfers) still needs its own live
// discovery pass before it can be wired for real — not assumed here.

type RealDataState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: string }
  | { status: 'ready'; occupiedRoomCount: number; totalRoomCount: number; residentsToWatch: ResidentToWatch[] }

type RangeKey = 'today' | '7d' | '30d' | 'mtd'

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'mtd', label: 'MTD' },
]

const UNIT_SEGMENT_CLASSES = ['mh-unit-seg-a', 'mh-unit-seg-b', 'mh-unit-seg-c', 'mh-unit-seg-d', 'mh-unit-seg-e']

/** Builds a `<polyline points="...">` value normalized to a 0–24 y-range for a single tile's own min/max. */
function sparklinePoints(data: number[]): string {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  return data
    .map((v, i) => {
      const x = data.length > 1 ? (i * 100) / (data.length - 1) : 0
      const y = 26 - ((v - min) / range) * 24
      return `${x},${y}`
    })
    .join(' ')
}

/** Same visual scale the occupancy bars use (85–100% maps to 0–100% bar height), reused for the budget line. */
function occupancyBarPercent(value: number): number {
  return Math.max(0, Math.min(100, ((value - 85) / 10) * 100))
}

function pillClass(tone: Tone | 'done'): string {
  return `mh-pill mh-pill-${tone}`
}

function heatClass(value: number): string {
  if (value <= 0) return 'mh-heat-cell mh-heat-0'
  if (value === 1) return 'mh-heat-cell mh-heat-1'
  if (value === 2) return 'mh-heat-cell mh-heat-2'
  return 'mh-heat-cell mh-heat-3'
}

function IconExport() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function Dashboard() {
  const [range, setRange] = useState<RangeKey>('today')
  const [overnightVisible, setOvernightVisible] = useState(true)
  const [realData, setRealData] = useState<RealDataState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setRealData({ status: 'loading' })

    Promise.all([fetchRooms(), fetchResidentsToWatch()])
      .then(([rooms, residentsToWatch]) => {
        if (cancelled) return
        const occupiedRoomCount = rooms.filter((room) => room.residentTopIds.length > 0).length
        setRealData({ status: 'ready', occupiedRoomCount, totalRoomCount: rooms.length, residentsToWatch })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setRealData({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          code: err instanceof GqlError ? err.code : undefined,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const overnight = getOvernightSummary()
  const attentionCards = getAttentionCards()
  const kpiTiles = getKpiTiles()
  const { weeks, budgetPercent } = getOccupancyWeeks()
  const unitSegments = getUnitsBreakdown()
  const leasing = getLeasingSummary()
  const falls = getFallsHeatmap()
  const medPass = getMedPassByShift()
  const staffing = getStaffingToday()
  const survey = getSurveyReadiness()
  const openIncidents = getOpenIncidentReports()
  const recentIncidents = getRecentIncidents()
  const transfers = getHospitalTransfers()

  const unitsTotal = unitSegments.reduce((sum, seg) => sum + seg.count, 0)
  const budgetLinePercent = occupancyBarPercent(budgetPercent)
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div class="mh-page">
      <header class="mh-header">
        <div class="mh-header-left">
          <span class="mh-eyebrow">Manager's dashboard · some data is live, some is sample</span>
          <h1 class="mh-title">{todayLabel}</h1>
          <p class="mh-census-line">
            {realData.status === 'ready'
              ? `${realData.occupiedRoomCount} of ${realData.totalRoomCount} units occupied`
              : realData.status === 'error'
                ? 'Could not load live resident count'
                : 'Loading resident count…'}
            {' · on-leave and move-in tracking not yet connected'}
          </p>
        </div>
        <div class="mh-header-right">
          <div class="mh-range-toggle" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                class={range === r.key ? 'mh-range-btn mh-range-btn-active' : 'mh-range-btn'}
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" class="mh-btn mh-btn-outline">
            <IconExport />
            Export
          </button>
          <button type="button" class="mh-btn mh-btn-primary">
            Start morning huddle
          </button>
        </div>
      </header>

      <div class="mh-overnight-toggle-row">
        <button
          type="button"
          class="mh-overnight-toggle"
          aria-expanded={overnightVisible}
          onClick={() => setOvernightVisible((v) => !v)}
        >
          {overnightVisible ? 'Hide overnight summary' : 'Show overnight summary'}
        </button>
      </div>

      {overnightVisible && (
        <section class="mh-overnight" aria-label="Overnight summary, since 6 PM yesterday">
          <div class="mh-overnight-left">
            <div class="mh-overnight-eyebrow">
              <span class="mh-overnight-dot" aria-hidden="true" />
              SINCE 6 PM YESTERDAY
            </div>
            <h2 class="mh-overnight-headline">{overnight.headline}</h2>
            <ul class="mh-overnight-bullets">
              {overnight.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
          <div class="mh-overnight-actions">
            <a class="mh-btn mh-btn-primary" href="#">
              Open huddle notes
            </a>
            <a class="mh-btn mh-btn-outline-dark" href="#">
              See the {overnight.sourceEntryCount} source entries
            </a>
          </div>
        </section>
      )}

      <section class="mh-section">
        <div class="mh-section-header">
          <h2 class="mh-section-title">Needs attention today</h2>
          <span class="mh-section-note">Sorted by how soon it's due</span>
        </div>
        <div class="mh-attention-grid">
          {attentionCards.map((card) => (
            <a href="#" key={card.label} class={`mh-attention-card mh-tone-${card.tone}`}>
              <span class="mh-attention-area">
                <span class="mh-dot" aria-hidden="true" />
                {card.area}
              </span>
              <span class="mh-attention-count">{card.count}</span>
              <span class="mh-attention-label">{card.label}</span>
              <span class="mh-attention-sub">{card.sub}</span>
              <span class="mh-attention-cta">{card.cta} →</span>
            </a>
          ))}
        </div>
      </section>

      <section class="mh-section" aria-label="Key performance indicators">
        <h2 class="mh-visually-hidden">Key performance indicators</h2>
        <div class="mh-kpi-grid">
          {kpiTiles.map((tile) => (
            <div class="mh-kpi-tile" key={tile.label}>
              <span class="mh-kpi-label">{tile.label}</span>
              <div class="mh-kpi-value-row">
                <span class="mh-kpi-value">{tile.value}</span>
                {tile.unit && <span class="mh-kpi-unit">{tile.unit}</span>}
              </div>
              <svg
                class="mh-kpi-sparkline"
                viewBox="0 0 100 28"
                role="img"
                aria-label={`${tile.label} over the last 12 weeks, now ${tile.value} ${tile.unit}`.trim()}
              >
                <polyline points={sparklinePoints(tile.data)} vector-effect="non-scaling-stroke" />
              </svg>
              <div class="mh-kpi-foot">
                <span class={tile.deltaGood ? 'mh-kpi-delta mh-kpi-delta-good' : 'mh-kpi-delta mh-kpi-delta-bad'}>
                  {tile.delta}
                </span>
                <span class="mh-kpi-target">{tile.target}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div class="mh-row">
        <div class="mh-panel mh-panel--occupancy">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">Occupancy, last 12 weeks</h2>
            <span class="mh-panel-note">Budget {budgetPercent.toFixed(1)}% · dashed line</span>
          </div>
          <div class="mh-panel-body">
            <div class="mh-occ-chart-wrap">
              <div class="mh-occ-budget-line" style={{ bottom: `${budgetLinePercent}%` }} aria-hidden="true" />
              <div class="mh-occ-chart">
                {weeks.map((week, i) => (
                  <div class="mh-occ-bar-col" key={week.label}>
                    <span class="mh-occ-bar-value">{week.percent.toFixed(1)}</span>
                    <div
                      class={i === weeks.length - 1 ? 'mh-occ-bar mh-occ-bar-current' : 'mh-occ-bar'}
                      style={{ height: `${occupancyBarPercent(week.percent)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div class="mh-occ-weeks-footer">
              {weeks.map((week) => (
                <div class="mh-occ-week-col" key={week.label}>
                  <span class="mh-occ-week-label">{week.label}</span>
                  <span class="mh-occ-week-moves">
                    +{week.moveIns} / −{week.moveOuts}
                  </span>
                </div>
              ))}
            </div>
            <p class="mh-occ-caption">
              Each column shows physical occupancy for the week, with move-ins / move-outs underneath. Financial
              occupancy (paid units) sits 0.6 pts higher because 1 unit is reserved with a deposit.
            </p>
          </div>
        </div>

        <div class="mh-panel mh-panel--units">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">Units right now</h2>
            <Link class="mh-panel-link" href="/rent-roll">
              Open Rent Roll
            </Link>
          </div>
          <div class="mh-panel-body">
            <div
              class="mh-units-bar"
              role="img"
              aria-label={`Units breakdown: ${unitSegments.map((seg) => `${seg.label} ${seg.count}`).join(', ')}`}
            >
              {unitSegments.map((seg, i) => (
                <span
                  key={seg.label}
                  class={`mh-units-bar-seg ${UNIT_SEGMENT_CLASSES[i % UNIT_SEGMENT_CLASSES.length]}`}
                  style={{ width: `${(seg.count / unitsTotal) * 100}%` }}
                />
              ))}
            </div>
            <ul class="mh-units-legend">
              {unitSegments.map((seg, i) => (
                <li key={seg.label}>
                  <span
                    class={`mh-legend-swatch ${UNIT_SEGMENT_CLASSES[i % UNIT_SEGMENT_CLASSES.length]}`}
                    aria-hidden="true"
                  />
                  <span class="mh-legend-label">{seg.label}</span>
                  <span class="mh-legend-count">{seg.count}</span>
                </li>
              ))}
            </ul>
            <div class="mh-stat-row mh-stat-row-boxed">
              <div class="mh-stat">
                <span class="mh-stat-value">{leasing.toursThisWeek}</span>
                <span class="mh-stat-label">Tours this week</span>
              </div>
              <div class="mh-stat">
                <span class="mh-stat-value">{leasing.depositsTaken}</span>
                <span class="mh-stat-label">Deposits taken</span>
              </div>
              <div class="mh-stat">
                <span class="mh-stat-value">{leasing.moveInsScheduled}</span>
                <span class="mh-stat-label">Move-ins scheduled</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mh-row">
        <div class="mh-panel mh-panel--residents">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">Residents to watch</h2>
            <span class="mh-panel-note">Live from BlueStep's dashboard warnings</span>
          </div>
          {realData.status === 'loading' && <p class="mh-survey-note" style={{ padding: '0 24px 24px' }}>Loading…</p>}
          {realData.status === 'error' &&
            (realData.code === 'UNAUTHENTICATED' ? (
              <div style={{ padding: '0 24px 24px' }}>
                <SignInPrompt />
              </div>
            ) : (
              <p class="mh-survey-note" style={{ padding: '0 24px 24px' }}>Could not load: {realData.message}</p>
            ))}
          {realData.status === 'ready' && (
            <div class="mh-table-scroll">
              {realData.residentsToWatch.length === 0 ? (
                <p class="mh-survey-note" style={{ padding: '0 24px 24px' }}>No residents currently flagged.</p>
              ) : (
                <table class="mh-table">
                  <thead>
                    <tr>
                      <th>Resident</th>
                      <th>Room</th>
                      <th>Why they're flagged</th>
                      <th>Most recent warning</th>
                      <th class="mh-visually-hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realData.residentsToWatch.map((resident) => (
                      <tr key={resident.residentTopId}>
                        <td class="mh-table-strong">{resident.name}</td>
                        <td>{resident.room}</td>
                        <td>
                          <div class="mh-chip-row">
                            {resident.signals.map((signal, i) => (
                              <span key={`${signal}-${i}`} class={pillClass('info')}>
                                {signal}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td class={resident.overdue ? 'mh-text-error' : 'mh-text-secondary'}>
                          {resident.lastWarningDate ?? '—'}
                        </td>
                        <td>
                          <Link class="mh-panel-link" href={`/residents/${resident.residentTopId}`}>
                            Open chart
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div class="mh-panel mh-panel--falls">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">When falls happen</h2>
            <span class="mh-panel-note">Last 90 days · {falls.totalFalls} falls</span>
          </div>
          <div class="mh-panel-body">
            <div
              class="mh-heatgrid"
              role="img"
              aria-label={`Falls heat map, last 90 days, ${falls.totalFalls} falls total, by day of week and time block`}
            >
              <div class="mh-heatgrid-corner" aria-hidden="true" />
              {falls.columns.map((col) => (
                <div class="mh-heatgrid-colhead" key={col}>
                  {col}
                </div>
              ))}
              {falls.rows.flatMap((row, rowIdx) => [
                <div class="mh-heatgrid-rowhead" key={`row-${row.day}`}>
                  {row.day}
                </div>,
                ...row.cells.map((value, cellIdx) => (
                  <div class={heatClass(value)} key={`cell-${rowIdx}-${cellIdx}`}>
                    {value}
                  </div>
                )),
              ])}
            </div>
            <p class="mh-heat-insight">{falls.insight}</p>
          </div>
        </div>
      </div>

      <div class="mh-three-grid">
        <div class="mh-panel mh-panel--medpass">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">Med pass by shift</h2>
            <span class="mh-panel-note">Yesterday</span>
          </div>
          <div class="mh-panel-body">
            {medPass.shifts.map((shift) => (
              <div class="mh-medpass-shift" key={shift.shift}>
                <div class="mh-medpass-shift-row">
                  <span>
                    <strong>{shift.shift}</strong> · {shift.time} · {shift.doses} doses
                  </span>
                  <span class="mh-medpass-ontime-pct">{shift.onTimePercent}% on time</span>
                </div>
                <div
                  class="mh-medpass-bar"
                  role="img"
                  aria-label={`${shift.shift} shift: ${shift.onTimePercent}% on time, ${shift.latePercent}% late, ${shift.missedPercent}% missed, ${shift.refusedPercent}% refused`}
                >
                  <span class="mh-medpass-seg mh-medpass-seg-ontime" style={{ width: `${shift.onTimePercent}%` }} />
                  <span class="mh-medpass-seg mh-medpass-seg-late" style={{ width: `${shift.latePercent}%` }} />
                  <span class="mh-medpass-seg mh-medpass-seg-missed" style={{ width: `${shift.missedPercent}%` }} />
                  <span class="mh-medpass-seg mh-medpass-seg-refused" style={{ width: `${shift.refusedPercent}%` }} />
                </div>
              </div>
            ))}
            <div class="mh-medpass-legend">
              <span>
                <span class="mh-legend-swatch mh-medpass-seg-ontime" aria-hidden="true" /> On time
              </span>
              <span>
                <span class="mh-legend-swatch mh-medpass-seg-late" aria-hidden="true" /> Late
              </span>
              <span>
                <span class="mh-legend-swatch mh-medpass-seg-missed" aria-hidden="true" /> Missed
              </span>
              <span>
                <span class="mh-legend-swatch mh-medpass-seg-refused" aria-hidden="true" /> Refused
              </span>
            </div>
            <div class="mh-panel-footrow">
              <span>PRN effectiveness checks due</span>
              <a href="#" class="mh-footrow-link">
                {medPass.prnChecksDue}
              </a>
            </div>
          </div>
        </div>

        <div class="mh-panel mh-panel--staffing">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">Staffing today</h2>
            <a href="#" class="mh-panel-link">
              Open schedule
            </a>
          </div>
          <div class="mh-panel-body">
            {staffing.shifts.map((shift) => (
              <div class="mh-staffing-row" key={shift.shift}>
                <div class="mh-staffing-shift-name">
                  <strong>{shift.shift}</strong>
                  <span class="mh-text-secondary">{shift.time}</span>
                </div>
                <span class="mh-staffing-count">
                  {shift.scheduled} of {shift.required} scheduled
                </span>
                <span class={pillClass(shift.tone)}>{shift.status}</span>
              </div>
            ))}
            <div class="mh-stat-row">
              <div class="mh-stat">
                <span class="mh-stat-value">{staffing.callOffsToday}</span>
                <span class="mh-stat-label">Call-offs today</span>
              </div>
              <div class="mh-stat">
                <span class="mh-stat-value">{staffing.agencyHoursMtd}</span>
                <span class="mh-stat-label">Agency hours MTD</span>
              </div>
              <div class="mh-stat">
                <span class="mh-stat-value">{staffing.certsExpiringIn30Days}</span>
                <span class="mh-stat-label">Certifications expire in 30 days</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mh-panel mh-panel--survey">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">Survey readiness</h2>
            <a href="#" class="mh-panel-link">
              Open roster
            </a>
          </div>
          <div class="mh-panel-body">
            {survey.map((item) => {
              const percent = (item.done / item.total) * 100
              return (
                <div class="mh-survey-item" key={item.label}>
                  <div class="mh-survey-row">
                    <span>{item.label}</span>
                    <span>
                      {item.done} / {item.total}
                    </span>
                  </div>
                  <div class="mh-progress-track">
                    <div
                      class={percent >= 95 ? 'mh-progress-fill mh-progress-fill-good' : 'mh-progress-fill mh-progress-fill-warn'}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p class="mh-survey-note">{item.note}</p>
                </div>
              )
            })}
            <div class="mh-incident-subsection">
              <div class="mh-incident-subsection-header">
                <span class="mh-panel-title">Incident reports open beyond 72 hours</span>
                <a
                  href="#"
                  class="mh-incident-badge"
                  aria-label={`${openIncidents.count} incident reports open beyond 72 hours`}
                >
                  {openIncidents.count}
                </a>
              </div>
              {openIncidents.reports.map((report) => (
                <div class="mh-incident-row" key={report.resident}>
                  <span>
                    <strong>{report.resident}</strong> · {report.incidentType}
                  </span>
                  <span class="mh-text-error">Open {report.daysOpen} days</span>
                </div>
              ))}
              <p class="mh-survey-note">
                Investigation and follow-up not signed off within 72 hours of the incident.
              </p>
              <a href="#" class="mh-panel-link">
                Close out open reports →
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="mh-row">
        <div class="mh-panel mh-panel--incidents">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">Incidents, last 7 days</h2>
            <a href="#" class="mh-panel-link">
              All incident reports
            </a>
          </div>
          <div class="mh-table-scroll">
            <div class="mh-incidents-list">
              {recentIncidents.map((incident) => (
                <div class="mh-incidents-row" key={`${incident.when}-${incident.who}`}>
                  <span class="mh-incidents-when">{incident.when}</span>
                  <span class="mh-incidents-type">{incident.type}</span>
                  <span class="mh-incidents-who">{incident.who}</span>
                  <span class={pillClass(incident.tone)}>{incident.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div class="mh-panel mh-panel--transfers">
          <div class="mh-panel-header">
            <h2 class="mh-panel-title">Hospital transfers, 30 days</h2>
          </div>
          <div class="mh-panel-body">
            <div class="mh-stat-row">
              <div class="mh-stat">
                <span class="mh-stat-value mh-stat-value-lg">{transfers.sentOut}</span>
                <span class="mh-stat-label">Sent out</span>
              </div>
              <div class="mh-stat">
                <span class="mh-stat-value mh-stat-value-lg">{transfers.returned}</span>
                <span class="mh-stat-label">Returned</span>
              </div>
              <div class="mh-stat">
                <span class="mh-stat-value mh-stat-value-lg">{transfers.stillAdmitted}</span>
                <span class="mh-stat-label">Still admitted</span>
              </div>
            </div>
            <p class="mh-survey-note">{transfers.note}</p>
            <a href="#" class="mh-panel-link">
              Review returns →
            </a>
          </div>
        </div>
      </div>

      <p class="mh-footer">
        "Residents to watch" and the resident count above are live from BlueStep. Everything else on this page is
        still sample data for design review.
      </p>
    </div>
  )
}
