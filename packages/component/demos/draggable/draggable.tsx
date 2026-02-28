import { createMixin, on } from 'remix/component'

export type DragDetail = {
  left: number
  top: number
}

export let dragStartEvent = 'rmx:dragstart' as const
export let dragEndEvent = 'rmx:dragend' as const

type DraggableProps = {
  on?: Record<string, (event: Event) => void>
}

let baseDraggable = createMixin<HTMLElement, [boolean], DraggableProps>((handle) => {
  let node: HTMLElement | null = null
  let enabled = true
  let pointerId: number | null = null
  let startLeft = 0
  let startTop = 0
  let startClientX = 0
  let startClientY = 0

  handle.addEventListener('insert', (event) => {
    node = event.node
  })

  handle.addEventListener('remove', stopDrag)

  return (nextEnabled: boolean = true, props) => {
    enabled = nextEnabled
    if (!enabled) {
      stopDrag()
    }

    return <handle.element {...props} mix={[on('pointerdown', (event) => onPointerDown(event))]} />
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    if (!enabled) return
    if (!node) return

    let style = getComputedStyle(node)
    if (style.position === 'static') {
      node.style.position = 'relative'
    }
    node.style.cursor = 'grabbing'

    startLeft = readPx(node.style.left)
    startTop = readPx(node.style.top)
    startClientX = event.clientX
    startClientY = event.clientY
    pointerId = event.pointerId

    try {
      node.setPointerCapture(event.pointerId)
    } catch {}

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerDone)
    window.addEventListener('pointercancel', onPointerDone)
    dispatchDragEvent(node, dragStartEvent)
  }

  function onPointerMove(event: PointerEvent) {
    if (!node) return
    if (pointerId == null) return
    if (event.pointerId !== pointerId) return
    let dx = event.clientX - startClientX
    let dy = event.clientY - startClientY
    node.style.left = `${startLeft + dx}px`
    node.style.top = `${startTop + dy}px`
    void handle.update()
  }

  function onPointerDone(event: PointerEvent) {
    if (!node) return
    if (pointerId == null) return
    if (event.pointerId !== pointerId) return
    stopDrag()
    dispatchDragEvent(node, dragEndEvent)
  }

  function stopDrag() {
    if (!node) return
    if (pointerId == null) return
    pointerId = null
    node.style.cursor = 'grab'
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerDone)
    window.removeEventListener('pointercancel', onPointerDone)
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

type DraggableMixin = typeof baseDraggable & {
  readonly start: typeof dragStartEvent
  readonly end: typeof dragEndEvent
}

export let draggable: DraggableMixin = Object.assign(baseDraggable, {
  start: dragStartEvent,
  end: dragEndEvent,
})

declare global {
  interface HTMLElementEventMap {
    [dragStartEvent]: CustomEvent<DragDetail>
    [dragEndEvent]: CustomEvent<DragDetail>
  }
}
