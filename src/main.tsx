import { render } from 'preact'
import './index.css'
import './styles/deepblu-tokens.css'
import { App } from './App.tsx'

// This Git Site serves the built app under /spa/ (see vite.config.ts's build-time
// base), but every in-app route is prefix-free ("/", "/residents", "/medications"...).
// Client-side <Link> navigation already lands on a prefix-free path, so it matches
// fine — but a fresh load, hard refresh, or direct/bookmarked deep link to
// https://.../spa/<route> arrives with the /spa prefix still in the URL, which no
// <Route path> matches, leaving the page blank. Normalize it once, before mount.
const SPA_PREFIX = '/spa'
const { pathname, search, hash } = window.location
if (pathname === SPA_PREFIX) {
  window.history.replaceState(null, '', '/' + search + hash)
} else if (pathname.startsWith(SPA_PREFIX + '/')) {
  window.history.replaceState(null, '', pathname.slice(SPA_PREFIX.length) + search + hash)
}

render(<App />, document.getElementById('app')!)
