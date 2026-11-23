import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'

import { anchor } from './anchor.ts'

type RectInit = {
  height: number
  left: number
  scrollHeight?: number
  scrollWidth?: number
  top: number
  width: number
}

function createRect({ top, left, width, height }: RectInit) {
  return new DOMRect(left, top, width, height)
}

function getConstrainedSize(size: number, maxSize: string) {
  let parsedMaxSize = Number.parseFloat(maxSize)
  if (Number.isNaN(parsedMaxSize)) {
    return size
  }

  return Math.min(size, parsedMaxSize)
}

function mockLayout(element: HTMLElement, rectInit: RectInit) {
  let rect = createRect(rectInit)
  let scrollWidth = rectInit.scrollWidth ?? rectInit.width
  let scrollHeight = rectInit.scrollHeight ?? rectInit.height
  let scrollLeft = 0
  let scrollTop = 0

  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    get: () => getConstrainedSize(rect.width, element.style.maxWidth),
  })

  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    get: () => getConstrainedSize(rect.height, element.style.maxHeight),
  })

  Object.defineProperty(element, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth,
  })

  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  })

  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value
    },
  })

  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value
    },
  })

  element.getBoundingClientRect = () =>
    createRect({
      top: rect.top,
      left: rect.left,
      width: getConstrainedSize(rect.width, element.style.maxWidth),
      height: getConstrainedSize(rect.height, element.style.maxHeight),
    })

  return {
    setRect(nextRectInit: RectInit) {
      rect = createRect(nextRectInit)
      scrollWidth = nextRectInit.scrollWidth ?? nextRectInit.width
      scrollHeight = nextRectInit.scrollHeight ?? nextRectInit.height
    },
  }
}

