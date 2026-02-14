import { createDirective } from './use.ts'

export type DragDetail = {
  left: number
  top: number
}

export let dragStartEvent = 'rmx:dragstart' as const
export let dragEndEvent = 'rmx:dragend' as const

let baseDraggable = createDirective((_) => (host) => {
  let enabled = true
  let target: null | HTMLElement = null
  let pointerId: null | number = null
  let startLeft = 0
  let startTop = 0
  let startClientX = 0
  let startClientY = 0

  let cleanupTarget: null | (() => void) = null
  let cleanupDrag: null | (() => void) = null

  host.addEventListener('remove', () => {
    cleanupDrag?.()
    cleanupTarget?.()
    cleanupDrag = null
    cleanupTarget = null
    target = null
  })

  return (nextEnabled: boolean = true) => {
    enabled = nextEnabled
    host.queueTask((node) => {
      if (!(node instanceof HTMLElement)) return

      if (target !== node) {
        cleanupDrag?.()
        cleanupTarget?.()
        cleanupDrag = null
        cleanupTarget = null
        target = node
      }

      if (!enabled) {
        cleanupDrag?.()
        cleanupDrag = null
        cleanupTarget?.()
        cleanupTarget = null
        target = node
        return
      }

      if (!cleanupTarget) {
        cleanupTarget = bindTarget(node)
      }
    })
  }

  function bindTarget(node: HTMLElement) {
    let pointerDown = (event: PointerEvent) => {
      if (!enabled) return
      if (event.button !== 0) return

      let style = getComputedStyle(node)
      if (style.position === 'static') {
        node.style.position = 'relative'
      }

      startLeft = readPx(node.style.left)
      startTop = readPx(node.style.top)
      startClientX = event.clientX
      startClientY = event.clientY
      pointerId = event.pointerId

      try {
        node.setPointerCapture(event.pointerId)
      } catch {}
      cleanupDrag?.()
      cleanupDrag = bindDrag(node)
      dispatchDragEvent(node, dragStartEvent)
    }

    node.addEventListener('pointerdown', pointerDown)
    return () => {
      node.removeEventListener('pointerdown', pointerDown)
    }
  }

  function bindDrag(node: HTMLElement) {
    let move = (event: PointerEvent) => {
      if (pointerId == null) return
      if (event.pointerId !== pointerId) return
      let dx = event.clientX - startClientX
      let dy = event.clientY - startClientY
      node.style.left = `${startLeft + dx}px`
      node.style.top = `${startTop + dy}px`
    }

    let done = (event: PointerEvent) => {
      if (pointerId == null) return
      if (event.pointerId !== pointerId) return
      pointerId = null
      cleanupDrag?.()
      cleanupDrag = null
      dispatchDragEvent(node, dragEndEvent)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)

    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
    }
  }
})

function dispatchDragEvent(node: HTMLElement, type: string) {
  node.dispatchEvent(
    new CustomEvent<DragDetail>(type, {
      detail: {
        left: readPx(node.style.left),
        top: readPx(node.style.top),
      },
      bubbles: true,
    }),
  )
}

function readPx(value: string) {
  if (!value) return 0
  let parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

type DraggableDirective = typeof baseDraggable & {
  readonly start: typeof dragStartEvent
  readonly end: typeof dragEndEvent
}

export let draggable: DraggableDirective = Object.assign(baseDraggable, {
  start: dragStartEvent,
  end: dragEndEvent,
})

declare global {
  interface HTMLElementEventMap {
    [dragStartEvent]: CustomEvent<DragDetail>
    [dragEndEvent]: CustomEvent<DragDetail>
  }
}
