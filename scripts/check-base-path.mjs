// Base-path build guard for this standalone routed Git Site SPA.
//
// This project builds with vite.config.ts's `base: command === 'build' ? '/spa/' : '/'`
// (see bluestep-reference skill: reference/git-site-spa.md, "Standalone routed SPA:
// conditional base"). A wrong base typechecks, builds, and deploys clean, then the
// site renders a blank page — the index arrives, its assets 404 against the platform's
// `/spa/**` file mount, and nothing reports an error. That file explicitly calls for a
// CI guard: read the built index.html, assert every asset src/href is addressed from
// `/spa/`, and fail the build if any root-addressed asset appears. This script is that
// guard, run after `vite build` via the `build` script in package.json.
//
// Plain Node ESM, no dependencies — just fs/path from the standard library.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIST_DIR = 'dist'
const INDEX_PATH = join(DIST_DIR, 'index.html')
const REQUIRED_PREFIX = '/spa/'

function fail(message) {
  console.error(`[check-base-path] ${message}`)
  process.exit(1)
}

if (!existsSync(INDEX_PATH)) {
  fail(`Could not find ${INDEX_PATH} — run "vite build" first.`)
}

const html = readFileSync(INDEX_PATH, 'utf8')

// Match src="..." / href="..." (or single-quoted) on <script>, <link>, and
// <link rel="modulepreload"> tags — i.e. this project's own emitted asset
// references. We don't try to fully parse HTML; a plain attribute regex is
// enough for Vite's generated output, which is flat and predictable.
const ATTR_PATTERN = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi

/** True for an absolute-path reference to this site's own emitted assets —
 * i.e. the kind of path this guard cares about. Excludes external absolute
 * URLs (http(s)://, protocol-relative //), data/blob URIs, and in-page
 * anchors, none of which are assets this build controls. */
function isOwnAssetReference(value) {
  if (!value.startsWith('/')) return false // relative, external, data:, etc.
  if (value.startsWith('//')) return false // protocol-relative external URL
  return true
}

const badReferences = []
let match
while ((match = ATTR_PATTERN.exec(html)) !== null) {
  const value = match[1]
  if (!isOwnAssetReference(value)) continue
  if (!value.startsWith(REQUIRED_PREFIX)) {
    badReferences.push(value)
  }
}

if (badReferences.length > 0) {
  const list = badReferences.map((ref) => `  - ${ref}`).join('\n')
  fail(
    `Found asset reference(s) in ${INDEX_PATH} NOT addressed from "${REQUIRED_PREFIX}":\n${list}\n\n` +
      `This Git Site serves files under /spa/ and funnels extension-less navigations ` +
      `at the domain root to the index — a root-addressed asset (e.g. "/assets/...") ` +
      `404s there instead of resolving. Check vite.config.ts's build base is ` +
      `"${REQUIRED_PREFIX}" (see reference/git-site-spa.md).`
  )
}

console.log('[check-base-path] base path OK — all emitted assets addressed from /spa/.')
