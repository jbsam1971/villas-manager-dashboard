// Sample/placeholder data for the Care Staff shift dashboard (tablet view).
//
// NOT real BlueStep data. Ported from the user's Design artifact mockup
// (Care staff · tablet shift view, https://claude.ai/artifact/4WrUeaGLaozVjE1E9bMR5u,
// project/CareStaff.dc.html) per her explicit instruction to build with
// sample data first. Scoped to one staff member's own assignment for one
// shift. When this is wired to real data, each function below gets replaced
// by a real fetch (tasks generated from each resident's service plan,
// unplanned care entries, handoff notes) — the function names/shapes are
// kept stable so that swap doesn't require a page rewrite.

export type TagTone = 'risk' | 'warn' | 'unplanned' | 'neutral'

export interface Tag {
  text: string
  tone: TagTone
}

export type TaskGroup = 'Overdue' | 'Now' | 'Next'

export interface ShiftTask {
  id: string
  group: TaskGroup
  time: string
  task: string
  resident: string
  room: string
  tags: Tag[]
}

export interface ShiftInfo {
  shiftLabel: string
  hall: string
  staffName: string
  staffRole: string
  clockedInAt: string
  totalTasks: number
  /** Tasks already charted earlier in the shift, before the ones listed in getShiftTasks(). */
  baseDoneCount: number
  residentCount: number
  overdueCount: number
  nextRoundTime: string
}

export function getShiftInfo(): ShiftInfo {
  return {
    shiftLabel: 'Day shift · 6 AM – 2 PM',
    hall: 'Hall B',
    staffName: 'Maria T.',
    staffRole: 'CNA',
    clockedInAt: '5:52 AM',
    totalTasks: 41,
    baseDoneCount: 16,
    residentCount: 8,
    overdueCount: 1,
    nextRoundTime: '9:00 AM',
  }
}

export interface ShiftAlert {
  resident: string
  room: string
  headline: string
  detail: string
  severity: 'high' | 'medium'
}

/** Alerts scoped to this staff member's own residents only. */
export function getShiftAlerts(): ShiftAlert[] {
  return [
    {
      resident: 'M. Alvarez',
      room: '114',
      headline: 'M. Alvarez, room 114 fell overnight',
      detail: '15-minute safety checks until 2:40 PM. Chart each check.',
      severity: 'high',
    },
    {
      resident: 'R. Okafor',
      room: 'MC-08',
      headline: 'R. Okafor, MC-08: new meal plan',
      detail: 'Offer a snack mid-morning. Record % eaten at every meal.',
      severity: 'medium',
    },
  ]
}

/** This shift's planned + logged-unplanned tasks, oldest/most-urgent group first. */
export function getShiftTasks(): ShiftTask[] {
  return [
    { id: 't1', group: 'Overdue', time: '7:45', task: 'Morning vitals', resident: 'J. Whitehorse', room: '121', tags: [{ text: 'Service plan', tone: 'neutral' }] },
    { id: 't2', group: 'Overdue', time: '7:30', task: 'Get up, dress, toilet', resident: 'P. Nakamura', room: '230', tags: [{ text: 'Service plan', tone: 'neutral' }] },
    { id: 't3', group: 'Now', time: '8:00', task: '15-minute safety check', resident: 'M. Alvarez', room: '114', tags: [{ text: 'After fall', tone: 'risk' }] },
    { id: 't4', group: 'Now', time: '8:15', task: '15-minute safety check', resident: 'M. Alvarez', room: '114', tags: [{ text: 'After fall', tone: 'risk' }] },
    { id: 't5', group: 'Now', time: '8:15', task: 'Breakfast, record % eaten', resident: 'R. Okafor', room: 'MC-08', tags: [{ text: 'Meal plan', tone: 'warn' }] },
    { id: 't6', group: 'Now', time: '8:20', task: 'Escorted to dining room after fall alarm', resident: 'E. Brandt', room: 'MC-03', tags: [{ text: 'Unplanned', tone: 'unplanned' }] },
    { id: 't7', group: 'Now', time: '8:30', task: 'Shower assist, 2-person transfer', resident: 'D. Lindqvist', room: '207', tags: [{ text: 'Service plan', tone: 'neutral' }, { text: '2-person', tone: 'warn' }] },
    { id: 't8', group: 'Next', time: '9:00', task: 'Walk to activity room', resident: 'P. Nakamura', room: '230', tags: [{ text: 'Service plan', tone: 'neutral' }] },
    { id: 't9', group: 'Next', time: '9:30', task: 'Mid-morning snack offered', resident: 'R. Okafor', room: 'MC-08', tags: [{ text: 'Meal plan', tone: 'warn' }] },
    { id: 't10', group: 'Next', time: '9:45', task: 'Reposition and skin check', resident: 'J. Whitehorse', room: '121', tags: [{ text: 'Service plan', tone: 'neutral' }] },
  ]
}

