import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { Frame } from '../runtime/component.ts'
import { jsx } from '../runtime/jsx.ts'
import { prefetch, startPrefetching, type PrefetchFrame } from '../runtime/prefetch.ts'
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
