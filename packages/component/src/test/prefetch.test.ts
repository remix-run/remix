import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { Frame } from '../runtime/frame.ts'
import { jsx } from '../runtime/core/vnode.ts'
import {
  createDefaultPrefetch,
  prefetch,
  startPrefetching,
  type PrefetchFrame,
  type PrefetchConfig,
} from '../runtime/prefetch.ts'
import type { PrefetchLink } from '../index.ts'
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
  anchor.style.cssText = `position: fixed; left: 0; top: ${visible ? 0 : 100000}px; width: 20px; height: 20px`
  return anchor
}

function readIntersection(anchor: HTMLAnchorElement): Promise<boolean> {
  return new Promise((resolve) => {
    let observer = new IntersectionObserver(([entry]) => {
      observer.disconnect()
      setTimeout(() => resolve(entry.isIntersecting), 0)
    })
    observer.observe(anchor)
  })
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(condition: () => boolean) {
  let deadline = Date.now() + 2000
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for prefetch work')
    await wait(10)
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

function createPrefetch(t: TestContext, config?: PrefetchConfig) {
  let controller = new AbortController()
  t.after(() => controller.abort())
  return { prefetch: createDefaultPrefetch(controller.signal, config), controller }
}

function collectHints(t: TestContext, onHint?: (link: HTMLLinkElement) => void): HTMLLinkElement[] {
  let hints: HTMLLinkElement[] = []
  let observer = new MutationObserver((records) => {
    for (let record of records) {
      for (let node of record.addedNodes) {
        if (node instanceof HTMLLinkElement && ['prefetch', 'preload'].includes(node.rel)) {
          hints.push(node)
          node.dispatchEvent(new Event('load'))
          onHint?.(node)
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

function holdNativeHintEvents(t: TestContext) {
  let controller = new AbortController()
  t.after(() => controller.abort())
  for (let type of ['load', 'error'])
    document.head.addEventListener(
      type,
      (event) => {
        if (event.isTrusted && event.target instanceof HTMLLinkElement)
          event.stopImmediatePropagation()
      },
      { capture: true, signal: controller.signal },
    )
}

function htmlResponse(html: string) {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
  })
}

describe('prefetch', () => {
  afterEach(() => {
    document.body.textContent = ''
  })

  it('skips intent and viewport prefetching when Save-Data is enabled', async (t) => {
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
    await wait(150)

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
      expect(prefetchFrame).toHaveBeenCalledWith(pressed.href)
      let visible = createViewportLink(`/products/viewport-${effectiveType}`)
      expect(await readIntersection(visible)).toBe(true)
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
    expect(await readIntersection(visible)).toBe(true)

    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expect(prefetchFrame).toHaveBeenCalledWith(pressed.href)
    expect(prefetchFrame).toHaveBeenCalledWith(visible.href)
  })

  it('checks connection settings after the intent delay and allows a later press', async (t) => {
    let connection = { saveData: false }
    stubConnection(t, connection)
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    movePointer(document.body, anchor)
    connection.saveData = true
    await wait(150)
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
    expect(await readIntersection(anchor)).toBe(true)
    expect(prefetchFrame).not.toHaveBeenCalled()

    anchor.style.top = `100000px`
    expect(await readIntersection(anchor)).toBe(false)
    connection.effectiveType = '4g'
    anchor.style.top = '0px'
    expect(await readIntersection(anchor)).toBe(true)
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
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let hovered = createIntentLink('/products/hovered')
    let focused = createIntentLink('/products/focused')

    hovered.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    expect(prefetchFrame).not.toHaveBeenCalled()
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledWith(hovered.href)

    focused.focus()
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledWith(focused.href)
  })

  it('cancels the prefetch when the pointer leaves before the intent delay', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    anchor.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    anchor.dispatchEvent(
      new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }),
    )
    await wait(150)

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
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')
    let first = document.createElement('span')
    let second = document.createElement('span')
    anchor.replaceChildren(first, second)

    movePointer(document.body, first)
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    movePointer(first, second)
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    movePointer(second, document.body)
    movePointer(document.body, first)
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
  })

  it('keeps keyboard focus intent when the pointer enters and leaves another link', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let focused = createIntentLink('/products/focused')
    let hovered = createIntentLink('/products/hovered')

    focused.focus()
    movePointer(document.body, hovered)
    movePointer(hovered, document.body)
    await wait(150)

    expect(document.activeElement).toBe(focused)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expect(prefetchFrame).toHaveBeenCalledWith(focused.href)
  })

  it('prefetches separate hovered and focused links without replacing either intent', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let focused = createIntentLink('/products/focused')
    let hovered = createIntentLink('/products/hovered')

    focused.focus()
    movePointer(document.body, hovered)
    await wait(150)

    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expect(prefetchFrame).toHaveBeenCalledWith(focused.href)
    expect(prefetchFrame).toHaveBeenCalledWith(hovered.href)
  })

  it('keeps hover intent when another link loses focus', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let focused = createIntentLink('/products/focused')
    let hovered = createIntentLink('/products/hovered')

    focused.focus()
    movePointer(document.body, hovered)
    focused.blur()
    await wait(150)

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expect(prefetchFrame).toHaveBeenCalledWith(hovered.href)
  })

  it('keeps focus intent when the pointer leaves the same link', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    movePointer(document.body, anchor)
    anchor.focus()
    movePointer(anchor, document.body)
    await wait(150)

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('keeps hover intent when the same link loses focus', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    anchor.focus()
    movePointer(document.body, anchor)
    anchor.blur()
    await wait(150)

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('does not repeat completed hover prefetch on press or focus', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    movePointer(document.body, anchor)
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    press(anchor)
    anchor.focus()
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('prefetches on an early press without repeating after the hover or focus delay', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let anchor = createIntentLink('/products/shirt')

    movePointer(document.body, anchor)
    press(anchor)
    anchor.focus()
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('prefetches touch and pen presses immediately without repeating on focus', async (t) => {
    let prefetchFrame = mock.fn()
    startTestPrefetching(t, prefetchFrame)
    let touched = createIntentLink('/products/touched')
    let penned = createIntentLink('/products/penned')

    press(touched, 'touch')
    touched.focus()
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    press(penned, 'pen')
    penned.focus()
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    await wait(150)
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
  })

  it('cancels pending hover and focus intent when disposed', async () => {
    let prefetchFrame = mock.fn()
    let controller = new AbortController()
    startPrefetching(controller.signal, prefetchFrame)
    let hovered = createIntentLink('/products/hovered')
    let focused = createIntentLink('/products/focused')

    movePointer(document.body, hovered)
    focused.focus()
    controller.abort()
    press(hovered)
    await wait(150)

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
    let anchor = createIntentLink('/products/shirt')
    anchor.setAttribute('data-rmx-target', 'details')
    press(anchor)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href, { target: 'details' })

    let overridden = createIntentLink('/products/hat')
    overridden.setAttribute('data-rmx-target', 'details')
    overridden.setAttribute('data-rmx-src', './partials/hat?size=small#details')
    movePointer(document.body, overridden)
    await wait(150)
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

  it('preserves the run prefetch function shorthand and target context', async (t) => {
    let prefetchFrame = mock.fn()
    let app = run({
      loadModule: mock.fn(),
      prefetch(src, options) {
        prefetchFrame(src, options)
      },
    })
    t.after(() => app.dispose())
    await app.ready()
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

    await Promise.resolve()
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
    it('prefetches initial named-frame links and observes changes to source and target', async (t) => {
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      anchor.setAttribute('data-rmx-target', 'details')
      anchor.setAttribute('data-rmx-src', '/partials/shirt#details')
      await startNamedFramePrefetching(t, prefetchFrame, anchor)

      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledWith(new URL('/partials/shirt', location.href).href, {
        target: 'details',
      })
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.setAttribute('data-rmx-src', '/partials/shirt#reviews')
      anchor.href = '/products/another-navigation-url'
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.setAttribute('data-rmx-src', '/partials/hat')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(prefetchFrame).toHaveBeenCalledWith(new URL('/partials/hat', location.href).href, {
        target: 'details',
      })

      anchor.setAttribute('data-rmx-target', 'sidebar')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(3)
      expect(prefetchFrame).toHaveBeenCalledWith(new URL('/partials/hat', location.href).href, {
        target: 'sidebar',
      })

      anchor.setAttribute('data-rmx-target', 'missing')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(3)
      anchor.removeAttribute('data-rmx-target')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(4)
      expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
    })

    it('prefetches existing links only when they enter the viewport', async (t) => {
      let prefetchFrame = mock.fn()
      let visible = createViewportLink('/products/visible')
      let offscreen = createViewportLink('/products/offscreen', false)
      startTestPrefetching(t, prefetchFrame)

      expect(await readIntersection(visible)).toBe(true)
      expect(await readIntersection(offscreen)).toBe(false)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(visible.href)

      offscreen.style.top = '0px'
      expect(await readIntersection(offscreen)).toBe(true)
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
      expect(await readIntersection(added)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledWith(added.href)

      let markedLater = createIntentLink('/products/marked-later')
      markedLater.style.cssText = added.style.cssText
      expect(await readIntersection(markedLater)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      markedLater.setAttribute('data-rmx-prefetch', 'viewport')
      expect(await readIntersection(markedLater)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(2)
      expect(prefetchFrame).toHaveBeenCalledWith(markedLater.href)
    })

    it('does not repeat on reentry or fragment changes but observes changed destinations', async (t) => {
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt#details')
      startTestPrefetching(t, prefetchFrame)
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(new URL('/products/shirt', location.href).href)

      anchor.style.top = `100000px`
      expect(await readIntersection(anchor)).toBe(false)
      anchor.style.top = '0px'
      expect(await readIntersection(anchor)).toBe(true)
      press(anchor)
      anchor.focus()
      await wait(150)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.hash = 'reviews'
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)

      anchor.href = '/products/hat'
      expect(await readIntersection(anchor)).toBe(true)
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

      expect(await readIntersection(download)).toBe(true)
      expect(prefetchFrame).not.toHaveBeenCalled()

      download.removeAttribute('download')
      expect(await readIntersection(download)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      expect(prefetchFrame).toHaveBeenCalledWith(download.href)
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
      let prefetchFrame = mock.fn()
      let anchor = createViewportLink('/products/shirt')
      anchor.setAttribute('data-rmx-prefetch', 'intent')
      startTestPrefetching(t, prefetchFrame)
      movePointer(document.body, anchor)

      anchor.setAttribute('data-rmx-prefetch', 'viewport')
      expect(await readIntersection(anchor)).toBe(true)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
      await wait(150)
      expect(prefetchFrame).toHaveBeenCalledTimes(1)
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
      expect(prefetchFrame).toHaveBeenCalledWith(intent.href)
    })
  })
})

describe('default frame prefetch', () => {
  it('scans embedded assets without fetching unmarked frames or native fetch preloads', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let html = await drain(
      renderToStream(jsx(Frame, { name: 'details', src: '/details', fallback: 'Loading' }), {
        resolveFrame: () => '<script src="/embedded.js"></script>',
      }),
    )
    let fetch = t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse(`<link rel="preload" as="fetch" href="/details">${html}`),
    )
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)

    await prefetch(new URL('/page', location.href).href)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/embedded.js'])
  })

  it('prefetches only frames with prefetch=true and discovers their assets by default', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let rootHtml = await drain(
      renderToStream(
        jsx('main', {
          children: [
            jsx(Frame, { name: 'details', src: './details#content', prefetch: true }),
            jsx(Frame, { name: 'disabled', src: '/disabled', prefetch: false }),
            jsx(Frame, { src: '/not-prefetched' }),
          ],
        }),
        { resolveFrame: () => 'Details' },
      ),
    )
    let fetch = t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      let url = new URL(String(src))
      let response = htmlResponse(
        url.pathname === '/page'
          ? `<base href="/partials/">${rootHtml}`
          : '<script type="module" src="./entry.js"></script>',
      )
      Object.defineProperty(response, 'url', {
        value: new URL(
          url.pathname === '/page' ? '/pages/final' : '/redirected/details',
          location.href,
        ).href,
      })
      return response
    })
    let hinted = Promise.withResolvers<void>()
    let hints = collectHints(t, () => hinted.resolve())
    document.body.textContent = ''
    let app = run({ loadModule: mock.fn() })
    t.after(() => app.dispose())
    await app.ready()

    prefetch('/page')
    await hinted.promise

    expect(fetch.mock.calls.map((call) => new URL(String(call.arguments[0])).pathname)).toEqual([
      '/page',
      '/partials/details',
    ])
    expect(
      fetch.mock.calls.map((call) => new Headers(call.arguments[1]?.headers).get('X-Remix-Target')),
    ).toEqual([null, 'details'])
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/redirected/entry.js'])
  })

  it('recursively discovers opted-in frames in templates and deduplicates cycles by source and target', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let fetch = t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      switch (new URL(String(src)).pathname) {
        case '/page':
          return htmlResponse(`<script type="application/json" id="rmx-data">{"f":{
            "details":{"src":"/shared","name":"details","prefetch":true},
            "duplicate":{"src":"/shared#duplicate","name":"details","prefetch":true},
            "sidebar":{"src":"/shared","name":"sidebar","prefetch":true}
          }}</script>`)
        case '/shared':
          return htmlResponse(`<script src="/shared.js"></script>
            <script type="application/json" id="rmx-data">{"f":{"cycle":{"src":"/page","prefetch":true}}}</script>
            <template><template><script type="application/json" id="rmx-data">
              {"f":{"leaf":{"src":"/leaf","prefetch":true}}}
            </script></template></template>`)
        case '/leaf':
          return htmlResponse(`<link rel="stylesheet" href="/leaf.css">
            <script type="application/json" id="rmx-data">{"f":{"deep":{"src":"/deep","prefetch":true}}}</script>`)
        case '/deep':
          return htmlResponse('<link rel="preload" as="font" href="/deep.woff2" crossorigin>')
        default:
          throw new Error('Unexpected nested-frame request')
      }
    })
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t, { links: { concurrency: 1 } })

    await prefetch(new URL('/page', location.href).href)

    expect(
      fetch.mock.calls.map((call) => [
        new URL(String(call.arguments[0])).pathname,
        new Headers(call.arguments[1]?.headers).get('X-Remix-Target'),
      ]),
    ).toEqual([
      ['/page', null],
      ['/shared', 'details'],
      ['/shared', 'sidebar'],
      ['/leaf', null],
      ['/deep', null],
    ])
    expect(hints.map((link) => new URL(link.href).pathname)).toContain('/shared.js')
    expect(hints.map((link) => new URL(link.href).pathname)).toContain('/leaf.css')
    expect(hints.map((link) => new URL(link.href).pathname)).toContain('/deep.woff2')
  })

  it('ignores malformed metadata and ineligible frames without losing valid sibling assets', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let fetch = t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      if (new URL(String(src)).pathname === '/page') {
        return htmlResponse(`<script src="/page.js"></script>
          <script type="application/json" id="rmx-data">invalid JSON</script>
          <script type="application/json" id="rmx-data">null</script>
          <script type="application/json" id="rmx-data">{"f":[{"src":"/array","prefetch":true}]}</script>
          <script type="application/json" id="rmx-data">{"f":{
            "null":null,"number":42,"missing":{"prefetch":true},
            "empty":{"src":"","prefetch":true},"invalid":{"src":"http://[","prefetch":true},
            "crossOrigin":{"src":"https://example.com/frame","prefetch":true},
            "data":{"src":"data:text/html,frame","prefetch":true},
            "badTarget":{"src":"/bad","name":42,"prefetch":true},
            "stringFlag":{"src":"/string","prefetch":"true"},
            "failed":{"src":"/failed","prefetch":true},"json":{"src":"/json","prefetch":true},
            "valid":{"src":"/valid?size=small#content","prefetch":true}
          }}</script>`)
      }
      if (new URL(String(src)).pathname === '/failed') {
        return new Response('Unavailable', { status: 503 })
      }
      if (new URL(String(src)).pathname === '/json') {
        return new Response('<script src="/ignored.js"></script>', {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return htmlResponse('<link rel="preload" as="image" href="/valid.jpg">')
    })
    let hints = collectHints(t)
    let { prefetch } = createPrefetch(t)

    await prefetch(new URL('/page', location.href).href)

    expect(fetch.mock.calls.map((call) => new URL(String(call.arguments[0])).pathname)).toEqual([
      '/page',
      '/failed',
      '/json',
      '/valid',
    ])
    expect(new URL(String(fetch.mock.calls[3].arguments[0])).search).toBe('?size=small')
    expect(new URL(String(fetch.mock.calls[3].arguments[0])).hash).toBe('')
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/page.js', '/valid.jpg'])
  })

  it('does not make speculative requests while hydrating frames marked for prefetch on a normal load', async (t) => {
    let html = await drain(
      renderToStream(jsx(Frame, { name: 'details', src: '/details', prefetch: true }), {
        resolveFrame: () => '<p>Server-rendered details</p>',
      }),
    )
    document.body.innerHTML = html
    expect(document.querySelector('link[rel="preload"][as="fetch"], link[rel="prefetch"]')).toBe(
      null,
    )
    let fetch = t.mock.method(globalThis, 'fetch', async () => htmlResponse(''))
    let app = run({ loadModule: mock.fn() })
    t.after(() => {
      app.dispose()
      document.body.textContent = ''
    })

    await app.ready()

    expect(app.frames.get('details')).toBeDefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shares overlapping recursive requests without waiting on a cycle', async (t) => {
    let fetch = t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) =>
      htmlResponse(
        `<script type="application/json" id="rmx-data">{"f":{"next":{
          "src":"${new URL(String(src)).pathname === '/first' ? '/second' : '/first'}","prefetch":true
        }}}</script>`,
      ),
    )
    let { prefetch } = createPrefetch(t)

    await Promise.all([
      prefetch(new URL('/first', location.href).href),
      prefetch(new URL('/second', location.href).href),
    ])

    expect(fetch).toHaveBeenCalledTimes(2)
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

  it('selects responsive preloads while skipping active images and unmatched media', async (t) => {
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
      new URL('/images/fallback.jpg', location.href).href,
      null,
      new URL('/images/screen.jpg', location.href).href,
    ])
    expect(hints[0].rel).toBe('preload')
    expect(hints[0].imageSrcset).toBe(
      `${new URL('/images/small.jpg', location.href).href} 400w, ${new URL('/images/large.jpg', location.href).href} 1200w`,
    )
    expect(hints[0].imageSizes).toBe('100vw')
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
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(1)
    response.resolve(htmlResponse('<main>Next</main>'))
    await Promise.all([first, second])
    response = Promise.withResolvers<Response>()
    let third = prefetch(src)
    await Promise.resolve()
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

    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(
      fetch.mock.calls.map((call) => new Headers(call.arguments[1]?.headers).get('X-Remix-Target')),
    ).toEqual([null, 'details', 'sidebar'])
    response.resolve()
    await Promise.all(requests)
  })

  it('deduplicates pending asset hints across pages and targets and removes failed hints', async (t) => {
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
          if (node instanceof HTMLLinkElement && ['prefetch', 'preload'].includes(node.rel)) {
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

    await Promise.resolve()
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

  it('cancels nested speculative HTML and removes pending asset links on disposal', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let nestedStarted = Promise.withResolvers<AbortSignal | null | undefined>()
    let fetch = t.mock.method(
      globalThis,
      'fetch',
      async (src: RequestInfo | URL, init?: RequestInit) => {
        if (new URL(String(src)).pathname === '/page') {
          return htmlResponse(`<script src="/pending.js"></script>
          <script type="application/json" id="rmx-data">{"f":{"nested":{"src":"/nested","prefetch":true}}}</script>`)
        }
        let response = Promise.withResolvers<Response>()
        init?.signal?.addEventListener('abort', () => response.reject(init.signal?.reason), {
          once: true,
        })
        nestedStarted.resolve(init?.signal)
        return response.promise
      },
    )
    let { prefetch, controller } = createPrefetch(t)
    let linked = Promise.withResolvers<HTMLLinkElement>()
    let observer = new MutationObserver((records) => {
      for (let record of records) {
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && ['prefetch', 'preload'].includes(node.rel))
            linked.resolve(node)
        }
      }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())

    let ready = prefetch(new URL('/page', location.href).href)
    let link = await linked.promise
    let nestedSignal = await nestedStarted.promise
    controller.abort()
    await ready

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(nestedSignal?.aborted).toBe(true)
    expect(link.isConnected).toBe(false)
  })
})