describe('anchor', () => {
  let rafSpy: ReturnType<typeof mock.method>
  let cafSpy: ReturnType<typeof mock.method>
  let restoreViewport = () => {}

  beforeEach(() => {
    rafSpy = mock.method(globalThis, 'requestAnimationFrame', () => 1)
    cafSpy = mock.method(globalThis, 'cancelAnimationFrame', () => {})

    let width = mock.getter(window, 'innerWidth', () => 800)
    let height = mock.getter(window, 'innerHeight', () => 600)
    restoreViewport = () => {
      width.mock.restore()
      height.mock.restore()
    }
  })

  afterEach(() => {
    rafSpy.mock.restore!()
    cafSpy.mock.restore!()
    restoreViewport()
    document.body.textContent = ''
  })

  it('positions a floating element below its anchor by default', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement)

    expect(floating.style.position).toBe('absolute')
    expect(floating.style.top).toBe('68px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('supports aligned placements and offset', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      offset: 8,
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('76px')
    expect(floating.style.left).toBe('200px')

    cleanup()
  })

  it('positions a floating element from coordinates', () => {
    let floating = document.createElement('div')
    document.body.append(floating)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })

    let cleanup = anchor(floating, { x: 200, y: 40 }, { placement: 'bottom-start' })

    expect(floating.style.position).toBe('fixed')
    expect(floating.style.top).toBe('40px')
    expect(floating.style.left).toBe('200px')

    cleanup()
  })

  it('preserves an inline fixed surface and tracks its anchor in viewport coordinates', (t) => {
    let floating = document.createElement('div')
    floating.style.position = 'fixed'
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    let layout = mockLayout(anchorElement, { top: 200, left: 200, width: 80, height: 28 })
    let scrollX = 100
    let scrollY = 200
    t.mock.getter(window, 'scrollX', () => scrollX)
    t.mock.getter(window, 'scrollY', () => scrollY)

    let cleanup = anchor(floating, anchorElement, { placement: 'bottom-start' })
    t.after(cleanup)

    expect(floating.style.position).toBe('fixed')
    expect(floating.style.top).toBe('228px')
    expect(floating.style.left).toBe('200px')

    scrollX = 150
    scrollY = 250
    layout.setRect({ top: 150, left: 150, width: 80, height: 28 })
    window.dispatchEvent(new Event('scroll'))

    expect(floating.style.position).toBe('fixed')
    expect(floating.style.top).toBe('178px')
    expect(floating.style.left).toBe('150px')
  })

  it('supports horizontal and vertical offsets independently', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      offset: 8,
      offsetX: (currentFloating) => currentFloating.offsetWidth / 10,
      offsetY: (currentFloating) => -currentFloating.offsetHeight / 20,
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('72px')
    expect(floating.style.left).toBe('212px')

    cleanup()
  })

  it('flips when the requested placement would overflow the viewport', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 560, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom',
    })

    expect(floating.style.top).toBe('480px')
    expect(floating.style.left).toBe('180px')
    expect(floating.getAttribute('data-anchor-placement')).toBe('top')

    cleanup()
  })

  it('exposes the final horizontal placement when right placement flips to the left', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 180, height: 120 })
    mockLayout(anchorElement, { top: 40, left: 760, width: 24, height: 32 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'right-start',
    })

    expect(floating.style.top).toBe('40px')
    expect(floating.style.left).toBe('580px')
    expect(floating.getAttribute('data-anchor-placement')).toBe('left-start')

    cleanup()
  })

  it('supports inset positioning', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      inset: true,
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('40px')
    expect(floating.style.left).toBe('200px')

    cleanup()
  })

  it('supports positioning relative to an inner element', () => {
    let floating = document.createElement('div')
    let inner = document.createElement('div')
    inner.className = 'inner'
    floating.append(inner)

    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 200, height: 100 })
    mockLayout(inner, { top: 10, left: 20, width: 100, height: 40 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom-start',
      relativeTo: '.inner',
    })

    expect(floating.style.top).toBe('58px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('supports inset left positioning relative to a selected inner element', () => {
    let floating = document.createElement('div')
    let selected = document.createElement('div')
    selected.setAttribute('aria-selected', 'true')
    selected.setAttribute('role', 'option')
    floating.append(selected)

    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 200, height: 100 })
    mockLayout(selected, { top: 10, left: 20, width: 100, height: 40 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      inset: true,
      placement: 'left',
      relativeTo: '[role="option"][aria-selected="true"]',
    })

    expect(floating.style.top).toBe('24px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('preserves relative alignment by scrolling oversized inset popovers when possible', () => {
    let floating = document.createElement('div')
    let viewport = document.createElement('div')
    let selected = document.createElement('div')
    selected.setAttribute('aria-selected', 'true')
    selected.setAttribute('role', 'option')
    viewport.style.overflow = 'auto'
    viewport.append(selected)
    floating.append(viewport)

    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 200, height: 800 })
    mockLayout(viewport, { top: 4, left: 4, width: 192, height: 560, scrollHeight: 800 })
    mockLayout(selected, { top: 404, left: 24, width: 100, height: 40 })
    mockLayout(anchorElement, { top: 200, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      inset: true,
      placement: 'left',
      relativeTo: '[role="option"][aria-selected="true"]',
    })

    expect(floating.style.top).toBe('16px')
    expect(floating.style.left).toBe('176px')
    expect(floating.style.maxHeight).toBe('568px')
    expect(viewport.scrollTop).toBe(226)

    cleanup()
  })

  it('repositions when the floating dimensions change during animation-frame polling', () => {
    let pollForPositionChanges: ((time: number) => void) | null = null
    rafSpy.mock.restore!()
    rafSpy = mock.method(globalThis, 'requestAnimationFrame', (callback) => {
      pollForPositionChanges = callback
      return 1
    })

    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    let floatingLayout = mockLayout(floating, { top: 0, left: 0, width: 120, height: 40 })
    mockLayout(anchorElement, { top: 500, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom',
    })

    expect(floating.style.top).toBe('528px')
    expect(floating.style.left).toBe('180px')

    floatingLayout.setRect({ top: 0, left: 0, width: 120, height: 80 })
    if (!pollForPositionChanges) {
      throw new Error('Expected anchor() to schedule polling')
    }

    ;(pollForPositionChanges as (time: number) => void)(16)

    expect(floating.style.top).toBe('420px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('repositions when a coordinate target changes during animation-frame polling', () => {
    let pollForPositionChanges: ((time: number) => void) | null = null
    rafSpy.mock.restore!()
    rafSpy = mock.method(globalThis, 'requestAnimationFrame', (callback) => {
      pollForPositionChanges = callback
      return 1
    })

    let floating = document.createElement('div')
    let anchorPoint = { x: 200, y: 40 }
    document.body.append(floating)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })

    let cleanup = anchor(floating, anchorPoint, {
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('40px')
    expect(floating.style.left).toBe('200px')

    anchorPoint.x = 240
    anchorPoint.y = 90
    if (!pollForPositionChanges) {
      throw new Error('Expected anchor() to schedule polling')
    }

    ;(pollForPositionChanges as (time: number) => void)(16)

    expect(floating.style.top).toBe('90px')
    expect(floating.style.left).toBe('240px')

    cleanup()
  })

  it('shrinks oversized bottom popovers to the remaining viewport height', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 800 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('68px')
    expect(floating.style.left).toBe('200px')
    expect(floating.style.maxHeight).toBe('516px')

    cleanup()
  })

  it('keeps oversized popovers constrained across repeated attachments', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 800 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('68px')
    expect(floating.style.left).toBe('200px')
    expect(floating.style.maxHeight).toBe('516px')

    cleanup()

    cleanup = anchor(floating, anchorElement, {
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('68px')
    expect(floating.style.left).toBe('200px')
    expect(floating.style.maxHeight).toBe('516px')

    cleanup()
  })

  it('prefers the side with less overflow for oversized popovers', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 700 })
    mockLayout(anchorElement, { top: 500, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom',
    })

    expect(floating.style.top).toBe('16px')
    expect(floating.style.left).toBe('180px')
    expect(floating.style.maxHeight).toBe('484px')

    cleanup()
  })

  it('cancels its animation frame polling during cleanup', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement)
    cleanup()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
  })
})

