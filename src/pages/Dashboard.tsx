import { useEffect, useState } from 'preact/hooks'
import { fetchResidentBillings } from '../lib/billing.ts'
import type { ResidentBilling } from '../lib/billing.ts'
import type { Room } from '../lib/rooms.ts'
import { compareRoomNamesNaturally } from '../lib/rooms.ts'
import { formatMoney } from '../lib/formData.ts'
import { GqlError } from '../lib/gql.ts'
import { SignInPrompt } from '../components/SignInPrompt.tsx'
import { OccupancyDonut } from '../components/OccupancyDonut.tsx'
import './Dashboard.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: string }
  | { status: 'ready'; rooms: Room[]; billings: ResidentBilling[] }

export function Dashboard() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetchResidentBillings()
      .then(({ rooms, billings }) => {
        if (cancelled) return
        setState({ status: 'ready', rooms, billings })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          code: err instanceof GqlError ? err.code : undefined,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div class="dashboard-page">
        <h2>Dashboard</h2>
        <p>Loading community data…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div class="dashboard-page">
        <h2>Dashboard</h2>
        {state.code === 'UNAUTHENTICATED' ? (
          <SignInPrompt />
        ) : (
          <p class="dashboard-error">Could not load dashboard data: {state.message}</p>
        )}
      </div>
    )
  }

  const { rooms, billings } = state

  // Occupied is defined the same way Occupancy.tsx defines it (a room with at
  // least one resident); residentTopIds and residentNames are parsed in
  // parallel from the same field in lib/rooms.ts, so they agree in practice.
  const occupiedRooms = rooms.filter((room) => room.residentTopIds.length > 0)
  const vacantRooms = rooms
    .filter((room) => room.residentTopIds.length === 0)
    .sort((a, b) => compareRoomNamesNaturally(a.roomName, b.roomName))

  const totalRooms = rooms.length
  const occupancyPercent = totalRooms === 0 ? 0 : Math.round((occupiedRooms.length / totalRooms) * 100)

  // Census: current resident count. This org's demo data has one resident per
  // occupied room, so census and occupied-room count are the same number here
  // — not computed as a separate sum, since Room only tracks residents as a
  // per-room list, not a global roster.
  const census = occupiedRooms.length

  // Same sum Rent Roll's grand-total row shows — must agree with that page,
  // so it's computed from the same shared `billings`, not re-derived.
  const rentRollTotal = billings.reduce((sum, b) => sum + b.total, 0)

  // Bed-level census (distinct from the room-level Occupancy tile above): a
  // room is only counted here when both bed fields resolved, consistent with
  // formatBeds's existing treatment of a null bed count as "unavailable"
  // rather than zero — a partially-unresolved room is excluded rather than
  // skewing the ratio with a guessed value.
  const roomsWithBedData = rooms.filter((room) => room.numberOfBeds !== null && room.openBeds !== null)
  const availableBeds = roomsWithBedData.reduce((sum, room) => sum + (room.openBeds ?? 0), 0)
  const occupiedBeds = roomsWithBedData.reduce(
    (sum, room) => sum + ((room.numberOfBeds ?? 0) - (room.openBeds ?? 0)),
    0
  )

  return (
    <div class="dashboard-page">
      <h2>Dashboard</h2>
      <div class="dashboard-tiles">
        <div class="dashboard-tile dashboard-tile--blue">
          <span class="dashboard-tile-label">Occupancy</span>
          <span class="dashboard-tile-value">{occupancyPercent}%</span>
          <span class="dashboard-tile-sub">
            {occupiedRooms.length} of {totalRooms} units occupied
          </span>
        </div>
        <div class="dashboard-tile dashboard-tile--blue">
          <span class="dashboard-tile-label">Census</span>
          <span class="dashboard-tile-value">{census}</span>
          <span class="dashboard-tile-sub">current resident{census === 1 ? '' : 's'}</span>
        </div>
        <div class="dashboard-tile dashboard-tile--green">
          <span class="dashboard-tile-label">Current Rent Roll</span>
          <span class="dashboard-tile-value">{formatMoney(rentRollTotal)}</span>
          <span class="dashboard-tile-sub">across {billings.length} occupied resident{billings.length === 1 ? '' : 's'}</span>
        </div>
        <div class="dashboard-tile dashboard-tile--neutral">
          <span class="dashboard-tile-label">Vacant Units</span>
          <span class="dashboard-tile-value">{vacantRooms.length}</span>
          <span class="dashboard-tile-sub">of {totalRooms} total units</span>
        </div>
      </div>

      <section class="dashboard-census-section">
        <h3>Census &amp; Occupancy</h3>
        <OccupancyDonut occupied={occupiedBeds} available={availableBeds} />
      </section>

      <section class="dashboard-vacant-section">
        <h3>Vacant units</h3>
        {vacantRooms.length === 0 ? (
          <p class="dashboard-vacant-empty">
            {totalRooms === 0 ? 'No units configured for this community yet.' : 'No vacant units right now.'}
          </p>
        ) : (
          <ul class="dashboard-vacant-list">
            {vacantRooms.map((room) => (
              <li key={room.key}>{room.roomName}</li>
            ))}
          </ul>
        )}
      </section>

      <section class="dashboard-kpi-placeholders">
        <h3>More on the way</h3>
        <p class="dashboard-placeholders-note">
          These will show real numbers once their data is connected on the platform.
        </p>
        <div class="dashboard-tiles">
          {PLACEHOLDER_KPIS.map((kpi) => (
            <div key={kpi.label} class="dashboard-tile dashboard-tile--placeholder">
              <span class="dashboard-placeholder-badge">Not yet connected</span>
              <span class="dashboard-tile-label">{kpi.label}</span>
              <span class="dashboard-tile-value dashboard-tile-value--placeholder">—</span>
              <span class="dashboard-tile-sub">{kpi.sub}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const PLACEHOLDER_KPIS = [
  { label: 'Missed MARs', sub: 'medication administration' },
  { label: 'Missed ADLs', sub: 'activities of daily living' },
  { label: 'Assessments Past Due', sub: 'assessments & service plans' },
  { label: 'Residents with Warnings', sub: 'open resident warnings' },
]
