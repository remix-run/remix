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
    floating.style.cssText = 'position: fixed; width: 120px; height: 80px;'
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

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

  it('flips a fixed surface below its anchor near the top edge of a scrolled page', async (t) => {
    let originalStyle = document.body.getAttribute('style')
    let originalScroll = { left: window.scrollX, top: window.scrollY }
    let container = document.createElement('div')
    container.style.cssText = 'position: relative; padding: 200px 0 0 150px; height: 2000px;'
    let target = document.createElement('div')
    target.style.cssText = 'width: 80px; height: 28px;'
    let floating = document.createElement('div')
    floating.style.cssText =
      'position: fixed; width: 120px; height: 80px; padding: 8px; border: 2px solid; box-sizing: border-box;'
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

    window.scrollTo(0, 195)
    await t.waitFor(() => {
      expect(window.scrollY).toBe(195)
      expect(target.getBoundingClientRect().top).toBe(5)
    })
    cleanup = anchor(floating, target, { placement: 'top-start' })

    expect(floating.dataset.anchorPlacement).toBe('bottom-start')
    expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
    expect(floating.getBoundingClientRect().height).toBe(80)

    window.scrollTo(0, 190)
    await t.waitFor(() => {
      expect(window.scrollY).toBe(190)
      expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
      expect(floating.getBoundingClientRect().height).toBe(80)
    })

    cleanup()
    cleanup = anchor(floating, target, { placement: 'top-start' })
    expect(floating.dataset.anchorPlacement).toBe('bottom-start')
    expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
    expect(floating.getBoundingClientRect().height).toBe(80)

    window.scrollTo(0, 0)
    await t.waitFor(() => {
      expect(window.scrollY).toBe(0)
      expect(floating.dataset.anchorPlacement).toBe('top-start')
      expect(floating.getBoundingClientRect().bottom).toBe(target.getBoundingClientRect().top)
      expect(floating.getBoundingClientRect().height).toBe(80)
    })
  })

  it('keeps a surface aligned inside a transformed ancestor while the page scrolls', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)')
  })

  it('keeps a transformed surface at the viewport padding as its anchor crosses the top edge', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', { topEdge: true })
  })

  it('keeps a viewport-fixed surface at the padding as its anchor crosses the top edge', async (t) => {
    await expectSurfaceToTrackAnchor(t, '', { topEdge: true })
  })

  it('keeps a surface aligned inside an ancestor with individual translation', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'translate: 0px')
  })

  it('keeps a surface aligned inside an ancestor with individual rotation', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'rotate: 0deg')
  })

  it('keeps a surface aligned inside an ancestor with individual scaling', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'scale: 1')
  })

  it('keeps a surface aligned inside a perspective ancestor', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'perspective: 1000px')
  })

  it('keeps a surface aligned inside a filtered ancestor', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'filter: blur(0px)')
  })

  it('keeps a surface aligned inside a backdrop-filtered ancestor', async (t) => {
    let property = CSS.supports('backdrop-filter', 'blur(0px)')
      ? 'backdrop-filter'
      : '-webkit-backdrop-filter'
    await expectSurfaceToTrackAnchor(t, `${property}: blur(0px)`)
  })

  it('keeps a surface aligned inside paint containment while the page scrolls', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'contain: paint')
  })

  it('keeps a surface aligned inside layout containment', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'contain: layout')
  })

  it('keeps a surface aligned inside strict containment', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'contain: strict')
  })

  it('keeps a surface aligned inside content containment', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'contain: content')
  })

  it('keeps a surface aligned inside combined containment', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'contain: size layout style')
  })

  it('keeps a surface aligned inside automatic content visibility', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'content-visibility: auto')
  })

  it('keeps a surface aligned when hidden content becomes automatically visible', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'content-visibility: hidden', { revealContent: true })
  })

  it('keeps a surface aligned inside will-change containment while the page scrolls', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: transform')
  })

  it('keeps a surface aligned when will-change lists transform after another property', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: opacity, transform')
  })

  it('keeps a surface aligned when will-change anticipates translation', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: translate')
  })

  it('keeps a surface aligned when will-change anticipates rotation', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: rotate')
  })

  it('keeps a surface aligned when will-change anticipates scaling', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: scale')
  })

  it('keeps a surface aligned when will-change anticipates perspective', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: perspective')
  })

  it('keeps a surface aligned when will-change anticipates filtering', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: filter')
  })

  it('keeps a surface aligned when will-change anticipates backdrop filtering', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: backdrop-filter')
  })

  it('keeps a surface aligned when will-change anticipates containment', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: contain')
  })

  it('keeps a surface aligned when will-change anticipates content visibility', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'will-change: content-visibility')
  })

  it('preserves viewport positioning inside size and style containment', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'contain: size style; margin: 100px 0 0 50px')
  })

  it('preserves viewport positioning inside inline-size and style containment', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'contain: inline-size style; margin: 100px 0 0 50px')
  })

  it('preserves viewport positioning inside an inline-size query container', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'container-type: inline-size; margin: 100px 0 0 50px')
  })

  it('preserves viewport positioning inside a size query container', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'container-type: size; margin: 100px 0 0 50px')
  })

  it('keeps alignment when query containers implicitly apply layout containment', async (t) => {
    let style = document.createElement('style')
    // Emulate the layout containment applied implicitly by older query containers.
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

    await expectSurfaceToTrackAnchor(t, 'container-type: inline-size')
  })

  it('preserves viewport positioning for unrelated will-change properties', async (t) => {
    await expectSurfaceToTrackAnchor(
      t,
      'will-change: opacity, transform-origin; margin: 100px 0 0 50px',
    )
  })

  it('keeps a surface aligned inside a transformed shadow host', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', { shadow: 'host' })
  })

  it('preserves viewport positioning inside an ordinary shadow host', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'margin: 100px 0 0 50px', { shadow: 'host' })
  })

  it('preserves viewport positioning for a slotted surface without containment', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'margin: 100px 0 0 50px', { shadow: 'slot' })
  })

  it('keeps a slotted surface aligned inside a transformed shadow ancestor', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', { shadow: 'slot' })
  })

  it('keeps a surface aligned when its parent is slotted inside a transformed ancestor', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', { shadow: 'slotted-parent' })
  })

  it('keeps a slotted surface aligned inside a transformed closed shadow root', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', { shadow: 'closed-slot' })
  })

  it('keeps a manually slotted surface at the padding as its anchor crosses the top edge', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      shadow: 'closed-manual-slot',
      topEdge: true,
    })
  })

  it('tracks its anchor when ancestor containment is added and removed while attached', async (t) => {
    await expectSurfaceToTrackAnchor(t, '', { toggleContainment: true })
  })

  it('keeps a manually assigned surface aligned inside a closed shadow root', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      shadow: 'closed-manual-slot',
    })
  })

  it('tracks a surface moved into a closed shadow root while attached', async (t) => {
    await expectSurfaceToTrackAnchor(t, '', { reparent: true })
  })

  it("preserves a fixed surface's own translation and scale", async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle: 'transform: translate(8px, 12px) scale(0.9); transform-origin: 0 0;',
      visualOffset: { x: 8, y: 12 },
    })
  })

  it('preserves individual transforms on a fixed surface', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle: 'translate: 8px 12px; scale: 0.9; transform-origin: 0 0;',
      visualOffset: { x: 8, y: 12 },
    })
  })

  it('resolves percentage and calculated translations on a fixed surface', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle: 'translate: calc(50% + 10px) min(10%, 5px);',
      visualOffset: { x: 70, y: 5 },
    })
  })

  it("preserves rotation around a fixed surface's centre", async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle: 'rotate: 0.25turn;',
      visualOffset: { x: 20, y: -20 },
    })
  })

  it('preserves the order of individual transforms and the transform property', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle:
        'translate: 8px 12px; rotate: 90deg; scale: 0.5; transform: translate(10px, 20px); transform-origin: 0 0;',
      visualOffset: { x: -42, y: 17 },
    })
  })

  it('uses the content box for individual translations when requested', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle:
        'box-sizing: border-box; border: 10px solid; padding: 10px; transform-box: content-box; translate: 50% 50%;',
      visualOffset: { x: 40, y: 20 },
    })
  })

  it('uses the content box origin for rotation when requested', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle:
        'box-sizing: border-box; border: 10px solid; padding: 10px; transform-box: content-box; rotate: 90deg;',
      visualOffset: { x: 20, y: -20 },
    })
  })

  it('preserves rotation on a surface with fractional dimensions', async (t) => {
    let reference = document.createElement('div')
    reference.style.cssText =
      'position: fixed; left: 0; top: 0; width: 120.5px; height: 80.5px; rotate: 90deg;'
    document.body.append(reference)
    // Engines differ in how they snap a rotated fractional box to layout pixels.
    let { left: x, top: y } = reference.getBoundingClientRect()
    reference.remove()

    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceSize: { width: 120.5, height: 80.5 },
      surfaceStyle: 'rotate: 90deg;',
      visualOffset: { x, y },
    })
  })

  it('preserves margins on a fixed surface', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle: 'margin: 12px 0 0 8px;',
      visualOffset: { x: 8, y: 12 },
    })
  })

  it('preserves fractional margins on a fixed surface', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle: 'margin: 12.5px 0 0 8.5px;',
      visualOffset: { x: 8.5, y: 12.5 },
    })
  })

  it('preserves a motion path on a fixed surface', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle:
        'offset-path: path("M 0 0 L 16 24"); offset-distance: 50%; offset-rotate: 0deg;',
      visualOffset: { x: -52, y: -28 },
    })
  })

  it('preserves an entrance animation as it advances while attached', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      animate: true,
      visualOffset: { x: 8, y: 12 },
    })
  })

  it('tracks a fixed surface when the root element establishes its containing block', async (t) => {
    let originalStyle = document.documentElement.getAttribute('style')
    document.documentElement.style.transform = 'translateZ(0)'
    t.after(() => {
      if (originalStyle === null) document.documentElement.removeAttribute('style')
      else document.documentElement.setAttribute('style', originalStyle)
    })
    await expectSurfaceToTrackAnchor(t, '')
  })

  it('keeps fractional anchor coordinates inside a fractionally positioned containing block', async (t) => {
    await expectSurfaceToTrackAnchor(
      t,
      'transform: translateZ(0); margin: 100.25px 0 0 50.25px; padding-left: 200.25px !important;',
    )
  })

  it('tracks a fixed surface inside a bordered, scrolling containing block', async (t) => {
    await expectSurfaceToTrackAnchor(
      t,
      'transform: translateZ(0); border: 3px solid; overflow: auto;',
      {
        scrollContainer: true,
      },
    )
  })

  it('keeps a docked surface at the viewport padding after subpixel ancestor movement', async (t) => {
    let container = document.createElement('div')
    container.style.cssText =
      'position: relative; transform: translateZ(0); width: 200px; height: 200px;'
    let target = document.createElement('div')
    target.style.cssText = 'position: absolute; top: -100px; width: 80px; height: 28px;'
    let floating = document.createElement('div')
    floating.style.cssText = 'position: fixed; width: 120px; height: 80px;'
    container.append(target, floating)
    document.body.append(container)
    let cleanup = anchor(floating, target, { placement: 'bottom-start' })
    t.after(() => {
      cleanup()
      container.remove()
    })
    expect(floating.getBoundingClientRect().top).toBe(16)

    container.style.transform = 'translateY(0.5px)'
    await t.waitFor(() => expect(floating.getBoundingClientRect().top).toBe(16))
    container.style.transform = 'translateY(0.25px)'
    await t.waitFor(() => expect(floating.getBoundingClientRect().top).toBe(16))
    container.style.transform = 'translateZ(0)'
    await t.waitFor(() => expect(floating.getBoundingClientRect().top).toBe(16))
  })

  it('replaces authored right and bottom insets without changing surface effects', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle: 'right: 12px; bottom: 12px; translate: 8px 12px;',
      visualOffset: { x: 8, y: 12 },
    })
  })

  it('positions a slotted surface with the legacy offsetParent API', async (t) => {
    let position = await getLegacyAnchor(t)
    await expectSurfaceToTrackAnchor(t, 'margin: 100px 0 0 50px', { position, shadow: 'slot' })
  })

  it('preserves transforms and margins in a closed manual slot with the legacy offsetParent API', async (t) => {
    let position = await getLegacyAnchor(t)
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      position,
      shadow: 'closed-manual-slot',
      surfaceStyle: 'transform: translate(8px, 12px); margin: 0.5px;',
      visualOffset: { x: 8.5, y: 12.5 },
    })
  })

  it('positions a surface when the legacy offsetParent API returns body for fixed surfaces', async (t) => {
    let position = await getLegacyAnchor(t, 'body')
    await expectSurfaceToTrackAnchor(t, 'margin: 100px 0 0 50px', { position })
  })

  it('preserves positioning when the surface transitions its inset properties', async (t) => {
    await expectSurfaceToTrackAnchor(t, 'transform: translateZ(0)', {
      surfaceStyle: 'transition: left 1000ms linear, top 1000ms linear;',
    })
  })
})

