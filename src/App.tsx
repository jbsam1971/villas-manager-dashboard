import { Router, Route, Link } from 'preact-router'
import { Occupancy } from './pages/Occupancy.tsx'
import { RentRoll } from './pages/RentRoll.tsx'
import './App.css'

// Placeholder page — real logic lands in task 8 (Dashboard).
// Once it exists under src/pages/, this inline placeholder should be swapped for an import
// from there rather than kept side-by-side.
function Dashboard() {
  return <p>Dashboard — coming soon</p>
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
