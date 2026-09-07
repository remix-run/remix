import {
  detectMultipleImportMapSupport,
  importShim,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/ui'

const supportsMultipleImportMapsPromise = detectMultipleImportMapSupport()

const app = run({
  async loadModule(moduleUrl: string, name: string) {
    let mod = (await supportsMultipleImportMapsPromise)
      ? await import(moduleUrl)
      : await importShim(moduleUrl)
    if (!mod) {
      throw new Error(`Unknown module: ${moduleUrl}`)
    }

    let Component = mod[name]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${name}`)
    }

    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await supportsMultipleImportMapsPromise) return preloads

    preloadShim(preloads)
    return []
  },
})

app.ready().catch((error: unknown) => {
  console.error('Hydration failed:', error)
})
