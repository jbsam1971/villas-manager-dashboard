// Sample/placeholder data for the MAR / Medication dashboard.
//
// NOT real BlueStep data. Ported from the user's Design artifact mockup
// (MAR / Medication dashboard, https://claude.ai/artifact/4WrUeaGLaozVjE1E9bMR5u,
// project/MedDashboard.dc.html) per her explicit instruction to build with
// sample data first, same pattern as the Morning Huddle and Care Staff
// dashboards. Keep all data access behind this one file — real BlueStep
// queries get wired in later, function-by-function.

export type Tone = 'high' | 'med' | 'ok' | 'info' | 'neutral'

export interface MedCart {
  name: string
  who: string
  given: number
  due: number
  late: boolean
  flag: string
}

export interface MedPassNow {
  windowLabel: string
  minutesLeft: number
  givenCount: number
  dueCount: number
  stillDueOnTime: number
  atRiskOfLate: number
  refusedSoFar: number
  carts: MedCart[]
}

export function getMedPassNow(): MedPassNow {
  return {
    windowLabel: '8 AM med pass · window 7–9 AM',
    minutesLeft: 18,
    givenCount: 118,
    dueCount: 142,
    stillDueOnTime: 18,
    atRiskOfLate: 6,
    refusedSoFar: 2,
    carts: [
      { name: 'Cart 1 · Hall A', who: 'Ana R.', given: 38, due: 40, late: false, flag: 'On track' },
      { name: 'Cart 2 · Hall B', who: 'Luis M.', given: 34, due: 41, late: true, flag: '4 at risk' },
      { name: 'Cart 3 · Memory Care', who: 'Keisha W.', given: 27, due: 36, late: true, flag: '2 at risk' },
      { name: 'Cart 4 · Hall C', who: 'Ben O.', given: 19, due: 25, late: false, flag: 'On track' },
    ],
  }
}

export interface MedKpiTile {
  label: string
  value: string
  unit: string
  delta: string
  deltaTone: 'good' | 'bad' | 'neutral'
  target: string
  data: number[]
}

export function getMedKpiTiles(): MedKpiTile[] {
  return [
    { label: 'Doses given on time', value: '96.8', unit: '%', delta: '▼ 0.6 pts vs last week', deltaTone: 'bad', target: 'Goal 98%', data: [97.9, 97.6, 98.1, 97.7, 97.4, 97.8, 97.5, 97.2, 97.6, 97.1, 97.4, 96.8] },
    { label: 'Missed doses', value: '4', unit: 'last 7 days', delta: '▼ 3 vs prior week', deltaTone: 'good', target: 'Goal 0', data: [9, 8, 7, 9, 6, 7, 8, 5, 6, 7, 7, 4] },
    { label: 'Refused doses', value: '17', unit: 'last 7 days', delta: '▲ 5 vs prior week', deltaTone: 'bad', target: '2 residents = 52%', data: [10, 12, 11, 9, 12, 13, 11, 12, 14, 12, 12, 17] },
    { label: 'PRN follow-up charted', value: '91', unit: '%', delta: '▲ 4 pts vs October', deltaTone: 'good', target: 'Goal 100%', data: [82, 84, 83, 85, 86, 85, 87, 88, 87, 89, 90, 91] },
    { label: 'Medication errors', value: '2', unit: 'last 30 days', delta: 'Both late doses', deltaTone: 'neutral', target: 'Reviewed', data: [5, 4, 4, 3, 4, 3, 3, 2, 3, 2, 3, 2] },
    { label: 'Orders waiting', value: '5', unit: 'not yet on MAR', delta: 'Oldest 26 hours', deltaTone: 'bad', target: 'Goal under 24 h', data: [3, 2, 4, 3, 2, 5, 3, 4, 2, 3, 4, 5] },
    { label: 'Refills due in 5 days', value: '9', unit: 'meds', delta: '3 sent today', deltaTone: 'neutral', target: 'Auto-reorder on', data: [7, 8, 6, 9, 8, 7, 10, 8, 9, 8, 7, 9] },
    { label: 'Residents on 15+ meds', value: '13', unit: 'of 84', delta: '+1 this month', deltaTone: 'bad', target: 'Pharmacist review', data: [11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 13] },
  ]
}

