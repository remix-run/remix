import {
  Frame,
  clientEntry,
  css,
  ref,
  type Handle,
  type RemixElement,
  type RemixNode,
} from 'remix/ui'

export type LazyFrameProps = {
  src: string
  rootMargin?: string
  pauseAnimationsWhenInactive?: boolean
  fallback?: RemixElement | string | number | boolean | null
  children?: RemixNode
}

/**
 * Defers mounting a Frame until its stable host approaches the viewport.
 *
 * `children` render on the server and before intersection. Once observed, the Frame mounts and its
 * own `fallback` covers the network request. Once mounted, the Frame remains in the document when
 * it leaves the viewport. Set `pauseAnimationsWhenInactive` to track its visibility after loading
 * and pause descendant CSS animations without removing the Frame. Keeping those phases separate
 * lets callers compose placeholders without coupling viewport policy to presentation.
 */
export const LazyFrame = clientEntry(
  import.meta.url,
  function LazyFrame(handle: Handle<LazyFrameProps>) {
    let requested = false
    let active = false

    let observe = ref((node, signal) => {
      let loadObserver = new IntersectionObserver(
        (entries) => {
          if (requested || signal.aborted || !entries.some((entry) => entry.isIntersecting)) return

          requested = true
          loadObserver.disconnect()
          handle.update()
        },
        { rootMargin: handle.props.rootMargin ?? '320px 0px' },
      )
      let stageObserver: IntersectionObserver | undefined
      if (handle.props.pauseAnimationsWhenInactive) {
        stageObserver = new IntersectionObserver((entries) => {
          let nextActive = entries.some((entry) => entry.isIntersecting)
          if (active === nextActive || signal.aborted) return

          active = nextActive
          handle.update()
        })
        stageObserver.observe(node)
      }

      loadObserver.observe(node)
      signal.addEventListener(
        'abort',
        () => {
          loadObserver.disconnect()
          stageObserver?.disconnect()
        },
        { once: true },
      )
    })

    return () => (
      <div
        mix={[
          observe,
          handle.props.pauseAnimationsWhenInactive &&
            !active &&
            css({
              '& *, & *::before, & *::after': {
                animationPlayState: 'paused !important',
              },
            }),
        ]}
      >
        {requested ? (
          <Frame src={handle.props.src} fallback={handle.props.fallback} />
        ) : (
          handle.props.children
        )}
      </div>
    )
  },
)
