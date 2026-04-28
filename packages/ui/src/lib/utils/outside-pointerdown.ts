import { createMixin } from '@remix-run/component'

type OutsidePointerDownEvent = PointerEvent | MouseEvent
type OutsidePointerDownHandler = (event: OutsidePointerDownEvent) => void

export const onOutsidePointerDown = createMixin<HTMLElement, [handler: OutsidePointerDownHandler]>(
  (handle) => {
    let currentHandler: OutsidePointerDownHandler = () => {}
    let controller: AbortController | null = null
    let currentNode: HTMLElement | null = null
    let mounted = false
    let suppressNextClick = false

    function cleanupListeners() {
      controller?.abort()
      controller = null
      currentNode = null
      suppressNextClick = false
    }

    handle.addEventListener('insert', (event) => {
      cleanupListeners()
      controller = new AbortController()
      currentNode = event.node
      mounted = true
      let signal = controller.signal
      let handlePointerDown = (pointerEvent: PointerEvent) => {
        if (!mounted) return
        if (pointerEvent.button !== 0) return
        if (
          currentNode &&
          pointerEvent.target instanceof Node &&
          currentNode.contains(pointerEvent.target)
        ) {
          return
        }

        suppressNextClick = true
        pointerEvent.stopPropagation()
        currentHandler(pointerEvent)
      }
      let handleClick = (clickEvent: MouseEvent) => {
        let shouldSuppress = suppressNextClick
        suppressNextClick = false

        if (clickEvent.button !== 0) return
        if (
          currentNode &&
          clickEvent.target instanceof Node &&
          currentNode.contains(clickEvent.target)
        ) {
          return
        }

        if (!mounted) {
          if (shouldSuppress) {
            clickEvent.stopPropagation()
          }
          cleanupListeners()
          return
        }

        clickEvent.stopPropagation()
        if (shouldSuppress) {
          return
        }

        currentHandler(clickEvent)
      }

      document.addEventListener('pointerdown', handlePointerDown, {
        capture: true,
        signal,
      })

      document.addEventListener('click', handleClick, {
        capture: true,
        signal,
      })
    })

    handle.addEventListener('remove', () => {
      mounted = false
      if (!suppressNextClick) cleanupListeners()
    })

    return (handler) => {
      currentHandler = handler
      return handle.element
    }
  },
)
