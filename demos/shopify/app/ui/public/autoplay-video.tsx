import { clientEntry, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { afterPageLoad, getMotion } from './motion.ts'

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
 * A muted, looping video that starts after the page loads, plays only while it's visible, and
 * pauses with the page's motion state. Its sources stay in `data-src` until then, so the server
 * render and the no-JavaScript fallback show only the poster.
 */
export const AutoplayVideo = clientEntry(
  import.meta.url,
  function AutoplayVideo(handle: Handle<AutoplayVideoProps>) {
    let sourcesLoaded = false
    let ready = false
    let controls = false

    function playback(video: HTMLVideoElement, signal: AbortSignal) {
      let motion = getMotion()
      let visible = false

      async function update() {
        if (!motion.playing || !visible) {
          video.pause()
          return
        }
        if (!sourcesLoaded) {
          sourcesLoaded = true
          await handle.update()
          video.load()
        }
        video.muted = true
        video.play().catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            controls = true
            void handle.update()
          }
        })
      }

      let observer = new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting)
        void update()
      })
      signal.addEventListener('abort', () => observer.disconnect())
      afterPageLoad(() => observer.observe(video), signal)

      motion.addEventListener('change', () => void update(), { signal })
      video.addEventListener(
        'loadeddata',
        () => {
          ready = true
          void handle.update()
        },
        { signal },
      )

      // The hero switches between mobile and desktop sources with `media` queries, which the
      // browser only re-evaluates when the video reloads.
      if (handle.props.sources.some((source) => source.media)) {
        matchMedia('(max-width: 767px)').addEventListener(
          'change',
          async () => {
            if (!sourcesLoaded) return
            ready = false
            await handle.update()
            video.load()
            void update()
          },
          { signal },
        )
      }
    }

    return () => {
      let { label, width, height, sources, poster, hero } = handle.props
      let className = [handle.props.class, ready && 'video-ready'].filter(Boolean).join(' ')

      return (
        <video
          class={className || undefined}
          aria-label={label}
          width={width}
          height={height}
          poster={poster}
          loading={hero ? undefined : 'lazy'}
          preload={hero ? 'auto' : 'none'}
          controls={controls || undefined}
          muted
          loop
          playsInline
          mix={ref(playback)}
        >
          {sources.map((source) => (
            <source
              key={source.src}
              src={sourcesLoaded ? source.src : undefined}
              data-src={sourcesLoaded ? undefined : source.src}
              type={source.type}
              media={source.media}
            />
          ))}
        </video>
      )
    }
  },
)
