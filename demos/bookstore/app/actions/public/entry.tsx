import { run } from 'remix/ui'
import {
  detectMultipleImportMapSupport,
  importShim,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

const supportsMultipleImportMapsPromise = detectMultipleImportMapSupport()

const app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = (await supportsMultipleImportMapsPromise)
      ? await import(moduleUrl)
      : await importShim(moduleUrl)
    let Component = mod[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await supportsMultipleImportMapsPromise) {
      return preloads
    }

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

app.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})
