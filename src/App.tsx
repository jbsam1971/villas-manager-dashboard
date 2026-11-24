import { Router, Route, Link } from 'preact-router'
import { Dashboard } from './pages/Dashboard.tsx'
import { Occupancy } from './pages/Occupancy.tsx'
import { RentRoll } from './pages/RentRoll.tsx'
import './App.css'

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
