import {
  detectMultipleImportMapSupport,
  importShim,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/ui'

const supportsMultipleImportMapsPromise = detectMultipleImportMapSupport()

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = (await supportsMultipleImportMapsPromise)
      ? await import(moduleUrl)
      : await importShim(moduleUrl)
    let exp = (mod as any)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
  async processClientEntryPreloads(preloads) {
    if (await supportsMultipleImportMapsPromise) return preloads

    preloadShim(preloads)
    return []
  },
})

app.ready().catch((error: unknown) => console.error(error))
