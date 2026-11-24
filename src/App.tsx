import { Router, Route, Link } from 'preact-router'
import { Dashboard } from './pages/Dashboard.tsx'
import { Occupancy } from './pages/Occupancy.tsx'
import { RentRoll } from './pages/RentRoll.tsx'
import './App.css'

export function App() {
  return (
    <div id="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="sidebar-brand-mark" aria-hidden="true" />
          <span class="sidebar-brand-text">Manager Dashboard</span>
        </div>
        <nav class="sidebar-nav">
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
      </aside>
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
