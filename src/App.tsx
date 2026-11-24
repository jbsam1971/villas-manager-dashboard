import { useState } from 'preact/hooks'
import { Router, Route, Link } from 'preact-router'
import type { RouterOnChangeArgs } from 'preact-router'
import { Dashboard } from './pages/Dashboard.tsx'
import { Residents } from './pages/Residents.tsx'
import { ResidentRecord } from './pages/ResidentRecord.tsx'
import { Occupancy } from './pages/Occupancy.tsx'
import { RentRoll } from './pages/RentRoll.tsx'
import { CareStaffShift } from './pages/CareStaffShift.tsx'
import { CareStaffPhone } from './pages/CareStaffPhone.tsx'
import './App.css'

// Icons ported verbatim from the deepBLU mockup (project/Main.dc.html),
// one per mockup nav item below.
function IconToday() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}
function IconCensus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M2 20V8l10-5 10 5v12" />
      <path d="M6 20v-7h12v7" />
      <path d="M2 20h20" />
    </svg>
  )
}
function IconClinical() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  )
}
function IconMedications() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
      <path d="M9.5 9.5l5 5" />
    </svg>
  )
}
function IconStaffing() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14.8c1.8.6 3 2.4 3.5 5.2" />
    </svg>
  )
}
function IconIncidents() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5" />
      <path d="M12 18v.5" />
    </svg>
  )
}
function IconSurvey() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 4V2.5h6V4" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  )
}
function IconReports() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  )
}

export function App() {
  const [path, setPath] = useState(window.location.pathname)
  // The Care Staff shift view is a standalone, full-bleed tablet/phone page
  // (its own header, no manager sidebar) — matching the Design artifact's
  // CareStaff.dc.html, which has no left nav at all. The manager sidebar
  // below is skipped for this route rather than squeezed around it.
  const isCareStaffRoute = path.startsWith('/care-staff')

  return (
    <div id="app-shell" class={isCareStaffRoute ? 'app-shell-full' : undefined}>
      {!isCareStaffRoute && (
        <nav class="db-nav" aria-label="Dashboard sections">
          <div class="db-nav-brand">
            <div class="db-nav-logo" aria-label="Community logo">
              LOGO
            </div>
            <div class="db-nav-brand-text">
              <span class="db-nav-brand-name">[Community name]</span>
              <span class="db-nav-brand-sub">Assisted Living · Memory Care</span>
            </div>
          </div>

          <div class="db-nav-links">
            <Link activeClassName="active" href="/">
              <IconToday />
              Today
            </Link>
            <a href="#">
              <IconCensus />
              Census &amp; occupancy
            </a>
            <a href="#">
              <IconClinical />
              Clinical
            </a>
            <a href="#">
              <IconMedications />
              Medications
            </a>
            <a href="#">
              <IconStaffing />
              Staffing
            </a>
            <a href="#">
              <IconIncidents />
              Incidents
            </a>
            <a href="#">
              <IconSurvey />
              Survey readiness
            </a>
            <a href="#">
              <IconReports />
              Reports
            </a>
          </div>

          <div class="db-nav-links db-nav-links-existing">
            <span class="db-nav-section-label">Existing reports</span>
            <Link activeClassName="active" href="/residents">
              Residents
            </Link>
            <Link activeClassName="active" href="/occupancy">
              Occupancy
            </Link>
            <Link activeClassName="active" href="/rent-roll">
              Rent Roll
            </Link>
            <Link activeClassName="active" href="/care-staff">
              Care staff view (preview)
            </Link>
            <Link activeClassName="active" href="/care-staff/phone">
              Care staff phone view (preview)
            </Link>
          </div>

          <div class="db-nav-sync">
            <span class="db-nav-sync-dot" aria-hidden="true" />
            Synced from eMAR, care plans and Rent Roll · 6:00 AM
          </div>
        </nav>
      )}
      <main class={isCareStaffRoute ? 'page page-full' : 'page'}>
        <Router onChange={(e: RouterOnChangeArgs) => setPath(e.url)}>
          <Route path="/" component={Dashboard} />
          <Route path="/residents" component={Residents} />
          <Route path="/residents/:id" component={ResidentRecord} />
          <Route path="/occupancy" component={Occupancy} />
          <Route path="/rent-roll" component={RentRoll} />
          <Route path="/care-staff" component={CareStaffShift} />
          <Route path="/care-staff/phone" component={CareStaffPhone} />
        </Router>
      </main>
    </div>
  )
}
