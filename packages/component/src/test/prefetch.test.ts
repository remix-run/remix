import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { prefetch, startPrefetching } from '../runtime/prefetch.ts'

function startTestPrefetching(t: TestContext, prefetchFrame?: (src: string) => void) {
  let controller = new AbortController()
  startPrefetching(controller.signal, prefetchFrame)
  t.after(() => controller.abort())
}

function createIntentLink(href: string): HTMLAnchorElement {
  let anchor = document.createElement('a')
  anchor.href = href
  anchor.setAttribute('data-rmx-prefetch', 'intent')
  anchor.textContent = 'Product'
  document.body.append(anchor)
  return anchor
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

  it('skips links that would not reload the top frame from another URL', (t) => {
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
})
