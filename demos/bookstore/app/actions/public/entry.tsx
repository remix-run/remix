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
          cache: options?.transition?.navigationType === 'traverse' ? 'force-cache' : 'default',
        })
      },
      async commit(commitFrame, { signal }) {
        let transition = options?.transition
        if (
          options?.target ||
          !transition ||
          transition.navigationType === 'reload' ||
          !document.startViewTransition ||
          matchMedia('(prefers-reduced-motion: reduce)').matches ||
          signal.aborted
        ) {
          return commitFrame()
        }

        let viewTransition = document.startViewTransition(commitFrame)
        let skip = () => viewTransition.skipTransition()
        signal.addEventListener('abort', skip, { once: true })
        void viewTransition.ready.catch(() => {})

        try {
          await viewTransition.finished
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
