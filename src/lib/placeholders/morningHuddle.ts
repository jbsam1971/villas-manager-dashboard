// Sample/placeholder data for the Morning Huddle dashboard ("Today" page).
//
// NOT real BlueStep data. This whole file exists so the dashboard can be
// built and visually reviewed before any live /gql query is wired up —
// per the user's explicit instruction, every number below is sample data
// ported from her Design artifact's mockup (Direction A · deepBLU,
// https://claude.ai/artifact/4WrUeaGLaozVjE1E9bMR5u, project/Main.dc.html),
// not derived from this org's real residents. When the user is ready, each
// function below gets replaced by a real fetch from lib/*.ts (rooms.ts,
// billing.ts, residentProfile.ts, or new modules for data this app doesn't
// read yet — eMAR, staffing, incidents, surveys) — the function names and
// shapes are deliberately kept stable so that swap is a single-function
// change, not a page rewrite.

export type Tone = 'high' | 'med' | 'info' | 'ok'

export interface AttentionCard {
  area: string
  count: string
  label: string
  sub: string
  cta: string
  tone: Tone
}

/** "Needs attention today" cards, sorted by how soon each is due. */
export function getAttentionCards(): AttentionCard[] {
  return [
    { area: 'Medications', count: '3', label: 'Overdue med passes', sub: 'Oldest is 47 min late, Memory Care hall', cta: 'Open eMAR', tone: 'high' },
    { area: 'Falls', count: '1', label: 'Post-fall huddle due', sub: 'M. Alvarez, room 114 · due 2:40 PM', cta: 'Start huddle', tone: 'high' },
    { area: 'Incidents', count: '2', label: 'State reports due', sub: 'Both due tomorrow by 5 PM', cta: 'File reports', tone: 'high' },
    { area: 'Clinical', count: '1', label: 'Change in condition', sub: 'R. Okafor, weight down 6% in 30 days', cta: 'Review', tone: 'med' },
    { area: 'Care plans', count: '4', label: 'Assessments past due', sub: '2 are 30-day reviews after move-in', cta: 'Assign', tone: 'med' },
    { area: 'Staffing', count: '1', label: 'Open shift tonight', sub: 'CNA, 2 PM to 10 PM', cta: 'Fill shift', tone: 'info' },
  ]
}

export interface KpiTile {
  label: string
  value: string
  unit: string
  delta: string
  deltaGood: boolean
  target: string
  /** 12 weekly values, oldest first — the page computes the sparkline from this. */
  data: number[]
}

/** KPI tiles with 12-week trend data, delta, and target/budget. */
export function getKpiTiles(): KpiTile[] {
  return [
    { label: 'Occupancy', value: '91.4', unit: '%', delta: '▲ 0.8 pts vs October', deltaGood: true, target: 'Budget 93.0%', data: [89.1, 89.6, 90.2, 90.0, 89.4, 89.8, 90.6, 91.0, 90.7, 91.2, 91.0, 91.4] },
    { label: 'Census', value: '84', unit: 'of 92 units', delta: '+5 in / −3 out MTD', deltaGood: true, target: 'Net +2', data: [81, 81, 82, 82, 81, 82, 83, 83, 83, 84, 83, 84] },
    { label: 'Med pass on time', value: '96.8', unit: '%', delta: '▼ 0.6 pts vs last week', deltaGood: false, target: 'Goal 98%', data: [97.9, 97.6, 98.1, 97.7, 97.4, 97.8, 97.5, 97.2, 97.6, 97.1, 97.4, 96.8] },
    { label: 'Falls per 1,000 resident days', value: '6.1', unit: '', delta: '▼ 1.2 vs last month', deltaGood: true, target: 'Goal under 7', data: [8.4, 7.9, 8.1, 7.6, 7.3, 7.7, 7.2, 6.9, 7.0, 6.6, 6.4, 6.1] },
    { label: 'Care hours per resident day', value: '2.8', unit: 'hrs', delta: '0.1 under budget', deltaGood: false, target: 'Budget 2.9', data: [2.9, 2.9, 2.8, 2.9, 3.0, 2.9, 2.9, 2.8, 2.8, 2.9, 2.8, 2.8] },
    { label: 'Overtime', value: '4.6', unit: '% of hours', delta: '▲ 1.1 pts vs October', deltaGood: false, target: 'Goal under 4%', data: [3.1, 3.3, 3.0, 3.4, 3.6, 3.5, 3.9, 4.0, 4.2, 4.1, 4.4, 4.6] },
  ]
}

export interface OccupancyWeek {
  label: string
  percent: number
  moveIns: number
  moveOuts: number
}

