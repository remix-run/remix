import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { Frame } from '../runtime/frame.ts'
import { jsx } from '../runtime/core/vnode.ts'
import {
  createDefaultPrefetch,
  prefetch,
  startPrefetching,
  type PrefetchFrame,
  type PrefetchFrameOptions,
} from '../runtime/prefetch.ts'
import { run } from '../runtime/run.ts'
import { renderToStream } from '../server/stream.ts'
import { drain, nextDomMutation } from './utils.ts'
import {
  defaultPrefetch,
  type DefaultPrefetchOverrides,
  type PrefetchContext,
  type PrefetchFrameContext,
} from '../index.ts'

function expectPrefetchCall(
  callback: { mock: { calls: { arguments: unknown[] }[] } },
  src: string,
  options?: PrefetchFrameOptions,
): void {
  let call = callback.mock.calls.find(({ arguments: args }) => {
    let value = args[1]
    return (
      args[0] === src &&
      (options
        ? typeof value === 'object' &&
          value !== null &&
          Reflect.get(value, 'element') === options.element &&
          Reflect.get(value, 'target') === options.target
        : value === undefined)
    )
  })
  expect(call?.arguments).toMatchObject(options ? [src, options] : [src])
}

function startTestPrefetching(t: TestContext, prefetchFrame?: PrefetchFrame) {
  let controller = new AbortController()
  startPrefetching(controller.signal, prefetchFrame)
  t.after(() => controller.abort())
}

async function startNamedFramePrefetching(
  t: TestContext,
  prefetchFrame?: PrefetchFrame,
  ...links: HTMLAnchorElement[]
) {
  document.body.innerHTML = await drain(
    renderToStream(
      jsx('main', {
        children: [
          jsx(Frame, { name: 'details', src: '/initial-details' }),
          jsx(Frame, { name: 'sidebar', src: '/initial-sidebar' }),
        ],
      }),
      { resolveFrame: () => 'Initial frame' },
    ),
  )
  document.body.append(...links)
  let app = run({ loadModule: mock.fn(), prefetch: prefetchFrame })
  t.after(() => app.dispose())
  await app.ready()
  expect(app.frames.get('details')).toBeDefined()
  return app
}

function createIntentLink(href: string): HTMLAnchorElement {
  let anchor = document.createElement('a')
  anchor.href = href
  anchor.setAttribute('data-rmx-prefetch', 'intent')
  anchor.textContent = 'Product'
  document.body.append(anchor)
  return anchor
}

function createViewportLink(href: string, visible = true): HTMLAnchorElement {
  let anchor = createIntentLink(href)
  anchor.setAttribute('data-rmx-prefetch', 'viewport')
  anchor.style.cssText = `position: fixed; left: 0; top: ${visible ? 0 : innerHeight + 100}px; width: 20px; height: 20px`
  return anchor
}

const NativeIntersectionObserver = globalThis.IntersectionObserver
// Each runtime viewport observer's targets, mapped to the last intersection state it delivered.
const runtimeTargets = new Set<Map<Element, boolean | undefined>>()
const runtimeTargetsChanged = new EventTarget()

class TrackedIntersectionObserver extends NativeIntersectionObserver {
  #targets: Map<Element, boolean | undefined>

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    let targets = new Map<Element, boolean | undefined>()
    super((entries, observer) => {
      callback(entries, observer)
      for (let entry of entries) {
        if (targets.has(entry.target)) targets.set(entry.target, entry.isIntersecting)
      }
      runtimeTargetsChanged.dispatchEvent(new Event('change'))
    }, options)
    this.#targets = targets
    runtimeTargets.add(targets)
  }

  observe(target: Element) {
    this.#targets.set(target, undefined)
    super.observe(target)
  }

  unobserve(target: Element) {
    this.#targets.delete(target)
    super.unobserve(target)
    runtimeTargetsChanged.dispatchEvent(new Event('change'))
  }

  disconnect() {
    runtimeTargets.delete(this.#targets)
    super.disconnect()
    runtimeTargetsChanged.dispatchEvent(new Event('change'))
  }
}

// Reads the anchor's intersection state once every runtime observer watching it has delivered the
// same state, so the runtime has already reacted to it. Browsers don't reliably deliver a new
// observer's entries after the runtime's, so a plain observer can't prove that.
async function readIntersection(anchor: HTMLAnchorElement): Promise<boolean> {
  let isIntersecting = await new Promise<boolean>((resolve) => {
    let observer = new NativeIntersectionObserver(([entry]) => {
      observer.disconnect()
      resolve(entry.isIntersecting)
    })
    observer.observe(anchor)
  })
  let settled = () =>
    Array.from(runtimeTargets).every(
      (targets) => !targets.has(anchor) || targets.get(anchor) === isIntersecting,
    )
  while (!settled()) {
    await new Promise((resolve) =>
      runtimeTargetsChanged.addEventListener('change', resolve, { once: true }),
    )
  }
  return isIntersecting
}

function press(element: Element, pointerType = 'mouse') {
  element.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      isPrimary: true,
      pointerType,
    }),
  )
}

function movePointer(from: Element, to: Element) {
  from.dispatchEvent(
    new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: to }),
  )
  to.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', relatedTarget: from }),
  )
}

function stubViewportIntersections(t: TestContext) {
  let callback: IntersectionObserverCallback | undefined
  let records: IntersectionObserverEntry[] = []
  let observer = new IntersectionObserver(() => {})
  t.after(() => observer.disconnect())
  t.mock.method(observer, 'observe', () => {})
  t.mock.method(observer, 'takeRecords', () => records.splice(0))
  t.mock.method(globalThis, 'IntersectionObserver', (onIntersect: IntersectionObserverCallback) => {
    callback = onIntersect
    return observer
  })

  return {
    queue(target: HTMLAnchorElement, isIntersecting: boolean) {
      records.push({
        target,
        isIntersecting,
        time: 0,
        boundingClientRect: new DOMRect(),
        intersectionRect: new DOMRect(),
        rootBounds: null,
        intersectionRatio: isIntersecting ? 1 : 0,
      })
    },
    deliver() {
      if (!callback) throw new Error('Viewport observer has not started')
      callback(observer.takeRecords(), observer)
    },
  }
}

function stubConnection(
  t: TestContext,
  connection: { saveData?: boolean; effectiveType?: string } | undefined,
): void {
  let descriptor = Object.getOwnPropertyDescriptor(navigator, 'connection')
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection })
  t.after(() => {
    if (descriptor) Object.defineProperty(navigator, 'connection', descriptor)
    else Reflect.deleteProperty(navigator, 'connection')
  })
}

function stubIdleCallbacks(t: TestContext) {
  let requestDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestIdleCallback')
  let cancelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'cancelIdleCallback')
  let callbacks = new Map<number, IdleRequestCallback>()
  let changes = new EventTarget()
  let nextHandle = 0
  let timeout: number | undefined
  Object.defineProperty(globalThis, 'requestIdleCallback', {
    configurable: true,
    writable: true,
    value(callback: IdleRequestCallback, options?: IdleRequestOptions) {
      timeout = options?.timeout
      callbacks.set(++nextHandle, callback)
      changes.dispatchEvent(new Event('change'))
      return nextHandle
    },
  })
  Object.defineProperty(globalThis, 'cancelIdleCallback', {
    configurable: true,
    writable: true,
    value(handle: number) {
      callbacks.delete(handle)
    },
  })
  function restore() {
    if (requestDescriptor)
      Object.defineProperty(globalThis, 'requestIdleCallback', requestDescriptor)
    else Reflect.deleteProperty(globalThis, 'requestIdleCallback')
    if (cancelDescriptor) Object.defineProperty(globalThis, 'cancelIdleCallback', cancelDescriptor)
    else Reflect.deleteProperty(globalThis, 'cancelIdleCallback')
  }
  t.after(restore)
  return {
    get pending() {
      return callbacks.size
    },
    get timeout() {
      return timeout
    },
    async waitFor(count = 1) {
      while (callbacks.size < count) {
        await new Promise((resolve) => changes.addEventListener('change', resolve, { once: true }))
      }
    },
    flush(deadline: IdleDeadline = { didTimeout: false, timeRemaining: () => 50 }) {
      for (let [handle, callback] of Array.from(callbacks)) {
        if (!callbacks.delete(handle)) continue
        callback(deadline)
      }
    },
  }
}

function stubDocumentVisibility(t: TestContext, hidden = false) {
  let descriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  t.after(() => {
    if (descriptor) Object.defineProperty(document, 'hidden', descriptor)
    else Reflect.deleteProperty(document, 'hidden')
  })
  return function setHidden(value: boolean) {
    hidden = value
    document.dispatchEvent(new Event('visibilitychange'))
  }
}

function createPrefetch(t: TestContext) {
  let controller = new AbortController()
  t.after(() => controller.abort())
  return { prefetch: createDefaultPrefetch(controller.signal), controller }
}

function collectHints(t: TestContext): HTMLLinkElement[] {
  let hints: HTMLLinkElement[] = []
  let observer = new MutationObserver((records) => {
    for (let record of records) {
      for (let node of record.addedNodes) {
        if (node instanceof HTMLLinkElement && ['prefetch', 'preload'].includes(node.rel)) {
          hints.push(node)
          node.dispatchEvent(new Event('load'))
        }
      }
    }
  })
  observer.observe(document.head, { childList: true })
  t.after(() => observer.disconnect())
  return hints
}

// Safari can't prefetch links, so the runtime skips asset hints there. Tests that load hints
// themselves stand in for a browser that can, and one checks what Safari gets.
function stubLinkPrefetchSupport(t: TestContext, supported: boolean) {
  let supports = DOMTokenList.prototype.supports
  t.mock.method(DOMTokenList.prototype, 'supports', function (this: DOMTokenList, token: string) {
    return token === 'prefetch' ? supported : supports.call(this, token)
  })
}

function htmlResponse(html: string) {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
  })
}

