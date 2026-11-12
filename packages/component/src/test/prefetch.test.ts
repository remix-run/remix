import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { Frame } from '../runtime/frame.ts'
import { jsx } from '../runtime/core/vnode.ts'
import {
  createDefaultPrefetch,
  prefetch,
  startPrefetching,
  type PrefetchFrame,
} from '../runtime/prefetch.ts'
import { run } from '../runtime/run.ts'
import { renderToStream } from '../server/stream.ts'
import { drain } from './utils.ts'

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

function stubIdleCallbacks(t?: TestContext) {
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
  t?.after(restore)
  return {
    restore,
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
        if (node instanceof HTMLLinkElement && node.rel === 'prefetch') {
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
  let idle: ReturnType<typeof stubIdleCallbacks>

  async function readViewportIntersection(anchor: HTMLAnchorElement): Promise<boolean> {
    let intersecting = await readIntersection(anchor)
    idle.flush()
    return intersecting
  }

  beforeEach(() => {
    idle = stubIdleCallbacks()
    globalThis.IntersectionObserver = TrackedIntersectionObserver
  })

  afterEach(() => {
    idle.restore()
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
    expect(await readViewportIntersection(visible)).toBe(true)
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
      expect(await readViewportIntersection(visible)).toBe(true)
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
      expect(prefetchFrame).toHaveBeenCalledWith(pressed.href)
      let visible = createViewportLink(`/products/viewport-${effectiveType}`)
      expect(await readViewportIntersection(visible)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledWith(visible.href)
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
    expect(await readViewportIntersection(visible)).toBe(true)

    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expect(prefetchFrame).toHaveBeenCalledWith(pressed.href)
    expect(prefetchFrame).toHaveBeenCalledWith(visible.href)
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
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
  })

  it('allows a skipped viewport link to prefetch on reentry after the connection improves', async (t) => {
    let connection = { effectiveType: '2g' }
    stubConnection(t, connection)
    let prefetchFrame = mock.fn()
    let anchor = createViewportLink('/products/shirt')
    startTestPrefetching(t, prefetchFrame)
    expect(await readViewportIntersection(anchor)).toBe(true)
    expect(prefetchFrame).not.toHaveBeenCalled()

    anchor.style.top = `${innerHeight + 100}px`
    expect(await readViewportIntersection(anchor)).toBe(false)
    connection.effectiveType = '4g'
    anchor.style.top = '0px'
    expect(await readViewportIntersection(anchor)).toBe(true)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
  })

  it('allows imperative prefetching with Save-Data enabled on a slow connection', (t) => {
    stubConnection(t, { saveData: true, effectiveType: 'slow-2g' })
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)

    prefetch('/products/shirt')

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expect(prefetchFrame).toHaveBeenCalledWith(new URL('/products/shirt', location.href).href)
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
    expect(prefetchFrame).toHaveBeenCalledWith(hovered.href)

    focused.focus()
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledWith(focused.href)
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

    expect(prefetchFrame).toHaveBeenCalledWith(new URL('/products/shirt', location.href).href)
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
    expect(prefetchFrame).toHaveBeenCalledWith(focused.href)
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
    expect(prefetchFrame).toHaveBeenCalledWith(focused.href)
    expect(prefetchFrame).toHaveBeenCalledWith(hovered.href)
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
    expect(prefetchFrame).toHaveBeenCalledWith(hovered.href)
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
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href, { target: 'details' })

    let overridden = createIntentLink('/products/hat')
    overridden.setAttribute('data-rmx-target', 'details')
    overridden.setAttribute('data-rmx-src', './partials/hat?size=small#details')
    movePointer(document.body, overridden)
    timers.advance(150)
    expect(prefetchFrame).toHaveBeenCalledWith(
      new URL('./partials/hat?size=small', document.baseURI).href,
      { target: 'details' },
    )
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
    expect(prefetchFrame).toHaveBeenCalledWith(current.href, { target: 'details' })

    let top = createIntentLink('/products/top')
    top.setAttribute('data-rmx-target', '')
    top.setAttribute('data-rmx-src', '/ignored')
    press(top)
    expect(prefetchFrame).toHaveBeenCalledWith(top.href)
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
    expect(prefetchFrame).toHaveBeenCalledWith(new URL('/partial', location.href).href, {
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
    for (let call of fetch.mock.calls) {
      let [input, init] = call.arguments
      expect(input).toBe(src)
      let headers = new Headers(init?.headers)
      expect(headers.get('Accept')).toBe('text/html')
      expect(headers.get('X-Remix-Frame')).toBe('true')
      expect(headers.get('X-Remix-Target')).toBe('details')
    }
  })

  it('fetches HTML with low priority and frame headers by default', async (t) => {
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
  })

  describe('viewport', () => {
    it('waits for initially hidden documents to become visible before scheduling work', (t) => {
      let setHidden = stubDocumentVisibility(t, true)
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      intersections.queue(anchor, true)
      intersections.deliver()

      expect(idle.pending).toBe(0)
      idle.flush({ didTimeout: true, timeRemaining: () => 0 })
      expect(prefetchFrame).not.toHaveBeenCalled()

      setHidden(false)
      intersections.queue(anchor, true)
      intersections.deliver()
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
    })

    it('pauses queued viewport work and refreshes intersections when the document returns', async (t) => {
      let setHidden = stubDocumentVisibility(t)
      let prefetchFrame = mock.fn()
      let passed = createViewportLink('/passed')
      let download = createViewportLink('/download')
      let visible = createViewportLink('/visible')
      startTestPrefetching(t, prefetchFrame)
      expect(await readIntersection(passed)).toBe(true)
      expect(await readIntersection(download)).toBe(true)
      expect(await readIntersection(visible)).toBe(true)
      expect(idle.pending).toBe(1)

      setHidden(true)
      expect(idle.pending).toBe(0)
      idle.flush({ didTimeout: true, timeRemaining: () => 0 })
      expect(prefetchFrame).not.toHaveBeenCalled()
      passed.style.top = `${innerHeight + 100}px`
      download.setAttribute('download', '')

      setHidden(false)
      idle.flush()
      expect(prefetchFrame).not.toHaveBeenCalled()
      expect(await readViewportIntersection(passed)).toBe(false)
      expect(await readViewportIntersection(visible)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(visible.href)
    })

    it('pauses queued viewport work with the timer fallback and never resumes after disposal', (t) => {
      let timers = t.useFakeTimers()
      Object.defineProperty(globalThis, 'requestIdleCallback', { value: undefined })
      let setHidden = stubDocumentVisibility(t)
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      let controller = new AbortController()
      t.after(() => controller.abort())
      startPrefetching(controller.signal, prefetchFrame)
      intersections.queue(anchor, true)
      intersections.deliver()

      setHidden(true)
      timers.advance(0)
      expect(prefetchFrame).not.toHaveBeenCalled()
      setHidden(false)
      intersections.queue(anchor, true)
      intersections.deliver()
      timers.advance(0)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      let pending = createViewportLink('/products/hat')
      intersections.queue(pending, true)
      intersections.deliver()
      setHidden(true)
      controller.abort()
      setHidden(false)
      intersections.queue(pending, true)
      intersections.deliver()
      timers.advance(0)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
    })

    it('waits for idle time and yields when the idle budget is exhausted', (t) => {
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let first = createViewportLink('/first')
      let second = createViewportLink('/second')
      startTestPrefetching(t, prefetchFrame)
      intersections.queue(first, true)
      intersections.queue(second, true)
      intersections.deliver()

      expect(prefetchFrame).not.toHaveBeenCalled()
      expect(idle.pending).toBe(1)
      expect(idle.timeout).toBe(1000)
      idle.flush({
        didTimeout: false,
        timeRemaining: () => (prefetchFrame.mock.calls.length ? 0 : 5),
      })
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(first.href)
      expect(idle.pending).toBe(1)

      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(prefetchFrame).toHaveBeenCalledWith(second.href)
      expect(idle.pending).toBe(0)
    })

    it('starts one prefetch when the idle timeout expires without spare time', (t) => {
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let first = createViewportLink('/first')
      let second = createViewportLink('/second')
      startTestPrefetching(t, prefetchFrame)
      intersections.queue(first, true)
      intersections.queue(second, true)
      intersections.deliver()

      idle.flush({ didTimeout: true, timeRemaining: () => 0 })
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(idle.pending).toBe(1)
      idle.flush({ didTimeout: true, timeRemaining: () => 0 })
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(idle.pending).toBe(0)
    })

    it('rechecks queued exits, removed links, and eligibility before idle work starts', (t) => {
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let passed = createViewportLink('/passed')
      let removed = createViewportLink('/removed')
      let download = createViewportLink('/download')
      let visible = createViewportLink('/visible')
      startTestPrefetching(t, prefetchFrame)
      intersections.queue(passed, true)
      intersections.queue(removed, true)
      intersections.queue(download, true)
      intersections.queue(visible, true)
      intersections.deliver()

      intersections.queue(passed, false)
      removed.remove()
      download.setAttribute('download', '')
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(visible.href)
    })

    it('checks connection settings again when idle work starts', (t) => {
      let intersections = stubViewportIntersections(t)
      let connection = { saveData: false }
      stubConnection(t, connection)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      intersections.queue(anchor, true)
      intersections.deliver()

      connection.saveData = true
      idle.flush()
      expect(prefetchFrame).not.toHaveBeenCalled()
      expect(idle.pending).toBe(0)

      connection.saveData = false
      intersections.queue(anchor, false)
      intersections.queue(anchor, true)
      intersections.deliver()
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
    })

    it('keeps intent immediate and cancels pending idle work when disposed', (t) => {
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let controller = new AbortController()
      t.after(() => controller.abort())
      let viewport = createViewportLink('/viewport')
      let intent = createIntentLink('/intent')
      startPrefetching(controller.signal, prefetchFrame)
      intersections.queue(viewport, true)
      intersections.deliver()

      press(intent)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(intent.href)
      controller.abort()
      expect(idle.pending).toBe(0)
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
    })

    it('yields through a timer when idle callbacks are unavailable', (t) => {
      let timers = t.useFakeTimers()
      Object.defineProperty(globalThis, 'requestIdleCallback', { value: undefined })
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      intersections.queue(anchor, true)
      intersections.deliver()

      expect(prefetchFrame).not.toHaveBeenCalled()
      timers.advance(0)
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
    })

    it('prefetches initial named-frame links and observes changes to source and target', async (t) => {
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      anchor.setAttribute('data-rmx-target', 'details')
      anchor.setAttribute('data-rmx-src', '/partials/shirt#details')
      await startNamedFramePrefetching(t, prefetchFrame, anchor)

      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledWith(new URL('/partials/shirt', location.href).href, {
        target: 'details',
      })
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.setAttribute('data-rmx-src', '/partials/shirt#reviews')
      anchor.href = '/products/another-navigation-url'
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.setAttribute('data-rmx-src', '/partials/hat')
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(prefetchFrame).toHaveBeenCalledWith(new URL('/partials/hat', location.href).href, {
        target: 'details',
      })

      anchor.setAttribute('data-rmx-target', 'sidebar')
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(3)
      expect(prefetchFrame).toHaveBeenCalledWith(new URL('/partials/hat', location.href).href, {
        target: 'sidebar',
      })

      anchor.setAttribute('data-rmx-target', 'missing')
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(3)
      anchor.removeAttribute('data-rmx-target')
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(4)
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
    })

    it('prefetches existing links only when they enter the viewport', async (t) => {
      let prefetchFrame = mock.fn()
      let visible = createViewportLink('/products/visible')
      let offscreen = createViewportLink('/products/offscreen', false)
      startTestPrefetching(t, prefetchFrame)

      expect(await readViewportIntersection(visible)).toBe(true)
      expect(await readViewportIntersection(offscreen)).toBe(false)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(visible.href)

      offscreen.style.top = '0px'
      expect(await readViewportIntersection(offscreen)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(prefetchFrame).toHaveBeenCalledWith(offscreen.href)
    })

    it('discovers links in newly inserted subtrees and links marked after insertion', async (t) => {
      let prefetchFrame = mock.fn()
      startTestPrefetching(t, prefetchFrame)
      let subtree = document.createElement('section')
      let added = createViewportLink('/products/added')
      subtree.append(added)
      document.body.append(subtree)
      expect(await readViewportIntersection(added)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledWith(added.href)

      let markedLater = createIntentLink('/products/marked-later')
      markedLater.style.cssText = added.style.cssText
      expect(await readViewportIntersection(markedLater)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      markedLater.setAttribute('data-rmx-prefetch', 'viewport')
      expect(await readViewportIntersection(markedLater)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(prefetchFrame).toHaveBeenCalledWith(markedLater.href)
    })

    it('does not repeat on reentry or fragment changes but observes changed destinations', async (t) => {
      let timers = t.useFakeTimers()
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt#details')
      startTestPrefetching(t, prefetchFrame)
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(new URL('/products/shirt', location.href).href)

      anchor.style.top = `${innerHeight + 100}px`
      expect(await readViewportIntersection(anchor)).toBe(false)
      anchor.style.top = '0px'
      expect(await readViewportIntersection(anchor)).toBe(true)
      press(anchor)
      anchor.focus()
      timers.advance(150)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.hash = 'reviews'
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.href = '/products/hat'
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
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

      expect(await readViewportIntersection(download)).toBe(true)
      expect(prefetchFrame).not.toHaveBeenCalled()

      download.removeAttribute('download')
      expect(await readViewportIntersection(download)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(download.href)
    })

    it('does not prefetch a removed link and can prefetch it when mounted again', async (t) => {
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      anchor.remove()
      expect(await readViewportIntersection(anchor)).toBe(false)
      expect(prefetchFrame).not.toHaveBeenCalled()

      document.body.append(anchor)
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.remove()
      expect(await readViewportIntersection(anchor)).toBe(false)
      document.body.append(anchor)
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
    })

    it('rechecks eligibility before using queued intersection notifications', async (t) => {
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      anchor.setAttribute('data-rmx-prefetch', 'intent')
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(prefetchFrame).not.toHaveBeenCalled()

      anchor.setAttribute('data-rmx-prefetch', 'viewport')
      expect(await readViewportIntersection(anchor)).toBe(true)
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
      expect(await readViewportIntersection(anchor)).toBe(true)
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
      idle.flush()
      expect(prefetchFrame).not.toHaveBeenCalled()

      scroller.dispatchEvent(new Event('scroll'))
      timers.advance(149)
      idle.flush()
      expect(prefetchFrame).not.toHaveBeenCalled()

      timers.advance(1)
      expect(prefetchFrame).not.toHaveBeenCalled()
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
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
      idle.flush()
      expect(prefetchFrame).not.toHaveBeenCalled()

      intersections.queue(anchor, true)
      intersections.deliver()
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
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
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(visible.href)

      intersections.queue(passed, true)
      intersections.deliver()
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(prefetchFrame).toHaveBeenCalledWith(passed.href)
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
      idle.flush()
      expect(prefetchFrame).not.toHaveBeenCalled()

      connection.saveData = false
      intersections.queue(anchor, false)
      intersections.queue(anchor, true)
      intersections.deliver()
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
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
      idle.flush()
      expect(prefetchFrame).not.toHaveBeenCalled()
    })

    it('waits for scrolling to settle when a scroll interrupts queued idle work', (t) => {
      let timers = t.useFakeTimers()
      let intersections = stubViewportIntersections(t)
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      startTestPrefetching(t, prefetchFrame)
      intersections.queue(anchor, true)
      intersections.deliver()
      expect(idle.pending).toBe(1)

      document.dispatchEvent(new Event('scroll'))
      expect(idle.pending).toBe(0)
      idle.flush({ didTimeout: true, timeRemaining: () => 0 })
      timers.advance(149)
      expect(prefetchFrame).not.toHaveBeenCalled()
      expect(idle.pending).toBe(0)

      timers.advance(1)
      expect(prefetchFrame).not.toHaveBeenCalled()
      expect(idle.pending).toBe(1)
      idle.flush()
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
    })

    it('stops observing existing and newly inserted links when disposed', async () => {
      let prefetchFrame = mock.fn()
      let controller = new AbortController()
      let anchor = createViewportLink('/products/shirt', false)
      startPrefetching(controller.signal, prefetchFrame)
      expect(await readViewportIntersection(anchor)).toBe(false)
      controller.abort()

      anchor.style.top = '0px'
      let added = createViewportLink('/products/added')
      expect(await readViewportIntersection(anchor)).toBe(true)
      expect(await readViewportIntersection(added)).toBe(true)
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
      expect(prefetchFrame).toHaveBeenCalledWith(intent.href)
    })
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

  it('prefetches explicit image preload URLs, including nested templates', async (t) => {
    stubLinkPrefetchSupport(t, true)
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse(`<base href="/images/">
        <link rel="preload" as="image" href="hero.jpg" crossorigin="anonymous"
          referrerpolicy="no-referrer" fetchpriority="high">
        <template><link rel="preload" as="image" href="detail.jpg"></template>
        <img src="not-prefetched.jpg">
        <link rel="preload" as="fetch" href="not-prefetched.json">`),
    )
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)

    await prefetch(new URL('/page', location.href).href)

    expect(hints.map((link) => new URL(link.href).pathname)).toEqual([
      '/images/hero.jpg',
      '/images/detail.jpg',
    ])
    expect(hints.every((link) => link.as === 'image' && link.fetchPriority === 'low')).toBe(true)
    expect(hints[0].crossOrigin).toBe('anonymous')
    expect(hints[0].referrerPolicy).toBe('no-referrer')
    expect(hints[1].hasAttribute('crossorigin')).toBe(false)
    expect(hints.every((link) => !link.isConnected)).toBe(true)
  })

  it('skips active image preloads, responsive candidates, and unmatched image media', async (t) => {
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

    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/images/screen.jpg'])
    expect(hints[0].as).toBe('image')
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