/** Weekly occupancy % for the last 12 weeks, plus the budget line and move-in/out counts. */
export function getOccupancyWeeks(): { weeks: OccupancyWeek[]; budgetPercent: number } {
  const occ = [89.1, 89.6, 90.2, 90.0, 89.4, 89.8, 90.6, 91.0, 90.7, 91.2, 91.0, 91.4]
  const labels = ['Sep 1', 'Sep 8', 'Sep 15', 'Sep 22', 'Sep 29', 'Oct 6', 'Oct 13', 'Oct 20', 'Oct 27', 'Nov 3', 'Nov 10', 'Nov 17']
  const ins = [1, 1, 2, 0, 0, 1, 2, 1, 0, 2, 1, 1]
  const outs = [0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0]
  return {
    budgetPercent: 93.0,
    weeks: occ.map((percent, i) => ({ label: labels[i], percent, moveIns: ins[i], moveOuts: outs[i] })),
  }
}

export interface UnitSegment {
  label: string
  count: number
}

/** "Units right now" breakdown from Rent Roll. */
export function getUnitsBreakdown(): UnitSegment[] {
  return [
    { label: 'Occupied', count: 84 },
    { label: 'Vacant, ready to show', count: 4 },
    { label: 'Vacant, make-ready', count: 2 },
    { label: 'Reserved with deposit', count: 1 },
    { label: 'Out of service', count: 1 },
  ]
}

export function getLeasingSummary(): { toursThisWeek: number; depositsTaken: number; moveInsScheduled: number } {
  return { toursThisWeek: 7, depositsTaken: 2, moveInsScheduled: 2 }
}

export interface ResidentWatchSignal {
  text: string
  tone: Tone
}

export interface ResidentWatch {
  name: string
  room: string
  level: string
  last: string
  overdue: boolean
  signals: ResidentWatchSignal[]
}

/** Residents flagged from falls, eMAR, weights, vitals and hospital returns. */
export function getResidentsToWatch(): ResidentWatch[] {
  return [
    { name: 'M. Alvarez', room: '114', level: 'AL · Level 3', last: 'Nov 2', overdue: false, signals: [{ text: '2 falls in 30 days', tone: 'high' }, { text: 'New sedative Nov 18', tone: 'med' }] },
    { name: 'R. Okafor', room: 'MC-08', level: 'Memory Care', last: 'Oct 12', overdue: true, signals: [{ text: 'Weight −6% in 30 days', tone: 'high' }, { text: 'Refused 4 meals', tone: 'med' }] },
    { name: 'D. Lindqvist', room: '207', level: 'AL · Level 2', last: 'Nov 21', overdue: false, signals: [{ text: 'Hospital return Nov 21', tone: 'high' }, { text: 'Plan review due', tone: 'info' }] },
    { name: 'J. Whitehorse', room: '121', level: 'AL · Level 4', last: 'Oct 30', overdue: false, signals: [{ text: 'Refused meds 3× this week', tone: 'med' }] },
    { name: 'E. Brandt', room: 'MC-03', level: 'Memory Care', last: 'Nov 9', overdue: false, signals: [{ text: 'New antipsychotic', tone: 'med' }, { text: 'No supporting diagnosis', tone: 'high' }] },
    { name: 'P. Nakamura', room: '230', level: 'AL · Level 1', last: 'Oct 4', overdue: true, signals: [{ text: 'Pain 7+ twice this week', tone: 'med' }] },
  ]
}

export interface FallsHeatmapRow {
  day: string
  cells: number[]
}

/** Falls heat map: day of week x 4-hour block, last 90 days. */
export function getFallsHeatmap(): { columns: string[]; rows: FallsHeatmapRow[]; totalFalls: number; insight: string } {
  const columns = ['12–4a', '4–8a', '8–12p', '12–4p', '4–8p', '8–12a']
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const grid = [
    [0, 1, 0, 0, 1, 0],
    [0, 2, 0, 0, 1, 0],
    [0, 1, 1, 0, 2, 0],
    [1, 2, 0, 0, 1, 0],
    [0, 1, 0, 1, 2, 1],
    [0, 0, 0, 0, 1, 0],
    [0, 1, 0, 0, 0, 0],
  ]
  return {
    columns,
    rows: days.map((day, i) => ({ day, cells: grid[i] })),
    totalFalls: 19,
    insight: 'Falls cluster around the 6 AM and 6 PM shift changes. Worth checking hand-off rounding before adding more staff hours.',
  }
}

export interface ShiftMedPass {
  shift: string
  time: string
  doses: number
  onTimePercent: number
  latePercent: number
  missedPercent: number
  refusedPercent: number
}

/** Med pass on-time/late/missed/refused by shift, yesterday. */
export function getMedPassByShift(): { shifts: ShiftMedPass[]; prnChecksDue: number } {
  return {
    prnChecksDue: 5,
    shifts: [
      { shift: 'Day', time: '6a–2p', doses: 412, onTimePercent: 98.1, latePercent: 1.4, missedPercent: 0.2, refusedPercent: 0.3 },
      { shift: 'Evening', time: '2p–10p', doses: 368, onTimePercent: 96.4, latePercent: 2.6, missedPercent: 0.4, refusedPercent: 0.6 },
      { shift: 'Night', time: '10p–6a', doses: 96, onTimePercent: 94.0, latePercent: 4.8, missedPercent: 0.5, refusedPercent: 0.7 },
    ],
  }
}

