import type { CSSMixinDescriptor, ResolveFrameOptions } from 'remix/component'
import { css } from 'remix/component'

import type { Album } from '../data/schema.ts'

export function albumCoverTransition(albumId: Album['id']): CSSMixinDescriptor {
  let styles: Parameters<typeof css>[0] = {}
  styles[`:root:active-view-transition-type(album-cover-${albumId}) &`] = {
    viewTransitionName: `album-cover-${albumId}`,
    viewTransitionClass: 'album-cover',
  }
  return css(styles)
}

export async function transitionAlbumPage(
  commitFrame: () => Promise<void>,
  options: Pick<ResolveFrameOptions, 'target' | 'navigationType'> & {
    fromIndex?: number
    currentIndex?: number
    faceoutAlbumId?: string | null
    cardAlbumId?: string | null
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
  let albumId = goingBack
    ? (options.faceoutAlbumId ?? options.cardAlbumId)
    : (options.cardAlbumId ?? options.faceoutAlbumId)
  let transition = startViewTransition(commitFrame)
  if (albumId) transition.types?.add(`album-cover-${albumId}`)
  let skip = () => transition.skipTransition()
  signal.addEventListener('abort', skip, { once: true })
  void transition.ready.catch(() => {})
  try {
    await transition.finished
  } finally {
    signal.removeEventListener('abort', skip)
  }
}
