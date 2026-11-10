import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock } from '@remix-run/test'

import { lockScroll } from './scroll-lock.ts'

let currentScrollX = 24
let currentScrollY = 120
let scrollToSpy: ReturnType<typeof mock.method>

beforeEach(() => {
  currentScrollX = 24
  currentScrollY = 120
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1000,
    writable: true,
  })

  Object.defineProperty(window, 'scrollX', {
    configurable: true,
    get: () => currentScrollX,
  })

  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => currentScrollY,
  })

  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 980,
  })

  scrollToSpy = mock.method(
    window,
    'scrollTo',
    (xOrOptions?: number | ScrollToOptions, y?: number) => {
      if (xOrOptions && typeof xOrOptions === 'object') {
        currentScrollX = xOrOptions.left ?? currentScrollX
        currentScrollY = xOrOptions.top ?? currentScrollY
        return
      }

      currentScrollX = xOrOptions ?? currentScrollX
      currentScrollY = y ?? currentScrollY
    },
  )
})

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
  scrollToSpy?.mock.restore!()
})

function computed() {
  return getComputedStyle(document.documentElement)
}

// Desktop Firefox has no `TouchEvent` and desktop WebKit cannot construct a `Touch`, so the listener
// is exercised there with a plain event that carries the same touch list.
function dispatchTouch(type: string, target: Element, ...points: [x: number, y: number][]) {
  let touches = points.map(([clientX, clientY], identifier) => ({
    clientX,
    clientY,
    identifier,
    target,
  }))
  let init = { bubbles: true, cancelable: true, composed: true }
  let event: Event
  try {
    event = new TouchEvent(type, { ...init, touches: touches.map((touch) => new Touch(touch)) })
  } catch {
    event = Object.assign(new Event(type, init), { touches })
  }

  target.dispatchEvent(event)
  return event
}

function drag(target: Element, deltaX: number, deltaY: number) {
  dispatchTouch('touchstart', target, [200, 200])
  let move = dispatchTouch('touchmove', target, [200 + deltaX, 200 + deltaY])
  dispatchTouch('touchend', target)
  return move
}

function appendElement(parent: Node, tagName: string, style = '') {
  let element = document.createElement(tagName)
  element.style.cssText = style
  parent.appendChild(element)
  return element
}

function appendScroller(parent: Node, style = '') {
  let scroller = appendElement(
    parent,
    'div',
    `width: 100px; height: 100px; overflow: auto; ${style}`,
  )
  let content = appendElement(scroller, 'div', 'width: 400px; height: 400px; flex: none')
  return { scroller, content }
}

describe('lockScroll', () => {
  it('locks document scrolling and restores the scroll position on unlock', () => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'clip'
    document.body.style.position = 'relative'

    let unlock = lockScroll()

    expect(computed().overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.position).toBe('relative')

    unlock()

    expect(computed().overflow).toBe('auto')
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.position).toBe('relative')
    expect(window.scrollTo).toHaveBeenCalledWith(24, 120)
  })

  it('overrides application styles for the document element', () => {
    let style = document.createElement('style')
    style.textContent = 'html { overflow: scroll !important }'
    document.head.append(style)

    let unlock = lockScroll()
    expect(computed().overflow).toBe('hidden')

    unlock()
    expect(computed().overflow).toBe('scroll')
    style.remove()
  })

  it('reserves the scrollbar gutter while locked', () => {
    let unlock = lockScroll()

    expect(computed().scrollbarGutter).toBe('stable')

    unlock()

    expect(computed().scrollbarGutter).toBe('auto')
  })

  it('keeps an application scrollbar gutter', () => {
    document.documentElement.style.scrollbarGutter = 'stable both-edges'

    let unlock = lockScroll()
    expect(computed().scrollbarGutter).toBe('stable both-edges')

    unlock()
  })

  it('stays locked when the document element attributes are replaced', () => {
    document.documentElement.style.overflow = 'auto'
    document.documentElement.setAttribute('data-theme', 'dark')

    let unlock = lockScroll()

    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-theme')
    expect(computed().overflow).toBe('hidden')

    unlock()
    expect(computed().overflow).toBe('visible')
  })

  it('keeps the document locked until the last unlock runs', () => {
    let unlockFirst = lockScroll()
    let unlockSecond = lockScroll()

    unlockFirst()

    expect(computed().overflow).toBe('hidden')
    expect(window.scrollTo).not.toHaveBeenCalled()

    unlockSecond()
    unlockSecond()

    expect(computed().overflow).toBe('visible')
    expect(document.adoptedStyleSheets).toHaveLength(0)
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })
})