export interface OrderFlowStep {
  label: string
  count: number
  note: string
  warn: boolean
}

/** "Order to administration" — where every new/changed order is right now, in pipeline order. */
export function getOrderFlow(): OrderFlowStep[] {
  return [
    { label: 'Order received', count: 3, note: 'From prescriber or hospital discharge', warn: false },
    { label: 'Nurse review', count: 2, note: '1 waiting over 4 hours', warn: true },
    { label: 'Pharmacy verified', count: 1, note: 'Sent to ManageRX', warn: false },
    { label: 'Delivered & checked in', count: 2, note: 'Arriving 2 PM delivery', warn: false },
    { label: 'Active on MAR', count: 1, note: 'First dose due 12 PM', warn: false },
    { label: 'First dose given', count: 4, note: 'Today, all charted', warn: false },
  ]
}

export type ExceptionType = 'Late' | 'Missed' | 'Refused' | 'Held'

export interface MedException {
  due: string
  name: string
  room: string
  med: string
  type: ExceptionType
  reason: string
  action: string
}

/** Every late, missed, refused or held dose needing a reason + follow-up. */
export function getMedExceptions(): MedException[] {
  return [
    { due: '7:00 AM', name: 'R. Okafor', room: 'MC-08', med: 'Donepezil 10 mg tab', type: 'Late', reason: 'Resident asleep, retry 8:30', action: 'Chart retry' },
    { due: '7:00 AM', name: 'J. Whitehorse', room: '121', med: 'Metoprolol 25 mg tab', type: 'Refused', reason: 'Said it makes him dizzy', action: 'Notify nurse' },
    { due: '7:30 AM', name: 'L. Sorensen', room: '118', med: 'Insulin glargine 18 units', type: 'Held', reason: 'Blood sugar 68, nurse notified', action: 'Nurse to sign' },
    { due: '8:00 AM', name: 'E. Brandt', room: 'MC-03', med: 'Quetiapine 25 mg tab', type: 'Refused', reason: 'Spit out, will re-offer', action: 'Chart re-offer' },
    { due: '8:00 AM', name: 'P. Nakamura', room: '230', med: 'Acetaminophen 500 mg tab', type: 'Late', reason: 'No reason entered', action: 'Add reason' },
    { due: 'Yesterday 8 PM', name: 'D. Lindqvist', room: '207', med: 'Apixaban 5 mg tab', type: 'Missed', reason: 'Not on cart after hospital return', action: 'Start med error report' },
    { due: 'Yesterday 4 PM', name: 'G. Hale', room: '125', med: 'Vitamin D3 1,000 IU', type: 'Missed', reason: 'No reason entered', action: 'Add reason' },
  ]
}

export interface PrnCheck {
  name: string
  room: string
  med: string
  due: string
  tone: Tone
}

export function getPrnChecks(): { checks: PrnCheck[]; dosesLast7Days: number; followUpChartedPercent: number } {
  return {
    dosesLast7Days: 47,
    followUpChartedPercent: 91,
    checks: [
      { name: 'P. Nakamura', room: '230', med: 'Acetaminophen 500 mg · pain 7/10 at 7:40', due: 'Due 8:40', tone: 'med' },
      { name: 'M. Alvarez', room: '114', med: 'Ibuprofen 400 mg · hip pain after fall', due: 'Overdue 12 min', tone: 'high' },
      { name: 'E. Brandt', room: 'MC-03', med: 'Lorazepam 0.5 mg · agitation at 7:55', due: 'Due 8:55', tone: 'med' },
      { name: 'J. Whitehorse', room: '121', med: 'Senna 8.6 mg · yesterday 9 PM', due: 'Charted', tone: 'ok' },
      { name: 'R. Okafor', room: 'MC-08', med: 'Ondansetron 4 mg · yesterday 6 PM', due: 'Charted', tone: 'ok' },
    ],
  }
}

export interface ControlledCount {
  label: string
  sub: string
  status: string
  tone: Tone
}

