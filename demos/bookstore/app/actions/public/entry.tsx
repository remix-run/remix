import { defaultResolveFrame, run } from 'remix/component'
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

export const app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await importModule(moduleUrl)
    let Component = mod[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  resolveFrame(src, options) {
    return defaultResolveFrame(src, options, {
      fetch(url, init) {
        return fetch(url, {
          ...init,
          cache: options?.navigationType === 'traverse' ? 'force-cache' : 'default',
        })
      },
      async commit(commitFrame, { signal }) {
        let navigationType = options?.navigationType
        if (
          options?.target ||
          (navigationType !== 'push' &&
            navigationType !== 'replace' &&
            navigationType !== 'traverse') ||
          !document.startViewTransition ||
          matchMedia('(prefers-reduced-motion: reduce)').matches ||
          signal.aborted
        ) {
          return commitFrame()
        }

        let transition = document.startViewTransition(commitFrame)
        let skip = () => transition.skipTransition()
        signal.addEventListener('abort', skip, { once: true })
        void transition.ready.catch(() => {})

        try {
          await transition.finished
        } finally {
          signal.removeEventListener('abort', skip)
        }
      },
    })
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) {
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