export interface StaffingShift {
  shift: string
  time: string
  required: number
  scheduled: number
  status: string
  tone: Tone
}

/** Staffing required vs. scheduled per shift today, plus call-offs and certs. */
export function getStaffingToday(): {
  shifts: StaffingShift[]
  callOffsToday: number
  agencyHoursMtd: string
  certsExpiringIn30Days: number
} {
  return {
    callOffsToday: 2,
    agencyHoursMtd: '36 h',
    certsExpiringIn30Days: 3,
    shifts: [
      { shift: 'Day', time: '6 AM – 2 PM', required: 9, scheduled: 9, status: 'Covered', tone: 'ok' },
      { shift: 'Evening', time: '2 PM – 10 PM', required: 8, scheduled: 7, status: '1 open', tone: 'high' },
      { shift: 'Night', time: '10 PM – 6 AM', required: 4, scheduled: 4, status: 'Covered', tone: 'ok' },
    ],
  }
}

export interface ComplianceItem {
  label: string
  done: number
  total: number
  note: string
}

/** Survey-readiness progress bars. */
export function getSurveyReadiness(): ComplianceItem[] {
  return [
    { label: 'Service plans current', done: 78, total: 84, note: '6 due within 14 days' },
    { label: 'Assessments current', done: 80, total: 84, note: '4 past due · oldest 51 days' },
    { label: 'Staff training complete', done: 41, total: 46, note: 'Dementia care module is the gap' },
    { label: 'Staff TB screening current', done: 44, total: 46, note: '2 expire before Dec 15' },
  ]
}

export interface OpenIncidentReport {
  resident: string
  incidentType: string
  daysOpen: number
}

/**
 * Incident reports open beyond 72 hours: status not closed/signed off, and
 * now minus the incident datetime is greater than 72 hours. Returns days
 * open per report (the real query will compute this the same way, from the
 * incident's recorded datetime and current time).
 */
export function getOpenIncidentReports(): { count: number; reports: OpenIncidentReport[] } {
  const reports: OpenIncidentReport[] = [
    { resident: 'D. Lindqvist', incidentType: 'Fall with injury', daysOpen: 6 },
    { resident: 'E. Brandt', incidentType: 'Exit-seeking, door alarm', daysOpen: 4 },
  ]
  return { count: reports.length, reports }
}

export interface IncidentRow {
  when: string
  type: string
  who: string
  status: string
  tone: Tone | 'done'
}

/** Incidents in the last 7 days. */
export function getRecentIncidents(): IncidentRow[] {
  return [
    { when: 'Nov 24 · 2:40 AM', type: 'Fall, no injury', who: 'M. Alvarez · 114', status: 'Huddle due 2:40 PM', tone: 'high' },
    { when: 'Nov 23 · 7:15 PM', type: 'Late medication dose', who: 'R. Okafor · MC-08', status: 'Reviewed', tone: 'done' },
    { when: 'Nov 22 · 9:05 AM', type: 'Skin tear', who: 'J. Whitehorse · 121', status: 'State report due Nov 25', tone: 'med' },
    { when: 'Nov 20 · 4:50 PM', type: 'Exit-seeking, door alarm', who: 'E. Brandt · MC-03', status: 'State report due Nov 25', tone: 'med' },
    { when: 'Nov 18 · 6:20 AM', type: 'Fall with injury', who: 'D. Lindqvist · 207', status: 'Returned from hospital', tone: 'done' },
  ]
}

/** Hospital transfers in the last 30 days. */
export function getHospitalTransfers(): { sentOut: number; returned: number; stillAdmitted: number; note: string } {
  return {
    sentOut: 3,
    returned: 2,
    stillAdmitted: 1,
    note: 'D. Lindqvist returned Nov 21. Readmission review and service plan update are due within 72 hours of return.',
  }
}

export interface OvernightSummary {
  headline: string
  bullets: string[]
  sourceEntryCount: number
}

/** Overnight summary (since 6 PM yesterday), from incidents, eMAR and staffing. */
export function getOvernightSummary(): OvernightSummary {
  return {
    headline: 'One fall, no injury. Night med pass ran late in Memory Care. Evening shift is still one aide short.',
    bullets: [
      'M. Alvarez fell at 2:40 AM in room 114. Post-fall huddle is due by 2:40 PM.',
      'Night pass finished 94% on time; 3 Memory Care doses were 20–47 minutes late.',
      '2 call-offs for 2–10 PM. One is covered; one CNA shift is still open.',
    ],
    sourceEntryCount: 14,
  }
}

export interface CensusSummary {
  dateLabel: string
  residentsInBuilding: number
  onLeave: number
  pendingMoveIn: string
}

export function getCensusSummary(): CensusSummary {
  return {
    dateLabel: 'Tuesday, November 24',
    residentsInBuilding: 84,
    onLeave: 2,
    pendingMoveIn: 'Friday',
  }
}
