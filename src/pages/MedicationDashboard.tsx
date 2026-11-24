import { useState } from 'preact/hooks'
import {
  getMedDashboardHeader,
  getMedPassNow,
  getMedKpiTiles,
  getOrderFlow,
  getMedExceptions,
  getPrnChecks,
  getControlledSubstances,
  getHighRiskMeds,
  getRefills,
  getRefusalsByPass,
  getMedReports,
} from '../lib/placeholders/medDashboard.ts'
import type { Tone, ExceptionType } from '../lib/placeholders/medDashboard.ts'
import './MedicationDashboard.css'

// MAR / Medication dashboard — direct port of the reviewed Design artifact
// mockup (MAR / Medication dashboard), same pattern as Dashboard.tsx: pure
// sample data from src/lib/placeholders/medDashboard.ts, synchronous render,
// no /gql or fetch. This page sits inside the normal sidebar layout (routed
// at /medications in App.tsx), not full-bleed. Section `id`s below
// (#pass, #flow, #exceptions, #prn, #controlled, #highrisk, #refills,
// #reports) are load-bearing for the sidebar's "Jump to" links.

type RangeKey = 'today' | '7d' | '30d' | 'mtd'

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'mtd', label: 'MTD' },
]

type ExceptionFilter = 'All' | ExceptionType

const EXCEPTION_FILTERS: ExceptionFilter[] = ['All', 'Missed', 'Late', 'Refused', 'Held']

/** Builds a `<polyline points="...">` value normalized to a 0–24 y-range for a single tile's own min/max.
 *  Copied from Dashboard.tsx's sparklinePoints (kept per-page, not shared, per project convention). */
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

function pillClass(tone: Tone): string {
  return `med-pill med-pill-${tone}`
}

/** Late → error/high tone, Missed → high (error), Refused → info, Held → neutral. */
function exceptionTone(type: ExceptionType): Tone {
  switch (type) {
    case 'Late':
      return 'med'
    case 'Missed':
      return 'high'
    case 'Refused':
      return 'info'
    case 'Held':
      return 'neutral'
  }
}

