// Sample/placeholder data for the eMAR med-pass workflow page.
//
// NOT real BlueStep data. Ported from the user's Design artifact mockup
// (eMAR · med pass and monthly MAR, https://claude.ai/artifact/4WrUeaGLaozVjE1E9bMR5u,
// project/MAR.dc.html) per her explicit instruction to build with sample
// data first. Resident names/rooms deliberately reuse the same sample
// universe as src/lib/placeholders/careStaffShift.ts (J. Whitehorse 121,
// R. Okafor MC-08, L. Sorensen 118, D. Lindqvist 207, G. Hale 125) for
// continuity across the app's mockups. When this is wired to real data,
// this module gets replaced by a real fetch (active orders + MAR entries
// for one cart/hall's pass) — the shapes below are kept close to what
// that fetch will need to return.

export type MedFlagTone = 'risk' | 'warn' | 'cs' | 'neutral'

export interface MedFlag {
  text: string
  tone: MedFlagTone
}

export interface VitalsRequirement {
  /** e.g. "BP and pulse" */
  need: string
  /** The reading once recorded this pass, e.g. "BP 128/76 · pulse 68 · 8:31 AM" */
  got: string
  /** The hold rule, e.g. "Required before metoprolol. Hold if SBP under 100 or pulse under 55." */
  rule: string
}

export interface ScheduledMed {
  id: string
  name: string
  dose: string
  sig: string
  reason: string
  looks: string
  needsVitals?: boolean
  flags: MedFlag[]
}

export interface PrnMed {
  name: string
  dose: string
  sig: string
  last: string
  /** Whether it's within protocol to give right now. */
  ok: boolean
}

export interface EmarResident {
  key: string
  initials: string
  full: string
  name: string
  room: string
  dob: string
  level: string
  allergies: string
  swallow: string
  /** "Last 24 hours" alert line. */
  alerts: string
  vitals: VitalsRequirement | null
  meds: ScheduledMed[]
  prns: PrnMed[]
}

export function getEmarCartInfo(): { cartLabel: string; passLabel: string; signedInAs: string; minutesLeft: number } {
  return {
    cartLabel: 'eMAR · Cart 2 · Hall B',
    passLabel: '8 AM pass · window 7:00 – 9:00',
    signedInAs: 'Luis Martinez, Med tech',
    minutesLeft: 18,
  }
}

function flag(text: string, tone: MedFlagTone = 'neutral'): MedFlag {
  return { text, tone }
}

