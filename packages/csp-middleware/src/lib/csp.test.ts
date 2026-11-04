import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRouter } from '@remix-run/fetch-router'
import { ContentSecurityPolicy } from '@remix-run/headers/content-security-policy'

import {
  csp,
  CspNonce,
  getCspNonce,
  inheritCspNonce,
  type CspOptions,
  type CspPolicyFactory,
} from '../index.ts'

describe('csp', () => {
  it('checks policy directives and preserves inferred factory context', () => {
    csp({
      // @ts-expect-error Inferred factory returns reject unknown directive keys.
      policy: ({ nonce }) => ({ scriptSrc: [`'nonce-${nonce}'`], frameAncestorsxss: ["'none'"] }),
    })
    csp({
      // @ts-expect-error Async report-only factories also reject unknown directive keys.
      reportOnlyPolicy: async () => ({ scriptSrc: ["'self'"], frameAncestorsxss: ["'none'"] }),
    })
    csp({
      policy: {
        scriptSrc: ["'self'"],
        // @ts-expect-error Static policies reject unknown directive keys.
        frameAncestorsxss: ["'none'"],
      },
    })
    let policy = (() => ({
      scriptSrc: ["'self'"],
      frameAncestorsxss: ["'none'"],
    })) satisfies CspPolicyFactory
    // @ts-expect-error Extracted factories retain their inferred extra keys.
    csp({ policy })
    csp({
      // @ts-expect-error A valid serialized branch cannot hide an invalid object branch.
      policy: ({ nonce }) =>
        nonce.length > 10
          ? "script-src 'self'"
          : { scriptSrc: [`'nonce-${nonce}'`], frameAncestorsxss: ["'none'"] },
    })
    csp({
      policy({ nonce, context }) {
        // @ts-expect-error Nonce inference must remain string rather than any.
        let invalidNonce: number = nonce
        // @ts-expect-error Context inference must remain RequestContext rather than any.
        let invalidContext: number = context
        void invalidNonce
        void invalidContext
        return { scriptSrc: [`'nonce-${nonce}'`, context.url.origin] }
      },
    })
    csp({
      // @ts-expect-error Source directives require strings.
      policy: () => ({ scriptSrc: [123] }),
    })
    csp({
      // @ts-expect-error Reporting directives require one endpoint name.
      policy: () => ({ reportTo: ['csp'] }),
    })
  })

  it('requires a policy and accepts supported static and factory forms', () => {
    // @ts-expect-error At least one defined policy is required.
    assert.throws(() => csp({}), TypeError)
    // @ts-expect-error Undefined is not a policy.
    assert.throws(() => csp({ policy: undefined }), TypeError)
    // @ts-expect-error reportOnlyPolicy is a policy, not a mode switch.
    csp({ policy: {}, reportOnlyPolicy: true })

    let factory: CspPolicyFactory = ({ nonce }) => ({ scriptSrc: [`'nonce-${nonce}'`] })
    let instance = new ContentSecurityPolicy({ scriptSrc: ["'self'"] })
    csp({ policy: { scriptSrc: ["'self'"] } as const })
    csp({ policy: () => "script-src 'self'" })
    csp({ policy: async () => instance })
    csp({ reportOnlyPolicy: factory })
    function configure(options: CspOptions): void {
      csp(options)
    }
    configure({ policy: factory, reportOnlyPolicy: instance })
  })

  it('serializes static policies for either header', async () => {
    let router = createRouter()
    router.get('/serialized', {
      middleware: [csp({ policy: "default-src 'self'" })],
      handler: () => new Response('ok', { headers: { 'Content-Type': 'text/html' } }),
    })
    router.get('/instance', {
      middleware: [csp({ reportOnlyPolicy: new ContentSecurityPolicy({ scriptSrc: ["'none'"] }) })],
      handler: () => new Response('ok', { headers: { 'Content-Type': 'text/html' } }),
    })

    let serialized = await router.fetch('https://example.com/serialized')
    let instance = await router.fetch('https://example.com/instance')

    assert.equal(serialized.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.equal(instance.headers.get('Content-Security-Policy'), null)
    assert.equal(instance.headers.get('Content-Security-Policy-Report-Only'), "script-src 'none'")
    assert.equal(instance.headers.get('Reporting-Endpoints'), null)
  })

  it('applies a policy to an immutable redirect when the filter accepts it', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          filter: () => true,
        }),
      ],
    })
    router.get('/redirect', () => Response.redirect('https://example.com/'))

    let redirect = await router.fetch('https://example.com/redirect')
    assert.equal(redirect.status, 302)
    assert.equal(redirect.headers.get('Location'), 'https://example.com/')
    assert.equal(redirect.headers.get('Content-Security-Policy'), "default-src 'self'")
  })

  it('applies policies and reporting endpoints to HTML errors and leaves non-HTML responses alone', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          reportingEndpoints: { csp: '/reports' },
        }),
      ],
    })
    let json = Response.json(
      { ok: true },
      { headers: { 'Content-Security-Policy': "connect-src 'none'" } },
    )
    router.get('/json', () => json)
    router.get(
      '/',
      () =>
        new Response('Unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }),
    )

    let untouched = await router.fetch('https://example.com/json')
    assert.equal(untouched, json)
    assert.equal(untouched.headers.get('Content-Security-Policy'), "connect-src 'none'")
    assert.equal(untouched.headers.get('Reporting-Endpoints'), null)
    let html = await router.fetch('https://example.com/')
    assert.equal(html.status, 503)
    assert.equal(html.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.equal(html.headers.get('Reporting-Endpoints'), 'csp="/reports"')
    assert.equal(await html.text(), 'Unavailable')
  })

  it('lets a custom filter exclude HTML while accepting another content type', async () => {
    let router = createRouter({
      middleware: [
        csp({
          reportOnlyPolicy: { scriptSrc: ["'self'"] },
          reportingEndpoints: { csp: '/reports' },
          filter: (response) => response.status === 201,
        }),
      ],
    })
    let excluded = new Response('HTML', { headers: { 'Content-Type': 'text/html' } })
    router.get('/', () => excluded)
    router.get(
      '/worker.js',
      () =>
        new Response('postMessage("ready")', {
          status: 201,
          headers: { 'Content-Type': 'application/javascript' },
        }),
    )

    assert.equal(await router.fetch('https://example.com/'), excluded)
    let worker = await router.fetch('https://example.com/worker.js')
    assert.equal(worker.headers.get('Content-Security-Policy'), null)
    assert.equal(worker.headers.get('Content-Security-Policy-Report-Only'), "script-src 'self'")
    assert.equal(worker.headers.get('Reporting-Endpoints'), 'csp="/reports"')
  })

  it('leaves 304 responses unchanged even when a custom filter accepts them', async () => {
    let downstream = new Response(null, {
      status: 304,
      headers: {
        'Content-Type': 'text/html',
        'Content-Security-Policy': "script-src 'nonce-cached'",
        ETag: 'W/"page-v1"',
      },
    })
    let router = createRouter({
      middleware: [
        csp({
          policy: ({ nonce }) => ({ scriptSrc: [`'nonce-${nonce}'`] }),
          reportOnlyPolicy: { styleSrc: ["'none'"] },
          reportingEndpoints: { csp: '/reports' },
          filter: () => true,
        }),
      ],
    })
    router.get('/', () => downstream)
    let response = await router.fetch('https://example.com/')
    assert.equal(response.status, 304)
    assert.equal(response.headers.get('Content-Security-Policy'), "script-src 'nonce-cached'")
    assert.equal(response.headers.get('Content-Security-Policy-Report-Only'), null)
    assert.equal(response.headers.get('Reporting-Endpoints'), null)
    assert.equal(response.body, null)
  })

  it('provides fresh request nonces to async factories and concurrent document and frame handlers', async () => {
    let router = createRouter({
      middleware: [
        csp({
          async policy({ nonce, context }) {
            assert.equal(getCspNonce(context), nonce)
            await Promise.resolve()
            return { scriptSrc: [`'nonce-${nonce}'`] }
          },
        }),
      ] as const,
    })
    router.get('/', (context) => {
      let nonce: string = context.get(CspNonce)
      assert.equal(getCspNonce(context), nonce)
      return new Response(nonce, { headers: { 'Content-Type': 'text/html' } })
    })

    let [frame, document] = await Promise.all([
      router.fetch('https://example.com/', { headers: { 'X-Remix-Frame': 'true' } }),
      router.fetch('https://example.com/'),
    ])
    let frameNonce = await frame.text()
    let documentNonce = await document.text()
    assert.notEqual(frameNonce, documentNonce)
    for (let [response, nonce] of [
      [frame, frameNonce],
      [document, documentNonce],
    ] as const) {
      assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/)
      assert.equal(atob(nonce).length, 16)
      assert.equal(response.headers.get('Content-Security-Policy'), `script-src 'nonce-${nonce}'`)
    }
  })

  it('appends enforced and report-only policies and reporting endpoints while sharing a nonce', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            return { scriptSrc: [`'nonce-${nonce}'`], reportTo: 'enforced' }
          },
          async reportOnlyPolicy({ nonce, context }) {
            assert.equal(nonce, getCspNonce(context))
            return { scriptSrc: [`'nonce-${nonce}'`], reportTo: 'preview' }
          },
          reportingEndpoints: {
            enforced: '/reports/enforced',
            preview: 'https://reports.example.com/csp',
          },
        }),
        csp({
          policy: ({ nonce }) => ({ styleSrc: [`'nonce-${nonce}'`] }),
        }),
      ] as const,
    })
    router.get(
      '/',
      (context) =>
        new Response(getCspNonce(context), {
          headers: {
            'Content-Type': 'text/html',
            'Content-Security-Policy': "object-src 'none'",
            'Content-Security-Policy-Report-Only': 'img-src https:',
            'Reporting-Endpoints': 'default="/reports/default", enforced="/reports/old"',
          },
        }),
    )

    let response = await router.fetch('https://example.com/')
    let nonce = await response.text()

    assert.ok(nonce)
    assert.equal(
      response.headers.get('Content-Security-Policy'),
      `object-src 'none', style-src 'nonce-${nonce}', script-src 'nonce-${nonce}'; report-to enforced`,
    )
    assert.equal(
      response.headers.get('Content-Security-Policy-Report-Only'),
      `img-src https:, script-src 'nonce-${nonce}'; report-to preview`,
    )
    assert.equal(
      response.headers.get('Reporting-Endpoints'),
      'default="/reports/default", enforced="/reports/old", enforced="/reports/enforced", preview="https://reports.example.com/csp"',
    )
  })

  it('quotes reporting endpoint URLs and replaces an empty downstream header', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy: { reportTo: 'csp' },
          reportingEndpoints: {
            csp: String.raw`/reports?label="csp",path=\test`,
            'other_1.*-': '/reports/other',
          },
        }),
      ],
    })
    router.get(
      '/',
      () =>
        new Response('ok', { headers: { 'Content-Type': 'text/html', 'Reporting-Endpoints': '' } }),
    )

    let response = await router.fetch('https://example.com/')

    assert.equal(
      response.headers.get('Reporting-Endpoints'),
      String.raw`csp="/reports?label=\"csp\",path=\\test", other_1.*-="/reports/other"`,
    )
  })

  it('rejects reporting endpoint names and URLs that cannot be serialized as structured fields', () => {
    for (let name of ['CSP', '', 'csp,other', 'csp\n']) {
      assert.throws(
        () => csp({ policy: {}, reportingEndpoints: { [name]: '/reports' } }),
        /Invalid reporting endpoint name/,
      )
    }
    for (let url of ['/reports\r\nX-Injected: true', '/réports']) {
      assert.throws(
        () => csp({ policy: {}, reportingEndpoints: { csp: url } }),
        /Invalid reporting endpoint URL/,
      )
    }
  })

  it('inherits nonces only on marked Request objects', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            return { scriptSrc: [`'nonce-${nonce}'`] }
          },
        }),
      ] as const,
    })
    router.get(
      '/',
      (context) => new Response(getCspNonce(context), { headers: { 'Content-Type': 'text/html' } }),
    )
    let request = new Request('https://example.com/')
    inheritCspNonce(request, 'document-nonce')
    let internal = await router.fetch(request)
    let independent = await router.fetch(request.clone())
    assert.equal(await internal.text(), 'document-nonce')
    assert.equal(
      internal.headers.get('Content-Security-Policy'),
      "script-src 'nonce-document-nonce'",
    )
    assert.notEqual(await independent.text(), 'document-nonce')
  })

  it('does not wait for or consume a streaming response body', async () => {
    let writer: ReadableStreamDefaultController<Uint8Array> | undefined
    let body = new ReadableStream<Uint8Array>({
      start(controller) {
        writer = controller
      },
    })
    let router = createRouter({
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
        }),
      ],
    })
    router.get(
      '/',
      () => new Response(body, { status: 201, headers: { 'Content-Type': 'text/html' } }),
    )
    let response = await router.fetch('https://example.com/')
    assert.equal(response.status, 201)
    assert.equal(response.body, body)
    assert.equal(response.bodyUsed, false)
    assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'self'")
    writer?.enqueue(new TextEncoder().encode('streamed'))
    writer?.close()
    assert.equal(await response.text(), 'streamed')
  })
})
