import { useState } from 'preact/hooks'
import {
  getShiftInfo,
  getShiftAlerts,
  getShiftTasks,
  getMyResidents,
  getHandoffNotes,
  getClockOutChecklist,
} from '../lib/placeholders/careStaffShift.ts'
import type { Tag, TaskGroup } from '../lib/placeholders/careStaffShift.ts'
import './CareStaffShift.css'

// Direct port of the reviewed Design artifact mockup (Care staff · tablet
// shift view, project/CareStaff.dc.html). Pure sample-data page — see
// src/lib/placeholders/careStaffShift.ts. No /gql call, no fetch; every
// interactive bit here (task charting, the handoff-notes filter toggle,
// the "I've read these" acknowledgment) is local useState only, matching
// the mockup's own interactive behavior.

type TaskFilter = 'All' | 'To do' | 'Done'
type TaskStatus = 'done' | 'refused' | 'notNeeded'

const FILTERS: TaskFilter[] = ['All', 'To do', 'Done']

const GROUP_ORDER: TaskGroup[] = ['Overdue', 'Now', 'Next']

// The sample data's own `group` field is just 'Now'/'Next' — the mockup
// shows the wider time-range label, so that mapping is hardcoded here.
const GROUP_LABELS: Record<TaskGroup, string> = {
  Overdue: 'Overdue',
  Now: 'Now · 8–9 AM',
  Next: 'Next · 9–10 AM',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  done: '✓ Done',
  refused: '✓ Refused',
  notNeeded: '✓ Not needed',
}

function TagChip({ tag }: { tag: Tag }) {
  return <span class={`cs-tag cs-tag-${tag.tone}`}>{tag.text}</span>
}

function IconAlertTriangle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.5v.1" />
    </svg>
  )
}

function IconAlertCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5v.1" />
    </svg>
  )
}

function ClockOutIndicator({ ok }: { ok: boolean }) {
  return (
    <span class={ok ? 'cs-checklist-box cs-checklist-box-ok' : 'cs-checklist-box'} aria-hidden="true">
      {ok && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M4 12l5 5 11-11" />
        </svg>
      )}
    </span>
  )
}

