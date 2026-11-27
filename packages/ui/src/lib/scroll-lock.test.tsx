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

describe('lockScroll', () => {
  it('locks and releases each document independently', () => {
    let frame = document.createElement('iframe')
    document.body.append(frame)
    let doc = frame.contentDocument
    let view = frame.contentWindow
    if (!doc || !view) throw new Error('Missing frame document')
    let outerSheets = [...document.adoptedStyleSheets]
    let innerSheets = [...doc.adoptedStyleSheets]
    let unlockOuter = lockScroll()
    let unlockInner = lockScroll(doc)
    try {
      expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
      expect(view.getComputedStyle(doc.documentElement).overflow).toBe('hidden')
      unlockOuter()
      expect(getComputedStyle(document.documentElement).overflow).toBe('visible')
      expect(view.getComputedStyle(doc.documentElement).overflow).toBe('hidden')
      unlockInner()
      expect(view.getComputedStyle(doc.documentElement).overflow).toBe('visible')
      expect(document.adoptedStyleSheets.length).toBe(outerSheets.length)
      expect(doc.adoptedStyleSheets.length).toBe(innerSheets.length)
    } finally {
      unlockOuter()
      unlockInner()
      frame.remove()
    }
  })

  it('beats application rules and normal inline overflow while preserving unrelated sheets', () => {
    let application = new CSSStyleSheet()
    application.replaceSync(
      '@layer app { html { overflow: scroll } } html { overflow: auto !important }',
    )
    let original = [...document.adoptedStyleSheets]
    document.adoptedStyleSheets = [...original, application]
    document.documentElement.style.overflow = 'scroll'
    let unlock = lockScroll()
    try {
      expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
      let later = new CSSStyleSheet()
      later.replaceSync('html { overflow: scroll !important; color: rgb(1, 2, 3) }')
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, later]
      expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
      unlock()
      expect(getComputedStyle(document.documentElement).overflow).toBe('scroll')
      expect(document.adoptedStyleSheets.includes(application)).toBe(true)
      expect(document.adoptedStyleSheets.includes(later)).toBe(true)
      expect(getComputedStyle(document.documentElement).color).toBe('rgb(1, 2, 3)')
      let unlockAgain = lockScroll()
      expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
      unlockAgain()
      expect(getComputedStyle(document.documentElement).overflow).toBe('scroll')
    } finally {
      unlock()
      document.adoptedStyleSheets = original
    }
  })

  it('does not reserve an extra gutter when there is no scrollbar', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1000,
    })
    let unlock = lockScroll()
    try {
      expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
      expect(getComputedStyle(document.documentElement).scrollbarGutter).toBe('auto')
    } finally {
      unlock()
    }
  })

  it('keeps locking when html attributes are replaced and releases to the new styles', () => {
    let unlock = lockScroll()
    try {
      document.documentElement.setAttribute('style', 'overflow: auto; color: red')
      expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
    } finally {
      unlock()
    }
    expect(getComputedStyle(document.documentElement).overflow).toBe('auto')
    expect(document.documentElement.style.color).toBe('red')
  })

  it('locks document scrolling without changing authored inline styles', () => {
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.scrollbarGutter = 'stable both-edges'
    document.body.style.overflow = 'clip'
    document.body.style.position = 'relative'
    document.body.style.top = '1px'
    document.body.style.left = '2px'
    document.body.style.right = '3px'
    document.body.style.width = '80%'
    document.body.style.paddingRight = '4px'

    let unlock = lockScroll()

    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
    expect(getComputedStyle(document.documentElement).scrollbarGutter).toBe('stable both-edges')
    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.documentElement.style.scrollbarGutter).toBe('stable both-edges')
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.position).toBe('relative')
    expect(document.body.style.top).toBe('1px')
    expect(document.body.style.left).toBe('2px')
    expect(document.body.style.right).toBe('3px')
    expect(document.body.style.width).toBe('80%')
    expect(document.body.style.paddingRight).toBe('4px')

    unlock()

    expect(getComputedStyle(document.documentElement).overflow).toBe('auto')
    expect(getComputedStyle(document.documentElement).scrollbarGutter).toBe('stable both-edges')
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.position).toBe('relative')
    expect(document.body.style.top).toBe('1px')
    expect(document.body.style.left).toBe('2px')
    expect(document.body.style.right).toBe('3px')
    expect(document.body.style.width).toBe('80%')
    expect(document.body.style.paddingRight).toBe('4px')
    expect(window.scrollTo).toHaveBeenCalledWith(24, 120)
  })

  it('reserves the scrollbar gutter while locked', () => {
    let unlock = lockScroll()

    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
    expect(getComputedStyle(document.documentElement).scrollbarGutter).toBe('stable')

    unlock()

    expect(getComputedStyle(document.documentElement).overflow).toBe('visible')
    expect(getComputedStyle(document.documentElement).scrollbarGutter).toBe('auto')
  })

  it('keeps the document locked until the last unlock runs', () => {
    let unlockFirst = lockScroll()
    let unlockSecond = lockScroll()

    unlockFirst()

    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
    expect(window.scrollTo).not.toHaveBeenCalled()

    unlockSecond()
    unlockSecond()

    expect(getComputedStyle(document.documentElement).overflow).toBe('visible')
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })
})
