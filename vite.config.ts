import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// This is a standalone routed SPA Git Site (jbstest.bluestep.net): the site IS the app, served at
// its own domain root with client-side routes (/occupancy, /rent-roll). The platform serves the
// deployed repo under /spa/, so the build-time base must be absolute '/spa/' for assets to resolve
// at any route depth; the dev server serves from the root, so dev-time base stays '/'.
// See bluestep-reference skill: reference/git-site-spa.md ("Standalone routed SPA: conditional base").
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/spa/' : '/',
  plugins: [preact()],
}))
