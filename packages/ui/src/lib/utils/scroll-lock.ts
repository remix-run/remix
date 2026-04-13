import { createMixin, on, type ElementProps } from '@remix-run/component'

type ScrollLockState = {
  bodyLeft: string
  bodyOverflow: string
  bodyPaddingRight: string
  bodyPosition: string
  bodyRight: string
  bodyTop: string
  bodyWidth: string
  count: number
  documentOverflow: string
  scrollX: number
  scrollY: number
}

let scrollLocks = new WeakMap<Document, ScrollLockState>()

export function lockScroll(targetDocument = globalThis.document) {
  if (!targetDocument?.body || !targetDocument.defaultView) {
    return () => {}
  }

  let document = targetDocument
  let window = document.defaultView
  let body = document.body
  let documentElement = document.documentElement
  let state = scrollLocks.get(document)

  if (!state) {
    let scrollX = window.scrollX
    let scrollY = window.scrollY
    let scrollbarWidth =
      documentElement.clientWidth > 0
        ? Math.max(window.innerWidth - documentElement.clientWidth, 0)
        : 0
    let computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0

    state = {
      bodyLeft: body.style.left,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      bodyPosition: body.style.position,
      bodyRight: body.style.right,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      count: 0,
      documentOverflow: documentElement.style.overflow,
      scrollX,
      scrollY,
    }

    documentElement.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = `-${scrollX}px`
    body.style.right = '0px'
    body.style.width = '100%'

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`
    }

    scrollLocks.set(document, state)
  }

  state.count++

  let unlocked = false

  return () => {
    if (unlocked) {
      return
    }

    unlocked = true

    let currentState = scrollLocks.get(document)
    if (!currentState) {
      return
    }

    currentState.count--
    if (currentState.count > 0) {
      return
    }

    scrollLocks.delete(document)

    documentElement.style.overflow = currentState.documentOverflow
    body.style.overflow = currentState.bodyOverflow
    body.style.position = currentState.bodyPosition
    body.style.top = currentState.bodyTop
    body.style.left = currentState.bodyLeft
    body.style.right = currentState.bodyRight
    body.style.width = currentState.bodyWidth
    body.style.paddingRight = currentState.bodyPaddingRight
    window.scrollTo(currentState.scrollX, currentState.scrollY)
  }
}

export let lockScrollOnToggle = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let unlockScroll = () => {}

  handle.signal.addEventListener('abort', () => {
    unlockScroll()
    unlockScroll = () => {}
  })

  return () => [
    on('beforetoggle', (event) => {
      unlockScroll()
      unlockScroll = () => {}

      if (event.newState !== 'open') {
        return
      }

      unlockScroll = lockScroll((event.currentTarget as HTMLElement).ownerDocument)
    }),
  ]
})
