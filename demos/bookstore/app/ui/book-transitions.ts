import type { CSSMixinDescriptor, ResolveFrameOptions } from 'remix/component'
import { css } from 'remix/component'

import type { Book } from '../data/schema.ts'

export function bookCoverTransition(bookId: Book['id']): CSSMixinDescriptor {
  let styles: Parameters<typeof css>[0] = {}
  styles[`:root:active-view-transition-type(book-cover-${bookId}) &`] = {
    viewTransitionName: `book-cover-${bookId}`,
    viewTransitionClass: 'book-cover',
  }
  return css(styles)
}

export async function transitionBookPage(
  commitFrame: () => Promise<void>,
  options: Pick<ResolveFrameOptions, 'target' | 'navigationType'> & {
    fromIndex?: number
    currentIndex?: number
    faceoutBookId?: string | null
    cardBookId?: string | null
    reducedMotion: boolean
    signal: AbortSignal
    startViewTransition?: (update: () => Promise<void>) => ViewTransition
  },
) {
  let { navigationType, signal, startViewTransition } = options
  if (
    options.target ||
    !navigationType ||
    navigationType === 'reload' ||
    !startViewTransition ||
    options.reducedMotion ||
    signal.aborted
  ) {
    return commitFrame()
  }

  let goingBack =
    navigationType === 'traverse' &&
    options.fromIndex != null &&
    options.currentIndex != null &&
    options.currentIndex < options.fromIndex
  // Back returns the outgoing faceout to its card; forward navigation opens the next cover.
  let bookId = goingBack
    ? (options.faceoutBookId ?? options.cardBookId)
    : (options.cardBookId ?? options.faceoutBookId)
  let transition = startViewTransition(commitFrame)
  if (bookId) transition.types?.add(`book-cover-${bookId}`)
  let skip = () => transition.skipTransition()
  signal.addEventListener('abort', skip, { once: true })
  void transition.ready.catch(() => {})
  try {
    await transition.finished
  } finally {
    signal.removeEventListener('abort', skip)
  }
}