export function CareStaffShift() {
  const shiftInfo = getShiftInfo()
  const alerts = getShiftAlerts()
  const tasks = getShiftTasks()
  const residents = getMyResidents()
  const handoffData = getHandoffNotes()
  const clockOut = getClockOutChecklist()

  const [filter, setFilter] = useState<TaskFilter>('All')
  const [taskStatus, setTaskStatus] = useState<Record<string, TaskStatus>>({})
  const [handoffAcknowledged, setHandoffAcknowledged] = useState(handoffData.alreadyRead)
  const [handoffReadTime, setHandoffReadTime] = useState<string | null>(null)

  // Matches the mockup's own interactive behavior: doneCount = 16 + Object.keys(st).length
  const chartedCount = Object.keys(taskStatus).length
  const doneCount = shiftInfo.baseDoneCount + chartedCount
  const percentDone = (doneCount / shiftInfo.totalTasks) * 100

  function setStatus(id: string, status: TaskStatus) {
    setTaskStatus((prev) => ({ ...prev, [id]: status }))
  }

  function clearStatus(id: string) {
    setTaskStatus((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function acknowledgeHandoff() {
    setHandoffAcknowledged(true)
    setHandoffReadTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'To do') return !taskStatus[task.id]
    if (filter === 'Done') return !!taskStatus[task.id]
    return true
  })

  const groups = GROUP_ORDER.map((group) => ({
    group,
    tasks: filteredTasks.filter((task) => task.group === group),
  })).filter((g) => g.tasks.length > 0)

  return (
    <div class="cs-page">
      <header class="cs-header">
        <div class="cs-header-left">
          <span class="cs-eyebrow">
            {shiftInfo.shiftLabel} · {shiftInfo.hall}
          </span>
          <h1 class="cs-staff-name">
            {shiftInfo.staffName}, {shiftInfo.staffRole}
          </h1>
          <p class="cs-clock-line">
            <span class="cs-sync-dot" aria-hidden="true" />
            Clocked in {shiftInfo.clockedInAt} · charting saves on this tablet and syncs when Wi-Fi returns
          </p>
        </div>

        <div class="cs-header-mid">
          <div class="cs-progress-row">
            <span class="cs-progress-label">My tasks this shift</span>
            <span class="cs-progress-count">
              {doneCount} of {shiftInfo.totalTasks} done
            </span>
          </div>
          <div class="cs-progress-track" role="img" aria-label={`${doneCount} of ${shiftInfo.totalTasks} tasks done`}>
            <div class="cs-progress-fill" style={{ width: `${percentDone}%` }} />
          </div>
          <p class="cs-progress-sub">
            {shiftInfo.residentCount} residents · {shiftInfo.overdueCount} overdue · next round at {shiftInfo.nextRoundTime}
          </p>
        </div>

        <div class="cs-header-right">
          <button type="button" class="cs-btn cs-btn-outline-dark">
            Message nurse
          </button>
          <button type="button" class="cs-btn cs-btn-primary">
            + Log unplanned care
          </button>
        </div>
      </header>

      <div class="cs-body">
        <section class="cs-alerts" aria-label="Alerts for your residents">
          {alerts.map((alert) => (
            <div key={`${alert.resident}-${alert.headline}`} class={`cs-alert-card cs-alert-${alert.severity}`}>
              {alert.severity === 'high' ? <IconAlertTriangle /> : <IconAlertCircle />}
              <div class="cs-alert-body">
                <p class="cs-alert-headline">{alert.headline}</p>
                <p class="cs-alert-detail">{alert.detail}</p>
              </div>
            </div>
          ))}
        </section>

        <div class="cs-content">
          <div class="cs-panel cs-panel--tasks">
            <div class="cs-panel-header">
              <h2 class="cs-panel-title cs-panel-title-lg">Now and next</h2>
              <div class="cs-filter-toggle" role="group" aria-label="Filter tasks">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    class={filter === f ? 'cs-filter-btn cs-filter-btn-active' : 'cs-filter-btn'}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {groups.map(({ group, tasks: groupTasks }) => (
              <div class="cs-task-group" key={group}>
                <div class={group === 'Overdue' ? 'cs-group-header cs-group-header-overdue' : 'cs-group-header'}>
                  {GROUP_LABELS[group]}
                </div>
                {groupTasks.map((task) => {
                  const status = taskStatus[task.id]
                  const isOpen = !status
                  const isOverdueOpen = task.group === 'Overdue' && isOpen
                  return (
                    <div class={isOverdueOpen ? 'cs-task-row cs-task-row-overdue' : 'cs-task-row'} key={task.id}>
                      <span class={isOverdueOpen ? 'cs-task-time cs-task-time-overdue' : 'cs-task-time'}>
                        {task.time}
                      </span>
                      <div class="cs-task-main">
                        <p class={status ? 'cs-task-name cs-task-name-done' : 'cs-task-name'}>{task.task}</p>
                        <p class="cs-task-resident">
                          {task.resident} · {task.room}
                        </p>
                        <div class="cs-tag-row">
                          {task.tags.map((tag) => (
                            <TagChip tag={tag} key={tag.text} />
                          ))}
                        </div>
                      </div>
                      <div class="cs-task-actions">
                        {isOpen ? (
                          <>
                            <button
                              type="button"
                              class="cs-btn cs-btn-primary cs-btn-task"
                              onClick={() => setStatus(task.id, 'done')}
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              class="cs-btn cs-btn-outline cs-btn-task"
                              onClick={() => setStatus(task.id, 'refused')}
                            >
                              Refused
                            </button>
                            <button
                              type="button"
                              class="cs-btn cs-btn-outline cs-btn-task"
                              onClick={() => setStatus(task.id, 'notNeeded')}
                            >
                              Not needed
                            </button>
                          </>
                        ) : (
                          <>
                            <span class={status === 'done' ? 'cs-status-pill cs-status-pill-done' : 'cs-status-pill'}>
                              {STATUS_LABELS[status]}
                            </span>
                            <button type="button" class="cs-undo-btn" onClick={() => clearStatus(task.id)}>
                              Undo
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            <p class="cs-tasks-caption">
              Tasks come from each resident's service plan. Anything you log with "+ Log unplanned care" shows here
              too, tagged Unplanned.
            </p>
          </div>

          <div class="cs-sidebar">
            <div class="cs-panel cs-panel--residents">
              <div class="cs-panel-header">
                <h2 class="cs-panel-title">My residents</h2>
                <span class="cs-panel-note">Tap for care card</span>
              </div>
              <div class="cs-resident-list">
                {residents.map((resident, i) => (
                  <a
                    href="#"
                    class={i === residents.length - 1 ? 'cs-resident-row cs-resident-row-last' : 'cs-resident-row'}
                    key={resident.name}
                  >
                    <span class="cs-resident-avatar" aria-hidden="true">
                      {resident.initials}
                    </span>
                    <div class="cs-resident-info">
                      <div class="cs-resident-line">
                        <span class="cs-resident-name">{resident.name}</span>
                        <span class="cs-resident-room">{resident.room}</span>
                      </div>
                      <div class="cs-tag-row">
                        {resident.tags.map((tag) => (
                          <TagChip tag={tag} key={tag.text} />
                        ))}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div class="cs-panel cs-panel--handoff">
              <div class="cs-panel-header">
                <h2 class="cs-panel-title">Handoff from night shift</h2>
                <span class="cs-panel-note">{handoffData.notes.length} notes</span>
              </div>
              <div class="cs-handoff-list">
                {handoffData.notes.map((note, i) => (
                  <div
                    class={i === handoffData.notes.length - 1 ? 'cs-handoff-note cs-handoff-note-last' : 'cs-handoff-note'}
                    key={`${note.author}-${note.time}-${note.room}`}
                  >
                    <p class="cs-handoff-meta">
                      {note.author}
                      {note.role ? `, ${note.role}` : ''} · {note.time} · {note.room}
                    </p>
                    <p class="cs-handoff-text">{note.note}</p>
                  </div>
                ))}
              </div>
              {handoffAcknowledged ? (
                <p class="cs-handoff-ack">✓ Read{handoffReadTime ? ` at ${handoffReadTime}` : ''}</p>
              ) : (
                <button type="button" class="cs-handoff-link" onClick={acknowledgeHandoff}>
                  I've read these →
                </button>
              )}
            </div>

            <div class="cs-panel cs-panel--clockout">
              <div class="cs-panel-header">
                <h2 class="cs-panel-title">Before you clock out</h2>
              </div>
              <div class="cs-clockout-list">
                <div class="cs-clockout-row">
                  <ClockOutIndicator ok={doneCount >= shiftInfo.totalTasks} />
                  <span class="cs-clockout-label">All tasks charted</span>
                  <span class="cs-clockout-status">{Math.max(shiftInfo.totalTasks - doneCount, 0)} left</span>
                </div>
                <div class="cs-clockout-row">
                  <ClockOutIndicator ok={clockOut.vitalsDone >= clockOut.vitalsTotal} />
                  <span class="cs-clockout-label">Vitals entered</span>
                  <span class="cs-clockout-status">
                    {clockOut.vitalsDone} of {clockOut.vitalsTotal}
                  </span>
                </div>
                <div class="cs-clockout-row">
                  <ClockOutIndicator ok={clockOut.handoffWritten} />
                  <span class="cs-clockout-label">Handoff note written for evening shift</span>
                  <span class="cs-clockout-status">{clockOut.handoffWritten ? 'Done' : 'Not started'}</span>
                </div>
                <div class="cs-clockout-row">
                  <ClockOutIndicator ok={handoffAcknowledged} />
                  <span class="cs-clockout-label">Night shift handoff read</span>
                  <span class="cs-clockout-status">{handoffAcknowledged ? 'Done' : 'Not read'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p class="cs-footer">Sample data for design review. Mark tasks Done, Refused or Not needed to try the flow.</p>
      </div>
    </div>
  )
}
