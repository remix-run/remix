import { run } from 'remix/component'
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

// With the speed techniques off, stop Remix from intercepting navigations so every link and form
// is a full document load. This listener must be registered before run() adds its own.
if (document.documentElement.dataset.speedTechniques === 'off') {
  window.navigation?.addEventListener('navigate', (event) => event.stopImmediatePropagation())
}

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await importModule(moduleUrl)
    let Component = mod[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads
    preloadShim(preloads)
    return []
  },
})

app.addEventListener('error', (event) => {
  console.error('Component error:', event.error)
})

app.ready().catch((error: unknown) => {
  console.error('Hydration failed:', error)
})