function deltaClass(tone: 'good' | 'bad' | 'neutral'): string {
  if (tone === 'good') return 'med-kpi-delta med-kpi-delta-good'
  if (tone === 'bad') return 'med-kpi-delta med-kpi-delta-bad'
  return 'med-kpi-delta med-kpi-delta-neutral'
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

export function MedicationDashboard() {
  const [range, setRange] = useState<RangeKey>('today')
  const [exceptionFilter, setExceptionFilter] = useState<ExceptionFilter>('All')

  const header = getMedDashboardHeader()
  const passNow = getMedPassNow()
  const kpiTiles = getMedKpiTiles()
  const orderFlow = getOrderFlow()
  const exceptions = getMedExceptions()
  const prn = getPrnChecks()
  const controlled = getControlledSubstances()
  const highRisk = getHighRiskMeds()
  const refills = getRefills()
  const refusals = getRefusalsByPass()
  const reports = getMedReports()

  const exceptionCounts: Record<ExceptionFilter, number> = {
    All: exceptions.length,
    Missed: exceptions.filter((e) => e.type === 'Missed').length,
    Late: exceptions.filter((e) => e.type === 'Late').length,
    Refused: exceptions.filter((e) => e.type === 'Refused').length,
    Held: exceptions.filter((e) => e.type === 'Held').length,
  }
  const visibleExceptions =
    exceptionFilter === 'All' ? exceptions : exceptions.filter((e) => e.type === exceptionFilter)

  const maxRefusalCount = Math.max(...refusals.buckets.map((b) => b.count))
  const refusalsAriaLabel = `Refusals by time of pass, last 30 days: ${refusals.buckets
    .map((b) => `${b.label} ${b.count}`)
    .join(', ')}`

  return (
    <div class="med-page">
      <header class="med-header">
        <div class="med-header-left">
          <span class="med-eyebrow">MAR / Medication dashboard · sample data</span>
          <h1 class="med-title">{header.dateLabel}</h1>
          <p class="med-census-line">
            {header.residentCount} residents · {header.activeOrders} active orders · {header.passInProgressLabel}
          </p>
        </div>
        <div class="med-header-right">
          <div class="med-range-toggle" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                class={range === r.key ? 'med-range-btn med-range-btn-active' : 'med-range-btn'}
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label class="med-search">
            <IconSearch />
            <span class="med-visually-hidden">Find a resident or medication</span>
            <input type="search" placeholder="Resident or medication" />
          </label>
          <a href="#" class="med-btn med-btn-primary">
            Open eMAR
          </a>
        </div>
      </header>

      <section class="med-pass-panel" id="pass" aria-label="Med pass now">
        <div class="med-pass-top">
          <span class="med-pass-eyebrow">
            <span class="med-pass-dot" aria-hidden="true" />
            {passNow.windowLabel}
          </span>
          <span class="med-pass-minutes">{passNow.minutesLeft} minutes left in the window</span>
        </div>
        <div class="med-pass-stats">
          <div class="med-pass-stat">
            <span class="med-pass-stat-value">
              {passNow.givenCount} <span class="med-pass-stat-value-of">of {passNow.dueCount}</span>
            </span>
            <span class="med-pass-stat-label">doses given</span>
          </div>
          <div class="med-pass-stat">
            <span class="med-pass-stat-value">{passNow.stillDueOnTime}</span>
            <span class="med-pass-stat-label">still due, on time</span>
          </div>
          <div class="med-pass-stat">
            <span class="med-pass-stat-value med-pass-stat-value-risk">{passNow.atRiskOfLate}</span>
            <span class="med-pass-stat-label">at risk of running late</span>
          </div>
          <div class="med-pass-stat">
            <span class="med-pass-stat-value">{passNow.refusedSoFar}</span>
            <span class="med-pass-stat-label">refused so far</span>
          </div>
        </div>
        <div class="med-cart-grid">
          {passNow.carts.map((cart) => (
            <div class="med-cart-card" key={cart.name}>
              <div class="med-cart-row">
                <strong>{cart.name}</strong>
                <span class="med-cart-who">{cart.who}</span>
              </div>
              <div
                class="med-cart-track"
                role="img"
                aria-label={`${cart.name}: ${cart.given} of ${cart.due} given`}
              >
                <span
                  class={cart.late ? 'med-cart-fill med-cart-fill-late' : 'med-cart-fill'}
                  style={{ width: `${Math.min(100, (cart.given / cart.due) * 100)}%` }}
                />
              </div>
              <div class="med-cart-row">
                <span class="med-cart-given">
                  {cart.given} of {cart.due} given
                </span>
                <span class={cart.late ? 'med-cart-flag med-cart-flag-late' : 'med-cart-flag'}>{cart.flag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section class="med-section" aria-label="Medication key numbers">
        <h2 class="med-visually-hidden">Medication key numbers</h2>
        <div class="med-kpi-grid">
          {kpiTiles.map((tile) => (
            <a href="#" class="med-kpi-tile" key={tile.label}>
              <span class="med-kpi-label">{tile.label}</span>
              <div class="med-kpi-value-row">
                <span class="med-kpi-value">{tile.value}</span>
                {tile.unit && <span class="med-kpi-unit">{tile.unit}</span>}
              </div>
              <svg
                class="med-kpi-sparkline"
                viewBox="0 0 100 28"
                role="img"
                aria-label={`${tile.label} trend, now ${tile.value} ${tile.unit}`.trim()}
              >
                <polyline points={sparklinePoints(tile.data)} vector-effect="non-scaling-stroke" />
              </svg>
              <div class="med-kpi-foot">
                <span class={deltaClass(tile.deltaTone)}>{tile.delta}</span>
                <span class="med-kpi-target">{tile.target}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section class="med-section" id="flow">
        <div class="med-section-header">
          <h2 class="med-section-title">Order to administration</h2>
          <span class="med-section-note">
            Where every new or changed order is right now · tap a step to see the orders in it
          </span>
        </div>
        <div class="med-flow-row">
          {orderFlow.map((step, i) => (
            <>
              <a href="#" class={step.warn ? 'med-flow-step med-flow-step-warn' : 'med-flow-step'} key={step.label}>
                <span class="med-flow-step-number">Step {i + 1}</span>
                <span class="med-flow-step-label">{step.label}</span>
                <span class="med-flow-step-count">{step.count}</span>
                <span class={step.warn ? 'med-flow-step-note med-flow-step-note-warn' : 'med-flow-step-note'}>
                  {step.note}
                </span>
              </a>
              {i < orderFlow.length - 1 && (
                <span class="med-flow-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </>
          ))}
        </div>
      </section>

      <div class="med-row">
        <div class="med-panel med-panel--exceptions" id="exceptions">
          <div class="med-panel-header">
            <h2 class="med-panel-title">Exceptions to resolve</h2>
          </div>
          <div class="med-panel-body">
            <div class="med-filter-group" role="group" aria-label="Filter exceptions">
              {EXCEPTION_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  class={exceptionFilter === f ? 'med-filter-btn med-filter-btn-active' : 'med-filter-btn'}
                  aria-pressed={exceptionFilter === f}
                  onClick={() => setExceptionFilter(f)}
                >
                  {f} · {exceptionCounts[f]}
                </button>
              ))}
            </div>
            <div class="med-table-scroll">
              <table class="med-table">
                <thead>
                  <tr>
                    <th>Due</th>
                    <th>Resident</th>
                    <th>Medication</th>
                    <th>Exception</th>
                    <th>Reason given</th>
                    <th class="med-visually-hidden">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleExceptions.map((e, i) => (
                    <tr key={`${e.name}-${e.due}-${i}`}>
                      <td>{e.due}</td>
                      <td>
                        <div class="med-table-resident">
                          <span class="med-table-strong">{e.name}</span>
                          <span class="med-text-secondary">{e.room}</span>
                        </div>
                      </td>
                      <td>{e.med}</td>
                      <td>
                        <span class={pillClass(exceptionTone(e.type))}>{e.type}</span>
                      </td>
                      <td class={e.reason === 'No reason entered' ? 'med-text-error' : undefined}>{e.reason}</td>
                      <td>
                        <a href="#" class="med-panel-link">
                          {e.action}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="med-caption">
              Every late, missed, refused or held dose needs a reason and a follow-up before the end of the shift.
            </p>
          </div>
        </div>

        <div class="med-panel med-panel--prn" id="prn">
          <div class="med-panel-header">
            <h2 class="med-panel-title">PRN effectiveness checks</h2>
            <span class="med-panel-note">Due within 60 min of the dose</span>
          </div>
          <div class="med-panel-body">
            <div class="med-prn-list">
              {prn.checks.map((check, i) => (
                <div class="med-prn-row" key={`${check.name}-${i}`}>
                  <div class="med-prn-who">
                    <span class="med-table-strong">
                      {check.name} · {check.room}
                    </span>
                    <span class="med-text-secondary">{check.med}</span>
                  </div>
                  <span class={pillClass(check.tone)}>{check.due}</span>
                </div>
              ))}
            </div>
            <div class="med-stat-row">
              <div class="med-stat">
                <span class="med-stat-value">{prn.dosesLast7Days}</span>
                <span class="med-stat-label">PRN doses last 7 days</span>
              </div>
              <div class="med-stat">
                <span class="med-stat-value">{prn.followUpChartedPercent}%</span>
                <span class="med-stat-label">With follow-up charted</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="med-three-grid">
        <div class="med-panel med-panel--controlled" id="controlled">
          <div class="med-panel-header">
            <h2 class="med-panel-title">Controlled substances</h2>
            <a href="#" class="med-panel-link">
              Count log
            </a>
          </div>
          <div class="med-panel-body">
            <div class="med-list">
              {controlled.counts.map((c) => (
                <div class="med-list-row" key={c.label}>
                  <div class="med-list-col">
                    <span class="med-table-strong">{c.label}</span>
                    <span class="med-text-secondary med-list-sub">{c.sub}</span>
                  </div>
                  <span class={pillClass(c.tone)}>{c.status}</span>
                </div>
              ))}
            </div>
            <div class="med-stat-row med-stat-row-3">
              <div class="med-stat">
                <span class="med-stat-value">{controlled.discrepancies30d}</span>
                <span class="med-stat-label">Discrepancies 30 days</span>
              </div>
              <div class="med-stat">
                <span class="med-stat-value">{controlled.residentsOnScheduled}</span>
                <span class="med-stat-label">Residents on scheduled drugs</span>
              </div>
              <div class="med-stat">
                <span class="med-stat-value">{controlled.destructionToWitness}</span>
                <span class="med-stat-label">Destruction to witness</span>
              </div>
            </div>
          </div>
        </div>

        <div class="med-panel med-panel--highrisk" id="highrisk">
          <div class="med-panel-header">
            <h2 class="med-panel-title">High-risk medications</h2>
            <span class="med-panel-note">Residents on each</span>
          </div>
          <div class="med-panel-body">
            <div class="med-list">
              {highRisk.map((item) => (
                <a href="#" class="med-highrisk-row" key={item.label}>
                  <div class="med-highrisk-top">
                    <span>{item.label}</span>
                    <strong>{item.residentCount}</strong>
                  </div>
                  <div
                    class="med-highrisk-track"
                    role="img"
                    aria-label={`${item.label}: ${item.residentCount} residents`}
                  >
                    <span
                      class={item.warn ? 'med-highrisk-fill med-highrisk-fill-warn' : 'med-highrisk-fill'}
                      style={{ width: `${Math.min(100, (item.residentCount / 84) * 100 * 4)}%` }}
                    />
                  </div>
                  <span class={item.warn ? 'med-highrisk-note med-highrisk-note-warn' : 'med-highrisk-note'}>
                    {item.note}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div class="med-panel med-panel--refills" id="refills">
          <div class="med-panel-header">
            <h2 class="med-panel-title">Refills &amp; supply</h2>
            <a href="#" class="med-panel-link">
              Send reorder
            </a>
          </div>
          <div class="med-panel-body">
            <div class="med-list">
              {refills.items.map((item) => (
                <div class="med-list-row" key={item.med}>
                  <div class="med-list-col">
                    <span class="med-table-strong">{item.med}</span>
                    <span class="med-text-secondary med-list-sub">{item.who}</span>
                  </div>
                  <span class={pillClass(item.tone)}>{item.daysLeftLabel}</span>
                </div>
              ))}
            </div>
            <p class="med-note-paragraph">{refills.note}</p>
          </div>
        </div>
      </div>

      <section class="med-section">
        <div class="med-section-header">
          <h2 class="med-section-title">Refusals, last 30 days</h2>
          <span class="med-section-note">By time of pass · {refusals.totalRefused} refused doses</span>
        </div>
        <div class="med-chart" role="img" aria-label={refusalsAriaLabel}>
          {refusals.buckets.map((bucket) => (
            <div class="med-chart-bar-col" key={bucket.label}>
              <span class="med-chart-bar-value">{bucket.count}</span>
              <div
                class={bucket.count === maxRefusalCount ? 'med-chart-bar med-chart-bar-peak' : 'med-chart-bar'}
                style={{ height: `${(bucket.count / maxRefusalCount) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div class="med-chart-labels">
          {refusals.buckets.map((bucket) => (
            <span class="med-chart-label" key={bucket.label}>
              {bucket.label}
            </span>
          ))}
        </div>
        <p class="med-note-paragraph">{refusals.insight}</p>
      </section>

      <section class="med-section" id="reports">
        <h2 class="med-section-title">Medication reports</h2>
        <div class="med-reports-grid">
          {reports.map((report) => (
            <a href="#" class="med-report-card" key={report.name}>
              <span class="med-report-name">{report.name}</span>
              <p class="med-report-description">{report.description}</p>
              <span class="med-report-cta">Run report →</span>
            </a>
          ))}
        </div>
      </section>

      <p class="med-footer">
        Sample data for design review. Each number links to the MAR entries it was counted from.
      </p>
    </div>
  )
}
