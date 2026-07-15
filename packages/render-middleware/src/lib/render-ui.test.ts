import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter, type MiddlewareContext } from '@remix-run/fetch-router'
import { clientEntry, createElement, css, Frame, type Handle, type RemixNode } from '@remix-run/ui'

import { render } from '../index.ts'

type IsEqual<left, right> =
  (<type>() => type extends left ? 1 : 2) extends <type>() => type extends right ? 1 : 2
    ? true
    : false

function expectTypeEquality<_check extends true>() {}

describe('render', () => {
  it('adds a typed Remix UI renderer to request context', async () => {
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
          'Sec-Fetch-Mode': 'navigate',
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
    assert.equal(frameRequestHeaders[0]?.get('Sec-Fetch-Mode'), null)
    assert.equal(frameRequestHeaders[1]?.get('X-Remix-Target'), 'inner')
  })

  it('follows frame redirects and preserves non-successful response content', async () => {
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
          createElement(Frame, { src: '/empty' }),
          createElement(Frame, { src: '/no-content' }),
          createElement(Frame, { src: 'https://other.example/cross-origin' }),
        ),
      ),
    )
    router.get('/redirect', () => new Response(null, { status: 302, headers: { Location: '/ok' } }))
    router.get('/ok', () => new Response('<strong>Redirected</strong>'))
    router.get('/invalid', () => new Response('<p>Validation failed</p>', { status: 422 }))
    router.get('/empty', () => new Response(null, { status: 404, statusText: 'Not Found' }))
    router.get('/no-content', () => new Response(null, { status: 204 }))
    router.get('/cross-origin', (context) => {
      crossOriginHeaders = context.request.headers
      return new Response('<span>Cross origin</span>')
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
    assert.match(html, /<pre>Frame error: 404 Not Found<\/pre>/)
    assert.doesNotMatch(html, /Frame error: 204/)
    assert.match(html, /<span>Cross origin<\/span>/)
    assert.equal(crossOriginHeaders?.get('Authorization'), null)
    assert.equal(crossOriginHeaders?.get('Cookie'), null)
    assert.equal(crossOriginHeaders?.get('X-Api-Key'), null)
    assert.equal(crossOriginHeaders?.get('X-Session-Token'), null)
  })

  it('resolves source client entries through the asset server', async () => {
    let resolvedEntries: string[] = []
    let assets = {
      async getHref(source: string) {
        resolvedEntries.push(source)
        return '/assets/counter-123.js'
      },
    }
    let middleware = render({ assets })
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

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()

    assert.deepEqual(resolvedEntries, ['file:///app/counter.ts', 'file:///app/named-entry.ts'])
    assert.match(html, /\/assets\/counter-123\.js/)
    assert.match(html, /"exportName":"Counter"/)
    assert.match(html, /"exportName":"NamedEntry"/)
    assert.match(html, /\/public\/widget\.js/)
    assert.match(html, /https:\/\/cdn\.example\/widget\.js/)
  })

  it('uses the UI renderer client entry rules when no asset server is configured', async () => {
    let middleware = render()
    let router = createRouter({ middleware: [middleware] as const })
    let PublicEntry = clientEntry('/assets/public.js#PublicEntry', function () {
      return () => createElement('p', {}, 'Public')
    })

    router.get('/', (context) => context.render(createElement(PublicEntry)))

    let response = await router.fetch('https://remix.run/')
    let html = await response.text()

    assert.match(html, /\/assets\/public\.js/)
    assert.match(html, /"exportName":"PublicEntry"/)
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
})
