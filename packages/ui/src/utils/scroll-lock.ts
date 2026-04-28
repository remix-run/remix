import { createMixin, on, type ElementProps } from '@remix-run/ui'

type ScrollLockState = {
  count: number
  documentOverflow: string
  documentScrollbarGutter: string
  scrollX: number
  scrollY: number
}

const scrollLocks = new WeakMap<Document, ScrollLockState>()

export function lockScroll(targetDocument = globalThis.document) {
  if (!targetDocument?.body || !targetDocument.defaultView) {
    return () => {}
  }

  let document = targetDocument
  let documentElement = document.documentElement
  let view = document.defaultView!
  let state = scrollLocks.get(document)

  if (!state) {
    let scrollX = view.scrollX
    let scrollY = view.scrollY
    let scrollbarWidth =
      documentElement.clientWidth > 0
        ? Math.max(view.innerWidth - documentElement.clientWidth, 0)
        : 0
    let computedScrollbarGutter = view.getComputedStyle(documentElement).scrollbarGutter

    state = {
      count: 0,
      documentOverflow: documentElement.style.overflow,
      documentScrollbarGutter: documentElement.style.scrollbarGutter,
      scrollX,
      scrollY,
    }

    documentElement.style.overflow = 'hidden'
    if (scrollbarWidth > 0 && computedScrollbarGutter === 'auto') {
      documentElement.style.scrollbarGutter = 'stable'
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
    documentElement.style.scrollbarGutter = currentState.documentScrollbarGutter
    view.scrollTo(currentState.scrollX, currentState.scrollY)
  }
}

export const lockScrollOnToggle = createMixin<HTMLElement, [], ElementProps>((handle) => {
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
