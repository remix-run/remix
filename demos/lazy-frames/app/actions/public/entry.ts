import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let moduleExports = await importModule(moduleUrl)
    let component = moduleExports[exportName]
    if (typeof component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }

    return component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads

    preloadShim(preloads)
    return []
  },
})

app.ready().catch((error: unknown) => {
  console.error('Lazy Frame adoption failed:', error)
})