describe('anchor page scrolling', () => {
  it('keeps a fixed surface aligned inside a positioned ancestor while the page scrolls', async (t) => {
    let originalStyle = document.body.getAttribute('style')
    let originalScroll = { left: window.scrollX, top: window.scrollY }
    let style = document.createElement('style')
    style.textContent = '.anchor-test-floating { position: fixed; width: 120px; height: 80px; }'
    let container = document.createElement('div')
    container.style.cssText = 'position: relative; margin: 400px 0 0 300px;'
    let target = document.createElement('div')
    target.style.cssText = 'width: 80px; height: 28px;'
    let floating = document.createElement('div')
    floating.className = 'anchor-test-floating'
    container.append(target, floating)
    document.body.style.cssText = 'margin: 0; width: 2000px; height: 2000px;'
    document.head.append(style)
    document.body.append(container)
    let cleanup = () => {}
    t.after(() => {
      cleanup()
      container.remove()
      style.remove()
      if (originalStyle === null) document.body.removeAttribute('style')
      else document.body.setAttribute('style', originalStyle)
      window.scrollTo(originalScroll)
    })

    window.scrollTo(100, 200)
    await t.waitFor(() => {
      expect(window.scrollX).toBe(100)
      expect(window.scrollY).toBe(200)
    })
    cleanup = anchor(floating, target, { placement: 'bottom-start' })

    expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
    expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
    expect(getComputedStyle(floating).position).toBe('fixed')

    window.scrollTo(150, 250)
    await t.waitFor(() => {
      expect(window.scrollX).toBe(150)
      expect(window.scrollY).toBe(250)
      expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
      expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
    })

    cleanup()
    cleanup = anchor(floating, target, { placement: 'bottom-start' })
    expect(floating.getBoundingClientRect().left).toBe(150)
    expect(floating.getBoundingClientRect().top).toBe(178)
    expect(getComputedStyle(floating).position).toBe('fixed')
  })

  it('keeps a surface aligned inside a transformed ancestor while the page scrolls', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)')
  })

  it('keeps a surface aligned inside paint containment while the page scrolls', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'contain: paint')
  })

  it('keeps a surface aligned inside will-change containment while the page scrolls', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: transform')
  })

  it('preserves viewport positioning inside an inline-size query container', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'container-type: inline-size; margin: 100px 0 0 50px')
  })

  it('preserves viewport positioning inside a size query container', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'container-type: size; margin: 100px 0 0 50px')
  })

  it('keeps alignment when query containers implicitly apply layout containment', async (t) => {
    let style = document.createElement('style')
    // Emulate older query-container rules without sharing the normal capability cache.
    style.textContent = '[style*="container-type:"] { contain: layout !important; }'
    document.head.append(style)
    t.after(() => style.remove())
    let readStyle = getComputedStyle
    t.mock.method(globalThis, 'getComputedStyle', (element, pseudo) => {
      let computed = readStyle(element, pseudo)
      if (computed.containerType === 'normal') return computed
      // Implicit containment in older browsers was not reflected in computed `contain`.
      return new Proxy(computed, {
        get(target, key) {
          if (key === 'contain') return 'none'
          let value: unknown = Reflect.get(target, key, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    })
    let { anchor: position }: { anchor: typeof anchor } = await import(
      new URL('./anchor.ts?legacy-query-containment', import.meta.url).href
    )

    await expectSurfaceToTrackAnchor(t, 'container-type: inline-size', { position })
  })
})

async function expectSurfaceToTrackAnchor(
  t: TestContext,
  containingStyle: string,
  options: { position?: typeof anchor } = {},
) {
  let originalStyle = document.body.getAttribute('style')
  let originalScroll = { left: window.scrollX, top: window.scrollY }
  let container = document.createElement('div')
  container.style.cssText = `position: relative; ${containingStyle}; width: 2000px; height: 2000px; padding: 200px 0 0 200px; box-sizing: border-box;`
  let target = document.createElement('div')
  target.style.cssText = 'width: 80px; height: 28px;'
  let floating = document.createElement('div')
  floating.style.cssText = 'position: fixed; width: 120px; height: 80px;'
  container.append(target, floating)
  document.body.style.cssText = 'margin: 0; overflow-anchor: none;'
  document.body.append(container)
  let cleanup = () => {}
  t.after(() => {
    cleanup()
    container.remove()
    if (originalStyle === null) document.body.removeAttribute('style')
    else document.body.setAttribute('style', originalStyle)
    window.scrollTo(originalScroll)
  })

  window.scrollTo(50, 100)
  await t.waitFor(() => {
    expect(window.scrollX).toBe(50)
    expect(window.scrollY).toBe(100)
  })
  cleanup = (options.position ?? anchor)(floating, target, { placement: 'bottom-start' })

  expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
  expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)

  window.scrollTo(100, 150)
  await t.waitFor(() => {
    expect(window.scrollX).toBe(100)
    expect(window.scrollY).toBe(150)
    expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
    expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
  })

  cleanup()
  cleanup = (options.position ?? anchor)(floating, target, { placement: 'bottom-start' })
  expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
  expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
}