export interface ResidentCard {
  initials: string
  name: string
  room: string
  /** e.g. "AL · Level 3", "Memory Care" — sample values, same style as the manager dashboard's "Residents to watch". */
  careLevel: string
  tags: Tag[]
}

/** Care-card summary for every resident assigned to this staff member this shift. */
export function getMyResidents(): ResidentCard[] {
  return [
    { initials: 'MA', name: 'M. Alvarez', room: '114', careLevel: 'AL · Level 3', tags: [{ text: 'Fall risk', tone: 'risk' }, { text: 'Low bed + mat', tone: 'neutral' }] },
    { initials: 'RO', name: 'R. Okafor', room: 'MC-08', careLevel: 'Memory Care', tags: [{ text: 'Meal plan', tone: 'warn' }, { text: 'Needs cueing', tone: 'neutral' }] },
    { initials: 'DL', name: 'D. Lindqvist', room: '207', careLevel: 'AL · Level 2', tags: [{ text: '2-person transfer', tone: 'warn' }, { text: 'Walker', tone: 'neutral' }] },
    { initials: 'JW', name: 'J. Whitehorse', room: '121', careLevel: 'AL · Level 4', tags: [{ text: 'Reposition every 2 h', tone: 'neutral' }, { text: 'Hearing aid, left', tone: 'neutral' }] },
    { initials: 'EB', name: 'E. Brandt', room: 'MC-03', careLevel: 'Memory Care', tags: [{ text: 'Exit-seeking', tone: 'risk' }, { text: "Redirect, don't argue", tone: 'neutral' }] },
    { initials: 'PN', name: 'P. Nakamura', room: '230', careLevel: 'AL · Level 1', tags: [{ text: 'Pain check before walks', tone: 'neutral' }] },
    { initials: 'LS', name: 'L. Sorensen', room: '118', careLevel: 'AL · Level 2', tags: [{ text: 'Diabetic diet', tone: 'neutral' }, { text: 'Glasses', tone: 'neutral' }] },
    { initials: 'GH', name: 'G. Hale', room: '125', careLevel: 'AL · Level 1', tags: [{ text: 'Independent', tone: 'neutral' }, { text: 'Prefers late shower', tone: 'neutral' }] },
  ]
}

export interface HandoffNote {
  author: string
  role: string
  time: string
  room: string
  note: string
}

export function getHandoffNotes(): { notes: HandoffNote[]; alreadyRead: boolean } {
  return {
    alreadyRead: false,
    notes: [
      { author: 'Devon K.', role: '', time: '5:40 AM', room: 'Room 114', note: 'Found on floor by bed at 2:40, no injury. Bed now in low position, mat down. Was restless until 4.' },
      { author: 'Devon K.', role: '', time: '5:15 AM', room: 'Room 207', note: "Slept well after hospital return. Asked about his walker. It's in the closet." },
      { author: 'Ana R.', role: 'Med tech', time: '4:50 AM', room: 'MC-08', note: 'Refused 4 AM meds, accepted at 4:40 with applesauce.' },
    ],
  }
}

export interface ClockOutItem {
  label: string
  status: string
  ok: boolean
}

/** "Before you clock out" checklist — vitals/handoff items independent of the task list above. */
export function getClockOutChecklist(): { vitalsDone: number; vitalsTotal: number; handoffWritten: boolean } {
  return { vitalsDone: 6, vitalsTotal: 8, handoffWritten: false }
}
