import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter, type MiddlewareContext } from '@remix-run/fetch-router'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { jsx } from '@remix-run/component/jsx-runtime'
import {
  clientEntry,
  createElement,
  css,
  Frame,
  type Handle,
  type RemixNode,
} from '@remix-run/component'

import { render } from '../index.ts'

type IsEqual<left, right> =
  (<type>() => type extends left ? 1 : 2) extends <type>() => type extends right ? 1 : 2
    ? true
    : false

function expectTypeEquality<_check extends true>() {}

describe('render', () => {
  it('shares the CSP nonce with authored elements through multiple frame redirects', async () => {
    let seen: string[] = []
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            seen.push(nonce)
            return { scriptSrc: [`'nonce-${nonce}'`], styleSrc: [`'nonce-${nonce}'`] }
          },
        }),
        render(),
      ] as const,
    })
    router.get('/', (context) => context.render(createElement(Frame, { src: '/first' })))
    router.get('/first', () => Response.redirect('https://remix.run/second'))
    router.get('/second', () => Response.redirect('https://remix.run/child'))
    router.get('/child', (context) =>
      context.render(
        createElement(
          'section',
          {},
          jsx('script', { nonce: getCspNonce(context), children: 'globalThis.child = true' }),
          createElement('p', { mix: css({ color: 'red' }) }, 'Child'),
          createElement(Frame, { src: '/grandchild' }),
        ),
      ),
    )
    router.get('/grandchild', (context) =>
      context.render(createElement('p', { mix: css({ color: 'blue' }) }, 'Grandchild')),
    )

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()
    let nonce = seen[0]
    assert.ok(nonce)
    assert.equal(seen.length, 5)
    assert.deepEqual(new Set(seen), new Set([nonce]))
    assert.equal(
      response.headers.get('Content-Security-Policy'),
      `script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'`,
    )
    assert.ok(html.includes(`<script nonce="${nonce}">globalThis.child = true</script>`))
    let styles = html.match(/<style\b[^>]*>/g) ?? []
    assert.equal(styles.length, 2)
    assert.ok(styles.every((style) => style.includes(`nonce="${nonce}"`)))
  })

  it('adds a typed Remix component renderer to request context', async () => {
    let middleware = render()
    type AppContext = MiddlewareContext<[typeof middleware]>
    let router = createRouter<AppContext>({ middleware: [middleware] })

    router.get('/', (context) => {
      expectTypeEquality<
        IsEqual<typeof context.render, (node: RemixNode, init?: ResponseInit) => Response>
      >()

      return context.render(createElement('h1', {}, 'Hello'), {
        status: 201,
        headers: { 'X-Test': 'render' },
      })
    })

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 201)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(response.headers.get('X-Test'), 'render')
    assert.match(await response.text(), /^<!DOCTYPE html><h1>Hello<\/h1>/)
  })

  it('makes the inherited nonce available to children outside the CSP middleware scope', async () => {
    let childNonce: string | undefined
    let router = createRouter({ middleware: [render()] as const })
    router.get('/', {
      middleware: [
        csp({
          policy({ nonce }) {
            return { scriptSrc: [`'nonce-${nonce}'`] }
          },
        }),
      ],
      handler: (context) => context.render(createElement(Frame, { src: '/redirect' })),
    })
    router.get('/redirect', () => Response.redirect('https://remix.run/child'))
    router.get('/child', (context) => {
      childNonce = getCspNonce(context)
      return context.render(
        jsx('script', { nonce: childNonce, children: 'globalThis.child = true' }),
      )
    })

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()
    assert.ok(childNonce)
    assert.equal(
      response.headers.get('Content-Security-Policy'),
      `script-src 'nonce-${childNonce}'`,
    )
    assert.ok(html.includes(`<script nonce="${childNonce}">`))

    let independent = await router.fetch('https://remix.run/child')
    let independentHtml = await independent.text()
    assert.equal(childNonce, undefined)
    assert.equal(independent.headers.get('Content-Security-Policy'), null)
    assert.doesNotMatch(independentHtml, /nonce=/)
  })

  it('applies the CSP nonce to generated styles, import maps, and preloads', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            return { scriptSrc: [`'nonce-${nonce}'`], styleSrc: [`'nonce-${nonce}'`] }
          },
        }),
        render({
          assets: {
            async getScriptEntry() {
              return {
                href: '/assets/island.js',
                importMap: { imports: { island: '/assets/island.js' } },
                preloads: ['/assets/island.js'],
              }
            },
          },
        }),
      ] as const,
    })
    let Island = clientEntry('file:///app/island.ts#Island', function Island() {
      return () => createElement('p', { mix: css({ color: 'red' }) }, 'Island')
    })
    router.get('/', (context) =>
      context.render(
        createElement(
          'html',
          {},
          createElement('head'),
          createElement('body', {}, createElement(Island)),
        ),
        {
          status: 201,
          headers: { 'X-Test': 'preserved' },
        },
      ),
    )

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()
    let nonce = response.headers.get('Content-Security-Policy')?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(nonce)

    assert.equal(response.status, 201)
    assert.equal(
      response.headers.get('Content-Security-Policy'),
      `script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'`,
    )
    assert.equal(response.headers.get('X-Test'), 'preserved')
    let styles = html.match(/<style\b[^>]*>/g) ?? []
    assert.equal(styles.length, 1)
    assert.ok(styles.every((tag) => tag.includes(`nonce="${nonce}"`)))
    assert.ok(html.includes(`<script data-rmx-import-map type="importmap" nonce="${nonce}">`))
    assert.ok(
      html.includes(
        `<link data-rmx-module-preload rel="modulepreload" href="/assets/island.js" nonce="${nonce}" />`,
      ),
    )
  })

  it('propagates the document nonce through redirects and nested blocking frames', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            return { styleSrc: [`'nonce-${nonce}'`] }
          },
        }),
        render(),
      ] as const,
    })
    router.get('/', (context) => context.render(createElement(Frame, { src: '/redirect' })))
    router.get('/redirect', () => Response.redirect('https://remix.run/child'))
    router.get('/child', (context) =>
      context.render(
        createElement(
          'section',
          {},
          createElement('p', { mix: css({ color: 'red' }) }, 'Child'),
          createElement(Frame, { src: '/grandchild' }),
        ),
      ),
    )
    router.get('/grandchild', (context) =>
      context.render(createElement('p', { mix: css({ color: 'blue' }) }, 'Grandchild')),
    )

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()
    let styles = html.match(/<style\b[^>]*>/g) ?? []
    let nonce = response.headers.get('Content-Security-Policy')?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(nonce)

    assert.equal(styles.length, 2)
    assert.ok(styles.every((style) => style.includes(`nonce="${nonce}"`)))
    assert.match(html, />Child<\/p>/)
    assert.match(html, />Grandchild<\/p>/)
    assert.doesNotMatch(html, /<template/)

    let frameResponse = await router.fetch('https://remix.run/child', {
      headers: { 'X-Remix-Frame': 'true' },
    })
    let frameHtml = await frameResponse.text()
    let frameStyles = frameHtml.match(/<style\b[^>]*>/g) ?? []
    let frameNonce = frameResponse.headers
      .get('Content-Security-Policy')
      ?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(frameNonce)
    assert.notEqual(frameNonce, nonce)

    assert.equal(frameStyles.length, 2)
    assert.ok(frameStyles.every((style) => style.includes(`nonce="${frameNonce}"`)))
    assert.ok(!frameHtml.includes(`nonce="${nonce}"`))
  })

  it('propagates the document nonce through redirects to non-blocking frames', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            return { styleSrc: [`'nonce-${nonce}'`] }
          },
        }),
        render(),
      ] as const,
    })
    router.get('/', (context) =>
      context.render(
        createElement(Frame, { src: '/redirect', fallback: createElement('p', {}, 'Loading') }),
      ),
    )
    router.get('/redirect', () => Response.redirect('https://remix.run/child'))
    router.get('/child', (context) =>
      context.render(
        createElement(
          'section',
          {},
          createElement('p', { mix: css({ color: 'red' }) }, 'Child'),
          jsx('script', { nonce: getCspNonce(context), children: 'globalThis.child = true' }),
        ),
      ),
    )

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()
    let nonce = response.headers.get('Content-Security-Policy')?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(nonce)

    assert.match(html, /<p>Loading<\/p>/)
    assert.match(html, /<template\b[^>]*>[\s\S]*?<style data-rmx-style=/)
    let styles = html.match(/<style\b[^>]*>/g) ?? []
    assert.equal(styles.length, 1)
    assert.ok(styles.every((tag) => tag.includes(`nonce="${nonce}"`)))
    assert.ok(html.includes(`<script nonce="${nonce}">globalThis.child = true</script>`))
  })

  it('resolves nested and targeted frames through the current router', async () => {
    let middleware = render()
    let router = createRouter({ middleware: [middleware] as const })
    let frameRequestHeaders: Headers[] = []

    function FrameLocation(handle: Handle) {
      return () => createElement('p', {}, `${handle.frame.src} (top: ${handle.frames.top.src})`)
    }

    router.post('/start', (context) =>
      context.render(createElement(Frame, { name: 'outer', src: '/frames/first' })),
    )
    router.get('/frames/first', (context) => {
      frameRequestHeaders.push(context.request.headers)
      return context.render(
        createElement(
          'section',
          {},
          createElement(FrameLocation),
          createElement(Frame, { name: 'inner', src: './second' }),
        ),
      )
    })
    router.get('/frames/second', (context) => {
      frameRequestHeaders.push(context.request.headers)
      return context.render(createElement(FrameLocation))
    })

    let response = await router.fetch(
      new Request('https://remix.run/start', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          Authorization: 'Bearer secret',
          'Content-Length': '2',
          'Content-Type': 'application/json',
          Cookie: 'session=abc',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'X-Session-Token': 'token',
        },
        body: '{}',
      }),
    )
    let html = await response.text()

    assert.match(html, /https:\/\/remix\.run\/frames\/first \(top: https:\/\/remix\.run\/start\)/)
    assert.match(html, /https:\/\/remix\.run\/frames\/second \(top: https:\/\/remix\.run\/start\)/)
    assert.equal(frameRequestHeaders.length, 2)
    assert.equal(frameRequestHeaders[0]?.get('Accept'), 'text/html')
    assert.equal(frameRequestHeaders[0]?.get('Accept-Encoding'), 'identity')
    assert.equal(frameRequestHeaders[0]?.get('Authorization'), 'Bearer secret')
    assert.equal(frameRequestHeaders[0]?.get('Cookie'), 'session=abc')
    assert.equal(frameRequestHeaders[0]?.get('X-Session-Token'), 'token')
    assert.equal(frameRequestHeaders[0]?.get('X-Remix-Frame'), 'true')
    assert.equal(frameRequestHeaders[0]?.get('X-Remix-Target'), 'outer')
    assert.equal(frameRequestHeaders[0]?.get('Content-Length'), null)
    assert.equal(frameRequestHeaders[0]?.get('Content-Type'), null)
    assert.equal(frameRequestHeaders[0]?.get('Sec-Fetch-Dest'), null)
    assert.equal(frameRequestHeaders[0]?.get('Sec-Fetch-Mode'), null)
    assert.equal(frameRequestHeaders[0]?.get('Sec-Fetch-Site'), null)
    assert.equal(frameRequestHeaders[0]?.get('Sec-Fetch-User'), null)
    assert.equal(frameRequestHeaders[1]?.get('X-Remix-Target'), 'inner')
  })

  it('follows frame redirects and preserves non-successful HTML response content', async () => {
    let middleware = render()
    let router = createRouter({ middleware: [middleware] as const })
    let crossOriginHeaders: Headers | undefined

    router.get('/redirect-frame', (context) =>
      context.render(
        createElement(
          'main',
          {},
          createElement(Frame, { src: '/redirect' }),
          createElement(Frame, { src: '/invalid' }),
          createElement(Frame, { src: '/not-a-redirect' }),
          createElement(Frame, { src: 'https://other.example/cross-origin' }),
        ),
      ),
    )
    router.get('/redirect', () => new Response(null, { status: 302, headers: { Location: '/ok' } }))
    router.get(
      '/ok',
      () =>
        new Response('<strong>Redirected</strong>', { headers: { 'Content-Type': 'text/html' } }),
    )
    router.get(
      '/invalid',
      () =>
        new Response('<p>Validation failed</p>', {
          status: 422,
          headers: { 'Content-Type': 'text/html' },
        }),
    )
    router.get(
      '/not-a-redirect',
      () =>
        new Response('<p>Multiple choices</p>', {
          status: 300,
          headers: { 'Content-Type': 'text/html', Location: '/ok' },
        }),
    )
    router.get('/cross-origin', (context) => {
      crossOriginHeaders = context.request.headers
      return new Response('<span>Cross origin</span>', {
        headers: { 'Content-Type': 'text/html' },
      })
    })

    let response = await router.fetch(
      new Request('https://remix.run/redirect-frame', {
        headers: {
          Authorization: 'Bearer secret',
          Cookie: 'session=abc',
          'X-Api-Key': 'api-secret',
          'X-Session-Token': 'session-secret',
        },
      }),
    )
    let html = await response.text()

    assert.match(html, /<strong>Redirected<\/strong>/)
    assert.match(html, /<p>Validation failed<\/p>/)
    assert.match(html, /<p>Multiple choices<\/p>/)
    assert.match(html, /<span>Cross origin<\/span>/)
    assert.equal(crossOriginHeaders?.get('Authorization'), null)
    assert.equal(crossOriginHeaders?.get('Cookie'), null)
    assert.equal(crossOriginHeaders?.get('X-Api-Key'), null)
    assert.equal(crossOriginHeaders?.get('X-Session-Token'), null)
    assert.equal(crossOriginHeaders?.get('X-Remix-Top-Frame-Src'), null)
    assert.equal(crossOriginHeaders?.get('X-Remix-Frame'), 'true')
  })

  it('rejects non-HTML frame responses', async () => {
    let errors: unknown[] = []
    let middleware = render({ onError: (error) => errors.push(error) })
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/', (context) => context.render(createElement(Frame, { src: '/text' })))
    router.get('/text', () => new Response('Not UI'))

    let response = await router.fetch('https://remix.run/')

    await assert.rejects(response.text(), /Frame response must be HTML/)
    assert.equal(errors.length, 1)
  })

  it('rejects failed frame responses without UI', async () => {
    let errors: unknown[] = []
    let middleware = render({ onError: (error) => errors.push(error) })
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/', (context) => context.render(createElement(Frame, { src: '/missing' })))
    router.get(
      '/missing',
      () =>
        new Response(null, {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'text/html' },
        }),
    )

    let response = await router.fetch('https://remix.run/')

    await assert.rejects(response.text(), /Failed to resolve frame: 404 Not Found/)
    assert.equal(errors.length, 1)
  })

  it('renders frame bodies from context.render() in place without a leaked doctype', async () => {
    let middleware = render()
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/', (context) =>
      context.render(
        createElement(
          'main',
          {},
          createElement(Frame, { src: '/blocking' }),
          createElement('p', {}, 'after'),
          createElement(Frame, { src: '/async', fallback: createElement('p', {}, 'loading') }),
        ),
      ),
    )
    router.get('/blocking', (context) =>
      context.render(createElement('h2', {}, 'Blocking content')),
    )
    router.get('/async', (context) => context.render(createElement('h2', {}, 'Async content')))

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()

    // The blocking frame body renders at its slot, ahead of subsequent markup
    let slot = html.match(/<!-- rmx:f:[^ ]+ -->([\s\S]*?)<!-- \/rmx:f -->/)
    assert.match(slot?.[1] ?? '', /<h2>Blocking content<\/h2>/)
    assert.ok(html.indexOf('Blocking content') < html.indexOf('<p>after</p>'))
    // The non-blocking frame body streams as a template chunk
    assert.match(
      html,
      /<template id="f[^"]+">[\s\S]*?Async content[\s\S]*?<!--rmx:template-end--><\/template>/,
    )
    // The frame responses' own doctypes are stripped from the outer document
    assert.doesNotMatch(html.slice('<!DOCTYPE html>'.length), /<!DOCTYPE html>/i)
  })

  it('resolves source client entries through the asset server', async () => {
    let errors: unknown[] = []
    let resolvedEntries: string[] = []
    let assets = {
      async getScriptEntry(source: string) {
        resolvedEntries.push(source)
        return {
          href: '/assets/counter-123.js',
          importMap: { imports: { package: '/assets/package-789.js' } },
          preloads: ['/assets/shared-456.js'],
        }
      },
    }
    let middleware = render({ assets, onError: (error) => errors.push(error) })
    let router = createRouter({ middleware: [middleware] as const })
    let Counter = clientEntry('file:///app/counter.ts#Counter', function () {
      return () => createElement('button', {}, 'Count')
    })
    let NamedEntry = clientEntry('file:///app/named-entry.ts', function NamedEntry() {
      return () => createElement('p', {}, 'Named')
    })
    let PublicEntry = clientEntry('/public/widget.js#PublicEntry', function () {
      return () => createElement('p', {}, 'Public')
    })
    let CdnEntry = clientEntry('https://cdn.example/widget.js#CdnEntry', function () {
      return () => createElement('p', {}, 'CDN')
    })
    let MissingExportEntry = clientEntry('file:///app/missing-export.ts', function () {
      return () => createElement('p', {}, 'Missing export')
    })

    router.get('/', (context) =>
      context.render(
        createElement(
          'main',
          {},
          createElement(Counter),
          createElement(NamedEntry),
          createElement(PublicEntry),
          createElement(CdnEntry),
        ),
      ),
    )
    router.get('/missing-export', (context) => context.render(createElement(MissingExportEntry)))

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()

    assert.deepEqual(resolvedEntries, ['file:///app/counter.ts', 'file:///app/named-entry.ts'])
    assert.match(html, /\/assets\/counter-123\.js/)
    assert.match(
      html,
      /<script data-rmx-import-map type="importmap">\{"imports":\{"package":"\/assets\/package-789\.js"\}\}<\/script>/,
    )
    assert.match(
      html,
      /<link data-rmx-module-preload rel="modulepreload" href="\/assets\/shared-456\.js" \/>/,
    )
    assert.match(html, /"exportName":"Counter"/)
    assert.match(html, /"exportName":"NamedEntry"/)
    assert.match(html, /\/public\/widget\.js/)
    assert.match(html, /https:\/\/cdn\.example\/widget\.js/)

    let missingExportResponse = await router.fetch('https://remix.run/missing-export')
    await assert.rejects(
      missingExportResponse.text(),
      /entry ID \(e\.g\., import\.meta\.url \+ "#ExportName"\)/,
    )
    assert.equal(errors.length, 1)
  })

  it('uses the UI renderer client entry rules when no asset server is configured', async () => {
    let errors: unknown[] = []
    let middleware = render({ onError: (error) => errors.push(error) })
    let router = createRouter({ middleware: [middleware] as const })
    let PublicEntry = clientEntry('/assets/public.js#PublicEntry', function () {
      return () => createElement('p', {}, 'Public')
    })
    let MissingPublicExportEntry = clientEntry('/assets/missing-export.js', function () {
      return () => createElement('p', {}, 'Missing public export')
    })
    let SourceEntry = clientEntry('file:///Users/alice/private/source.ts', function () {
      return () => createElement('p', {}, 'Source')
    })

    router.get('/', (context) => context.render(createElement(PublicEntry)))
    router.get('/missing-public-export', (context) =>
      context.render(createElement(MissingPublicExportEntry)),
    )
    router.get('/source', (context) => context.render(createElement(SourceEntry)))

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()

    assert.match(html, /\/assets\/public\.js/)
    assert.match(html, /"exportName":"PublicEntry"/)

    let missingPublicExportResponse = await router.fetch('https://remix.run/missing-public-export')
    await assert.rejects(
      missingPublicExportResponse.text(),
      /entry ID \(e\.g\., "\/js\/module\.js#ExportName"\)/,
    )
    assert.doesNotMatch(String(errors[0]), /import\.meta\.url/)

    let sourceResponse = await router.fetch('https://remix.run/source')
    await assert.rejects(
      sourceResponse.text(),
      /file: source entry ID without an asset server.*render\(\{ assets \}\)/,
    )
    assert.doesNotMatch(String(errors[1]), /Users\/alice/)
  })

  it('emits generated styles and reports rendering errors', async () => {
    let errors: unknown[] = []
    let middleware = render({ onError: (error) => errors.push(error) })
    let router = createRouter({ middleware: [middleware] as const })
    let renderError = new Error('Broken component')

    function Broken() {
      throw renderError
    }

    router.get('/styles', (context) =>
      context.render(
        createElement(
          'html',
          {},
          createElement('head'),
          createElement('body', {}, createElement('p', { mix: css({ color: 'red' }) }, 'Styled')),
        ),
      ),
    )
    router.get('/error', (context) => context.render(createElement(Broken)))

    let styleResponse = await router.fetch('https://remix.run/styles')
    let styleHtml = await styleResponse.text()
    assert.match(styleHtml, /<style\b/)
    assert.match(styleHtml, /color: red/)

    let errorResponse = await router.fetch('https://remix.run/error')
    await errorResponse.text().catch(() => '')
    assert.deepEqual(errors, [renderError])
  })

  it('cancels internal frame requests with the original request', async () => {
    let middleware = render()
    let router = createRouter({ middleware: [middleware] as const })
    let frameStartedResolve: (() => void) | undefined
    let frameStarted = new Promise<void>((resolve) => {
      frameStartedResolve = resolve
    })
    let frameAbortedResolve: (() => void) | undefined
    let frameAborted = new Promise<void>((resolve) => {
      frameAbortedResolve = resolve
    })

    router.get('/', (context) => context.render(createElement(Frame, { src: '/slow' })))
    router.get('/slow', ({ request }) => {
      frameStartedResolve?.()
      return new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener(
          'abort',
          () => {
            frameAbortedResolve?.()
            reject(request.signal.reason)
          },
          { once: true },
        )
      })
    })

    let controller = new AbortController()
    let response = await router.fetch(
      new Request('https://remix.run/', { signal: controller.signal }),
    )
    let body = response.text().catch(() => '')

    await frameStarted
    controller.abort(new Error('Request cancelled'))
    await frameAborted
    await body
  })

  it('cancels returned frame streams with the original request', async () => {
    let middleware = render()
    let router = createRouter({ middleware: [middleware] as const })
    let frameStreamStartedResolve: (() => void) | undefined
    let frameStreamStarted = new Promise<void>((resolve) => {
      frameStreamStartedResolve = resolve
    })
    let frameStreamCancelledResolve: ((reason: unknown) => void) | undefined
    let frameStreamCancelled = new Promise<unknown>((resolve) => {
      frameStreamCancelledResolve = resolve
    })

    router.get('/', (context) => context.render(createElement(Frame, { src: '/stream' })))
    router.get(
      '/stream',
      () =>
        new Response(
          new ReadableStream({
            pull() {
              frameStreamStartedResolve?.()
            },
            cancel(reason) {
              frameStreamCancelledResolve?.(reason)
            },
          }),
          { headers: { 'Content-Type': 'text/html' } },
        ),
    )

    let controller = new AbortController()
    let response = await router.fetch(
      new Request('https://remix.run/', { signal: controller.signal }),
    )
    let body = response.text().catch(() => '')
    let reason = new Error('Request cancelled')

    await frameStreamStarted
    controller.abort(reason)

    assert.equal(await frameStreamCancelled, reason)
    await body
  })

  it('reports rendering errors for browser-initiated frame requests', async () => {
    let errors: unknown[] = []
    let middleware = render({ onError: (error) => errors.push(error) })
    let router = createRouter({ middleware: [middleware] as const })
    let renderError = new Error('Broken frame component')

    function Broken() {
      throw renderError
    }

    router.get('/frame', (context) => context.render(createElement(Broken)))

    let response = await router.fetch('https://remix.run/frame', {
      headers: { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'details' },
    })
    await assert.rejects(response.text(), /Broken frame component/)

    assert.deepEqual(errors, [renderError])
  })

  it('uses default error reporting for browser-initiated frame requests', async (t) => {
    let reportError = t.mock.method(console, 'error', () => {})
    let router = createRouter({ middleware: [render()] as const })
    let renderError = new Error('Broken frame component')

    function Broken() {
      throw renderError
    }

    router.get('/frame', (context) => context.render(createElement(Broken)))

    let response = await router.fetch('https://remix.run/frame', {
      headers: { 'X-Remix-Frame': 'true' },
    })
    await assert.rejects(response.text(), /Broken frame component/)

    assert.equal(reportError.mock.calls.length, 1)
    assert.deepEqual(reportError.mock.calls[0].arguments, [renderError])
  })

  it('reports redirected nested errors once for browser-initiated frame requests', async () => {
    let errors: unknown[] = []
    let childErrors: unknown[] = []
    let router = createRouter({
      middleware: [render({ onError: (error) => errors.push(error) })] as const,
    })
    let renderError = new Error('Broken child component')

    function Broken() {
      throw renderError
    }

    router.get('/', (context) => context.render(createElement(Frame, { src: '/redirect' })))
    router.get('/redirect', () => Response.redirect('https://remix.run/child'))
    router.get('/child', {
      middleware: [render({ onError: (error) => childErrors.push(error) })],
      handler: (context) => context.render(createElement(Broken)),
    })

    let response = await router.fetch('https://remix.run/', {
      headers: { 'X-Remix-Frame': 'true' },
    })
    await assert.rejects(response.text(), /Broken child component/)

    assert.deepEqual(errors, [renderError])
    assert.deepEqual(childErrors, [])
  })

  it('reports nested frame render errors once', async () => {
    let errors: unknown[] = []
    let middleware = render({ onError: (error) => errors.push(error) })
    let router = createRouter({ middleware: [middleware] as const })
    let renderError = new Error('Broken child component')

    function Broken() {
      throw renderError
    }

    router.get('/', (context) => context.render(createElement(Frame, { src: '/child' })))
    router.get('/child', (context) => context.render(createElement(Broken)))

    let response = await router.fetch('https://remix.run/')
    await response.text().catch(() => '')

    assert.deepEqual(errors, [renderError])
  })
})
