import type { Handle } from 'remix/component'

import type { ResponsiveImage } from '../data/images.ts'

export interface CdnImageProps {
  image: ResponsiveImage
  alt: string
  sizes: string
  /** Loads the image eagerly with high priority, for the largest image above the fold. */
  priority?: boolean
}

export function CdnImage(handle: Handle<CdnImageProps>) {
  return () => {
    let { image, alt, sizes, priority } = handle.props

    return (
      <img
        {...image}
        alt={alt}
        sizes={sizes}
        loading={priority ? undefined : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
    )
  }
}
