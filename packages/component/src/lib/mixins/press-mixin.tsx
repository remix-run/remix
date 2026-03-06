import { createMixin } from '../mixin.ts'

export let pressEventType = 'rmx:press' as const
export let pressDownEventType = 'rmx:press-down' as const
export let pressUpEventType = 'rmx:press-up' as const
export let longPressEventType = 'rmx:long-press' as const
export let pressCancelEventType = 'rmx:press-cancel' as const

declare global {
  interface HTMLElementEventMap {
    [pressEventType]: PressEvent
    [pressDownEventType]: PressEvent
    [pressUpEventType]: PressEvent
    [longPressEventType]: PressEvent
    [pressCancelEventType]: PressEvent
  }
}

export class PressEvent extends Event {
  clientX: number
  clientY: number

  constructor(
    type:
      | typeof pressEventType
      | typeof pressDownEventType
      | typeof pressUpEventType
      | typeof longPressEventType
      | typeof pressCancelEventType,
    init: { clientX?: number; clientY?: number } = {},
  ) {
    super(type, { bubbles: true, cancelable: true })
    this.clientX = init.clientX ?? 0
    this.clientY = init.clientY ?? 0
  }
}

let basePressEvents = createMixin<HTMLElement>((handle) => {
  let target: HTMLElement | null = null
  let doc: Document | null = null
  let isPointerDown = false
  let isKeyboardDown = false
  let longPressTimer = 0
  let suppressNextUp = false

  let clearLongTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = 0
    }
  }

  let startLongTimer = () => {
    if (!target) return
    clearLongTimer()
    longPressTimer = window.setTimeout(() => {
      if (!target) return
      suppressNextUp = !target.dispatchEvent(new PressEvent(longPressEventType))
    }, 500)
  }

  let onPointerDown = (event: PointerEvent) => {
    if (!target) return
    if (event.isPrimary === false) return
    if (isPointerDown) return
    isPointerDown = true
    target.dispatchEvent(
      new PressEvent(pressDownEventType, {
        clientX: event.clientX,
        clientY: event.clientY,
      }),
    )
    startLongTimer()
  }

  let onPointerUp = (event: PointerEvent) => {
    if (!target) return
    if (!isPointerDown) return
    isPointerDown = false
    clearLongTimer()
    if (suppressNextUp) {
      suppressNextUp = false
      return
    }

    target.dispatchEvent(
      new PressEvent(pressUpEventType, {
        clientX: event.clientX,
        clientY: event.clientY,
      }),
    )
    target.dispatchEvent(
      new PressEvent(pressEventType, {
        clientX: event.clientX,
        clientY: event.clientY,
      }),
    )
  }

  let onPointerLeave = () => {
    if (!isPointerDown) return
    clearLongTimer()
  }

  let onKeyDown = (event: KeyboardEvent) => {
    if (!target) return
    let key = event.key
    if (key == 'Escape' && (isKeyboardDown || isPointerDown)) {
      clearLongTimer()
      suppressNextUp = true
      target.dispatchEvent(new PressEvent(pressCancelEventType))
      return
    }

    if (!(key === 'Enter' || key === ' ')) return
    if (event.repeat) return
    if (isKeyboardDown) return
    isKeyboardDown = true

    target.dispatchEvent(new PressEvent(pressDownEventType))
    startLongTimer()
  }

  let onKeyUp = (event: KeyboardEvent) => {
    if (!target) return
    let key = event.key
    if (!(key === 'Enter' || key === ' ')) return
    if (!isKeyboardDown) return
    isKeyboardDown = false

    clearLongTimer()
    if (suppressNextUp) {
      suppressNextUp = false
      return
    }

    target.dispatchEvent(new PressEvent(pressUpEventType))
    target.dispatchEvent(new PressEvent(pressEventType))
  }

  let onDocumentPointerUp = () => {
    if (!target) return
    if (!isPointerDown) return
    isPointerDown = false
    target.dispatchEvent(new PressEvent(pressCancelEventType))
  }

  handle.addEventListener('insert', (event) => {
    target = event.node
    doc = target.ownerDocument
    target.addEventListener('pointerdown', onPointerDown)
    target.addEventListener('pointerup', onPointerUp)
    target.addEventListener('pointerleave', onPointerLeave)
    target.addEventListener('keydown', onKeyDown)
    target.addEventListener('keyup', onKeyUp)
    doc.addEventListener('pointerup', onDocumentPointerUp)
  })

  handle.addEventListener('remove', () => {
    clearLongTimer()
    if (target) {
      target.removeEventListener('pointerdown', onPointerDown)
      target.removeEventListener('pointerup', onPointerUp)
      target.removeEventListener('pointerleave', onPointerLeave)
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('keyup', onKeyUp)
    }
    if (doc) {
      doc.removeEventListener('pointerup', onDocumentPointerUp)
    }
    target = null
    doc = null
    isPointerDown = false
    isKeyboardDown = false
    suppressNextUp = false
  })
})

type PressEventsMixin = typeof basePressEvents & {
  readonly press: typeof pressEventType
  readonly down: typeof pressDownEventType
  readonly up: typeof pressUpEventType
  readonly long: typeof longPressEventType
  readonly cancel: typeof pressCancelEventType
}

export let pressEvents: PressEventsMixin = Object.assign(basePressEvents, {
  press: pressEventType,
  down: pressDownEventType,
  up: pressUpEventType,
  long: longPressEventType,
  cancel: pressCancelEventType,
})
