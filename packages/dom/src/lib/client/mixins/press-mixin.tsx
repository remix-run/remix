import { createMixin } from '@remix-run/reconciler'
import type { MixinDescriptor } from '@remix-run/reconciler'
import type { DomElementType } from '../../shared/jsx/jsx-runtime.ts'

const pressType = 'rmx:press'
const pressDownType = 'rmx:press-down'
const pressUpType = 'rmx:press-up'
const longPressType = 'rmx:long-press'
const pressCancelType = 'rmx:press-cancel'

declare global {
  interface HTMLElementEventMap {
    [pressType]: PressEvent
    [pressDownType]: PressEvent
    [pressUpType]: PressEvent
    [longPressType]: PressEvent
    [pressCancelType]: PressEvent
  }
}

export class PressEvent extends Event {
  clientX: number
  clientY: number

  constructor(type: string, init: { clientX?: number; clientY?: number } = {}) {
    super(type, { bubbles: true, cancelable: true })
    this.clientX = init.clientX ?? 0
    this.clientY = init.clientY ?? 0
  }
}

let pressBehaviorMixin = createMixin<[], Element, DomElementType>((handle) => {
  let activeNode: null | HTMLElement = null
  let removeListeners: null | (() => void) = null
  let isPointerDown = false
  let isKeyboardDown = false
  let suppressNextUp = false
  let longPressTimer = 0

  function clearLongTimer() {
    if (!longPressTimer) return
    clearTimeout(longPressTimer)
    longPressTimer = 0
  }

  function cleanup() {
    clearLongTimer()
    removeListeners?.()
    removeListeners = null
    activeNode = null
    isPointerDown = false
    isKeyboardDown = false
    suppressNextUp = false
  }

  function startLongTimer(node: HTMLElement) {
    clearLongTimer()
    longPressTimer = window.setTimeout(() => {
      suppressNextUp = !node.dispatchEvent(new PressEvent(longPressType))
    }, 500)
  }

  function attach(node: HTMLElement) {
    if (activeNode === node) return
    cleanup()
    activeNode = node
    let controller = new AbortController()
    let { signal } = controller

    node.addEventListener(
      'pointerdown',
      (event) => {
        if (event.isPrimary === false) return
        if (isPointerDown) return
        isPointerDown = true
        node.dispatchEvent(
          new PressEvent(pressDownType, {
            clientX: event.clientX,
            clientY: event.clientY,
          }),
        )
        startLongTimer(node)
      },
      { signal },
    )

    node.addEventListener(
      'pointerup',
      (event) => {
        if (!isPointerDown) return
        isPointerDown = false
        clearLongTimer()
        if (suppressNextUp) {
          suppressNextUp = false
          return
        }

        node.dispatchEvent(
          new PressEvent(pressUpType, {
            clientX: event.clientX,
            clientY: event.clientY,
          }),
        )
        node.dispatchEvent(
          new PressEvent(pressType, {
            clientX: event.clientX,
            clientY: event.clientY,
          }),
        )
      },
      { signal },
    )

    node.addEventListener(
      'pointerleave',
      () => {
        if (!isPointerDown) return
        clearLongTimer()
      },
      { signal },
    )

    node.addEventListener(
      'keydown',
      (event) => {
        let key = event.key
        if (key == 'Escape' && (isKeyboardDown || isPointerDown)) {
          clearLongTimer()
          suppressNextUp = true
          node.dispatchEvent(new PressEvent(pressCancelType))
          return
        }

        if (!(key === 'Enter' || key === ' ')) return
        if (event.repeat) return
        if (isKeyboardDown) return
        isKeyboardDown = true

        node.dispatchEvent(new PressEvent(pressDownType))
        startLongTimer(node)
      },
      { signal },
    )

    node.addEventListener(
      'keyup',
      (event) => {
        let key = event.key
        if (!(key === 'Enter' || key === ' ')) return
        if (!isKeyboardDown) return
        isKeyboardDown = false

        clearLongTimer()
        if (suppressNextUp) {
          suppressNextUp = false
          return
        }

        node.dispatchEvent(new PressEvent(pressUpType))
        node.dispatchEvent(new PressEvent(pressType))
      },
      { signal },
    )

    node.ownerDocument.addEventListener(
      'pointerup',
      () => {
        if (!isPointerDown) return
        isPointerDown = false
        node.dispatchEvent(new PressEvent(pressCancelType))
      },
      { signal },
    )

    removeListeners = () => {
      controller.abort()
    }
  }

  handle.addEventListener('remove', cleanup)

  return (props) => {
    handle.queueTask((node) => {
      if (!(node instanceof HTMLElement)) return
      attach(node)
    })
    return <handle.element {...props} />
  }
})

type PressEventsMixin = (<node extends Element = Element>() => MixinDescriptor<node, []>) & {
  press: string
  down: string
  up: string
  long: string
  cancel: string
}

export let pressEvents = Object.assign(<node extends Element = Element>() => pressBehaviorMixin() as MixinDescriptor<node, []>, {
  press: pressType,
  down: pressDownType,
  up: pressUpType,
  long: longPressType,
  cancel: pressCancelType,
}) as PressEventsMixin
