import { defaultPrefetch, defaultResolveFrame, run } from 'remix/component'
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { createMatcher } from 'remix/route-pattern/match'

import { routes } from '../../routes.ts'
import { transitionAlbumPage } from '../../ui/album-transitions.ts'
import { installDebugBoundaries } from './debug-boundaries.ts'
import { createFrameRequestManager } from './frame-request-manager.ts'
import { createRelatedAlbumPrefetchManager } from './related-album-prefetch-manager.ts'
import { prefetchResponsiveImages } from './prefetch-responsive-images.ts'

const albumDetailsMatcher = createMatcher(routes.albums.show.pattern)
const relatedAlbumsMatcher = createMatcher(routes.albums.related.pattern)
const browsingPageMatchers = [
  routes.home.pattern,
  routes.albums.index.pattern,
  routes.albums.genre.pattern,
  routes.albums.show.pattern,
  routes.search.pattern,
  routes.about.pattern,
  routes.contact.index.pattern,
  routes.auth.register.index.pattern,
].map((pattern) => createMatcher(pattern))
const disposeDebugBoundaries = installDebugBoundaries()
const prefetchController = new AbortController()
const frameRequestManager = createFrameRequestManager(prefetchController.signal)
const relatedAlbumPrefetchManager = createRelatedAlbumPrefetchManager(prefetchController.signal)

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
        async processFrame(prefetchReferences, context) {
          // Queue lazy related frames discovered in the prefetched details HTML.
          // Card hover/focus starts them; if intent preceded discovery, start them now.
          if (albumDetailsMatcher.match(context.src)) {
            relatedAlbumPrefetchManager.queueRelatedAlbums(context)
          }

          // Related covers and page image preloads use responsive image candidates.
          // Only explicit preloads from page HTML participate; hidden slides stay lazy.
          let images = context.fragment.querySelectorAll(
            'link[rel="preload"][as="image"][imagesrcset]',
          )
          if (relatedAlbumsMatcher.match(context.src)) {
            images = context.fragment.querySelectorAll('img[src]')
          }
          // Prefetch default assets; nested frames require explicit selection.
          await Promise.all([
            prefetchResponsiveImages(images, context.signal),
            prefetchReferences({ assets: [...context.assets, ...images] }),
          ])
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
        let existing = frameRequestManager.get(url, init)
        if (existing) return existing
        let reuseBrowsingHtml =
          // Deferred lazy frames can load after the navigation metadata is no longer available.
          relatedAlbumsMatcher.match(url) !== null ||
          (options?.navigationType === 'traverse' &&
            browsingPageMatchers.some((matcher) => matcher.match(url) !== null))
        return fetch(url, {
          ...init,
          cache: reuseBrowsingHtml ? 'force-cache' : undefined,
        })
      },
      async commit(commitFrame, { signal, to }) {
        let from = options?.from?.url
        let toAlbum = albumDetailsMatcher.match(to)
        let fromAlbum = from != null ? albumDetailsMatcher.match(from) : null
        let faceout = fromAlbum ? document.querySelector('[data-album-faceout]') : null
        let destinationCard = toAlbum
          ? document
              .querySelector(
                `a[href="${CSS.escape(routes.albums.show.href({ slug: toAlbum.params.slug }))}"]`,
              )
              ?.closest('[data-album-id]')
          : null
        return transitionAlbumPage(commitFrame, {
          target: options?.target,
          navigationType: options?.navigationType,
          fromIndex: options?.from?.index,
          currentIndex: window.navigation?.currentEntry?.index,
          faceoutAlbumId: faceout?.getAttribute('data-album-faceout'),
          cardAlbumId: destinationCard?.getAttribute('data-album-id'),
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          signal,
          startViewTransition: document.startViewTransition?.bind(document),
        })
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