export function getEmarQueue(): EmarResident[] {
  return [
    {
      key: 'jw',
      initials: 'JW',
      full: 'James Whitehorse',
      name: 'J. Whitehorse',
      room: '121',
      dob: '03/14/1938',
      level: 'AL Level 4',
      allergies: 'Penicillin, Sulfa',
      swallow: 'Swallows whole · water',
      alerts: 'pain 6/10 at 2 AM · no BM for 2 days',
      vitals: {
        need: 'BP and pulse',
        got: 'BP 128/76 · pulse 68 · 8:31 AM',
        rule: 'Required before metoprolol. Hold if SBP under 100 or pulse under 55.',
      },
      meds: [
        { id: 'jw-1', name: 'Metoprolol tartrate', dose: '25 mg tablet', sig: 'Give 1 tablet by mouth at 8 AM', reason: 'blood pressure', looks: 'white, round, "M 25"', needsVitals: true, flags: [flag('Hold if SBP < 100 or HR < 55', 'warn')] },
        { id: 'jw-2', name: 'Lisinopril', dose: '10 mg tablet', sig: 'Give 1 tablet by mouth daily', reason: 'blood pressure', looks: 'pink, round, "L 10"', flags: [] },
        { id: 'jw-3', name: 'Furosemide', dose: '20 mg tablet', sig: 'Give 1 tablet by mouth every morning', reason: 'fluid retention', looks: 'white, round, "3169 V"', flags: [flag('Weigh before giving'), flag('Late dose: 7:00 AM', 'risk')] },
        { id: 'jw-4', name: 'Oxycodone', dose: '5 mg tablet', sig: 'Give 1 tablet by mouth at 8 AM', reason: 'chronic back pain', looks: 'white, round, "K 56"', flags: [flag('Controlled · count 23 → 22', 'cs'), flag('Pain score required')] },
        { id: 'jw-5', name: 'Docusate sodium', dose: '100 mg capsule', sig: 'Give 1 capsule by mouth twice daily', reason: 'constipation', looks: 'red, oval softgel', flags: [] },
      ],
      prns: [
        { name: 'Acetaminophen', dose: '650 mg', sig: 'Every 6 hours as needed for pain over 4/10. Max 3 g a day.', last: 'Last given 2:10 AM · OK to give now', ok: true },
        { name: 'Senna', dose: '8.6 mg', sig: 'At bedtime as needed if no BM in 2 days', last: 'Not until bedtime', ok: false },
      ],
    },
    {
      key: 'ro',
      initials: 'RO',
      full: 'Ruth Okafor',
      name: 'R. Okafor',
      room: 'MC-08',
      dob: '07/02/1941',
      level: 'Memory Care',
      allergies: 'No known drug allergies',
      swallow: 'Crush OK · give in applesauce',
      alerts: 'refused 4 AM dose, took at 4:40 · ate 25% at dinner',
      vitals: null,
      meds: [
        { id: 'ro-1', name: 'Donepezil', dose: '10 mg tablet', sig: 'Give 1 tablet by mouth daily', reason: 'memory', looks: 'yellow, round, "10"', flags: [flag('Late dose: 7:00 AM', 'risk')] },
        { id: 'ro-2', name: 'Sertraline', dose: '50 mg tablet', sig: 'Give 1 tablet by mouth daily', reason: 'depression', looks: 'blue, oblong, "Z 50"', flags: [flag('Psychotropic · watch for side effects')] },
        { id: 'ro-3', name: 'Calcium + vitamin D', dose: '600 mg / 400 IU', sig: 'Give 1 tablet with breakfast', reason: 'bone health', looks: 'white, oval', flags: [] },
      ],
      prns: [{ name: 'Ondansetron', dose: '4 mg ODT', sig: 'Every 8 hours as needed for nausea', last: 'Last given yesterday 6 PM · OK to give', ok: true }],
    },
    {
      key: 'ls',
      initials: 'LS',
      full: 'Linnea Sorensen',
      name: 'L. Sorensen',
      room: '118',
      dob: '11/29/1944',
      level: 'AL Level 2',
      allergies: 'Codeine',
      swallow: 'Swallows whole · water',
      alerts: 'blood sugar 68 at 7:25 AM, juice given',
      vitals: {
        need: 'Blood sugar',
        got: 'Blood sugar 104 · 8:34 AM (recheck)',
        rule: 'Required before insulin. Hold and call nurse if under 70.',
      },
      meds: [
        { id: 'ls-1', name: 'Insulin glargine', dose: '18 units', sig: 'Inject 18 units under the skin every morning', reason: 'diabetes', looks: 'pen · rotate site (last: left abdomen)', needsVitals: true, flags: [flag('Hold if blood sugar < 70', 'warn'), flag('High-alert medication', 'risk')] },
        { id: 'ls-2', name: 'Metformin', dose: '500 mg tablet', sig: 'Give 1 tablet by mouth with breakfast', reason: 'diabetes', looks: 'white, round, "142"', flags: [flag('Give with food')] },
      ],
      prns: [{ name: 'Glucose gel', dose: '15 g', sig: 'For blood sugar under 70. Recheck in 15 minutes.', last: 'Not given today', ok: true }],
    },
    {
      key: 'dl',
      initials: 'DL',
      full: 'David Lindqvist',
      name: 'D. Lindqvist',
      room: '207',
      dob: '05/08/1936',
      level: 'AL Level 2',
      allergies: 'Latex',
      swallow: 'Swallows whole · water',
      alerts: 'returned from hospital Nov 21 · 2 new orders',
      vitals: null,
      meds: [
        { id: 'dl-1', name: 'Apixaban', dose: '5 mg tablet', sig: 'Give 1 tablet by mouth twice daily', reason: 'blood clot prevention', looks: 'pink, oval, "894 5"', flags: [flag('New order Nov 21'), flag('Missed last night', 'risk')] },
        { id: 'dl-2', name: 'Atorvastatin', dose: '20 mg tablet', sig: 'Give 1 tablet by mouth daily', reason: 'cholesterol', looks: 'white, oval, "PD 155"', flags: [] },
      ],
      prns: [],
    },
    {
      key: 'hale',
      initials: 'GH',
      full: 'George Hale',
      name: 'G. Hale',
      room: '125',
      dob: '09/17/1939',
      level: 'AL Level 1',
      allergies: 'No known drug allergies',
      swallow: 'Swallows whole · water',
      alerts: 'none',
      vitals: null,
      meds: [
        { id: 'hale-1', name: 'Levothyroxine', dose: '50 mcg tablet', sig: 'Give 1 tablet by mouth at 6 AM, empty stomach', reason: 'thyroid', looks: 'white, round', flags: [] },
        { id: 'hale-2', name: 'Vitamin D3', dose: '1,000 IU', sig: 'Give 1 tablet daily', reason: 'supplement', looks: 'yellow softgel', flags: [] },
      ],
      prns: [],
    },
  ]
}

/** Two meds already charted earlier in the shift, before the user opens the page. */
export function getInitialChartedState(): Record<string, { status: 'given' | 'refused' | 'held'; at: string; by: string; why?: string }> {
  return {
    'hale-1': { status: 'given', at: 'Nov 24, 2026 at 6:04 AM', by: 'Ana Ruiz, Med tech' },
    'hale-2': { status: 'given', at: 'Nov 24, 2026 at 8:12 AM', by: 'Luis Martinez, Med tech' },
  }
}

export function getReasonOptions(kind: 'refuse' | 'hold'): string[] {
  return kind === 'refuse'
    ? ['Said no, will re-offer', 'Asleep', 'Spit out', 'Nausea', 'Other']
    : ['Outside hold parameters', 'Nurse instruction', 'Out of stock', 'Resident away', 'Other']
}

export function getSignatureKey(): string {
  return 'LM Luis Martinez, Med tech · AR Ana Ruiz, Med tech · KW Keisha Williams, Med tech · BO Ben Okoro, Med tech'
}
