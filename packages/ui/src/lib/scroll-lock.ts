type ScrollLockState = {
  count: number
  stylesheet: CSSStyleSheet
  touchListeners: AbortController
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

    let touchListeners = new AbortController()
    preventTouchScroll(document, touchListeners.signal)

    state = { count: 0, stylesheet, touchListeners, scrollX, scrollY }
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

    currentState.touchListeners.abort()
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (stylesheet) => stylesheet !== currentState.stylesheet,
    )
    view.scrollTo(currentState.scrollX, currentState.scrollY)
  }
}

// On iOS, `overflow: hidden` on the root does not stop touch scrolling of the page once the user
// has scrolled it, while the keyboard is open, or while it is zoomed, so the lock also cancels
// touch drags that would scroll the page. Drags that an element inside the page scrolls are left
// to the browser, as with a wheel or trackpad.
function preventTouchScroll(document: Document, signal: AbortSignal) {
  let view = document.defaultView!
  let startX = 0
  let startY = 0

  function trackStart(event: TouchEvent) {
    if (event.touches.length === 1) {
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
    }
  }

  document.addEventListener('touchstart', trackStart, { capture: true, passive: true, signal })
  // A finger that stays down after a pinch drags from where it is now.
  document.addEventListener('touchend', trackStart, { capture: true, passive: true, signal })
  document.addEventListener(
    'touchmove',
    (event) => {
      if (
        // Pinch-zoom must keep working, and a zoomed page must stay pannable.
        event.touches.length > 1 ||
        (view.visualViewport?.scale ?? 1) > 1 ||
        // Scrolling has already started and can no longer be stopped.
        !event.cancelable
      ) {
        return
      }

      let deltaX = event.touches[0].clientX - startX
      let deltaY = event.touches[0].clientY - startY
      if (deltaX === 0 && deltaY === 0) return

      let path = event.composedPath()
      if (path[0] instanceof view.Element && adjustsWithDrag(path[0], deltaX, deltaY)) return

      for (let target of path) {
        if (target === document.body) break
        if (target instanceof view.Element && scrollsWithDrag(target, deltaX, deltaY)) return
      }

      event.preventDefault()
    },
    { capture: true, passive: false, signal },
  )
}

// Cancelling a drag also stops iOS from moving a range input's thumb or a text selection handle
// with it, so those drags are left alone.
function adjustsWithDrag(target: Element, deltaX: number, deltaY: number) {
  let view = target.ownerDocument.defaultView!

  if (target instanceof view.HTMLInputElement && target.type === 'range') {
    // Only along the track. A drag across it does not move the thumb and would scroll the page.
    return Math.abs(deltaX) > Math.abs(deltaY) === target.offsetWidth > target.offsetHeight
  }

  if (target instanceof view.HTMLInputElement || target instanceof view.HTMLTextAreaElement) {
    return target.matches(':focus') && target.selectionStart !== target.selectionEnd
  }

  let selection = view.getSelection()
  return selection != null && !selection.isCollapsed && selection.containsNode(target, true)
}

function scrollsWithDrag(element: Element, deltaX: number, deltaY: number) {
  let style = element.ownerDocument.defaultView!.getComputedStyle(element)
  let flexDirection = style.display.endsWith('flex') ? style.flexDirection : ''
  return (
    axisScrollsWithDrag(
      style.overflowX,
      element.scrollLeft,
      element.scrollWidth - element.clientWidth,
      deltaX,
      (style.direction === 'rtl') !== (flexDirection === 'row-reverse'),
    ) ||
    axisScrollsWithDrag(
      style.overflowY,
      element.scrollTop,
      element.scrollHeight - element.clientHeight,
      deltaY,
      flexDirection === 'column-reverse',
    )
  )
}

// A drag scrolls an axis when content is hidden on the side the finger moves away from. Scroll
// offsets run from 0 to `max`, or from `-max` to 0 when content overflows toward the start edge
// (RTL, reversed flex directions), which `reversed` can only tell apart at offset 0.
function axisScrollsWithDrag(
  overflow: string,
  offset: number,
  max: number,
  delta: number,
  reversed: boolean,
) {
  if (delta === 0 || max < 1 || (overflow !== 'auto' && overflow !== 'scroll')) return false
  let hiddenBefore = offset < 0 || (offset === 0 && reversed) ? offset + max : offset
  return delta > 0 ? hiddenBefore >= 1 : max - hiddenBefore >= 1
}
