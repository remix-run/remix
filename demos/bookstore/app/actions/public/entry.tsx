import { defaultPrefetch, defaultResolveFrame, run } from 'remix/component'
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { createMatcher } from 'remix/route-pattern/match'

import { routes } from '../../routes.ts'
import { installDebugBoundaries } from './debug-boundaries.ts'
import { createFrameRequestManager } from './frame-request-manager.ts'
import { createRelatedBookPrefetchManager } from './related-book-prefetch-manager.ts'

const bookDetailsMatcher = createMatcher(routes.books.show.pattern)
const relatedBooksMatcher = createMatcher(routes.books.related.pattern)
const browsingPageMatchers = [
  routes.home.pattern,
  routes.books.index.pattern,
  routes.books.genre.pattern,
  routes.books.show.pattern,
  routes.search.pattern,
  routes.about.pattern,
  routes.contact.index.pattern,
  routes.auth.register.index.pattern,
].map((pattern) => createMatcher(pattern))
const disposeDebugBoundaries = installDebugBoundaries()
const prefetchController = new AbortController()
const frameRequestManager = createFrameRequestManager(prefetchController.signal)
const relatedBookPrefetchManager = createRelatedBookPrefetchManager(prefetchController.signal)

export const app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await importModule(moduleUrl)
    let Component = mod[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  prefetch(src, options) {
    return defaultPrefetch(
      src,
      {
        ...options,
        signal: options?.signal
          ? AbortSignal.any([options.signal, prefetchController.signal])
          : prefetchController.signal,
      },
      {
        fetch: frameRequestManager.fetch,
        processFrame(prefetchReferences, context) {
          // Queue lazy related frames discovered in the prefetched details HTML.
          // Card hover/focus starts them; if intent preceded discovery, start them now.
          if (bookDetailsMatcher.match(context.src)) {
            relatedBookPrefetchManager.queueRelatedBooks(context)
          }

          // Include ordinary cover images from related-books responses in asset prefetching.
          // Details responses continue to use their explicit image preloads.
          if (relatedBooksMatcher.match(context.src)) {
            return prefetchReferences({
              assets: [...context.assets, ...context.fragment.querySelectorAll('img[src]')],
            })
          }
          // Prefetch default assets; nested frames require explicit selection.
          return prefetchReferences()
        },
      },
    )
  },
  resolveFrame(src, options) {
    return defaultResolveFrame(src, options, {
      fetch(url, init) {
        if ((init.method ?? 'GET').toUpperCase() !== 'GET') {
          frameRequestManager.invalidate()
          return fetch(url, init).finally(() => frameRequestManager.invalidate())
        }
        let reuseBrowsingHtml =
          options?.navigationType === 'traverse' &&
          browsingPageMatchers.some((matcher) => matcher.match(url) !== null)
        let requestInit = {
          ...init,
          cache: reuseBrowsingHtml ? 'force-cache' : undefined,
        } satisfies RequestInit
        let existing = frameRequestManager.get(url, requestInit)
        if (existing) return existing
        return fetch(url, requestInit)
      },
      async commit(commitFrame, { signal, to }) {
        let navigationType = options?.navigationType
        if (
          options?.target ||
          !navigationType ||
          navigationType === 'reload' ||
          !document.startViewTransition ||
          matchMedia('(prefers-reduced-motion: reduce)').matches ||
          signal.aborted
        ) {
          return commitFrame()
        }

        let viewTransition = document.startViewTransition(commitFrame)
        let from = options?.from?.url
        if (bookDetailsMatcher.match(to) || (from != null && bookDetailsMatcher.match(from))) {
          viewTransition.types?.add('book-details')
        }
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
  import.meta.hot.dispose(() => {
    prefetchController.abort()
    disposeDebugBoundaries()
  })
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