describe('prefetch selection', () => {
  afterEach(() => {
    document.body.textContent = ''
  })

  it('rejects invalid independent concurrency limits before starting the runtime', () => {
    expect(() => run({ loadModule: mock.fn(), prefetch: { links: { concurrency: 0 } } })).toThrow(
      RangeError,
    )
    expect(() =>
      run({ loadModule: mock.fn(), prefetch: { assets: { concurrency: 1.5 } } }),
    ).toThrow(RangeError)
    expect(() =>
      run({ loadModule: mock.fn(), prefetch: { links: { concurrency: Infinity } } }),
    ).toThrow(RangeError)
  })

  it('starts all selected HTML and asset work when concurrency is omitted', async (t) => {
    stubLinkPrefetchSupport(t, true)
    holdNativeHintEvents(t)
    let response = Promise.withResolvers<void>()
    let starts: string[] = []
    t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      let path = new URL(String(src)).pathname
      starts.push(path)
      await response.promise
      return htmlResponse(
        `<script src="${path}-1.js"></script><script src="${path}-2.js"></script>`,
      )
    })
    let hints: HTMLLinkElement[] = []
    let observer = new MutationObserver((records) => {
      for (let record of records)
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'prefetch') hints.push(node)
        }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())
    let { prefetch: load } = createPrefetch(t, {
      links: { scheduler: (batch) => batch },
      assets: { scheduler: (batch) => batch },
    })
    let ready = Promise.all(
      ['/a', '/b', '/c', '/d', '/e'].map((src) => load(new URL(src, location.href).href)),
    )
    await waitFor(() => starts.length === 5)
    expect(starts).toEqual(['/a', '/b', '/c', '/d', '/e'])
    response.resolve()
    await waitFor(() => hints.length === 10)
    expect(hints.every((link) => link.isConnected)).toBe(true)
    for (let link of hints) link.dispatchEvent(new Event('load'))
    await ready
    expect(hints.every((link) => !link.isConnected)).toBe(true)
  })

  it('bounds HTML reads, preserves selected order, and drains cached selection on completion', async (t) => {
    let responses = new Map<string, ReturnType<typeof Promise.withResolvers<Response>>>()
    let starts: string[] = []
    let active = 0
    let peak = 0
    t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      let path = new URL(String(src)).pathname
      starts.push(path)
      active++
      peak = Math.max(peak, active)
      let response = Promise.withResolvers<Response>()
      responses.set(path, response)
      let value = await response.promise
      active--
      return value
    })
    let links = mock.fn((batch: readonly PrefetchLink[]) => [...batch].reverse())
    let { prefetch: load } = createPrefetch(t, { links: { concurrency: 2, scheduler: links } })
    let ready = Promise.all(
      ['/a', '/b', '/c', '/d'].map((src) => load(new URL(src, location.href).href)),
    )
    await wait(0)
    expect(starts).toEqual(['/d', '/c'])
    expect(links).toHaveBeenCalledTimes(1)
    responses.get('/d')?.resolve(htmlResponse(''))
    await waitFor(() => starts.length === 3)
    expect(starts).toEqual(['/d', '/c', '/b'])
    expect(links).toHaveBeenCalledTimes(1)
    responses.get('/c')?.resolve(htmlResponse(''))
    await waitFor(() => starts.length === 4)
    expect(starts).toEqual(['/d', '/c', '/b', '/a'])
    responses.get('/a')?.resolve(htmlResponse(''))
    responses.get('/b')?.resolve(htmlResponse(''))
    await ready
    expect(peak).toBe(2)
    expect(links).toHaveBeenCalledTimes(1)
  })

  it('drops omissions without reviving them on invalidation and accepts a new attempt', async (t) => {
    let fetch = t.mock.method(globalThis, 'fetch', async () => htmlResponse(''))
    let allow = false
    let links = mock.fn((batch: readonly PrefetchLink[]) => (allow ? [...batch, ...batch] : []))
    let strategy = createDefaultPrefetch(undefined, { links: { scheduler: links } })
    await strategy(new URL('/dropped', location.href).href)
    allow = true
    strategy.invalidate()
    await wait(0)
    expect(fetch).not.toHaveBeenCalled()
    await strategy(new URL('/dropped', location.href).href)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refreshes stale pending selection lazily when an HTML slot opens', async (t) => {
    let gate = Promise.withResolvers<Response>()
    let starts: string[] = []
    t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      let path = new URL(String(src)).pathname
      starts.push(path)
      return path === '/busy' ? gate.promise : htmlResponse('')
    })
    let reverse = false
    let links = mock.fn((batch: readonly PrefetchLink[]) =>
      reverse ? [...batch].reverse() : batch,
    )
    let strategy = createDefaultPrefetch(undefined, { links: { concurrency: 1, scheduler: links } })
    let busy = strategy(new URL('/busy', location.href).href)
    await wait(0)
    let next = strategy(new URL('/next', location.href).href)
    let last = strategy(new URL('/last', location.href).href)
    reverse = true
    strategy.invalidate()
    strategy.invalidate()
    await wait(0)
    expect(links).toHaveBeenCalledTimes(1)
    gate.resolve(htmlResponse(''))
    await Promise.all([busy, next, last])
    expect(starts).toEqual(['/busy', '/last', '/next'])
    expect(links).toHaveBeenCalledTimes(2)
  })

  it('tracks shared live anchors and keeps a request until its last owner disappears', async (t) => {
    let signals: AbortSignal[] = []
    t.mock.method(globalThis, 'fetch', (_src: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.signal) throw new Error('Missing prefetch signal')
      signals.push(init.signal)
      return new Promise<Response>((_resolve, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      )
    })
    let first = createIntentLink('/shared-owner')
    let second = createIntentLink('/shared-owner')
    let contexts: readonly PrefetchLink[] = []
    let app = run({
      loadModule: mock.fn(),
      prefetch: {
        links: {
          scheduler(batch) {
            contexts = batch
            return batch
          },
        },
      },
    })
    t.after(() => app.dispose())
    press(first)
    press(second)
    await wait(0)
    expect(signals).toHaveLength(1)
    expect(contexts[0].trigger).toBe('intent')
    expect(contexts[0].anchors).toEqual([first, second])
    first.remove()
    await wait(0)
    expect(signals[0].aborted).toBe(false)
    second.remove()
    await waitFor(() => signals[0].aborted)
    expect(signals[0].aborted).toBe(true)
  })

  it('inherits current intent ordering when an owner joins running HTML', async (t) => {
    let gate = Promise.withResolvers<Response>()
    let blocker = Promise.withResolvers<Response>()
    let starts: string[] = []
    t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      let path = new URL(String(src)).pathname
      starts.push(path)
      if (path === '/parent') return gate.promise
      if (path === '/blocker') return blocker.promise
      return htmlResponse('')
    })
    let { prefetch: strategy } = createPrefetch(t, { links: { concurrency: 1 } })
    let parent = strategy(new URL('/parent', location.href).href)
    await wait(0)
    let anchor = createIntentLink('/parent')
    let shared = strategy.enqueue(anchor.href, undefined, anchor, 'intent')
    let busy = strategy(new URL('/blocker', location.href).href)
    gate.resolve(
      htmlResponse(
        '<script id="rmx-data" type="application/json">{"f":{"child":{"src":"/child","prefetch":true}}}</script>',
      ),
    )
    await waitFor(() => starts.includes('/blocker'))
    let next = strategy(new URL('/next', location.href).href)
    blocker.resolve(htmlResponse(''))
    await Promise.all([parent, shared, busy, next])
    expect(starts).toEqual(['/parent', '/child', '/blocker', '/next'])
  })

  it('ignores cloned candidates and malformed selections without affecting later work', async (t) => {
    let fetch = t.mock.method(globalThis, 'fetch', async () => htmlResponse(''))
    let config = {
      links: {
        scheduler(batch: readonly PrefetchLink[]) {
          return batch.map((candidate) => ({ ...candidate }))
        },
      },
    } satisfies PrefetchConfig
    let strategy = createDefaultPrefetch(undefined, config)
    await strategy(new URL('/cloned', location.href).href)
    expect(fetch).not.toHaveBeenCalled()
    Object.defineProperty(config.links, 'scheduler', {
      value: () => Promise.resolve([]),
      configurable: true,
    })
    await strategy(new URL('/malformed', location.href).href)
    expect(fetch).not.toHaveBeenCalled()
    Object.defineProperty(config.links, 'scheduler', {
      value: (batch: readonly PrefetchLink[]) => batch,
      configurable: true,
    })
    await strategy(new URL('/valid', location.href).href)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('cancels one imperative owner independently and aborts HTML for the last', async (t) => {
    let jobSignal: AbortSignal | undefined
    t.mock.method(globalThis, 'fetch', (_src: RequestInfo | URL, init?: RequestInit) => {
      jobSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) =>
        jobSignal?.addEventListener('abort', () => reject(new Error('aborted'))),
      )
    })
    let { prefetch: load } = createPrefetch(t)
    let first = new AbortController()
    let second = new AbortController()
    let a = load(new URL('/shared', location.href).href, { signal: first.signal })
    let b = load(new URL('/shared', location.href).href, { signal: second.signal })
    await wait(0)
    first.abort()
    expect(jobSignal?.aborted).toBe(false)
    second.abort()
    expect(jobSignal?.aborted).toBe(true)
    await Promise.all([a, b])
  })

  it('selects assets once per response before unrelated HTML finishes and snapshots frame metadata', async (t) => {
    stubLinkPrefetchSupport(t, true)
    let gate = Promise.withResolvers<Response>()
    let starts: string[] = []
    t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      let path = new URL(String(src)).pathname
      starts.push(path)
      if (path === '/slow') return gate.promise
      if (path === '/leaf') return htmlResponse('')
      return htmlResponse(`<base href="/assets/"><script src="default.js"></script><img src="opted.jpg" data-prefetch>
        <template><img src="nested.jpg" data-prefetch></template>
        <script type="application/json" id="rmx-data">{"f":{"leaf":{"src":"/leaf","prefetch":true}}}</script>`)
    })
    let foreign = document.createElement('img')
    foreign.src = '/foreign.jpg'
    let calls = 0
    let hints = collectHints(t)
    let { prefetch: load } = createPrefetch(t, {
      assets: {
        scheduler(batch, context) {
          if (context.src.endsWith('/leaf') || context.src.endsWith('/slow')) return batch
          calls++
          expect(batch).toHaveLength(1)
          expect(context.baseURL).toBe(new URL('/assets/', location.href).href)
          let image = context.fragment.querySelector('img')
          let template = context.fragment.querySelector('template')
          if (!image || !template) throw new Error('Missing selected images')
          context.fragment.querySelector('#rmx-data')?.remove()
          return [image, image, ...template.content.querySelectorAll('img'), foreign]
        },
      },
    })
    let a = load(new URL('/fast', location.href).href)
    let shared = load(new URL('/fast', location.href).href)
    let b = load(new URL('/slow', location.href).href)
    await wait(0)
    await waitFor(() => calls === 1 && starts.includes('/leaf') && hints.length === 2)
    expect(calls).toBe(1)
    expect(starts).toContain('/leaf')
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual([
      '/assets/opted.jpg',
      '/assets/nested.jpg',
    ])
    gate.resolve(htmlResponse(''))
    await Promise.all([a, shared, b])
    expect(document.querySelector('img')).toBe(null)
  })

  it('bounds global assets, interleaves fragments, and releases error and success slots', async (t) => {
    stubLinkPrefetchSupport(t, true)
    holdNativeHintEvents(t)
    t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) => {
      let page = new URL(String(src)).pathname.slice(1)
      return htmlResponse(
        `<script src="/${page}1.js"></script><script src="/${page}2.js"></script><script src="/${page}3.js"></script>`,
      )
    })
    let hints: HTMLLinkElement[] = []
    let peak = 0
    let observer = new MutationObserver((records) => {
      for (let record of records)
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'prefetch') hints.push(node)
        }
      peak = Math.max(peak, document.head.querySelectorAll('link[rel="prefetch"]').length)
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())
    let { prefetch: load } = createPrefetch(t, { assets: { concurrency: 1 } })
    let first = load(new URL('/a', location.href).href)
    await waitFor(() => hints.length === 1)
    let second = load(new URL('/b', location.href).href)
    let ready = Promise.all([first, second])
    await wait(20)
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/a1.js'])
    hints[0].dispatchEvent(new Event('error'))
    await waitFor(() => hints.length === 2)
    hints[1].dispatchEvent(new Event('load'))
    await waitFor(() => hints.length === 3)
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual(['/a1.js', '/a2.js', '/b1.js'])
    for (let i = 2; i < 6; i++) {
      hints[i].dispatchEvent(new Event('load'))
      if (i < 5) await waitFor(() => hints.length === i + 2)
    }
    await ready
    expect(peak).toBe(1)
    expect(hints.every((link) => !link.isConnected)).toBe(true)
  })

  it('keeps selected order when a fragment joins an already queued shared asset', async (t) => {
    stubLinkPrefetchSupport(t, true)
    holdNativeHintEvents(t)
    let selections = 0
    t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) =>
      htmlResponse(
        new URL(String(src)).pathname === '/a'
          ? '<script src="/a1.js"></script><script src="/a2.js"></script><script src="/shared.js"></script>'
          : '<script src="/shared.js"></script><script src="/b.js"></script>',
      ),
    )
    let hints: HTMLLinkElement[] = []
    let observer = new MutationObserver((records) => {
      for (let record of records)
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement) hints.push(node)
        }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())
    let { prefetch: load } = createPrefetch(t, {
      assets: {
        concurrency: 1,
        scheduler(batch) {
          selections++
          return batch
        },
      },
    })
    let a = load(new URL('/a', location.href).href)
    await waitFor(() => hints.length === 1)
    let b = load(new URL('/b', location.href).href)
    await waitFor(() => selections === 2)
    for (let i = 0; i < 4; i++) {
      hints[i].dispatchEvent(new Event('load'))
      if (i < 3) await waitFor(() => hints.length === i + 2)
    }
    await Promise.all([a, b])
    expect(hints.map((link) => new URL(link.href).pathname)).toEqual([
      '/a1.js',
      '/a2.js',
      '/shared.js',
      '/b.js',
    ])
  })

  it('retains a shared issued asset for another owner and removes queued assets on cancellation', async (t) => {
    stubLinkPrefetchSupport(t, true)
    holdNativeHintEvents(t)
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse('<script src="/shared.js"></script><script src="/queued.js"></script>'),
    )
    let selections = 0
    let { prefetch: load } = createPrefetch(t, {
      assets: {
        concurrency: 1,
        scheduler(batch) {
          selections++
          return batch
        },
      },
    })
    let a = new AbortController()
    let b = new AbortController()
    let ready = Promise.all([
      load(new URL('/a', location.href).href, { signal: a.signal }),
      load(new URL('/b', location.href).href, { signal: b.signal }),
    ])
    await wait(0)
    await waitFor(() => selections === 2 && document.querySelector('link[rel="prefetch"]') !== null)
    let link = document.querySelector('link[rel="prefetch"]')
    expect(link).not.toBe(null)
    a.abort()
    await wait(0)
    expect(link?.isConnected).toBe(true)
    b.abort()
    await ready
    expect(link?.isConnected).toBe(false)
    expect(document.querySelector('link[rel="prefetch"]')).toBe(null)
  })

  it('prunes abandoned owners before resuming queued native assets', async (t) => {
    stubLinkPrefetchSupport(t, true)
    holdNativeHintEvents(t)
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse('<script src="/issued.js"></script><script src="/abandoned.js"></script>'),
    )
    let starts: string[] = []
    let observer = new MutationObserver((records) => {
      for (let record of records)
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement) starts.push(new URL(node.href).pathname)
        }
    })
    observer.observe(document.head, { childList: true })
    t.after(() => observer.disconnect())
    let anchor = createIntentLink('/owner')
    let { prefetch: strategy } = createPrefetch(t, { assets: { concurrency: 1 } })
    let ready = strategy.enqueue(anchor.href, undefined, anchor, 'intent')
    await waitFor(() => document.querySelector('link[rel="prefetch"]') !== null)
    strategy.pause()
    let issued = document.querySelector('link[rel="prefetch"]')
    issued?.dispatchEvent(new Event('load'))
    anchor.remove()
    strategy.resume()
    await ready
    expect(document.querySelector('link[rel="prefetch"]')).toBe(null)
    expect(starts).toEqual(['/issued.js'])
  })

  it('preloads selected responsive images without native prefetch support and snapshots attributes', async (t) => {
    stubLinkPrefetchSupport(t, false)
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse(
        `<base href="/relative/"><img src="fallback.png" srcset="small.png 400w, large.png 1200w" sizes="100vw" crossorigin="use-credentials" referrerpolicy="no-referrer"><script src="/ignored.js"></script>`,
      ),
    )
    let source: Element | undefined
    let hints = collectHints(t)
    let { prefetch: load } = createPrefetch(t, {
      assets: {
        scheduler(_batch, { fragment }) {
          source = fragment.querySelector('img') ?? undefined
          return source ? [source] : []
        },
      },
    })
    await load(new URL('/image', location.href).href)
    source?.setAttribute('srcset', '/mutated.png 1x')
    expect(hints).toHaveLength(1)
    expect(hints[0].rel).toBe('preload')
    expect(hints[0].imageSrcset).toBe(
      `${new URL('/relative/small.png', location.href).href} 400w, ${new URL('/relative/large.png', location.href).href} 1200w`,
    )
    expect(hints[0].crossOrigin).toBe('use-credentials')
    expect(hints[0].referrerPolicy).toBe('no-referrer')
    expect(hints[0].fetchPriority).toBe('low')
  })

  it('keeps nested discovery and navigation available after selector errors', async (t) => {
    t.mock.method(globalThis, 'fetch', async (src: RequestInfo | URL) =>
      ['/leaf', '/navigate'].includes(new URL(String(src)).pathname)
        ? htmlResponse('<html><head></head><body><main>Navigation</main></body></html>')
        : htmlResponse(
            '<script id="rmx-data" type="application/json">{"f":{"leaf":{"src":"/leaf","prefetch":true}}}</script>',
          ),
    )
    let calls = 0
    let { prefetch: load } = createPrefetch(t, {
      assets: {
        scheduler() {
          calls++
          throw new Error('policy')
        },
      },
    })
    await load(new URL('/root', location.href).href)
    expect(calls).toBe(2)
    let app = run({
      loadModule: mock.fn(),
      prefetch: {
        links: {
          scheduler() {
            throw new Error('policy')
          },
        },
      },
    })
    t.after(() => app.dispose())
    prefetch('/rejected')
    await app.frames.top.reload({ src: new URL('/navigate', location.href).href })
  })
})
