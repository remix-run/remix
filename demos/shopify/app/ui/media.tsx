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

export interface VideoSource {
  src: string
  type: string
  media?: string
}

export interface AutoplayVideoProps {
  label: string
  width: number
  height: number
  sources: readonly VideoSource[]
  poster?: string
  class?: string
  /** Preloads the video as the page's hero instead of waiting until it scrolls into view. */
  hero?: boolean
}

/**
 * A muted, looping video that `app/ui/public/media.js` starts after the page loads and while it is
 * visible. Sources stay in `data-src` until then so they don't compete with the page's images.
 */
export function AutoplayVideo(handle: Handle<AutoplayVideoProps>) {
  return () => {
    let { label, width, height, sources, poster, hero } = handle.props

    return (
      <video
        class={handle.props.class}
        data-video={hero ? 'hero' : 'viewport'}
        aria-label={label}
        width={width}
        height={height}
        poster={poster}
        loading={hero ? undefined : 'lazy'}
        preload={hero ? 'auto' : 'none'}
        muted
        loop
        playsInline
      >
        {sources.map((source) => (
          <source key={source.src} data-src={source.src} type={source.type} media={source.media} />
        ))}
      </video>
    )
  }
}
