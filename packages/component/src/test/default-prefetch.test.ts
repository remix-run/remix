import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

import { createDefaultPrefetch } from '../runtime/default-prefetch.ts'

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

  it('deduplicates pending asset hints across pages and removes failed hints', async (t) => {
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