export function getControlledSubstances(): { counts: ControlledCount[]; discrepancies30d: number; residentsOnScheduled: number; destructionToWitness: number } {
  return {
    discrepancies30d: 0,
    residentsOnScheduled: 14,
    destructionToWitness: 1,
    counts: [
      { label: 'Night to day count', sub: 'Carts 1–4 · Ana R. and Devon K. · 5:55 AM', status: 'Matched', tone: 'ok' },
      { label: 'Day to evening count', sub: 'Due at 2:00 PM shift change', status: 'Due 2 PM', tone: 'neutral' },
      { label: 'Refrigerated lock box', sub: 'Lorazepam injection · checked 6:05 AM', status: 'Matched', tone: 'ok' },
    ],
  }
}

export interface HighRiskMed {
  label: string
  residentCount: number
  note: string
  warn: boolean
}

export function getHighRiskMeds(): HighRiskMed[] {
  return [
    { label: 'Antipsychotics', residentCount: 9, note: '1 without a supporting diagnosis on file', warn: true },
    { label: 'Anticoagulants', residentCount: 11, note: '1 missed dose this week', warn: true },
    { label: 'Insulin', residentCount: 7, note: '1 held dose today, low blood sugar', warn: false },
    { label: 'Opioids', residentCount: 6, note: 'All counts matched', warn: false },
    { label: '15 or more medications', residentCount: 13, note: 'Due for pharmacist review', warn: false },
  ]
}

export interface RefillItem {
  med: string
  who: string
  daysLeftLabel: string
  tone: Tone
}

export function getRefills(): { items: RefillItem[]; note: string } {
  return {
    note: '3 reorders sent to pharmacy today. 1 awaiting prescriber signature.',
    items: [
      { med: 'Apixaban 5 mg', who: 'D. Lindqvist · 207', daysLeftLabel: '1 day left', tone: 'high' },
      { med: 'Levothyroxine 50 mcg', who: 'G. Hale · 125', daysLeftLabel: '2 days left', tone: 'med' },
      { med: 'Insulin glargine pen', who: 'L. Sorensen · 118', daysLeftLabel: '3 days left', tone: 'med' },
      { med: 'Donepezil 10 mg', who: 'R. Okafor · MC-08', daysLeftLabel: 'Reorder sent', tone: 'info' },
      { med: 'Metoprolol 25 mg', who: 'J. Whitehorse · 121', daysLeftLabel: 'Reorder sent', tone: 'info' },
    ],
  }
}

export interface RefusalBucket {
  label: string
  count: number
}

export function getRefusalsByPass(): { buckets: RefusalBucket[]; totalRefused: number; insight: string } {
  return {
    totalRefused: 64,
    insight:
      'Two residents account for 31 of the 64 refusals, mostly at the 8 AM pass. Worth a care conference and a prescriber review of timing.',
    buckets: [
      { label: '6 AM', count: 9 },
      { label: '8 AM', count: 22 },
      { label: 'Noon', count: 8 },
      { label: '4 PM', count: 6 },
      { label: '8 PM', count: 15 },
      { label: 'Bedtime', count: 4 },
    ],
  }
}

export interface MedReport {
  name: string
  description: string
}

export function getMedReports(): MedReport[] {
  return [
    { name: 'Monthly MAR', description: 'The full MAR grid for a resident and month, with initials for every pass. Print for survey.' },
    { name: 'Late pass list', description: 'Doses given outside the window, by resident, cart and staff member, for any date range.' },
    { name: 'Pass variance', description: 'Every dose that was due but has no entry at all. Run before each shift ends.' },
    { name: 'Refusals & held doses', description: 'Who refused or had doses held, how often, and the reasons given.' },
    { name: 'PRN usage & effectiveness', description: 'Every PRN dose, the reason, and whether the follow-up was charted and effective.' },
    { name: 'Medication errors', description: 'Errors by type, cart and shift, linked to the incident report.' },
    { name: 'Controlled substance log', description: 'Shift counts, signatures, waste and destruction records.' },
    { name: 'Psychotropic review', description: 'Residents on psychotropics with diagnosis, start date and last prescriber review.' },
  ]
}

export interface MedDashboardHeader {
  dateLabel: string
  residentCount: number
  activeOrders: number
  passInProgressLabel: string
}

export function getMedDashboardHeader(): MedDashboardHeader {
  return {
    dateLabel: 'Medications, Tuesday Nov 24',
    residentCount: 84,
    activeOrders: 1142,
    passInProgressLabel: '8 AM pass in progress',
  }
}