describe('lockScroll touch drags', () => {
  afterEach(() => {
    Reflect.deleteProperty(window.visualViewport!, 'scale')
    getSelection()?.removeAllRanges()
  })

  it('cancels drags that no element under the touch can scroll', () => {
    let target = appendElement(document.body, 'div')

    expect(drag(target, 0, -50).defaultPrevented).toBe(false)

    let unlock = lockScroll()
    expect(drag(target, 0, -50).defaultPrevented).toBe(true)
    expect(drag(target, 30, 0).defaultPrevented).toBe(true)

    unlock()
    expect(drag(target, 0, -50).defaultPrevented).toBe(false)
  })

  it('cancels drags until the last unlock runs', () => {
    let target = appendElement(document.body, 'div')
    let unlockFirst = lockScroll()
    let unlockSecond = lockScroll()

    unlockFirst()
    expect(drag(target, 0, -50).defaultPrevented).toBe(true)

    unlockSecond()
    expect(drag(target, 0, -50).defaultPrevented).toBe(false)
  })

  it('leaves drags that scroll an element under the touch', () => {
    let { scroller, content } = appendScroller(document.body)
    let unlock = lockScroll()

    scroller.scrollTop = 150
    expect(drag(content, 0, -50).defaultPrevented).toBe(false)
    expect(drag(content, 0, 50).defaultPrevented).toBe(false)

    scroller.scrollLeft = 150
    expect(drag(content, -50, 0).defaultPrevented).toBe(false)
    expect(drag(content, 50, 0).defaultPrevented).toBe(false)

    unlock()
  })

  it('cancels drags past the scroll boundary of an element under the touch', () => {
    let { scroller, content } = appendScroller(document.body, 'overflow-x: hidden')
    let unlock = lockScroll()

    expect(drag(content, 0, 50).defaultPrevented).toBe(true)
    expect(drag(content, 0, -50).defaultPrevented).toBe(false)

    scroller.scrollTop = scroller.scrollHeight
    expect(drag(content, 0, -50).defaultPrevented).toBe(true)
    expect(drag(content, 0, 50).defaultPrevented).toBe(false)

    expect(drag(content, -50, 0).defaultPrevented).toBe(true)

    unlock()
  })

  it('cancels drags in scroll containers that do not overflow', () => {
    let target = appendElement(document.body, 'div', 'height: 100px; overflow: auto')
    let unlock = lockScroll()

    expect(drag(target, 0, -50).defaultPrevented).toBe(true)

    unlock()
  })

  it('leaves drags toward the start of right-to-left and reversed scroll containers', () => {
    let rtl = appendScroller(document.body, 'direction: rtl')
    let reversed = appendScroller(document.body, 'display: flex; flex-direction: column-reverse')
    let unlock = lockScroll()

    expect(drag(rtl.content, 50, 0).defaultPrevented).toBe(false)
    expect(drag(rtl.content, -50, 0).defaultPrevented).toBe(true)

    rtl.scroller.scrollLeft = -150
    expect(drag(rtl.content, -50, 0).defaultPrevented).toBe(false)

    expect(drag(reversed.content, 0, 50).defaultPrevented).toBe(false)
    expect(drag(reversed.content, 0, -50).defaultPrevented).toBe(true)

    unlock()
  })

  it('finds scrollable elements across shadow roots', () => {
    let host = appendElement(document.body, 'div')
    let { content } = appendScroller(host.attachShadow({ mode: 'open' }))
    let unlock = lockScroll()

    expect(drag(content, 0, -50).defaultPrevented).toBe(false)
    expect(drag(content, 0, 50).defaultPrevented).toBe(true)

    unlock()
  })

  it('leaves multi-touch gestures to the browser', () => {
    let target = appendElement(document.body, 'div')
    let unlock = lockScroll()

    dispatchTouch('touchstart', target, [200, 200])
    dispatchTouch('touchstart', target, [200, 200], [260, 200])
    let pinch = dispatchTouch('touchmove', target, [180, 200], [280, 200])

    expect(pinch.defaultPrevented).toBe(false)

    unlock()
  })

  it('measures a drag from where the remaining finger is after a pinch', () => {
    let { content } = appendScroller(document.body)
    let unlock = lockScroll()

    dispatchTouch('touchstart', content, [200, 200])
    dispatchTouch('touchstart', content, [200, 200], [260, 200])
    dispatchTouch('touchmove', content, [200, 300], [260, 400])
    dispatchTouch('touchend', content, [200, 300])

    // Up from where the pinch ended scrolls the element, although it is down from the first touch.
    expect(dispatchTouch('touchmove', content, [200, 250]).defaultPrevented).toBe(false)
    expect(dispatchTouch('touchmove', content, [200, 350]).defaultPrevented).toBe(true)

    unlock()
  })

  it('leaves drags alone while the page is zoomed', () => {
    let target = appendElement(document.body, 'div')
    let unlock = lockScroll()

    Object.defineProperty(window.visualViewport, 'scale', { configurable: true, value: 2 })
    expect(drag(target, 0, -50).defaultPrevented).toBe(false)

    unlock()
  })

  it('leaves drags along the track of a range input', () => {
    let range = appendElement(document.body, 'input', 'width: 200px; height: 20px')
    range.setAttribute('type', 'range')
    let unlock = lockScroll()

    expect(drag(range, 50, 5).defaultPrevented).toBe(false)
    expect(drag(range, 5, -50).defaultPrevented).toBe(true)

    unlock()
  })

  it('leaves drags on selected text', () => {
    let selected = appendElement(document.body, 'p')
    selected.textContent = 'Selected text'
    let other = appendElement(document.body, 'p')
    other.textContent = 'Other text'
    let unlock = lockScroll()

    getSelection()!.selectAllChildren(selected)

    expect(drag(selected, 50, 0).defaultPrevented).toBe(false)
    expect(drag(other, 50, 0).defaultPrevented).toBe(true)

    unlock()
  })

  it('leaves drags on a focused text control with a selection', () => {
    let input = appendElement(document.body, 'input') as HTMLInputElement
    input.value = 'Selected text'
    let unlock = lockScroll()

    input.focus()
    input.setSelectionRange(0, 8)
    expect(drag(input, 50, 0).defaultPrevented).toBe(false)

    input.setSelectionRange(8, 8)
    expect(drag(input, 50, 0).defaultPrevented).toBe(true)

    unlock()
  })
})
