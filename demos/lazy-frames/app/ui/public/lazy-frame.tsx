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

type IntersectionCallback = (entry: IntersectionObserverEntry) => void

type IntersectionObserverPool = {
  callbacks: Map<Element, Set<IntersectionCallback>>
  observer: IntersectionObserver
}

const defaultRootMargin = '320px 0px'

/**
 * Defers mounting a Frame until its stable host approaches the viewport.
 *
 * `children` render on the server and before intersection. LazyFrame instances with the same
 * `rootMargin` share one observer, registering their host for its element lifetime. Once the host
 * intersects, the Frame mounts and its own `fallback` covers the network request. Once mounted, the
 * Frame remains in the document when it leaves the viewport. Set `pauseAnimationsWhenInactive` to
 * track its visibility after loading and pause descendant CSS animations without removing the
 * Frame. Keeping those phases separate lets callers compose placeholders without coupling viewport
 * policy to presentation.
 */
export const LazyFrame = clientEntry(
  import.meta.url,
  function LazyFrame(handle: Handle<LazyFrameProps>) {
    let requested = false
    let active = false

    let observe = ref((node, signal) => {
      let stopLoading = observeIntersection(
        node,
        signal,
        (entry) => {
          if (!entry.isIntersecting) return

          stopLoading()
          requested = true
          handle.update()
        },
        handle.props.rootMargin ?? defaultRootMargin,
      )

      if (handle.props.pauseAnimationsWhenInactive) {
        observeIntersection(
          node,
          signal,
          (entry) => {
            let nextActive = entry.isIntersecting
            if (active === nextActive) return

            active = nextActive
            handle.update()
          },
          '0px 0px 0px 0px',
        )
      }
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

const intersectionObserverPools = new Map<string, IntersectionObserverPool>()

function observeIntersection(
  node: Element,
  signal: AbortSignal,
  callback: IntersectionCallback,
  rootMargin: string,
): () => void {
  if (signal.aborted) return () => {}

  let pool = intersectionObserverPools.get(rootMargin)
  if (pool === undefined) {
    let callbacks = new Map<Element, Set<IntersectionCallback>>()
    let observer = new IntersectionObserver(
      (entries) => {
        for (let entry of entries) {
          for (let dispatch of callbacks.get(entry.target) ?? []) dispatch(entry)
        }
      },
      { rootMargin },
    )
    pool = { callbacks, observer }
    intersectionObserverPools.set(rootMargin, pool)
  }

  let callbacks = pool.callbacks.get(node)
  if (callbacks === undefined) {
    callbacks = new Set()
    pool.callbacks.set(node, callbacks)
    pool.observer.observe(node)
  }

  function unobserve() {
    signal.removeEventListener('abort', unobserve)

    let currentPool = intersectionObserverPools.get(rootMargin)
    if (currentPool === undefined) return
    let currentCallbacks = currentPool.callbacks.get(node)
    if (currentCallbacks === undefined || !currentCallbacks.delete(callback)) return

    if (currentCallbacks.size === 0) {
      currentPool.callbacks.delete(node)
      currentPool.observer.unobserve(node)
    }

    if (currentPool.callbacks.size === 0) {
      currentPool.observer.disconnect()
      intersectionObserverPools.delete(rootMargin)
    }
  }

  callbacks.add(callback)
  signal.addEventListener('abort', unobserve, { once: true })
  return unobserve
}
