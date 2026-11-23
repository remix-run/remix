import { run } from 'remix/component'
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

run({
  async loadModule(moduleUrl, exportName) {
    let exports = await importModule(moduleUrl)
    let component = exports[exportName]
    if (typeof component !== 'function')
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    return component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads
    preloadShim(preloads)
    return []
  },
})
