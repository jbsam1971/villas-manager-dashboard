import { useEffect, useState } from 'preact/hooks'
import { fetchRooms, formatBeds } from '../lib/rooms.ts'
import type { Room } from '../lib/rooms.ts'
import { GqlError } from '../lib/gql.ts'
import { SignInPrompt } from '../components/SignInPrompt.tsx'
import './Occupancy.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: string }
  | { status: 'ready'; rooms: Room[] }

export function Occupancy() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetchRooms()
      .then((rooms) => {
        if (cancelled) return
        setState({ status: 'ready', rooms })
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
      <div class="occupancy-page">
        <h2>Occupancy</h2>
        <p>Loading rooms…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div class="occupancy-page">
        <h2>Occupancy</h2>
        {state.code === 'UNAUTHENTICATED' ? (
          <SignInPrompt />
        ) : (
          <p class="occupancy-error">Could not load occupancy data: {state.message}</p>
        )}
      </div>
    )
  }

  const { rooms } = state

  if (rooms.length === 0) {
    return (
      <div class="occupancy-page">
        <h2>Occupancy</h2>
        <p>No rooms configured for this community yet.</p>
      </div>
    )
  }

  const occupiedCount = rooms.filter((room) => room.residentNames.length > 0).length

  return (
    <div class="occupancy-page">
      <h2>Occupancy</h2>
      <p class="occupancy-summary">
        {occupiedCount} of {rooms.length} rooms occupied
      </p>
      <div class="occupancy-card">
        <table class="occupancy-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Status</th>
              <th>Resident(s)</th>
              <th>Beds</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const occupied = room.residentNames.length > 0
              // Room Available is expected to be the opposite of "occupied"; flag it
              // rather than hide it when the recorded field disagrees with the
              // derived occupancy (per task spec's edge case).
              const mismatch = room.roomAvailable !== null && room.roomAvailable === occupied

              return (
                <tr key={room.key}>
                  <td>{room.roomName}</td>
                  <td>
                    <span class={occupied ? 'status-pill status-pill-good' : 'status-pill status-pill-neutral'}>
                      {occupied ? 'Occupied' : 'Vacant'}
                    </span>
                    {mismatch && (
                      <span class="status-mismatch">
                        {' '}
                        (Room Available field says {room.roomAvailable ? 'available' : 'not available'})
                      </span>
                    )}
                  </td>
                  <td>{occupied ? room.residentNames.join(', ') : '—'}</td>
                  <td>{formatBeds(room)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
