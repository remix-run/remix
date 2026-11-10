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
