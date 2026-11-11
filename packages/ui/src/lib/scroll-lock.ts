type ScrollLockState = {
  count: number
  stylesheet: CSSStyleSheet
  scrollX: number
  scrollY: number
}

const scrollLocks = new WeakMap<Document, ScrollLockState>()

export function lockScroll(targetDocument: Document | undefined = globalThis.document): () => void {
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

    // An adopted stylesheet survives DOM diffs of `<html>` that would drop inline styles. The
    // declarations are `!important` so the lock still beats app styles and inline `overflow`,
    // as the previous inline style did.
    let stylesheet = new view.CSSStyleSheet()
    stylesheet.replaceSync(
      `@layer rmx { :root { overflow: hidden !important;${
        scrollbarWidth > 0 && computedScrollbarGutter === 'auto'
          ? ' scrollbar-gutter: stable !important;'
          : ''
      } } }`,
    )
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet]

    state = { count: 0, stylesheet, scrollX, scrollY }
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

    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (stylesheet) => stylesheet !== currentState.stylesheet,
    )
    view.scrollTo(currentState.scrollX, currentState.scrollY)
  }
}