async function expectSurfaceToTrackAnchor(
  t: TestContext,
  containingStyle: string,
  options: {
    shadow?: 'host' | 'slot' | 'slotted-parent' | 'closed-slot' | 'closed-manual-slot'
    revealContent?: boolean
    animate?: boolean
    scrollContainer?: boolean
    topEdge?: boolean
    toggleContainment?: boolean
    reparent?: boolean
    surfaceStyle?: string
    surfaceSize?: { width: number; height: number }
    visualOffset?: { x: number; y: number }
    position?: typeof anchor
  } = {},
) {
  let surfaceSize = options.surfaceSize ?? { width: 120, height: 80 }
  let visualOffset = options.visualOffset ?? { x: 0, y: 0 }
  let originalStyle = document.body.getAttribute('style')
  let originalScroll = { left: window.scrollX, top: window.scrollY }
  let container = document.createElement('div')
  container.style.cssText = `position: relative; ${containingStyle}; width: 2000px; height: 2000px; padding: 200px 0 0 200px; box-sizing: border-box;`
  let target = document.createElement('div')
  target.style.cssText = 'width: 80px; height: 28px;'
  let floating = document.createElement('div')
  floating.style.cssText = `position: fixed; width: ${surfaceSize.width}px; height: ${surfaceSize.height}px; ${options.surfaceStyle ?? ''}`
  let fixture = container
  if (
    options.shadow === 'slot' ||
    options.shadow === 'slotted-parent' ||
    options.shadow === 'closed-slot' ||
    options.shadow === 'closed-manual-slot'
  ) {
    let host = document.createElement('div')
    host
      .attachShadow({
        mode:
          options.shadow === 'closed-slot' || options.shadow === 'closed-manual-slot'
            ? 'closed'
            : 'open',
        slotAssignment: options.shadow === 'closed-manual-slot' ? 'manual' : 'named',
      })
      .append(container)
    let slot = document.createElement('slot')
    container.append(slot)
    if (options.shadow === 'slotted-parent') {
      let wrapper = document.createElement('div')
      wrapper.append(target, floating)
      host.append(wrapper)
    } else {
      host.append(target, floating)
      if (options.shadow === 'closed-manual-slot') slot.assign(target, floating)
    }
    fixture = host
  } else {
    let root = options.shadow === 'host' ? container.attachShadow({ mode: 'open' }) : container
    root.append(target, floating)
  }
  if (options.scrollContainer) {
    let content = document.createElement('div')
    content.style.cssText = 'width: 4000px; height: 4000px;'
    container.append(content)
  }
  document.body.style.cssText = 'margin: 0; overflow-anchor: none;'
  document.body.append(fixture)
  let cleanup = () => {}
  let animation: Animation | undefined
  if (options.animate) {
    animation = floating.animate(
      [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(16px, 24px)' }],
      { duration: 1000, fill: 'both' },
    )
    animation.pause()
    animation.currentTime = 500
  }
  t.after(() => {
    cleanup()
    animation?.cancel()
    fixture.remove()
    if (originalStyle === null) document.body.removeAttribute('style')
    else document.body.setAttribute('style', originalStyle)
    window.scrollTo(originalScroll)
  })

  window.scrollTo(50, 100)
  await t.waitFor(() => {
    expect(window.scrollX).toBe(50)
    expect(window.scrollY).toBe(100)
  })
  if (!options.revealContent) {
    await t.waitFor(() => {
      expect(target.getBoundingClientRect().width).toBe(80)
      expect(Math.abs(floating.offsetHeight - surfaceSize.height)).toBeLessThanOrEqual(0.5)
    })
  }
  cleanup = (options.position ?? anchor)(floating, target, { placement: 'bottom-start' })
  if (options.revealContent) container.style.contentVisibility = 'auto'

  await t.waitFor(() => {
    expect(target.getBoundingClientRect().width).toBe(80)
    expect(Math.abs(floating.offsetHeight - surfaceSize.height)).toBeLessThanOrEqual(0.5)
    expect(floating.getBoundingClientRect().left).toBe(
      target.getBoundingClientRect().left + visualOffset.x,
    )
    expect(floating.getBoundingClientRect().top).toBe(
      target.getBoundingClientRect().bottom + visualOffset.y,
    )
  })

  if (options.scrollContainer) {
    container.scrollTo(25, 25)
    await t.waitFor(() => {
      expect(container.scrollLeft).toBe(25)
      expect(container.scrollTop).toBe(25)
      expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
      expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
    })
  }

  if (animation) {
    animation.currentTime = 1000
    visualOffset.x = 16
    visualOffset.y = 24
    await t.waitFor(() => {
      expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left + 16)
      expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom + 24)
    })
    expect(animation.currentTime).toBe(1000)
  }

  if (options.reparent) {
    let host = document.createElement('div')
    let wrapper = document.createElement('div')
    wrapper.style.cssText = 'position: relative; transform: translateZ(0);'
    wrapper.append(document.createElement('slot'))
    host.attachShadow({ mode: 'closed' }).append(wrapper)
    fixture.before(host)
    host.append(fixture)
    fixture = host
    await t.waitFor(() => {
      expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
      expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
    })
  }

  if (options.toggleContainment) {
    container.style.transform = 'translateZ(0)'
    await t.waitFor(() => {
      expect(floating.getBoundingClientRect().left).toBe(
        target.getBoundingClientRect().left + visualOffset.x,
      )
      expect(floating.getBoundingClientRect().top).toBe(
        target.getBoundingClientRect().bottom + visualOffset.y,
      )
    })
  }

  window.scrollTo(100, 150)
  await t.waitFor(() => {
    expect(window.scrollX).toBe(100)
    expect(window.scrollY).toBe(150)
    expect(floating.getBoundingClientRect().left).toBe(
      target.getBoundingClientRect().left + visualOffset.x,
    )
    expect(floating.getBoundingClientRect().top).toBe(
      target.getBoundingClientRect().bottom + visualOffset.y,
    )
  })

  if (options.toggleContainment) {
    container.style.transform = ''
    await t.waitFor(() => {
      expect(floating.getBoundingClientRect().left).toBe(
        target.getBoundingClientRect().left + visualOffset.x,
      )
      expect(floating.getBoundingClientRect().top).toBe(
        target.getBoundingClientRect().bottom + visualOffset.y,
      )
    })
  }

  if (options.topEdge) {
    let anchorDocumentBottom = target.getBoundingClientRect().bottom + window.scrollY
    let viewportPadding = 16
    let anchorBottomsWhileScrollingUp = [
      28,
      // Cross the panel's docking threshold.
      viewportPadding + 1,
      viewportPadding,
      viewportPadding - 1,
      // Cross the viewport's top edge, then continue offscreen.
      1,
      0,
      -1,
      -12,
    ]
    let anchorBottomsWhileScrollingDown = anchorBottomsWhileScrollingUp.toReversed()
    for (let anchorBottom of [
      ...anchorBottomsWhileScrollingUp,
      ...anchorBottomsWhileScrollingDown,
    ]) {
      let scrollTop = anchorDocumentBottom - anchorBottom
      window.scrollTo(100, scrollTop)
      await t.waitFor(() => {
        expect(window.scrollY).toBe(scrollTop)
        expect(target.getBoundingClientRect().bottom).toBe(anchorBottom)
        expect(floating.getBoundingClientRect().top).toBe(Math.max(viewportPadding, anchorBottom))
        expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
        expect(floating.offsetHeight).toBe(80)
        expect(floating.dataset.anchorPlacement).toBe('bottom-start')
      })
    }
  }

  cleanup()
  cleanup = (options.position ?? anchor)(floating, target, { placement: 'bottom-start' })
  expect(floating.getBoundingClientRect().left).toBe(
    target.getBoundingClientRect().left + visualOffset.x,
  )
  expect(floating.getBoundingClientRect().top).toBe(
    target.getBoundingClientRect().bottom + visualOffset.y,
  )
}

async function getLegacyAnchor(t: TestContext, fixedParent: 'null' | 'body' = 'null') {
  let offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')?.get
  if (!offsetParent) throw new Error('Missing native offsetParent getter')
  t.mock.getter(HTMLElement.prototype, 'offsetParent', function (this: HTMLElement) {
    return getComputedStyle(this).position === 'fixed'
      ? fixedParent === 'body'
        ? document.body
        : null
      : offsetParent.call(this)
  })
  let { anchor: position }: { anchor: typeof anchor } = await import(
    new URL(`./anchor.ts?legacy-fixed-offset-parent=${fixedParent}`, import.meta.url).href
  )
  return position
}
