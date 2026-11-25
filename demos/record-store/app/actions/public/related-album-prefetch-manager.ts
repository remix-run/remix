import { prefetch } from 'remix/component'
import type { PrefetchFrameReference, ProcessFrameContext } from 'remix/component'
import { createMatcher } from 'remix/route-pattern/match'

import { routes } from '../../routes.ts'
import { shouldEnablePrefetching } from './should-enable-prefetching.ts'

export interface RelatedAlbumPrefetchManager {
  queueRelatedAlbums(context: ProcessFrameContext): void
}

interface AlbumCardPrefetch {
  src: string
  intent: boolean
  started: boolean
  frames: readonly Pick<PrefetchFrameReference, 'src' | 'target'>[] | undefined
}

export function createRelatedAlbumPrefetchManager(
  signal: AbortSignal,
): RelatedAlbumPrefetchManager {
  let albumDetailsMatcher = createMatcher(routes.albums.show.pattern)
  let relatedAlbumsMatcher = createMatcher(routes.albums.related.pattern)
  let cardPrefetches = new WeakMap<HTMLAnchorElement, AlbumCardPrefetch>()

  function getAlbumCardLink(element: Element): HTMLAnchorElement | undefined {
    let link = element
      .closest('[data-test-slug]')
      ?.querySelector('a[data-rmx-prefetch="viewport"][href]')
    return link instanceof HTMLAnchorElement && albumDetailsMatcher.match(link.href)
      ? link
      : undefined
  }

  function getAlbumCardPrefetch(link: HTMLAnchorElement): AlbumCardPrefetch {
    let url = new URL(link.href)
    url.hash = ''
    let queued = cardPrefetches.get(link)
    if (!queued || queued.src !== url.href) {
      queued = { src: url.href, intent: false, started: false, frames: undefined }
      cardPrefetches.set(link, queued)
    }
    return queued
  }

  function prefetchQueuedAlbumFrames(link: HTMLAnchorElement, queued: AlbumCardPrefetch) {
    if (
      !queued.intent ||
      queued.started ||
      !queued.frames?.length ||
      !link.isConnected ||
      cardPrefetches.get(link) !== queued
    ) {
      return
    }
    let url = new URL(link.href)
    url.hash = ''
    if (queued.src !== url.href) return
    queued.started = true
    let frames = queued.frames
    queued.frames = []
    for (let { src, target } of frames) {
      prefetch(src, { target, signal })
    }
  }

  function prefetchRelatedAlbums(event: PointerEvent | FocusEvent) {
    if (event instanceof PointerEvent && event.pointerType === 'touch') return
    if (!(event.target instanceof Element)) return
    let link = getAlbumCardLink(event.target)
    let card = link?.parentElement
    if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return

    if (!shouldEnablePrefetching()) return

    if (!link) return
    let queued = getAlbumCardPrefetch(link)
    queued.intent = true
    if (queued.started) return
    if (queued.frames === undefined) {
      // Intent can arrive before viewport discovery; anchor callers share that pending request.
      prefetch(link, { signal })
    } else {
      prefetchQueuedAlbumFrames(link, queued)
    }
  }

  document.addEventListener('pointerover', prefetchRelatedAlbums, { signal })
  document.addEventListener('focusin', prefetchRelatedAlbums, { signal })

  return {
    queueRelatedAlbums({ src, target, element, frames, signal: frameSignal }) {
      if (signal.aborted || frameSignal.aborted) return
      let link = element ? getAlbumCardLink(element) : undefined
      let queued = link && !target ? getAlbumCardPrefetch(link) : undefined
      if (link && queued && queued.src === src && !queued.started && link.isConnected) {
        // Store only discovered URL/target pairs; the fragment and continuation can be released.
        queued.frames = frames
          .filter((frame) => frame.loading === 'lazy' && relatedAlbumsMatcher.match(frame.src))
          .map(({ src, target }) => ({ src, target }))
        prefetchQueuedAlbumFrames(link, queued)
      }
    },
  }
}
