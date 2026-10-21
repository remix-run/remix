import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { Frame } from '../runtime/component.ts'
import { jsx } from '../runtime/jsx.ts'
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

function htmlResponse(html: string) {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
  })
}

describe('prefetch', () => {
  afterEach(() => {
    document.body.textContent = ''
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

      anchor.style.top = `${innerHeight + 100}px`
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
  it('discovers explicit assets in inert HTML and nested templates without using its import map', async (t) => {
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
    t.mock.method(globalThis, 'fetch', async () =>
      htmlResponse('<script src="/shared.js"></script>'),
    )
    let { prefetch } = createPrefetch(t)
    let hints: HTMLLinkElement[] = []
    let observer = new MutationObserver((records) => {
      for (let record of records) {
        for (let node of record.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'prefetch') {
            hints.push(node)
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
    await new Promise(requestAnimationFrame)
    expect(hints).toHaveLength(1)
    hints[0].dispatchEvent(new Event('error'))
    await ready
    expect(hints[0].isConnected).toBe(false)
  })

  it('ignores non-HTML and failed responses and allows later attempts', async (t) => {
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

  it('cancels speculative HTML and removes pending asset links on disposal', async (t) => {
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
