import { addEventListeners, createMixin } from 'remix/component'

export let dragVelocityReleaseEventType = 'rmx:drag-velocity-release' as const

declare global {
  interface HTMLElementEventMap {
    [dragVelocityReleaseEventType]: DragVelocityEvent
  }
}

export class DragVelocityEvent extends Event {
  clientX: number
  clientY: number
  velocityX: number // px/s
  velocityY: number // px/s

  constructor(
    type: typeof dragVelocityReleaseEventType,
    init: { clientX: number; clientY: number; velocityX: number; velocityY: number },
  ) {
    super(type, { bubbles: true, cancelable: true })
    this.clientX = init.clientX
    this.clientY = init.clientY
    this.velocityX = init.velocityX
    this.velocityY = init.velocityY
  }
}

let baseDragVelocityEvents = createMixin<HTMLElement>((handle) => {
  let target: HTMLElement
  let isTracking = false
  let pointerId: number | null = null
  let lastX = 0
  let lastY = 0
  let lastTime = 0
  let velocityX = 0
  let velocityY = 0

  let onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary) return
    isTracking = true
    pointerId = event.pointerId
    lastX = event.clientX
    lastY = event.clientY
    lastTime = performance.now()
    velocityX = 0
    velocityY = 0
    target.setPointerCapture(event.pointerId)
  }

  let onPointerMove = (event: PointerEvent) => {
    if (!isTracking) return
    if (!event.isPrimary) return
    if (pointerId != null && event.pointerId !== pointerId) return

    let now = performance.now()
    let dt = (now - lastTime) / 1000 // seconds

    if (dt > 0) {
      // Smooth velocity with some decay of previous velocity
      let newVelocityX = (event.clientX - lastX) / dt
      let newVelocityY = (event.clientY - lastY) / dt
      velocityX = velocityX * 0.5 + newVelocityX * 0.5
      velocityY = velocityY * 0.5 + newVelocityY * 0.5
    }

    lastX = event.clientX
    lastY = event.clientY
    lastTime = now
  }

  let onPointerUp = (event: PointerEvent) => {
    if (!isTracking) return
    if (!event.isPrimary) return
    if (pointerId != null && event.pointerId !== pointerId) return
    isTracking = false
    pointerId = null

    // If too much time passed since last move, velocity is zero
    let timeSinceLastMove = (performance.now() - lastTime) / 1000
    if (timeSinceLastMove > 0.1) {
      velocityX = 0
      velocityY = 0
    }

    target.dispatchEvent(
      new DragVelocityEvent(dragVelocityReleaseEventType, {
        clientX: event.clientX,
        clientY: event.clientY,
        velocityX,
        velocityY,
      }),
    )
  }

  let onPointerCancel = () => {
    isTracking = false
    pointerId = null
  }

  handle.addEventListener('insert', (event) => {
    target = event.node
    addEventListeners(target, handle.signal, {
      pointerdown: onPointerDown,
      pointermove: onPointerMove,
      pointerup: onPointerUp,
      pointercancel: onPointerCancel,
    })
  })
})

type DragVelocityEventsMixin = typeof baseDragVelocityEvents & {
  readonly release: typeof dragVelocityReleaseEventType
}

export let dragVelocityEvents: DragVelocityEventsMixin = Object.assign(baseDragVelocityEvents, {
  release: dragVelocityReleaseEventType,
})
