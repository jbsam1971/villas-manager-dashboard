import { useState } from 'preact/hooks'
import { getShiftInfo, getShiftTasks, getMyResidents } from '../lib/placeholders/careStaffShift.ts'
import type { Tag, ShiftTask } from '../lib/placeholders/careStaffShift.ts'
import './CareStaffPhone.css'

// Direct port of the reviewed Design artifact mockup (Care staff · phone,
// next task). Pure sample-data page — see src/lib/placeholders/careStaffShift.ts.
// No /gql call, no fetch. This page keeps its own local interactive state,
// separate from CareStaffShift.tsx (the tablet view) — the two pages are
// not meant to share state.
//
// Unlike the mockup's static 390x844 design-canvas frame, this is built as
// a normal fluid, responsive page: no hardcoded device width, a sticky
// header, a scrollable middle region, and a fixed bottom tab bar sized for
// a real phone browser viewport.

type PhoneTaskStatus = 'done' | 'refused'

function TagChip({ tag }: { tag: Tag }) {
  return <span class={`csp-tag csp-tag-${tag.tone}`}>{tag.text}</span>
}

function IconToday() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="1.5" />
      <path d="M4 10h16" />
      <path d="M9 3v4" />
      <path d="M15 3v4" />
    </svg>
  )
}

function IconResidents() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
    </svg>
  )
}

function IconLogCare() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function IconMessages() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  )
}

function IconHandoff() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M5 4h14v16H5z" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
    </svg>
  )
}

export function CareStaffPhone() {
  const shiftInfo = getShiftInfo()
  const tasks = getShiftTasks()
  const residents = getMyResidents()

  const [status, setStatus] = useState<Record<string, PhoneTaskStatus>>({})

  const openTasks = tasks.filter((task) => !status[task.id])
  const nextTask: ShiftTask | undefined = openTasks[0]
  const comingUp = openTasks.slice(1, 4)

  const doneCount = shiftInfo.baseDoneCount + Object.keys(status).length
  const percentDone = (doneCount / shiftInfo.totalTasks) * 100

  function markNext(nextStatus: PhoneTaskStatus) {
    if (!nextTask) return
    setStatus((prev) => ({ ...prev, [nextTask.id]: nextStatus }))
  }

  const nextResident = nextTask ? residents.find((r) => r.name === nextTask.resident) : undefined

  let nextTags: Tag[] = []
  if (nextTask) {
    nextTags = [...nextTask.tags]
    const extraResidentTag = (nextResident?.tags ?? []).find(
      (rt) => !nextTask.tags.some((tt) => tt.text === rt.text),
    )
    if (extraResidentTag) nextTags.push(extraResidentTag)
    nextTags = nextTags.slice(0, 3)
  }

  const isAfterFall = nextTask ? nextTask.tags.some((t) => t.text === 'After fall') : false
  const shiftName = shiftInfo.shiftLabel.split('·')[0].trim()

  return (
    <div class="csp-page">
      <header class="csp-header">
        <div class="csp-header-inner">
          <div class="csp-header-top">
            <span class="csp-eyebrow">
              {shiftName} · {shiftInfo.hall}
            </span>
            <span class="csp-sync">
              <span class="csp-sync-dot" aria-hidden="true" />
              Synced
            </span>
          </div>
          <div class="csp-header-bottom">
            <h1 class="csp-staff-name">{shiftInfo.staffName}</h1>
            <span class="csp-progress-count">
              {doneCount} of {shiftInfo.totalTasks} done
            </span>
          </div>
          <div
            class="csp-progress-track"
            role="img"
            aria-label={`${doneCount} of ${shiftInfo.totalTasks} tasks done`}
          >
            <div class="csp-progress-fill" style={{ width: `${percentDone}%` }} />
          </div>
        </div>
      </header>

      <main class="csp-body">
        {nextTask ? (
          <>
            <span class="csp-section-label">Next up · {nextTask.time}</span>
            <div class="csp-next-card">
              <div class="csp-next-top">
                <span class="csp-avatar" aria-hidden="true">
                  {nextResident?.initials ?? nextTask.resident.slice(0, 2).toUpperCase()}
                </span>
                <div class="csp-next-who">
                  <span class="csp-next-name">{nextTask.resident}</span>
                  <span class="csp-next-room">
                    Room {nextTask.room}
                    {nextResident ? ` · ${nextResident.careLevel}` : ''}
                  </span>
                </div>
              </div>

              <p class="csp-next-task">{nextTask.task}</p>

              <div class="csp-tag-row">
                {nextTags.map((tag) => (
                  <TagChip tag={tag} key={tag.text} />
                ))}
              </div>

              <div class="csp-action-grid">
                <button type="button" class="csp-btn csp-btn-done" onClick={() => markNext('done')}>
                  {isAfterFall ? 'Done · resident safe' : 'Done'}
                </button>
                <button type="button" class="csp-btn csp-btn-outline" onClick={() => markNext('refused')}>
                  Refused
                </button>
                <button type="button" class="csp-btn csp-btn-outline">
                  Add a note
                </button>
              </div>

              <a href="#" class="csp-nurse-btn">
                Something's wrong · call nurse
              </a>
            </div>
          </>
        ) : (
          <>
            <span class="csp-section-label">Next up</span>
            <div class="csp-empty-card">All caught up — no more tasks right now.</div>
          </>
        )}

        {comingUp.length > 0 && (
          <>
            <span class="csp-section-label">Coming up</span>
            <div class="csp-coming-list">
              {comingUp.map((task, i) => {
                const isOverdue = task.group === 'Overdue'
                return (
                  <a
                    href="#"
                    class={i === comingUp.length - 1 ? 'csp-coming-row csp-coming-row-last' : 'csp-coming-row'}
                    key={task.id}
                  >
                    <span class={isOverdue ? 'csp-coming-time csp-coming-time-overdue' : 'csp-coming-time'}>
                      {task.time}
                    </span>
                    <div class="csp-coming-main">
                      <span class="csp-coming-task">{isOverdue ? `${task.task} · overdue` : task.task}</span>
                      <span class="csp-coming-resident">
                        {task.resident} · {task.room}
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          </>
        )}
      </main>

      <nav class="csp-tabbar" aria-label="Care staff navigation">
        <a href="/care-staff/phone" class="csp-tab csp-tab-active" aria-current="page">
          <IconToday />
          <span class="csp-tab-label">Today</span>
        </a>
        <a href="#" class="csp-tab">
          <IconResidents />
          <span class="csp-tab-label">Residents</span>
        </a>
        <a href="#" class="csp-tab csp-tab-fab" aria-label="Log unplanned care">
          <span class="csp-fab">
            <IconLogCare />
          </span>
        </a>
        <a href="#" class="csp-tab">
          <IconMessages />
          <span class="csp-tab-label">Messages</span>
        </a>
        <a href="#" class="csp-tab">
          <IconHandoff />
          <span class="csp-tab-label">Handoff</span>
        </a>
      </nav>
    </div>
  )
}
