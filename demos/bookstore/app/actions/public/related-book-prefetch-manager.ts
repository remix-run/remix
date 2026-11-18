import { prefetch } from 'remix/component'
import type { PrefetchFrameReference, ProcessFrameContext } from 'remix/component'
import { createMatcher } from 'remix/route-pattern/match'

import { routes } from '../../routes.ts'
import { shouldEnablePrefetching } from './should-enable-prefetching.ts'

export interface RelatedBookPrefetchManager {
  processFrame(context: ProcessFrameContext): readonly Element[]
}

interface BookCardPrefetch {
  src: string
  intent: boolean
  started: boolean
  frames: readonly Pick<PrefetchFrameReference, 'src' | 'target'>[] | undefined
}

export function createRelatedBookPrefetchManager(signal: AbortSignal): RelatedBookPrefetchManager {
  let bookDetailsMatcher = createMatcher(routes.books.show.pattern)
  let relatedBooksMatcher = createMatcher(routes.books.related.pattern)
  let cardPrefetches = new WeakMap<HTMLAnchorElement, BookCardPrefetch>()

  function getBookCardLink(element: Element): HTMLAnchorElement | undefined {
    let link = element
      .closest('[data-test-slug]')
      ?.querySelector('a[data-rmx-prefetch="viewport"][href]')
    return link instanceof HTMLAnchorElement && bookDetailsMatcher.match(link.href)
      ? link
      : undefined
  }

  function getBookCardPrefetch(link: HTMLAnchorElement): BookCardPrefetch {
    let url = new URL(link.href)
    url.hash = ''
    let queued = cardPrefetches.get(link)
    if (!queued || queued.src !== url.href) {
      queued = { src: url.href, intent: false, started: false, frames: undefined }
      cardPrefetches.set(link, queued)
    }
    return queued
  }

  function prefetchQueuedBookFrames(link: HTMLAnchorElement, queued: BookCardPrefetch) {
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

  function prefetchRelatedBooks(event: PointerEvent | FocusEvent) {
    if (event instanceof PointerEvent && event.pointerType === 'touch') return
    if (!(event.target instanceof Element)) return
    let link = getBookCardLink(event.target)
    let card = link?.parentElement
    if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return

    if (!shouldEnablePrefetching()) return

    if (!link) return
    let queued = getBookCardPrefetch(link)
    queued.intent = true
    if (queued.started) return
    if (queued.frames === undefined) {
      // Intent can arrive before viewport discovery; anchor callers share that pending request.
      prefetch(link, { signal })
    } else {
      prefetchQueuedBookFrames(link, queued)
    }
  }

  document.addEventListener('pointerover', prefetchRelatedBooks, { signal })
  document.addEventListener('focusin', prefetchRelatedBooks, { signal })

  return {
    processFrame({ src, target, element, fragment, frames, signal: frameSignal }) {
      if (signal.aborted || frameSignal.aborted) return []
      let link = element ? getBookCardLink(element) : undefined
      let queued = link && !target ? getBookCardPrefetch(link) : undefined
      if (link && queued && queued.src === src && !queued.started && link.isConnected) {
        // Store only discovered URL/target pairs; the fragment and continuation can be released.
        queued.frames = frames
          .filter((frame) => frame.loading === 'lazy' && relatedBooksMatcher.match(frame.src))
          .map(({ src, target }) => ({ src, target }))
        prefetchQueuedBookFrames(link, queued)
      }

      // Related covers are ordinary images; leave hidden main-page carousel images lazy.
      return relatedBooksMatcher.match(src) ? [...fragment.querySelectorAll('img[src]')] : []
    },
  }
}
