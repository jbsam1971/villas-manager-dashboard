# Villas Manager Dashboard

A manager-only web app for Jen's Sandbox Org (`U142196`), served as a BlueStep **Git Site**
at `jbstest.bluestep.net` — separate from the org's existing RELATE interface, with its own
sign-in restricted to the `Administration (Basic Community)` group. It is a **read-only**
reporting layer: it displays data pulled live from the org's `/gql` GraphQL surface, it never
writes anything back.

## Pages

- **Dashboard** (`/`) — the landing page. Four at-a-glance tiles: occupancy percentage, census
  (resident count vs. total units), the current rent roll total, and a list of vacant units.
  Derived from the same data/logic as the two report pages below, so the numbers never drift
  from them.
- **Occupancy** (`/occupancy`) — every unit/room in the community with its occupied/vacant
  status and resident name(s); a vacant unit is shown as vacant, never hidden.
- **Rent Roll** (`/rent-roll`) — every occupied unit's resident with a charge breakdown
  (recurring + ancillary charges) and a total; a resident with no billing recorded yet shows a
  genuine "no charges recorded" state rather than an error.

## Stack

Vite + Preact + TypeScript, client-side routing via `preact-router`. Data comes straight from
the platform's session-authenticated `/gql` endpoint (CSRF token fetched from `/csrf-token`) —
no backend of its own, no `/b/` endpoint, no build-time data.

## Dev / deploy workflow

A Git Site has **no server-side build step** — the repo it points at *is* the deploy artifact,
so the build has to happen locally and the *built output* gets committed, not the source. See
the `bluestep-reference` skill's `reference/git-site-spa.md` for the full platform-side model
(the `/spa/` file mount vs. the domain-root funnel, the five git-deployment fields, save-is-the-
redeploy, the webhook, reserved path prefixes, etc.) — this section is just the day-to-day loop:

1. Work on `main` as normal; `npm run dev` for local development (serves from `/`).
2. When ready to ship, `npm run build` (outputs to `dist/`). The build runs `tsc -b`, then
   `vite build`, then a guard script (`scripts/check-base-path.mjs`) that fails the build if any
   emitted asset isn't addressed from `/spa/` — the base this site's build must use since the
   platform serves the repo's files under that path. See that script and
   `git-site-spa.md` if the guard ever fails.
3. Commit `dist/`'s contents to the **`deploy`** branch (built files only — never the source
   tree) and push. **Never commit built output to `main`.**
4. The Git Site redeploys when its site record is saved — either manually (re-save, or the
   site's **Pull** button) or automatically if a push webhook is configured for the `deploy`
   branch. Allow up to ~5 minutes for the CDN cache to pick up a fresh deploy.

## Project layout

```
src/
  pages/        Dashboard.tsx, Occupancy.tsx, RentRoll.tsx — one per route
  lib/
    gql.ts       shared /gql + CSRF-token client helper
    rooms.ts     Setup: Rooms fetch/parse (occupancy source)
    billing.ts   Recurring/Ancillary Charges fetch + per-resident totals (rent roll source)
    formData.ts  form-entry field parsing helpers
  App.tsx        nav shell + router
  main.tsx       entry point
scripts/
  check-base-path.mjs   build guard — see Dev / deploy workflow above
```
