import { defineInteraction, type Interaction } from 'remix/interaction'

/**
 * Dispatched when a pointer is released after dragging. Includes velocity
 * calculated from the drag movement.
 *
 * ```ts
 * import { dragRelease } from './drag-release.ts'
 * on(element, {
 *   [dragRelease](event) {
 *     console.log(event.velocityX, event.velocityY)
 *   },
 * })
 * ```
 */
export let dragRelease = defineInteraction('rmx:drag-release', DragRelease)

declare global {
  interface HTMLElementEventMap {
    [dragRelease]: DragReleaseEvent
  }
}

export class DragReleaseEvent extends Event {
  clientX: number
  clientY: number
  velocityX: number // px/s
  velocityY: number // px/s

  constructor(
    type: typeof dragRelease,
    init: { clientX: number; clientY: number; velocityX: number; velocityY: number },
  ) {
    super(type, { bubbles: true, cancelable: true })
    this.clientX = init.clientX
    this.clientY = init.clientY
    this.velocityX = init.velocityX
    this.velocityY = init.velocityY
  }
}

function DragRelease(handle: Interaction) {
  if (!(handle.target instanceof HTMLElement)) return

  let target = handle.target
  let isTracking = false
  let lastX = 0
  let lastY = 0
  let lastTime = 0
  let velocityX = 0
  let velocityY = 0

  handle.on(target, {
    pointerdown(event) {
      if (!event.isPrimary) return
      isTracking = true
      lastX = event.clientX
      lastY = event.clientY
      lastTime = performance.now()
      velocityX = 0
      velocityY = 0
      target.setPointerCapture(event.pointerId)
    },

    pointermove(event) {
      if (!isTracking) return
      if (!event.isPrimary) return

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
    },

    pointerup(event) {
      if (!isTracking) return
      if (!event.isPrimary) return
      isTracking = false

      // If too much time passed since last move, velocity is zero
      let timeSinceLastMove = (performance.now() - lastTime) / 1000
      if (timeSinceLastMove > 0.1) {
        velocityX = 0
        velocityY = 0
      }

      target.dispatchEvent(
        new DragReleaseEvent(dragRelease, {
          clientX: event.clientX,
          clientY: event.clientY,
          velocityX,
          velocityY,
        }),
      )
    },

    pointercancel() {
      isTracking = false
    },
  })
}
