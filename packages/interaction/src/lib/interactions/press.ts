import { defineInteraction, type Interaction } from '../interaction.ts'

/**
 * Normalized press events for pointer and keyboard input. A press is dispatched
 * when a pointer or keyboard Enter/Space is pressed down followed by a press up
 * without repeating.
 *
 * ```tsx
 * import { press } from 'remix/interaction/press'
 * on(button, {
 *   [press]: (event) => {
 *     console.log('pressed')
 *   },
 * })
 * ```
 */
export let press = defineInteraction('rmx:press', Press)

/**
 * Normalized press down event for pointers and keyboard Enter/Space without
 * repeating.
 *
 * ```ts
 * import { pressDown } from 'remix/interaction/press'
 * on(button, {
 *   [pressDown]: (event) => {
 *     console.log('pressed down')
 *   },
 * })
 * ```
 */
export let pressDown = defineInteraction('rmx:press-down', Press)

/**
 * Normalized press up event for pointers and keyboard Enter/Space without
 * repeating.
 *
 * ```ts
 * import { pressUp } from 'remix/interaction/press'
 * on(button, {
 *   [pressUp]: (event) => {
 *     console.log('pressed up')
 *   },
 * })
 * ```
 */
export let pressUp = defineInteraction('rmx:press-up', Press)

/**
 * Dispatches when a press is held for 500ms. To prevent any `press` events from
 * dispatching after a long press, call `event.preventDefault()` on the long
 * press event.
 *
 * ```ts
 * on(button, {
 *   [longPress]: (event) => {
 *     console.log('long pressed')
 *     // cancel subsequent `press`/`pressUp` events
 *     event.preventDefault()
 *   },
 *   [press]: (event) => {
 *     console.log('pressed')
 *   },
 * })
 * ```
 */
export let longPress = defineInteraction('rmx:long-press', Press)

/**
 * Dispatched when a press is cancelled by a pointer up outside of the target or
 * keyboard escape after a press down.
 *
 * ```ts
 * import { pressCancel } from 'remix/interaction/press'
 * on(button, {
 *   [pressCancel]: (event) => {
 *     console.log('press cancelled')
 *   },
 * })
 * ```
 */
export let pressCancel = defineInteraction('rmx:press-cancel', Press)

declare global {
  interface HTMLElementEventMap {
    [press]: PressEvent
    [pressDown]: PressEvent
    [pressUp]: PressEvent
    [longPress]: PressEvent
    [pressCancel]: PressEvent
  }
}

export class PressEvent extends Event {
  clientX: number
  clientY: number

  constructor(
    type: typeof press | typeof pressDown | typeof pressUp | typeof longPress | typeof pressCancel,
    init: { clientX?: number; clientY?: number } = {},
  ) {
    super(type, { bubbles: true, cancelable: true })
    this.clientX = init.clientX ?? 0
    this.clientY = init.clientY ?? 0
  }
}

function Press(handle: Interaction) {
  if (!(handle.target instanceof HTMLElement)) return

  let target = handle.target
  let isPointerDown = false
  let isKeyboardDown = false
  let longPressTimer: number = 0
  let suppressNextUp = false

  let clearLongTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = 0
    }
  }

  let startLongTimer = () => {
    clearLongTimer()
    longPressTimer = window.setTimeout(() => {
      suppressNextUp = !target.dispatchEvent(new PressEvent(longPress))
    }, 500)
  }

  handle.on(handle.target, {
    pointerdown(event) {
      if (event.isPrimary === false) return
      if (isPointerDown) return
      isPointerDown = true
      target.dispatchEvent(
        new PressEvent(pressDown, {
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      )
      startLongTimer()
    },

    pointerup(event) {
      if (!isPointerDown) return
      isPointerDown = false
      clearLongTimer()
      if (suppressNextUp) {
        suppressNextUp = false
        return
      }

      target.dispatchEvent(
        new PressEvent(pressUp, {
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      )
      target.dispatchEvent(
        new PressEvent(press, {
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      )
    },

    pointerleave() {
      if (!isPointerDown) return
      // cancel current gesture without dispatching up/press
      clearLongTimer()
    },

    keydown(event) {
      let key = event.key
      if (key == 'Escape' && (isKeyboardDown || isPointerDown)) {
        clearLongTimer()
        suppressNextUp = true
        target.dispatchEvent(new PressEvent(pressCancel))
        return
      }

      if (!(key === 'Enter' || key === ' ')) return
      if (event.repeat) return
      if (isKeyboardDown) return
      isKeyboardDown = true

      target.dispatchEvent(new PressEvent(pressDown))
      startLongTimer()
    },

    keyup(event) {
      let key = event.key
      if (!(key === 'Enter' || key === ' ')) return
      if (!isKeyboardDown) return
      isKeyboardDown = false

      clearLongTimer()
      if (suppressNextUp) {
        suppressNextUp = false
        return
      }

      target.dispatchEvent(new PressEvent(pressUp))
      target.dispatchEvent(new PressEvent(press))
    },
  })

  handle.on(target.ownerDocument, {
    pointerup() {
      if (isPointerDown) {
        isPointerDown = false
        target.dispatchEvent(new PressEvent(pressCancel))
      }
    },
  })
}
