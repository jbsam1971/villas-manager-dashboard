import { Router, Route, Link } from 'preact-router'
import './App.css'

// Placeholder pages — real logic lands in later tasks (6: Occupancy, 7: Rent Roll, 8: Dashboard).
// Once those pages exist under src/pages/, these inline placeholders should be swapped for imports
// from there rather than kept side-by-side.
function Dashboard() {
  return <p>Dashboard — coming soon</p>
}

function Occupancy() {
  return <p>Occupancy — coming soon</p>
}

function RentRoll() {
  return <p>Rent Roll — coming soon</p>
}

export function App() {
  return (
    <div id="app-shell">
      <header class="nav">
        <span class="nav-brand">The Villas — Manager Dashboard</span>
        <nav>
          <Link activeClassName="active" href="/">
            Dashboard
          </Link>
          <Link activeClassName="active" href="/occupancy">
            Occupancy
          </Link>
          <Link activeClassName="active" href="/rent-roll">
            Rent Roll
          </Link>
        </nav>
      </header>
      <main class="page">
        <Router>
          <Route path="/" component={Dashboard} />
          <Route path="/occupancy" component={Occupancy} />
          <Route path="/rent-roll" component={RentRoll} />
        </Router>
      </main>
    </div>
  )
}
