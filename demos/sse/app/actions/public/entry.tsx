import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl: string, name: string) {
    let mod = await importModule(moduleUrl)
    let Component = mod[name]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${name}`)
    }

    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads

    preloadShim(preloads)
    return []
  },
})

app.ready().catch((error: unknown) => {
  console.error('Hydration failed:', error)
})
