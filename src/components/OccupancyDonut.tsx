import './OccupancyDonut.css'

// Standard SVG donut-chart technique: two concentric circles sharing the same
// radius/circumference, the top one's stroke-dasharray/-dashoffset revealing
// only the occupied-percentage length of the ring. Sized for a 120x120
// viewBox so it scales cleanly via CSS without recomputing geometry.
const RADIUS = 50
const STROKE_WIDTH = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function OccupancyDonut({ occupied, available }: { occupied: number; available: number }) {
  const total = occupied + available

  if (total === 0) {
    return (
      <div class="occupancy-donut">
        <div class="occupancy-donut-ring-wrap">
          <svg class="occupancy-donut-svg" viewBox="0 0 120 120" role="img" aria-label="No beds configured">
            <circle class="occupancy-donut-track" cx="60" cy="60" r={RADIUS} stroke-width={STROKE_WIDTH} />
          </svg>
          <div class="occupancy-donut-hero occupancy-donut-hero--empty">No beds configured</div>
        </div>
      </div>
    )
  }

  const percent = Math.round((occupied / total) * 100)
  const occupiedLength = (percent / 100) * CIRCUMFERENCE

  return (
    <div class="occupancy-donut">
      <div class="occupancy-donut-ring-wrap">
        <svg
          class="occupancy-donut-svg"
          viewBox="0 0 120 120"
          role="img"
          aria-label={`${percent}% of beds occupied`}
        >
          <circle class="occupancy-donut-track" cx="60" cy="60" r={RADIUS} stroke-width={STROKE_WIDTH} />
          <circle
            class="occupancy-donut-fill"
            cx="60"
            cy="60"
            r={RADIUS}
            stroke-width={STROKE_WIDTH}
            stroke-dasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            stroke-dashoffset={CIRCUMFERENCE - occupiedLength}
          />
        </svg>
        <div class="occupancy-donut-hero">{percent}%</div>
      </div>
      <div class="occupancy-donut-labels">
        <span class="occupancy-donut-label occupancy-donut-label--occupied">Occupied: {occupied} beds</span>
        <span class="occupancy-donut-label occupancy-donut-label--available">Available: {available} beds</span>
      </div>
    </div>
  )
}