describe('prefetch', () => {
  beforeEach(() => {
    globalThis.IntersectionObserver = TrackedIntersectionObserver
  })

  afterEach(() => {
    globalThis.IntersectionObserver = NativeIntersectionObserver
    runtimeTargets.clear()
    document.body.textContent = ''
  })

  it('skips intent and viewport prefetching when Save-Data is enabled', async (t) => {
    let timers = t.useFakeTimers()
    stubConnection(t, { saveData: true, effectiveType: '4g' })
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let hovered = createIntentLink('/products/hovered')
    let focused = createIntentLink('/products/focused')
    let pressed = createIntentLink('/products/pressed')
    let visible = createViewportLink('/products/visible')

    movePointer(document.body, hovered)
    focused.focus()
    press(pressed, 'touch')
    expect(await readIntersection(visible)).toBe(true)
    timers.advance(150)

    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('skips intent and viewport prefetching on slow-2g and 2g connections', async (t) => {
    let connection = { saveData: false, effectiveType: 'slow-2g' }
    stubConnection(t, connection)
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)

    for (let effectiveType of ['slow-2g', '2g']) {
      connection.effectiveType = effectiveType
      press(createIntentLink(`/products/intent-${effectiveType}`))
      let visible = createViewportLink(`/products/viewport-${effectiveType}`)
      expect(await readIntersection(visible)).toBe(true)
    }

    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('allows intent and viewport prefetching on 3g and 4g connections', async (t) => {
    let connection = { saveData: false, effectiveType: '3g' }
    stubConnection(t, connection)
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)

    for (let effectiveType of ['3g', '4g']) {
      connection.effectiveType = effectiveType
      let pressed = createIntentLink(`/products/intent-${effectiveType}`)
      press(pressed)
      expectPrefetchCall(prefetchFrame, pressed.href, { element: pressed })
      let visible = createViewportLink(`/products/viewport-${effectiveType}`)
      expect(await readIntersection(visible)).toBe(true)
      expectPrefetchCall(prefetchFrame, visible.href, { element: visible })
    }

    expect(prefetchFrame).toHaveBeenCalledTimes(4)
  })

  it('allows automatic prefetching when connection information is unavailable', async (t) => {
    stubConnection(t, undefined)
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let pressed = createIntentLink('/products/pressed')
    let visible = createViewportLink('/products/visible')

    press(pressed)
    expect(await readIntersection(visible)).toBe(true)

    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expectPrefetchCall(prefetchFrame, pressed.href, { element: pressed })
    expectPrefetchCall(prefetchFrame, visible.href, { element: visible })
  })

  it('checks connection settings after the intent delay and allows a later press', async (t) => {
    let timers = t.useFakeTimers()
    let connection = { saveData: false }
    stubConnection(t, connection)
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    movePointer(document.body, anchor)
    connection.saveData = true
    timers.advance(150)
    expect(prefetchFrame).not.toHaveBeenCalled()

    connection.saveData = false
    press(anchor)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expectPrefetchCall(prefetchFrame, anchor.href, { element: anchor })
  })

  it('allows a skipped viewport link to prefetch on reentry after the connection improves', async (t) => {
    let connection = { effectiveType: '2g' }
    stubConnection(t, connection)
    let prefetchFrame = mock.fn()
    let anchor = createViewportLink('/products/shirt')
    startTestPrefetching(t, prefetchFrame)
    expect(await readIntersection(anchor)).toBe(true)
    expect(prefetchFrame).not.toHaveBeenCalled()

    anchor.style.top = `${innerHeight + 100}px`
    expect(await readIntersection(anchor)).toBe(false)
    connection.effectiveType = '4g'
    anchor.style.top = '0px'
    expect(await readIntersection(anchor)).toBe(true)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expectPrefetchCall(prefetchFrame, anchor.href, { element: anchor })
  })

  it('allows imperative prefetching with Save-Data enabled on a slow connection', (t) => {
    stubConnection(t, { saveData: true, effectiveType: 'slow-2g' })
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)

    prefetch('/products/shirt')

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expectPrefetchCall(prefetchFrame, new URL('/products/shirt', location.href).href)
  })

  it('prefetches intent links after mouse hover or keyboard focus rests on them', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let hovered = createIntentLink('/products/hovered')
    let focused = createIntentLink('/products/focused')

    hovered.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    expect(prefetchFrame).not.toHaveBeenCalled()
    timers.advance(150)
    expectPrefetchCall(prefetchFrame, hovered.href, { element: hovered })

    focused.focus()
    timers.advance(150)
    expectPrefetchCall(prefetchFrame, focused.href, { element: focused })
  })

  it('cancels the prefetch when the pointer leaves before the intent delay', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    anchor.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    anchor.dispatchEvent(
      new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }),
    )
    timers.advance(150)

    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('prefetches immediately when an intent link is pressed', (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt#details')

    press(anchor)

    expectPrefetchCall(prefetchFrame, new URL('/products/shirt', location.href).href, {
      element: anchor,
    })
  })

  it('prefetches once across descendants during a hover and again on a later hover', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')
    let first = document.createElement('span')
    let second = document.createElement('span')
    anchor.replaceChildren(first, second)

    movePointer(document.body, first)
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    movePointer(first, second)
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    movePointer(second, document.body)
    movePointer(document.body, first)
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
  })

  it('keeps keyboard focus intent when the pointer enters and leaves another link', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let focused = createIntentLink('/products/focused')
    let hovered = createIntentLink('/products/hovered')

    focused.focus()
    movePointer(document.body, hovered)
    movePointer(hovered, document.body)
    timers.advance(150)

    expect(document.activeElement).toBe(focused)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expectPrefetchCall(prefetchFrame, focused.href, { element: focused })
  })

  it('prefetches separate hovered and focused links without replacing either intent', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let focused = createIntentLink('/products/focused')
    let hovered = createIntentLink('/products/hovered')

    focused.focus()
    movePointer(document.body, hovered)
    timers.advance(150)

    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expectPrefetchCall(prefetchFrame, focused.href, { element: focused })
    expectPrefetchCall(prefetchFrame, hovered.href, { element: hovered })
  })

  it('keeps hover intent when another link loses focus', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let focused = createIntentLink('/products/focused')
    let hovered = createIntentLink('/products/hovered')

    focused.focus()
    movePointer(document.body, hovered)
    focused.blur()
    timers.advance(150)

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expectPrefetchCall(prefetchFrame, hovered.href, { element: hovered })
  })

  it('keeps focus intent when the pointer leaves the same link', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    movePointer(document.body, anchor)
    anchor.focus()
    movePointer(anchor, document.body)
    timers.advance(150)

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('keeps hover intent when the same link loses focus', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    anchor.focus()
    movePointer(document.body, anchor)
    anchor.blur()
    timers.advance(150)

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('does not repeat completed hover prefetch on press or focus', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    movePointer(document.body, anchor)
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    press(anchor)
    anchor.focus()
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('prefetches on an early press without repeating after the hover or focus delay', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    movePointer(document.body, anchor)
    press(anchor)
    anchor.focus()
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('prefetches touch and pen presses immediately without repeating on focus', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let touched = createIntentLink('/products/touched')
    let penned = createIntentLink('/products/penned')

    press(touched, 'touch')
    touched.focus()
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    press(penned, 'pen')
    penned.focus()
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
  })

  it('cancels pending hover and focus intent when disposed', async (t) => {
    let timers = t.useFakeTimers()
    let prefetchFrame = mock.fn()
    let controller = new AbortController()
    startPrefetching(controller.signal, prefetchFrame)
    let hovered = createIntentLink('/products/hovered')
    let focused = createIntentLink('/products/focused')

    movePointer(document.body, hovered)
    focused.focus()
    controller.abort()
    press(hovered)
    timers.advance(150)

    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('skips document navigations, missing frames, and the current untargeted page', (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let unmarked = createIntentLink('/products/unmarked')
    unmarked.removeAttribute('data-rmx-prefetch')
    let download = createIntentLink('/products/download')
    download.setAttribute('download', '')
    let documentNavigation = createIntentLink('/products/document')
    documentNavigation.setAttribute('data-rmx-document', '')
    let named = createIntentLink('/products/named')
    named.setAttribute('data-rmx-target', 'details')
    let newTab = createIntentLink('/products/new-tab')
    newTab.target = '_blank'
    let crossOrigin = createIntentLink('https://example.com/products/shirt')
    let currentPage = createIntentLink(`${location.pathname}${location.search}#top`)

    for (let anchor of [
      unmarked,
      download,
      documentNavigation,
      named,
      newTab,
      crossOrigin,
      currentPage,
    ]) {
      press(anchor)
    }

    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('prefetches named-frame intent links with their target and source override', async (t) => {
    let prefetchFrame = mock.fn()
    await startNamedFramePrefetching(t, prefetchFrame)
    let timers = t.useFakeTimers()
    let anchor = createIntentLink('/products/shirt')
    anchor.setAttribute('data-rmx-target', 'details')
    press(anchor)
    expectPrefetchCall(prefetchFrame, anchor.href, {
      target: 'details',
      element: anchor,
    })

    let overridden = createIntentLink('/products/hat')
    overridden.setAttribute('data-rmx-target', 'details')
    overridden.setAttribute('data-rmx-src', './partials/hat?size=small#details')
    movePointer(document.body, overridden)
    timers.advance(150)
    expectPrefetchCall(prefetchFrame, new URL('./partials/hat?size=small', document.baseURI).href, {
      target: 'details',
      element: overridden,
    })
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
  })

  it('only applies source overrides to named frames, allowing a current-page frame source', async (t) => {
    let prefetchFrame = mock.fn()
    await startNamedFramePrefetching(t, prefetchFrame)
    let named = createIntentLink('/products/named')
    named.setAttribute('data-rmx-target', 'details')
    named.setAttribute('data-rmx-src', location.href)
    press(named)
    let current = new URL(location.href)
    current.hash = ''
    expectPrefetchCall(prefetchFrame, current.href, {
      target: 'details',
      element: named,
    })

    let top = createIntentLink('/products/top')
    top.setAttribute('data-rmx-target', '')
    top.setAttribute('data-rmx-src', '/ignored')
    press(top)
    expectPrefetchCall(prefetchFrame, top.href, { element: top })
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
  })

  it('skips invalid and cross-origin sources even when the source would be ignored', async (t) => {
    let prefetchFrame = mock.fn()
    await startNamedFramePrefetching(t, prefetchFrame)
    let invalid = createIntentLink('/products/invalid')
    invalid.setAttribute('data-rmx-target', 'details')
    invalid.setAttribute('data-rmx-src', 'http://[')
    let crossOriginSource = createIntentLink('/products/cross-origin-source')
    crossOriginSource.setAttribute('data-rmx-target', 'details')
    crossOriginSource.setAttribute('data-rmx-src', 'https://example.com/partial')
    let crossOriginHref = createIntentLink('https://example.com/products/shirt')
    crossOriginHref.setAttribute('data-rmx-target', 'details')
    crossOriginHref.setAttribute('data-rmx-src', '/partial')
    let untargeted = createIntentLink('/products/top')
    untargeted.setAttribute('data-rmx-src', 'https://example.com/ignored')

    press(invalid)
    press(crossOriginSource)
    press(crossOriginHref)
    press(untargeted)
    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('passes target context to imperative prefetch overrides', (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    prefetch('/partial#details', { target: 'details' })
    expectPrefetchCall(prefetchFrame, new URL('/partial', location.href).href, {
      target: 'details',
    })
    prefetch('https://example.com/partial', { target: 'details' })
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('prefetches named-frame content with the same URL and headers as a frame reload', async (t) => {
    let app = await startNamedFramePrefetching(t)
    let fetch = t.mock.method(
      globalThis,
      'fetch',
      async (_src: RequestInfo | URL, _init?: RequestInit) =>
        new Response('<main>Details</main>', { headers: { 'Content-Type': 'text/html' } }),
    )
    let anchor = createIntentLink('/products/shirt')
    anchor.setAttribute('data-rmx-target', 'details')
    anchor.setAttribute('data-rmx-src', '/partials/shirt')
    press(anchor)
    let frame = app.frames.get('details')
    if (!frame) throw new Error('Missing details frame')
    let src = new URL('/partials/shirt', document.baseURI).href
    await frame.reload({ src })

    expect(fetch).toHaveBeenCalledTimes(2)
    for (let [index, call] of fetch.mock.calls.entries()) {
      let [input, init] = call.arguments
      expect(input).toBe(src)
      let headers = new Headers(init?.headers)
      expect(headers.get('Accept')).toBe('text/html')
      expect(headers.get('X-Remix-Frame')).toBe('true')
      expect(headers.get('X-Remix-Target')).toBe('details')
      expect(headers.get('X-Remix-Prefetch')).toBe(index === 0 ? 'true' : null)
    }
  })

  it('fetches HTML with low priority, frame headers, and a prefetch header by default', async (t) => {
    let fetch = t.mock.method(
      globalThis,
      'fetch',
      async (_src: RequestInfo | URL, _init?: RequestInit) =>
        new Response('<main>Next page</main>', { headers: { 'Content-Type': 'text/html' } }),
    )
    startTestPrefetching(t)
    let href = new URL('/products/default-prefetch', location.href).href

    prefetch(href)
    prefetch(href)

    expect(fetch).toHaveBeenCalledTimes(1)
    let [src, init] = fetch.mock.calls[0].arguments
    expect(src).toBe(href)
    expect(init?.method).toBe('GET')
    expect(init?.mode).toBe('same-origin')
    expect(init?.priority).toBe('low')
    expect(new Headers(init?.headers).get('X-Remix-Frame')).toBe('true')
    expect(new Headers(init?.headers).get('Accept')).toBe('text/html')
    expect(new Headers(init?.headers).get('X-Remix-Prefetch')).toBe('true')
  })

  describe('viewport', () => {
    it('waits for initially hidden documents to become visible before prefetching', (t) => {
      let setHidden = stubDocumentVisibility(t, true)
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      intersections.queue(anchor, true)
      intersections.deliver()
      expect(prefetchFrame).not.toHaveBeenCalled()

      setHidden(false)
      expect(prefetchFrame).not.toHaveBeenCalled()
      intersections.queue(anchor, true)
      intersections.deliver()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, anchor.href, { element: anchor })
    })

    it('pauses links waiting for scrolling and refreshes intersections when the document returns', async (t) => {
      let timers = t.useFakeTimers()
      let setHidden = stubDocumentVisibility(t)
      let prefetchFrame = mock.fn()
      let passed = createViewportLink('/passed')
      let download = createViewportLink('/download')
      let visible = createViewportLink('/visible')
      startTestPrefetching(t, prefetchFrame)
      document.dispatchEvent(new Event('scroll'))
      expect(await readIntersection(passed)).toBe(true)
      expect(await readIntersection(download)).toBe(true)
      expect(await readIntersection(visible)).toBe(true)
      expect(prefetchFrame).not.toHaveBeenCalled()

      setHidden(true)
      timers.advance(150)
      expect(prefetchFrame).not.toHaveBeenCalled()
      passed.style.top = `${innerHeight + 100}px`
      download.setAttribute('download', '')

      setHidden(false)
      expect(prefetchFrame).not.toHaveBeenCalled()
      expect(await readIntersection(passed)).toBe(false)
      expect(await readIntersection(visible)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, visible.href, { element: visible })
    })

    it('does not resume hidden viewport work after disposal', (t) => {
      let setHidden = stubDocumentVisibility(t, true)
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let controller = new AbortController()
      t.after(() => controller.abort())
      let anchor = createViewportLink('/products/shirt')
      startPrefetching(controller.signal, prefetchFrame)
      intersections.queue(anchor, true)
      intersections.deliver()

      controller.abort()
      setHidden(false)
      intersections.queue(anchor, true)
      intersections.deliver()
      expect(prefetchFrame).not.toHaveBeenCalled()
    })

    it('rechecks removed links and eligibility when scrolling stops', (t) => {
      let timers = t.useFakeTimers()
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let removed = createViewportLink('/removed')
      let download = createViewportLink('/download')
      let visible = createViewportLink('/visible')
      startTestPrefetching(t, prefetchFrame)
      document.dispatchEvent(new Event('scroll'))
      intersections.queue(removed, true)
      intersections.queue(download, true)
      intersections.queue(visible, true)
      intersections.deliver()

      removed.remove()
      download.setAttribute('download', '')
      timers.advance(150)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, visible.href, { element: visible })
    })

    it('prefetches initial named-frame links and observes changes to source and target', async (t) => {
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      anchor.setAttribute('data-rmx-target', 'details')
      anchor.setAttribute('data-rmx-src', '/partials/shirt#details')
      await startNamedFramePrefetching(t, prefetchFrame, anchor)

      expect(await readIntersection(anchor)).toBe(true)
      expectPrefetchCall(prefetchFrame, new URL('/partials/shirt', location.href).href, {
        target: 'details',
        element: anchor,
      })
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.setAttribute('data-rmx-src', '/partials/shirt#reviews')
      anchor.href = '/products/another-navigation-url'
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.setAttribute('data-rmx-src', '/partials/hat')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expectPrefetchCall(prefetchFrame, new URL('/partials/hat', location.href).href, {
        target: 'details',
        element: anchor,
      })

      anchor.setAttribute('data-rmx-target', 'sidebar')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(3)
      expectPrefetchCall(prefetchFrame, new URL('/partials/hat', location.href).href, {
        target: 'sidebar',
        element: anchor,
      })

      anchor.setAttribute('data-rmx-target', 'missing')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(3)
      anchor.removeAttribute('data-rmx-target')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(4)
      expectPrefetchCall(prefetchFrame, anchor.href, { element: anchor })
    })

    it('prefetches existing links only when they enter the viewport', async (t) => {
      let prefetchFrame = mock.fn()
      let visible = createViewportLink('/products/visible')
      let offscreen = createViewportLink('/products/offscreen', false)
      startTestPrefetching(t, prefetchFrame)

      expect(await readIntersection(visible)).toBe(true)
      expect(await readIntersection(offscreen)).toBe(false)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, visible.href, { element: visible })

      offscreen.style.top = '0px'
      expect(await readIntersection(offscreen)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expectPrefetchCall(prefetchFrame, offscreen.href, { element: offscreen })
    })

    it('discovers links in newly inserted subtrees and links marked after insertion', async (t) => {
      let prefetchFrame = mock.fn()
      startTestPrefetching(t, prefetchFrame)
      let subtree = document.createElement('section')
      let added = createViewportLink('/products/added')
      subtree.append(added)
      document.body.append(subtree)
      expect(await readIntersection(added)).toBe(true)
      expectPrefetchCall(prefetchFrame, added.href, { element: added })

      let markedLater = createIntentLink('/products/marked-later')
      markedLater.style.cssText = added.style.cssText
      expect(await readIntersection(markedLater)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      markedLater.setAttribute('data-rmx-prefetch', 'viewport')
      expect(await readIntersection(markedLater)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expectPrefetchCall(prefetchFrame, markedLater.href, { element: markedLater })
    })

    it('does not repeat on reentry or fragment changes but observes changed destinations', async (t) => {
      let timers = t.useFakeTimers()
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt#details')
      startTestPrefetching(t, prefetchFrame)
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, new URL('/products/shirt', location.href).href, {
        element: anchor,
      })

      anchor.style.top = `${innerHeight + 100}px`
      expect(await readIntersection(anchor)).toBe(false)
      anchor.style.top = '0px'
      expect(await readIntersection(anchor)).toBe(true)
      press(anchor)
      anchor.focus()
      timers.advance(150)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.hash = 'reviews'
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.href = '/products/hat'
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expectPrefetchCall(prefetchFrame, anchor.href, { element: anchor })
    })

    it('retains viewport work on exit and starts fresh work after its marker is restored', async (t) => {
      let signals: AbortSignal[] = []
      startTestPrefetching(t, (_src, options) => {
        if (!options?.signal) throw new Error('Expected caller signal')
        signals.push(options.signal)
      })
      let anchor = createViewportLink('/page')
      expect(await readIntersection(anchor)).toBe(true)
      expect(signals).toHaveLength(1)

      anchor.style.top = `${innerHeight + 100}px`
      expect(await readIntersection(anchor)).toBe(false)
      expect(signals[0].aborted).toBe(false)
      let changed = nextDomMutation()
      anchor.removeAttribute('data-rmx-prefetch')
      await changed
      expect(signals[0].aborted).toBe(true)

      anchor.setAttribute('data-rmx-prefetch', 'viewport')
      anchor.style.top = '0px'
      expect(await readIntersection(anchor)).toBe(true)
      expect(signals).toHaveLength(2)
      expect(signals[1].aborted).toBe(false)
    })

    it('skips ineligible links and observes links when they become eligible', async (t) => {
      let prefetchFrame = mock.fn()
      let download = createViewportLink('/products/download')
      download.setAttribute('download', '')
      let documentNavigation = createViewportLink('/products/document')
      documentNavigation.setAttribute('data-rmx-document', '')
      let named = createViewportLink('/products/named')
      named.setAttribute('data-rmx-target', 'details')
      let newTab = createViewportLink('/products/new-tab')
      newTab.target = '_blank'
      createViewportLink('https://example.com/products/shirt')
      createViewportLink(`${location.pathname}${location.search}#top`)
      let render = createViewportLink('/products/render')
      render.setAttribute('data-rmx-prefetch', 'render')
      let unmarked = createViewportLink('/products/unmarked')
      unmarked.removeAttribute('data-rmx-prefetch')
      startTestPrefetching(t, prefetchFrame)

      expect(await readIntersection(download)).toBe(true)
      expect(prefetchFrame).not.toHaveBeenCalled()

      download.removeAttribute('download')
      expect(await readIntersection(download)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, download.href, { element: download })
    })

    it('does not prefetch a removed link and can prefetch it when mounted again', async (t) => {
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      anchor.remove()
      expect(await readIntersection(anchor)).toBe(false)
      expect(prefetchFrame).not.toHaveBeenCalled()

      document.body.append(anchor)
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.remove()
      expect(await readIntersection(anchor)).toBe(false)
      document.body.append(anchor)
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
    })

    it('rechecks eligibility before using queued intersection notifications', async (t) => {
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      anchor.setAttribute('data-rmx-prefetch', 'intent')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).not.toHaveBeenCalled()

      anchor.setAttribute('data-rmx-prefetch', 'viewport')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
    })

    it('does not repeat a viewport prefetch after changing from pending intent', async (t) => {
      let timers = t.useFakeTimers()
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      anchor.setAttribute('data-rmx-prefetch', 'intent')
      startTestPrefetching(t, prefetchFrame)
      movePointer(document.body, anchor)

      anchor.setAttribute('data-rmx-prefetch', 'viewport')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      timers.advance(150)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
    })

    it('waits 150ms after the last nested scroll before prefetching links that entered view', (t) => {
      let timers = t.useFakeTimers()
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt', false)
      let scroller = document.createElement('div')
      document.body.append(scroller)
      startTestPrefetching(t, prefetchFrame)

      scroller.dispatchEvent(new Event('scroll'))
      intersections.queue(anchor, true)
      intersections.deliver()
      timers.advance(149)
      expect(prefetchFrame).not.toHaveBeenCalled()

      scroller.dispatchEvent(new Event('scroll'))
      timers.advance(149)
      expect(prefetchFrame).not.toHaveBeenCalled()

      timers.advance(1)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, anchor.href, { element: anchor })
    })

    it('skips links that leave view before a scroll stops and prefetches them on a later entry', (t) => {
      let timers = t.useFakeTimers()
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/passed', false)
      startTestPrefetching(t, prefetchFrame)

      document.dispatchEvent(new Event('scroll'))
      intersections.queue(anchor, true)
      intersections.deliver()
      intersections.queue(anchor, false)
      intersections.deliver()
      timers.advance(150)
      expect(prefetchFrame).not.toHaveBeenCalled()

      intersections.queue(anchor, true)
      intersections.deliver()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, anchor.href, { element: anchor })
    })

    it('uses the final queued intersection when scrolling stops before notifications arrive', (t) => {
      let timers = t.useFakeTimers()
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let passed = createViewportLink('/products/passed', false)
      let visible = createViewportLink('/products/visible', false)
      startTestPrefetching(t, prefetchFrame)

      document.dispatchEvent(new Event('scroll'))
      intersections.queue(passed, true)
      intersections.queue(visible, true)
      intersections.queue(passed, false)
      timers.advance(150)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, visible.href, { element: visible })

      intersections.queue(passed, true)
      intersections.deliver()
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expectPrefetchCall(prefetchFrame, passed.href, { element: passed })
    })

    it('checks connection settings when a scroll stops and allows a later entry', (t) => {
      let timers = t.useFakeTimers()
      let intersections = stubViewportIntersections(t)
      let connection = { saveData: false }
      stubConnection(t, connection)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt', false)
      startTestPrefetching(t, prefetchFrame)

      document.dispatchEvent(new Event('scroll'))
      intersections.queue(anchor, true)
      intersections.deliver()
      connection.saveData = true
      timers.advance(150)
      expect(prefetchFrame).not.toHaveBeenCalled()

      connection.saveData = false
      intersections.queue(anchor, false)
      intersections.queue(anchor, true)
      intersections.deliver()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, anchor.href, { element: anchor })
    })

    it('does not prefetch links waiting for a scroll to stop once disposed', (t) => {
      let timers = t.useFakeTimers()
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let controller = new AbortController()
      t.after(() => controller.abort())
      let anchor = createViewportLink('/products/shirt', false)
      startPrefetching(controller.signal, prefetchFrame)

      document.dispatchEvent(new Event('scroll'))
      intersections.queue(anchor, true)
      intersections.deliver()
      controller.abort()
      timers.advance(150)
      expect(prefetchFrame).not.toHaveBeenCalled()
    })

    it('stops observing existing and newly inserted links when disposed', async () => {
      let prefetchFrame = mock.fn()
      let controller = new AbortController()
      let anchor = createViewportLink('/products/shirt', false)
      startPrefetching(controller.signal, prefetchFrame)
      expect(await readIntersection(anchor)).toBe(false)
      controller.abort()

      anchor.style.top = '0px'
      let added = createViewportLink('/products/added')
      expect(await readIntersection(anchor)).toBe(true)
      expect(await readIntersection(added)).toBe(true)
      expect(prefetchFrame).not.toHaveBeenCalled()
    })

    it('keeps intent prefetching when IntersectionObserver is unavailable', (t) => {
      let original = globalThis.IntersectionObserver
      Object.defineProperty(globalThis, 'IntersectionObserver', { value: undefined })
      t.after(() => {
        globalThis.IntersectionObserver = original
      })
      let prefetchFrame = mock.fn()
      startTestPrefetching(t, prefetchFrame)
      let viewport = createViewportLink('/products/viewport')
      let intent = createIntentLink('/products/intent')

      press(viewport)
      expect(prefetchFrame).not.toHaveBeenCalled()
      press(intent)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expectPrefetchCall(prefetchFrame, intent.href, { element: intent })
    })
  })
})

describe('anchor prefetch ownership', () => {
  it('uses the navigation destination and triggering element of unmarked anchors', async (t) => {
    let callback = mock.fn()
    let anchor = createIntentLink('/page#section')
    anchor.removeAttribute('data-rmx-prefetch')
    anchor.setAttribute('data-rmx-src', '/partial#section')
    anchor.setAttribute('data-rmx-target', 'details')
    await startNamedFramePrefetching(t, callback, anchor)
    prefetch(anchor)
    expectPrefetchCall(callback, new URL('/partial', location.href).href, {
      target: 'details',
      element: anchor,
    })
    // @ts-expect-error Anchor calls cannot override their DOM frame target.
    prefetch(anchor, { target: 'sidebar' })
    // @ts-expect-error Anchor calls cannot override their DOM frame target.
    prefetch(anchor, { target: '' })
    // @ts-expect-error Anchor calls supply their own triggering element.
    prefetch(anchor, { element: document.createElement('span') })

    expect(callback).toHaveBeenCalledTimes(4)
    for (let call of callback.mock.calls) {
      expect(call.arguments).toMatchObject([
        new URL('/partial', location.href).href,
        { target: 'details', element: anchor },
      ])
    }
  })

  it('skips detached and ineligible anchors without requiring a declarative marker', (t) => {
    let callback = mock.fn()
    startTestPrefetching(t, callback)
    let anchor = document.createElement('a')
    anchor.href = '/page'
    prefetch(anchor)
    document.body.append(anchor)
    anchor.download = 'page.html'
    prefetch(anchor)
    anchor.removeAttribute('download')
    anchor.target = '_blank'
    prefetch(anchor)
    anchor.target = '_self'
    anchor.setAttribute('data-rmx-document', '')
    prefetch(anchor)
    anchor.removeAttribute('data-rmx-document')
    anchor.href = 'https://example.com/page'
    prefetch(anchor)
    expect(callback).not.toHaveBeenCalled()
    anchor.href = '/page'
    prefetch(anchor)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('cancels changed frame destinations while retaining equivalent source metadata', async (t) => {
    let signals: AbortSignal[] = []
    let callback = mock.fn((_src: string, options?: PrefetchFrameOptions) => {
      if (!options?.signal) throw new Error('Expected caller signal')
      signals.push(options.signal)
    })
    let anchor = createIntentLink('/page#section')
    anchor.setAttribute('data-rmx-src', '/partial#section')
    anchor.setAttribute('data-rmx-target', 'details')
    await startNamedFramePrefetching(t, callback, anchor)
    prefetch(anchor)

    let changed = nextDomMutation()
    anchor.href = '/different-link#section'
    anchor.setAttribute('data-rmx-src', '/partial#other')
    await changed
    expect(signals[0].aborted).toBe(false)

    changed = nextDomMutation()
    anchor.setAttribute('data-rmx-src', '/next#section')
    await changed
    expect(signals[0].aborted).toBe(true)
    prefetch(anchor)
    expectPrefetchCall(callback, new URL('/next', location.href).href, {
      target: 'details',
      element: anchor,
    })

    changed = nextDomMutation()
    anchor.setAttribute('data-rmx-target', 'sidebar')
    await changed
    expect(signals[1].aborted).toBe(true)
    prefetch(anchor)
    expectPrefetchCall(callback, new URL('/next', location.href).href, {
      target: 'sidebar',
      element: anchor,
    })
    expect(signals[2].aborted).toBe(false)
  })

  it('cancels callers when their anchors become ineligible', async (t) => {
    let signals: AbortSignal[] = []
    startTestPrefetching(t, (_src, options) => {
      if (!options?.signal) throw new Error('Expected caller signal')
      signals.push(options.signal)
    })
    let download = createIntentLink('/download')
    let documentNavigation = createIntentLink('/document')
    let newTab = createIntentLink('/new-tab')
    let missingHref = createIntentLink('/missing-href')
    let crossOrigin = createIntentLink('/cross-origin')
    let missingFrame = createIntentLink('/missing-frame')
    for (let anchor of [
      download,
      documentNavigation,
      newTab,
      missingHref,
      crossOrigin,
      missingFrame,
    ]) {
      prefetch(anchor)
    }
    expect(signals).toHaveLength(6)

    let changed = nextDomMutation()
    download.download = 'page.html'
    documentNavigation.setAttribute('data-rmx-document', '')
    newTab.target = '_blank'
    missingHref.removeAttribute('href')
    crossOrigin.href = 'https://example.com/page'
    missingFrame.setAttribute('data-rmx-target', 'unmounted')
    await changed
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('cancels removed declarative markers while retaining imperative owners of shared work', async (t) => {
    let response = Promise.withResolvers<Response>()
    t.after(() => response.resolve(htmlResponse('Finished')))
    let sharedSignal: AbortSignal | undefined
    let fetch = mock.fn((_url: string, init: RequestInit) => {
      sharedSignal = init.signal ?? undefined
      return response.promise
    })
    let signals: AbortSignal[] = []
    startTestPrefetching(t, (src, options) => {
      if (!options?.signal) throw new Error('Expected caller signal')
      signals.push(options.signal)
      return defaultPrefetch(src, options, { fetch })
    })
    let anchor = createIntentLink('/shared')
    press(anchor)
    prefetch(anchor)
    if (!sharedSignal) throw new Error('Expected shared signal')
    expect(fetch).toHaveBeenCalledTimes(1)

    let changed = nextDomMutation()
    anchor.removeAttribute('data-rmx-prefetch')
    await changed
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    expect(sharedSignal.aborted).toBe(false)

    changed = nextDomMutation()
    anchor.href = '/different'
    await changed
    expect(signals[1].aborted).toBe(true)
    expect(sharedSignal.aborted).toBe(true)
  })

  it('retains declarative callers across supported trigger modes and cancels disabled markers', async (t) => {
    let signal: AbortSignal | undefined
    startTestPrefetching(t, (_src, options) => {
      signal ??= options?.signal
    })
    let anchor = createIntentLink('/page')
    press(anchor)
    if (!signal) throw new Error('Expected caller signal')

    let changed = nextDomMutation()
    anchor.setAttribute('data-rmx-prefetch', 'viewport')
    await changed
    expect(signal.aborted).toBe(false)
    changed = nextDomMutation()
    anchor.setAttribute('data-rmx-prefetch', 'intent')
    await changed
    expect(signal.aborted).toBe(false)
    changed = nextDomMutation()
    anchor.setAttribute('data-rmx-prefetch', 'none')
    await changed
    expect(signal.aborted).toBe(true)
  })

  it('cancels queued intent and imperative callers without IntersectionObserver or callback promises', async (t) => {
    let descriptor = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver')
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: undefined,
    })
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, 'IntersectionObserver', descriptor)
    })
    let signals: AbortSignal[] = []
    let cancelled: Promise<void>[] = []
    startTestPrefetching(t, (_src, options) => {
      if (!options?.signal) throw new Error('Expected caller signal')
      signals.push(options.signal)
      cancelled.push(
        new Promise((resolve) =>
          options.signal?.addEventListener('abort', () => resolve(), { once: true }),
        ),
      )
    })
    let intent = createIntentLink('/intent')
    let imperative = createIntentLink('/imperative')
    press(intent)
    prefetch(imperative)
    expect(signals.length).toBe(2)
    expect(signals.every((signal) => !signal.aborted)).toBe(true)
    intent.remove()
    imperative.remove()
    await Promise.all(cancelled)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('retains shared fetching after the first anchor disconnects and aborts after the last', async (t) => {
    let first = createIntentLink('/shared')
    let second = createIntentLink('/shared')
    let response = Promise.withResolvers<Response>()
    t.after(() => response.resolve(htmlResponse('Finished')))
    let context: PrefetchContext | undefined
    let fetched = mock.fn((_url: string, _init: RequestInit, value: PrefetchContext) => {
      context = value
      return response.promise
    })
    let callers: AbortSignal[] = []
    startTestPrefetching(t, (src, options) => {
      if (!options?.signal) throw new Error('Expected caller signal')
      callers.push(options.signal)
      return defaultPrefetch(src, options, { fetch: fetched })
    })
    prefetch(first)
    prefetch(second)
    if (!context) throw new Error('Expected fetch context')
    expect(fetched).toHaveBeenCalledTimes(1)
    expect(context.element).toBe(first)
    let firstCancelled = new Promise<void>((resolve) =>
      callers[0].addEventListener('abort', () => resolve(), { once: true }),
    )
    first.remove()
    await firstCancelled
    expect(context.element?.isConnected).toBe(false)
    expect(context.signal.aborted).toBe(false)
    let finished = new Promise<void>((resolve) =>
      context?.signal.addEventListener('abort', () => resolve(), { once: true }),
    )
    second.remove()
    await finished
    expect(callers.every((signal) => signal.aborted)).toBe(true)
  })

  it('retains string callers when an anchor sharing their request disconnects', async (t) => {
    let anchor = createIntentLink('/shared')
    let response = Promise.withResolvers<Response>()
    let parsed = Promise.withResolvers<void>()
    let context: PrefetchContext | undefined
    let callerSignal: AbortSignal | undefined
    startTestPrefetching(t, (src, options) => {
      if (options?.element) callerSignal = options.signal
      return defaultPrefetch(src, options, {
        fetch(_url, _init, value) {
          context = value
          return response.promise
        },
        processFrame() {
          parsed.resolve()
        },
      })
    })
    prefetch(anchor)
    prefetch('/shared')
    if (!callerSignal || !context) throw new Error('Expected signals')
    let cancelled = new Promise<void>((resolve) =>
      callerSignal?.addEventListener('abort', () => resolve(), { once: true }),
    )
    anchor.remove()
    await cancelled
    expect(context.signal.aborted).toBe(false)
    response.resolve(htmlResponse('<main>Shared</main>'))
    await parsed.promise
  })

  it('preserves document moves and gives reinserted anchors a fresh cancellation signal', async (t) => {
    let signals: AbortSignal[] = []
    startTestPrefetching(t, (_src, options) => {
      if (!options?.signal) throw new Error('Expected caller signal')
      signals.push(options.signal)
    })
    let anchor = createIntentLink('/page')
    prefetch(anchor)
    let container = document.createElement('main')
    document.body.append(container)
    container.append(anchor)
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    expect(signals[0].aborted).toBe(false)
    let cancelled = new Promise<void>((resolve) =>
      signals[0].addEventListener('abort', () => resolve(), { once: true }),
    )
    container.remove()
    await cancelled
    document.body.append(anchor)
    prefetch(anchor)
    expect(signals.length).toBe(2)
    expect(signals[1]).not.toBe(signals[0])
    expect(signals[1].aborted).toBe(false)
  })

  it('combines explicit cancellation and runtime disposal with anchor lifetime', (t) => {
    let caller = new AbortController()
    let runtime = new AbortController()
    let signals: AbortSignal[] = []
    startPrefetching(runtime.signal, (_src, options) => {
      if (!options?.signal) throw new Error('Expected caller signal')
      signals.push(options.signal)
    })
    t.after(() => runtime.abort())
    let anchor = createIntentLink('/page')
    prefetch(anchor, { signal: caller.signal })
    prefetch(anchor)
    caller.abort()
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    runtime.abort()
    expect(signals[1].aborted).toBe(true)
  })

  it('releases anchor lifetime tracking when promised work completes', async (t) => {
    let finished = Promise.withResolvers<void>()
    let signal: AbortSignal | undefined
    startTestPrefetching(t, (_src, options) => {
      signal = options?.signal
      return finished.promise
    })
    let anchor = createIntentLink('/page')
    prefetch(anchor)
    if (!signal) throw new Error('Expected caller signal')
    finished.resolve()
    await finished.promise
    anchor.remove()
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    expect(signal.aborted).toBe(false)
  })

  it('ignores unsupported string elements while retaining target and cancellation options', async (t) => {
    let caller = new AbortController()
    let anchor = createIntentLink('/page')
    let callback = mock.fn()
    startTestPrefetching(t, callback)
    // @ts-expect-error String triggers accept only target and signal options.
    prefetch('/page', { target: 'details', element: anchor, signal: caller.signal })
    expect(callback).toHaveBeenCalledWith(new URL('/page', location.href).href, {
      target: 'details',
      signal: caller.signal,
    })
    let changed = nextDomMutation()
    anchor.remove()
    await changed
    expect(caller.signal.aborted).toBe(false)
  })

  it('cancels viewport callers when their containing subtree disconnects', async (t) => {
    let signal = Promise.withResolvers<AbortSignal>()
    startTestPrefetching(t, (_src, options) => {
      if (!options?.signal) throw new Error('Expected caller signal')
      signal.resolve(options.signal)
    })
    let anchor = createViewportLink('/viewport')
    let container = document.createElement('div')
    container.append(anchor)
    document.body.append(container)
    let caller = await signal.promise
    let cancelled = new Promise<void>((resolve) =>
      caller.addEventListener('abort', () => resolve(), { once: true }),
    )
    container.remove()
    await cancelled
    expect(caller.aborted).toBe(true)
  })
})

describe('defaultPrefetch overrides', () => {
  it('retains idle discovery for shared anchors and cancels it when the last caller disconnects', async (t) => {
    let idle = stubIdleCallbacks(t)
    let context: PrefetchContext | undefined
    let processFrame = mock.fn()
    let requests: Promise<void>[] = []
    startTestPrefetching(t, (src, options) => {
      requests.push(
        defaultPrefetch(src, options, {
          fetch(_url, _init, value) {
            context = value
            return Promise.resolve(htmlResponse('<main>Shared page</main>'))
          },
          processFrame,
        }),
      )
    })
    let first = createIntentLink('/shared-idle')
    let second = createIntentLink('/shared-idle')
    prefetch(first)
    prefetch(second)
    await idle.waitFor()
    expect(context?.element).toBe(first)
    expect(idle.pending).toBe(1)

    let changed = nextDomMutation()
    first.remove()
    await changed
    expect(context?.signal.aborted).toBe(false)
    expect(idle.pending).toBe(1)

    changed = nextDomMutation()
    second.remove()
    await changed
    await Promise.all(requests)
    expect(context?.signal.aborted).toBe(true)
    expect(idle.pending).toBe(0)
    idle.flush()
    expect(processFrame).not.toHaveBeenCalled()
  })

  it('passes the marked link through options and both hooks when a descendant is pressed', async (t) => {
    let parsed = Promise.withResolvers<void>()
    let anchor = createIntentLink('/page#details')
    let child = document.createElement('span')
    anchor.append(child)
    let app = run({
      loadModule: mock.fn(),
      prefetch(src, options) {
        expect(options?.element).toBe(anchor)
        expect(options?.element).not.toBe(child)
        return defaultPrefetch(src, options, {
          fetch(url, init, context) {
            expect(context.src).toBe(url)
            expect(context.signal).toBe(init.signal)
            expect(context.element).toBe(anchor)
            return Promise.resolve(htmlResponse('<main>Page</main>'))
          },
          processFrame(_prefetchReferences, context) {
            expect(context.element).toBe(anchor)
            expect(context.element?.isConnected).toBe(true)
            parsed.resolve()
          },
        })
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    press(child)
    await parsed.promise
  })

  it('retains the first triggering element when shared callers join and cancel', async (t) => {
    startTestPrefetching(t)
    let firstElement = document.createElement('button')
    let secondElement = document.createElement('button')
    let firstController = new AbortController()
    let response = Promise.withResolvers<Response>()
    let parsed = Promise.withResolvers<PrefetchContext>()
    let release = Promise.withResolvers<void>()
    let requestContext: PrefetchContext | undefined
    let first = defaultPrefetch(
      '/page',
      {
        signal: firstController.signal,
        element: firstElement,
      },
      {
        fetch(_url, _init, context) {
          requestContext = context
          return response.promise
        },
        async processFrame(_prefetchReferences, context) {
          parsed.resolve(context)
          await release.promise
        },
      },
    )
    if (!requestContext) throw new Error('Expected request context')
    let duplicateFetch = mock.fn(() => Promise.resolve(htmlResponse('Duplicate')))
    let second = defaultPrefetch('/page', { element: secondElement }, { fetch: duplicateFetch })
    expect(requestContext.element).toBe(firstElement)
    expect(duplicateFetch).not.toHaveBeenCalled()
    response.resolve(htmlResponse('<main>Page</main>'))
    let frameContext = await parsed.promise
    expect(frameContext.element).toBe(firstElement)
    firstController.abort()
    await first
    expect(frameContext.element).toBe(firstElement)
    expect(requestContext.element).toBe(firstElement)
    expect(frameContext.signal.aborted).toBe(false)
    release.resolve()
    await second
  })

  it('inherits the initiating element through shared nested frame requests', async (t) => {
    startTestPrefetching(t)
    let firstElement = createIntentLink('/page')
    let secondElement = createIntentLink('/page')
    let directElement = createIntentLink('/child')
    let firstController = new AbortController()
    let secondController = new AbortController()
    let nested = Promise.withResolvers<PrefetchContext>()
    let parsed = Promise.withResolvers<PrefetchContext>()
    let release = Promise.withResolvers<void>()
    let first = defaultPrefetch(
      '/page',
      {
        signal: firstController.signal,
        element: firstElement,
      },
      {
        fetch(url, _init, context) {
          if (new URL(url).pathname === '/child') {
            expect(context.element).toBe(firstElement)
            nested.resolve(context)
          }
          return Promise.resolve(
            htmlResponse(
              new URL(url).pathname === '/page'
                ? '<script id="rmx-data" type="application/json">{"f":{"child":{"src":"/child"}}}</script>'
                : '<main>Child</main>',
            ),
          )
        },
        async processFrame(prefetchReferences, context) {
          if (new URL(context.src).pathname === '/child') {
            parsed.resolve(context)
            await release.promise
          }
          await prefetchReferences({ frames: context.frames })
        },
      },
    )
    let context = await nested.promise
    let frameContext = await parsed.promise
    let second = defaultPrefetch('/page', {
      signal: secondController.signal,
      element: secondElement,
    })
    let direct = defaultPrefetch('/child', { element: directElement })
    firstController.abort()
    await first
    secondController.abort()
    await second
    expect(context.element).toBe(firstElement)
    expect(frameContext.element).toBe(firstElement)
    expect(context.signal.aborted).toBe(false)
    release.resolve()
    await direct
  })

  it('provides no implicit origin and preserves element options through defaultPrefetch', async (t) => {
    startTestPrefetching(t)
    await defaultPrefetch('/without-origin', undefined, {
      fetch(_url, _init, context) {
        expect(context.element).toBeUndefined()
        return Promise.resolve(htmlResponse('<main>Page</main>'))
      },
      processFrame(_prefetchReferences, context) {
        expect(context.element).toBeUndefined()
      },
    })
    let source = document.createElement('button')
    await defaultPrefetch(
      '/with-origin',
      { element: source },
      {
        fetch(_url, _init, context) {
          expect(context.element).toBe(source)
          return Promise.resolve(htmlResponse('<main>Page</main>'))
        },
        processFrame(_prefetchReferences, context) {
          expect(context.element).toBe(source)
        },
      },
    )
  })

  it('prepares custom fetches and exposes original inert elements with response context', async (t) => {
    startTestPrefetching(t)
    let response = htmlResponse(`<base href="../assets/">
      <script src="entry.js"></script>
      <script>document.documentElement.dataset.prefetchExecuted = 'yes'</script>
      <template><link rel="preload" as="image" imagesrcset="small.jpg 1x, large.jpg 2x"
        imagesizes="100vw" crossorigin referrerpolicy="no-referrer"></template>`)
    Object.defineProperty(response, 'url', {
      value: new URL('/redirected/page', location.href).href,
    })
    let transport = mock.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => response)
    let processFrame = mock.fn<NonNullable<DefaultPrefetchOverrides['processFrame']>>()

    await defaultPrefetch('/page#hash', { target: 'details' }, { fetch: transport, processFrame })

    expect(transport).toHaveBeenCalledTimes(1)
    let [url, init] = transport.mock.calls[0].arguments
    expect(url).toBe(new URL('/page', location.href).href)
    expect(init?.method).toBe('GET')
    expect(init?.mode).toBe('same-origin')
    expect(init?.priority).toBe('low')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(init?.headers).get('Accept')).toBe('text/html')
    expect(new Headers(init?.headers).get('X-Remix-Frame')).toBe('true')
    expect(new Headers(init?.headers).get('X-Remix-Target')).toBe('details')
    expect(new Headers(init?.headers).get('X-Remix-Prefetch')).toBe('true')
    expect(processFrame).toHaveBeenCalledTimes(1)
    let context = processFrame.mock.calls[0].arguments[1]
    expect(context.response).toBe(response)
    expect(context.response.bodyUsed).toBe(true)
    expect(context.src).toBe(new URL('/page', location.href).href)
    expect(context.target).toBe('details')
    expect('baseURL' in context).toBe(false)
    expect(context.fragment.isConnected).toBe(false)
    expect(context.assets).toHaveLength(1)
    expect(context.assets[0]).toBe(context.fragment.querySelector('script[src]'))
    let template = context.fragment.querySelector('template')
    expect(template?.content.firstElementChild?.getAttribute('imagesrcset')).toBe(
      'small.jpg 1x, large.jpg 2x',
    )
    expect(context.signal.aborted).toBe(false)
    expect(document.documentElement.dataset.prefetchExecuted).toBe(undefined)
  })

  it('exposes usable asset URLs while leaving unsupported and incomplete declarations in the fragment', async (t) => {
    startTestPrefetching(t)
    let context: PrefetchFrameContext | undefined
    await defaultPrefetch('/page', undefined, {
      fetch: async () =>
        htmlResponse(`<base href="https://assets.example/resources/">
          <script id="script" src="entry.js"></script>
          <script src=""></script><script src="   "></script>
          <script src="http://["></script><script src="data:text/javascript,"></script>
          <link id="style" rel="stylesheet" href="style.css">
          <link rel="stylesheet"><link rel="modulepreload" href="">
          <link rel="preload" as="image" href="   ">
          <link rel="stylesheet" href="http://[">
          <link id="responsive" rel="preload" as="image" imagesrcset="hero.jpg 1x, hero@2x.jpg 2x"
            imagesizes="100vw" media="not all">
          <link id="responsive-with-fallback" rel="preload" as="image" href="hero.jpg"
            imagesrcset="hero.jpg 1x, hero@2x.jpg 2x">
          <link id="unparsed-responsive" rel="preload" as="image" imagesrcset="http://[ 1x">
          <link rel="preload" as="image" imagesrcset="   ">
          <link id="data" rel="preload" as="fetch" href="data.json">
          <template><link id="captions" rel="preload" as="track" href="captions.vtt"></template>`),
      processFrame(_prefetchReferences, value) {
        context = value
      },
    })
    if (!context) throw new Error('Expected parsed frame context')
    let { assets, fragment } = context
    expect(assets.map((element) => element.id)).toEqual(['script', 'style', 'data'])
    expect(assets[0].getAttribute('src')).toBe('entry.js')
    expect(fragment.querySelector('#responsive')?.hasAttribute('href')).toBe(false)
    expect(fragment.querySelector('#responsive')?.getAttribute('media')).toBe('not all')
    expect(fragment.querySelector('#responsive-with-fallback')?.getAttribute('href')).toBe(
      'hero.jpg',
    )
    expect(fragment.querySelector('#unparsed-responsive')?.getAttribute('imagesrcset')).toBe(
      'http://[ 1x',
    )
    expect(fragment.querySelectorAll('script[src]')).toHaveLength(5)
    expect(fragment.querySelector('link[rel="stylesheet"]:not([href])')).not.toBe(null)
    let template = fragment.querySelector('template')
    expect(template?.content.querySelector('#captions')?.getAttribute('href')).toBe('captions.vtt')
  })

  it('selects original assets, adds marked images, and controls nested frame requests', async (t) => {
    startTestPrefetching(t)
    stubLinkPrefetchSupport(t, true)
    let html = await drain(
      renderToStream(
        jsx('main', {
          children: [
            jsx(Frame, { src: './keep#hash', name: 'details' }),
            jsx(Frame, {
              src: './skip',
              name: 'sidebar',
              fallback: jsx('p', { children: 'Loading' }),
            }),
            jsx(Frame, { src: './unmarked' }),
          ],
        }),
        { resolveFrame: () => '' },
      ),
    )
    let transport = mock.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      new URL(String(url)).pathname === '/page'
        ? htmlResponse(`<base href="/resources/">${html}
            <script src="keep.js"></script><script src="skip.js"></script>
            <img src="extra.jpg" data-prefetch><img src="ignored.jpg">`)
        : htmlResponse('<link rel="stylesheet" href="nested.css">'),
    )
    let hints = collectHints(t)
    let contexts: string[] = []

    await defaultPrefetch('/page', undefined, {
      fetch: transport,
      processFrame(prefetchReferences, { src, fragment, assets, frames }) {
        contexts.push(new URL(src).pathname)
        if (new URL(src).pathname !== '/page') return prefetchReferences()
        expect(frames.map((frame) => new URL(frame.src).pathname)).toEqual([
          '/resources/keep',
          '/resources/skip',
          '/resources/unmarked',
        ])
        expect(frames.map((frame) => frame.fallback)).toEqual([false, true, false])
        fragment.querySelector('#rmx-data')?.remove()
        let image = fragment.querySelector('img[data-prefetch]')
        return prefetchReferences({
          assets: [
            ...assets.filter((element) => element.getAttribute('src') === 'keep.js'),
            ...(image ? [image] : []),
          ],
          frames: frames
            .filter((frame) => !frame.fallback && frame.target === 'details')
            .map(({ src, target }) => ({ src, target })),
        })
      },
    })

    expect(contexts).toEqual(['/page', '/resources/keep'])
    expect(transport.mock.calls.map((call) => new URL(String(call.arguments[0])).pathname)).toEqual(
      ['/page', '/resources/keep'],
    )
    expect(new Headers(transport.mock.calls[1].arguments[1]?.headers).get('X-Remix-Target')).toBe(
      'details',
    )
    expect(new Headers(transport.mock.calls[1].arguments[1]?.headers).get('X-Remix-Prefetch')).toBe(
      'true',
    )
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual([
      '/resources/keep.js',
      '/resources/extra.jpg',
      '/resources/nested.css',
    ])
  })

  it('exposes frame references from nested templates without starting default nested fetches', async (t) => {
    startTestPrefetching(t)
    stubLinkPrefetchSupport(t, true)
    let html = `<script src="/entry.js"></script>
      <script id="rmx-data" type="application/json">{"f":{
        "eager":{"src":"/eager","name":"details","status":"resolved"},
        "fallback":{"src":"/fallback","name":"sidebar","status":"pending"},
        "crossOrigin":{"src":"https://example.com/frame"},
        "invalidName":{"src":"/invalid","name":42}
      }}</script>
      <template><script id="rmx-data" type="application/json">{"f":{
        "nested":{"src":"/nested#section"}
      }}</script><link rel="stylesheet" href="/nested.css"></template>`
    let transport = mock.fn(async () => htmlResponse(html))
    let hints = collectHints(t)
    await defaultPrefetch('/page', undefined, { fetch: transport })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/entry.js', '/nested.css'])
    hints.length = 0
    await defaultPrefetch('/page', undefined, {
      fetch: transport,
      async processFrame(prefetchReferences, { frames }) {
        expect(frames).toEqual([
          {
            src: new URL('/eager', location.href).href,
            target: 'details',
            loading: 'eager',
            fallback: false,
          },
          {
            src: new URL('/fallback', location.href).href,
            target: 'sidebar',
            loading: 'eager',
            fallback: true,
          },
          {
            src: new URL('/nested', location.href).href,
            target: undefined,
            loading: 'eager',
            fallback: false,
          },
        ])
        expect(Object.isFrozen(frames)).toBe(true)
        await prefetchReferences()
      },
    })
    expect(transport).toHaveBeenCalledTimes(2)
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/entry.js', '/nested.css'])
  })

  it('selects lazy nested frames using loading metadata and retains their fallback flags', async (t) => {
    startTestPrefetching(t)
    let resolved: string[] = []
    let html = await drain(
      renderToStream(
        jsx('main', {
          children: [
            jsx(Frame, { src: '/eager', loading: 'eager' }),
            jsx(Frame, {
              src: '/later',
              name: 'details',
              loading: 'lazy',
              fallback: jsx('p', { children: 'Loading' }),
            }),
            jsx(Frame, { src: '/empty', loading: 'lazy' }),
          ],
        }),
        {
          resolveFrame(src) {
            resolved.push(src)
            return ''
          },
        },
      ),
    )
    expect(resolved).toEqual(['/eager'])
    let transport = mock.fn(async (url: RequestInfo | URL) =>
      htmlResponse(new URL(String(url)).pathname === '/page' ? html : '<main>Nested</main>'),
    )
    await defaultPrefetch('/page', undefined, {
      fetch: transport,
      processFrame(prefetchReferences, { src, frames }) {
        if (new URL(src).pathname === '/page') {
          expect(
            frames.map(({ src, ...metadata }) => ({ src: new URL(src).pathname, ...metadata })),
          ).toEqual([
            { src: '/eager', target: undefined, loading: 'eager', fallback: false },
            { src: '/later', target: 'details', loading: 'lazy', fallback: true },
            { src: '/empty', target: undefined, loading: 'lazy', fallback: false },
          ])
        }
        return prefetchReferences({
          assets: [],
          frames: frames.filter((frame) => frame.loading === 'lazy'),
        })
      },
    })
    expect(transport.mock.calls.map((call) => new URL(String(call.arguments[0])).pathname)).toEqual(
      ['/page', '/later', '/empty'],
    )
  })

  it('does not fall back when the processFrame hook skips or throws, and permits later attempts', async (t) => {
    startTestPrefetching(t)
    stubLinkPrefetchSupport(t, true)
    let hints = collectHints(t)
    let transport = mock.fn(async () => htmlResponse('<script src="/entry.js"></script>'))
    await defaultPrefetch('/page', undefined, { fetch: transport, processFrame() {} })
    await defaultPrefetch('/page', undefined, {
      fetch: transport,
      processFrame() {
        throw new Error('Skip speculative work')
      },
    })
    expect(hints).toEqual([])
    await defaultPrefetch('/page', undefined, { fetch: transport })
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/entry.js'])
    expect(transport).toHaveBeenCalledTimes(3)
  })

  it('defaults omitted assets, skips omitted frames, and deduplicates repeated delegations', async (t) => {
    startTestPrefetching(t)
    stubLinkPrefetchSupport(t, true)
    let transport = mock.fn(async (url: RequestInfo | URL) =>
      new URL(String(url)).pathname === '/page'
        ? htmlResponse(`<script src="/one.js"></script><script src="/two.js"></script>
            <script id="rmx-data" type="application/json">{"f":{"child":{"src":"/child"}}}</script>`)
        : htmlResponse('<main>Child</main>'),
    )
    let hints = collectHints(t)
    await defaultPrefetch('/page', undefined, {
      fetch: transport,
      processFrame(prefetchReferences, { assets }) {
        if (assets.length === 0) return
        let foreign = document.createElement('script')
        foreign.src = '/foreign.js'
        void prefetchReferences({ assets: [assets[0], foreign], frames: [] })
        void prefetchReferences({ frames: [] })
        return prefetchReferences({ assets: [] })
      },
    })
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/one.js', '/two.js'])
    expect(transport.mock.calls.map((call) => new URL(String(call.arguments[0])).pathname)).toEqual(
      ['/page'],
    )
  })

  it('starts each parsed frame independently and awaits custom and unreturned delegated work', async (t) => {
    startTestPrefetching(t)
    stubLinkPrefetchSupport(t, true)
    let second = Promise.withResolvers<Response>()
    let custom = Promise.withResolvers<void>()
    let firstParsed = Promise.withResolvers<void>()
    let hints = collectHints(t)
    let completed = false
    let first = defaultPrefetch('/first', undefined, {
      fetch: async () => htmlResponse('<script src="/first.js"></script>'),
      async processFrame(prefetchReferences) {
        void prefetchReferences()
        firstParsed.resolve()
        await custom.promise
      },
    }).then(() => {
      completed = true
    })
    let other = defaultPrefetch('/second', undefined, { fetch: () => second.promise })

    await firstParsed.promise
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/first.js'])
    expect(completed).toBe(false)
    second.resolve(htmlResponse('<script src="/second.js"></script>'))
    await other
    expect(completed).toBe(false)
    custom.resolve()
    await first
    expect(completed).toBe(true)
  })

  it('shares hooks across concurrent roots and terminates nested frame cycles', async (t) => {
    startTestPrefetching(t)
    let firstElement = createIntentLink('/first')
    let secondElement = createIntentLink('/second')
    let release = Promise.withResolvers<void>()
    let transport = mock.fn(async (url: RequestInfo | URL) => {
      await release.promise
      let other = new URL(String(url)).pathname === '/first' ? '/second' : '/first'
      return htmlResponse(
        `<script id="rmx-data" type="application/json">${JSON.stringify({
          f: { nested: { src: other } },
        })}</script>`,
      )
    })
    let parsed: string[] = []
    let origins = new Map<string, Element | undefined>()
    let overrides: DefaultPrefetchOverrides = {
      fetch: transport,
      async processFrame(prefetchReferences, context) {
        let pathname = new URL(context.src).pathname
        parsed.push(pathname)
        await prefetchReferences({ frames: context.frames })
        origins.set(pathname, context.element)
      },
    }
    let first = defaultPrefetch('/first', { element: firstElement }, overrides)
    let second = defaultPrefetch('/second', { element: secondElement }, overrides)
    let duplicate = defaultPrefetch(
      '/first',
      { element: firstElement },
      {
        fetch() {
          throw new Error('Duplicate must share first overrides')
        },
      },
    )
    release.resolve()
    await Promise.all([first, second, duplicate])
    expect(transport).toHaveBeenCalledTimes(2)
    expect(parsed.sort()).toEqual(['/first', '/second'])
    expect(origins.get('/first')).toBe(firstElement)
    expect(origins.get('/second')).toBe(secondElement)
  })

  it('cancels individual callers while retaining shared HTML and prevents late delegation', async (t) => {
    startTestPrefetching(t)
    stubLinkPrefetchSupport(t, true)
    let response = Promise.withResolvers<Response>()
    let release = Promise.withResolvers<void>()
    let parsed = Promise.withResolvers<AbortSignal>()
    let firstController = new AbortController()
    let secondController = new AbortController()
    let requestSignal: AbortSignal | null | undefined
    let transport = mock.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal
      return response.promise
    })
    let first = defaultPrefetch(
      '/page',
      { signal: firstController.signal },
      {
        fetch: transport,
        async processFrame(prefetchReferences, { signal }) {
          parsed.resolve(signal)
          await release.promise
          await prefetchReferences()
        },
      },
    )
    let second = defaultPrefetch('/page', { signal: secondController.signal })
    firstController.abort()
    await first
    expect(requestSignal?.aborted).toBe(false)
    response.resolve(htmlResponse('<script src="/entry.js"></script>'))
    let hookSignal = await parsed.promise
    secondController.abort()
    await second
    expect(hookSignal.aborted).toBe(true)
    let hints = collectHints(t)
    release.resolve()
    await Promise.resolve()
    expect(hints).toEqual([])
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it('lets a custom fetch handle failed responses before validation and skips failed discovery', async (t) => {
    startTestPrefetching(t)
    let processFrame = mock.fn()
    let failed = new Response('<script src="/error.js"></script>', {
      status: 503,
      headers: { 'Content-Type': 'text/html', 'Retry-After': '5' },
    })
    expect(failed.body).not.toBe(null)
    if (!failed.body) throw new Error('Expected a response body')
    let cancel = t.mock.method(failed.body, 'cancel', async () => {})
    await defaultPrefetch('/page', undefined, { fetch: async () => failed, processFrame })
    expect(processFrame).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledTimes(1)
    await defaultPrefetch('/page', undefined, {
      fetch: async () => htmlResponse('<main>Recovered</main>'),
      processFrame,
    })
    expect(processFrame).toHaveBeenCalledTimes(1)
  })

  it('allows applications to handle responsive image preloads and fetch their own assets', async (t) => {
    startTestPrefetching(t)
    let small =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="7" height="7"></svg>')
    let large =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"></svg>')
    let images: HTMLImageElement[] = []
    let hints = collectHints(t)
    let fetched = ''

    await defaultPrefetch('/page', undefined, {
      fetch: async () =>
        htmlResponse(`<link rel="preload" as="image" href="${small}"
        imagesrcset="${small} 1x, ${large} 2x" imagesizes="100vw" referrerpolicy="no-referrer">`),
      async processFrame(prefetchReferences, { fragment, signal }) {
        let source = fragment.querySelector<HTMLLinkElement>('link[rel="preload"][as="image"]')
        if (!source) throw new Error('Expected an image preload')
        let image = new Image()
        image.fetchPriority = 'low'
        image.referrerPolicy = source.referrerPolicy
        image.sizes = source.imageSizes
        image.srcset = source.imageSrcset
        image.src = source.getAttribute('href') ?? ''
        images.push(image)
        await Promise.all([
          prefetchReferences(),
          image.decode(),
          fetch('data:text/plain,custom-asset', { signal }).then(async (response) => {
            fetched = await response.text()
          }),
        ])
      },
    })

    expect(images).toHaveLength(1)
    expect(images[0].complete).toBe(true)
    expect(images[0].naturalWidth).toBe(7)
    expect(images[0].isConnected).toBe(false)
    expect(images[0].referrerPolicy).toBe('no-referrer')
    expect(fetched).toBe('custom-asset')
    expect(hints).toEqual([])
  })

  it('retains shared asset hints until their last frame owner cancels', async (t) => {
    let idle = stubIdleCallbacks(t)
    startTestPrefetching(t)
    stubLinkPrefetchSupport(t, true)
    let linked = Promise.withResolvers<HTMLLinkElement>()
    let secondParsed = Promise.withResolvers<void>()
    let observer = new MutationObserver((records) => {
      for (let record of records)
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'prefetch') linked.resolve(node)
        }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())
    let firstController = new AbortController()
    let secondController = new AbortController()
    let first = defaultPrefetch(
      '/first',
      { signal: firstController.signal },
      {
        fetch: async () => htmlResponse('<script src="/shared.js"></script>'),
      },
    )
    await idle.waitFor()
    let second = defaultPrefetch(
      '/second',
      { signal: secondController.signal },
      {
        fetch: async () => htmlResponse('<script src="/shared.js"></script>'),
        processFrame(prefetchReferences) {
          let ready = prefetchReferences()
          secondParsed.resolve()
          return ready
        },
      },
    )
    await idle.waitFor(2)
    idle.flush()
    let link = await linked.promise
    await secondParsed.promise
    firstController.abort()
    await first
    expect(link.isConnected).toBe(true)
    secondController.abort()
    await second
    expect(link.isConnected).toBe(false)
  })

  it('awaits unreturned delegation and ties custom defaultPrefetch calls to runtime disposal', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let linked = Promise.withResolvers<HTMLLinkElement>()
    let observer = new MutationObserver((records) => {
      for (let record of records)
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'prefetch') linked.resolve(node)
        }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())
    let finished = Promise.withResolvers<void>()
    let completed = false
    let app = run({
      loadModule: mock.fn(),
      prefetch(src, options) {
        return defaultPrefetch(src, options, {
          fetch: async () => htmlResponse('<script src="/pending.js"></script>'),
          processFrame(prefetchReferences) {
            void prefetchReferences()
          },
        }).then(() => {
          completed = true
          finished.resolve()
        })
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    prefetch('/page')
    let link = await linked.promise
    expect(completed).toBe(false)
    app.dispose()
    await finished.promise
    expect(completed).toBe(true)
    expect(link.isConnected).toBe(false)
  })

  it('awaits pending work when the same references are delegated again', async (t) => {
    startTestPrefetching(t)
    stubLinkPrefetchSupport(t, true)
    let linked = Promise.withResolvers<HTMLLinkElement>()
    let observer = new MutationObserver((records) => {
      for (let record of records)
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'prefetch') linked.resolve(node)
        }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())
    let delegated = false
    let ready = defaultPrefetch('/page', undefined, {
      fetch: async () => htmlResponse('<script src="/pending.js"></script>'),
      async processFrame(prefetchReferences) {
        void prefetchReferences()
        await prefetchReferences()
        delegated = true
      },
    })
    let link = await linked.promise
    await Promise.resolve()
    expect(delegated).toBe(false)
    link.dispatchEvent(new Event('load'))
    await ready
    expect(delegated).toBe(true)
  })
})

describe('default frame prefetch', () => {
  it('downloads HTML immediately and waits for idle time before discovering assets', async (t) => {
    let idle = stubIdleCallbacks(t)
    stubLinkPrefetchSupport(t, true)
    let fetch = t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse('<script src="/entry.js"></script>'),
    )
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)
    let ready = prefetch(new URL('/page', location.href).href)

    expect(fetch).toHaveBeenCalledTimes(1)
    await idle.waitFor()
    expect(idle.timeout).toBe(1000)
    expect(hints).toHaveLength(0)
    idle.flush()
    await ready
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/entry.js'])
  })

  it('cancels HTML discovery waiting for idle time on disposal', async (t) => {
    let idle = stubIdleCallbacks(t)
    stubLinkPrefetchSupport(t, true)
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse('<script src="/entry.js"></script>'),
    )
    let hints = collectHints(t)
    let { prefetch, controller } = createPrefetch(t)
    let ready = prefetch(new URL('/page', location.href).href)

    await idle.waitFor()
    controller.abort()
    await ready
    expect(idle.pending).toBe(0)
    idle.flush()
    expect(hints).toHaveLength(0)
  })

  it('discovers explicit assets in inert HTML and nested templates without using its import map', async (t) => {
    stubLinkPrefetchSupport(t, true)
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse(`<!doctype html><html><head>
        <base href="/resources/">
        <script type="importmap">{"imports":{"example":"/mapped.js"}}</script>
        <link rel="modulepreload" href="module.js">
        <script type="module" src="entry.js"></script>
        <script src="classic.js"></script>
        <link rel="stylesheet" href="styles.css">
        <style>body { --prefetch-style: applied }</style>
      </head><body>
        <img src="not-prefetched.png">
        <script>document.documentElement.dataset.executed = 'yes'</script>
        <template><template><link rel="preload" as="script" href="nested.js"></template></template>
        <script type="application/json" src="ignored.json"></script>
      </body></html>`),
    )
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)
    let importMaps = document.querySelectorAll('script[type=importmap]').length

    await prefetch(new URL('/page', location.href).href)

    expect(hints.map((link) => new URL(link.href).pathname).sort()).toEqual([
      '/resources/classic.js',
      '/resources/entry.js',
      '/resources/module.js',
      '/resources/nested.js',
      '/resources/styles.css',
    ])
    expect(hints.map((link) => link.as)).toEqual(['script', 'script', 'script', 'style', 'script'])
    expect(hints.every((link) => !link.isConnected)).toBe(true)
    expect(document.documentElement.dataset.executed).toBe(undefined)
    expect(getComputedStyle(document.body).getPropertyValue('--prefetch-style')).toBe('')
    expect(document.querySelectorAll('script[type=importmap]').length).toBe(importMaps)
  })

  it('honors final response URLs, skips active assets, and retains request attributes', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let active = document.createElement('script')
    active.type = 'module'
    active.src = new URL('/products/active.js', location.href).href
    document.head.append(active)
    t.after(() => active.remove())
    let response = htmlResponse(`<script type="module" src="./active.js"></script>
      <script type="module" src="./entry.js" crossorigin="use-credentials"
        integrity="sha256-example" referrerpolicy="no-referrer"></script>
      <link rel="stylesheet" href="data:text/css,body{}">`)
    Object.defineProperty(response, 'url', {
      value: new URL('/products/final', location.href).href,
    })
    t.mock.method(globalThis, 'fetch', async () => response)
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)

    await prefetch(new URL('/redirect', location.href).href)

    expect(hints).toHaveLength(1)
    expect(new URL(hints[0].href).pathname).toBe('/products/entry.js')
    expect(hints[0].crossOrigin).toBe('use-credentials')
    expect(hints[0].integrity).toBe('sha256-example')
    expect(hints[0].referrerPolicy).toBe('no-referrer')
  })

  it('prefetches image and fetch preload URLs, including nested templates, while skipping track preloads', async (t) => {
    stubLinkPrefetchSupport(t, true)
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse(`<base href="/images/">
        <link rel="preload" as="image" href="hero.jpg" crossorigin="anonymous"
          referrerpolicy="no-referrer" fetchpriority="high">
        <template><link rel="preload" as="image" href="detail.jpg"></template>
        <img src="not-prefetched.jpg">
        <link rel="preload" as="fetch" href="data.json">
        <link rel="preload" as="track" href="captions.vtt">`),
    )
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)

    await prefetch(new URL('/page', location.href).href)

    expect(hints.map((link) => new URL(link.href).pathname)).toEqual([
      '/images/hero.jpg',
      '/images/detail.jpg',
      '/images/data.json',
    ])
    expect(hints.map((link) => link.as)).toEqual(['image', 'image', 'fetch'])
    expect(hints.every((link) => link.fetchPriority === 'low')).toBe(true)
    expect(hints[0].crossOrigin).toBe('anonymous')
    expect(hints[0].referrerPolicy).toBe('no-referrer')
    expect(hints[1].hasAttribute('crossorigin')).toBe(false)
    expect(hints.every((link) => !link.isConnected)).toBe(true)
  })

  it('skips responsive image preloads, active images, and unmatched media', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let active = document.createElement('link')
    active.rel = 'preload'
    active.as = 'image'
    active.href = '/images/active.jpg'
    document.head.append(active)
    t.after(() => active.remove())
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse(`<link rel="preload" as="image" href="/images/active.jpg">
        <link rel="preload" as="image" href="/images/fallback.jpg"
          imagesrcset="/images/small.jpg 400w, /images/large.jpg 1200w" imagesizes="100vw">
        <link rel="preload" as="image" imagesrcset="/images/responsive.jpg 1x">
        <link rel="preload" as="image" href="/images/print.jpg" media="not all">
        <link rel="preload" as="image" href="/images/screen.jpg" media="all">`),
    )
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)

    await prefetch(new URL('/page', location.href).href)

    expect(hints.map((link) => link.getAttribute('href'))).toEqual([
      new URL('/images/screen.jpg', location.href).href,
    ])
    expect(hints[0].as).toBe('image')
    expect(hints[0].rel).toBe('prefetch')
    expect(hints.every((link) => link.fetchPriority === 'low')).toBe(true)
  })

  it('prefetches explicit font preload URLs, honoring media, active assets, and CORS', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let active = document.createElement('link')
    active.rel = 'preload'
    active.as = 'font'
    active.href = '/fonts/active.woff2'
    active.crossOrigin = 'anonymous'
    document.head.append(active)
    t.after(() => active.remove())
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse(`<base href="/fonts/">
        <link rel="preload" as="font" href="active.woff2" crossorigin>
        <link rel="preload" as="font" href="body.woff2" type="font/woff2" crossorigin
          integrity="sha256-example" referrerpolicy="no-referrer" fetchpriority="high">
        <template><link rel="preload" as="font" href="heading.woff2"
          crossorigin="anonymous" media="all"></template>
        <link rel="preload" as="font" href="print.woff2" crossorigin media="not all">
        <style>@font-face { font-family: undiscovered; src: url(css-only.woff2) }</style>`),
    )
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)

    await prefetch(new URL('/page', location.href).href)

    expect(hints.map((link) => new URL(link.href).pathname)).toEqual([
      '/fonts/body.woff2',
      '/fonts/heading.woff2',
    ])
    expect(
      hints.every(
        (link) =>
          link.as === 'font' && link.fetchPriority === 'low' && link.crossOrigin === 'anonymous',
      ),
    ).toBe(true)
    expect(hints[0].integrity).toBe('sha256-example')
    expect(hints[0].referrerPolicy).toBe('no-referrer')
    expect(hints.every((link) => !link.isConnected)).toBe(true)
  })

  it('shares only pending discovery work and does not retain completed no-store responses', async (t) => {
    let response = Promise.withResolvers<Response>()
    let fetch = t.mock.method(globalThis, 'fetch', () => response.promise)
    let { prefetch } = createPrefetch(t)
    let src = new URL('/page', location.href).href

    let first = prefetch(src)
    let second = prefetch(src)
    expect(fetch).toHaveBeenCalledTimes(1)
    response.resolve(htmlResponse('<main>Next</main>'))
    await Promise.all([first, second])
    response = Promise.withResolvers<Response>()
    let third = prefetch(src)
    expect(fetch).toHaveBeenCalledTimes(2)
    response.resolve(htmlResponse('<main>Updated</main>'))
    await third
  })

  it('deduplicates HTML by source and target without mixing frame response variants', async (t) => {
    let response = Promise.withResolvers<void>()
    let fetch = t.mock.method(
      globalThis,
      'fetch',
      async (_src: RequestInfo | URL, _init?: RequestInit) => {
        await response.promise
        return htmlResponse('<main>Frame</main>')
      },
    )
    let { prefetch } = createPrefetch(t)
    let src = new URL('/page', location.href).href
    let requests = [
      prefetch(src),
      prefetch(src, { target: 'details' }),
      prefetch(src, { target: 'sidebar' }),
      prefetch(src, { target: 'details' }),
    ]

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(
      fetch.mock.calls.map((call) => new Headers(call.arguments[1]?.headers).get('X-Remix-Target')),
    ).toEqual([null, 'details', 'sidebar'])
    response.resolve()
    await Promise.all(requests)
  })

  it('deduplicates pending asset hints across pages and targets and removes failed hints', async (t) => {
    let idle = stubIdleCallbacks(t)
    stubLinkPrefetchSupport(t, true)
    let html = Promise.withResolvers<string>()
    t.mock.method(globalThis, 'fetch', async () => {
      let response = htmlResponse('')
      // Discover all three responses together while their shared asset hint is still pending.
      t.mock.method(response, 'text', () => html.promise)
      return response
    })
    let { prefetch } = createPrefetch(t)
    let linked = Promise.withResolvers<void>()
    let hints: HTMLLinkElement[] = []
    let observer = new MutationObserver((records) => {
      for (let record of records) {
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'prefetch') {
            hints.push(node)
            linked.resolve()
          }
        }
      }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())

    let ready = Promise.all([
      prefetch(new URL('/first', location.href).href),
      prefetch(new URL('/second', location.href).href),
      prefetch(new URL('/first', location.href).href, { target: 'details' }),
    ])
    html.resolve('<script src="/shared.js"></script>')
    await idle.waitFor(3)
    idle.flush()
    await linked.promise
    expect(hints).toHaveLength(1)
    hints[0].dispatchEvent(new Event('error'))
    await ready
    expect(hints).toHaveLength(1)
    expect(hints[0].isConnected).toBe(false)
  })

  it('ignores non-HTML and failed responses and allows later attempts', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let response = new Response('<script src="/ignored.js"></script>', { status: 503 })
    let fetch = t.mock.method(globalThis, 'fetch', async () => response)
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)
    let src = new URL('/page', location.href).href

    await prefetch(src)
    response = new Response('<script src="/ignored.js"></script>', {
      headers: { 'Content-Type': 'text/plain' },
    })
    await prefetch(src)
    response = htmlResponse('<script src="/recovered.js"></script>')
    await prefetch(src)

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/recovered.js'])
  })

  it('prefetches only the HTML in browsers that cannot prefetch links', async (t) => {
    stubLinkPrefetchSupport(t, false)
    let fetch = t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse('<script src="/entry.js"></script><link rel="stylesheet" href="/styles.css">'),
    )
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)

    await prefetch(new URL('/page', location.href).href)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(hints).toEqual([])
  })

  it('cancels speculative HTML and removes pending asset links on disposal', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let fetchedSignal: AbortSignal | null | undefined
    t.mock.method(globalThis, 'fetch', async (_src: RequestInfo | URL, init?: RequestInit) => {
      fetchedSignal = init?.signal
      return htmlResponse('<script src="/pending.js"></script>')
    })
    let { prefetch, controller } = createPrefetch(t)
    let linked = Promise.withResolvers<HTMLLinkElement>()
    let observer = new MutationObserver((records) => {
      for (let record of records) {
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'prefetch') linked.resolve(node)
        }
      }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())

    let ready = prefetch(new URL('/page', location.href).href)
    let link = await linked.promise
    controller.abort()
    await ready

    expect(fetchedSignal?.aborted).toBe(true)
    expect(link.isConnected).toBe(false)
  })
})
