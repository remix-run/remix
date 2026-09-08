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
    return mod[exportName]
  },
  async processClientEntryPreloads(preloads) {
    if (await supportsMultipleImportMapsPromise) return preloads

    preloadShim(preloads)
    return []
  },
})

if (import.meta.hot) {
  import.meta.hot.on('server:update', async () => {
    try {
      await app.ready()
      await app.frames.top.reload()
    } catch (error) {
      console.error('Error reloading top frame on server update', error)
    }
  })
}
