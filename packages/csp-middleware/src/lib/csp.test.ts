import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRouter } from '@remix-run/fetch-router'
import {
  ContentSecurityPolicy,
  type ContentSecurityPolicyInit,
} from '@remix-run/headers/content-security-policy'

import {
  csp,
  CspNonce,
  getCspNonce,
  inheritCspNonce,
  type CspOptions,
  type CspPolicyFactory,
} from '../index.ts'

describe('csp', () => {
  it('rejects unknown directives in static, inferred, extracted, and mixed policy forms', () => {
    csp({
      // @ts-expect-error Inferred factory returns reject unknown directives alongside valid ones.
      policy({ nonce }) {
        return {
          scriptSrc: [`'nonce-${nonce}'`],
          frameAncestorsxss: ["'none'"],
        }
      },
    })

    csp({
      // @ts-expect-error Inferred async factory returns reject unknown directives.
      async policy({ nonce }) {
        return {
          scriptSrc: [`'nonce-${nonce}'`],
          frameAncestorsxss: ["'none'"],
        }
      },
    })

    csp({
      policy: {
        scriptSrc: ["'self'"],
        // @ts-expect-error Static directive objects also reject unknown keys.
        frameAncestorsxss: ["'none'"],
      },
    })

    let policy = (({ nonce }) => ({
      scriptSrc: [`'nonce-${nonce}'`],
      frameAncestorsxss: ["'none'"],
    })) satisfies CspPolicyFactory
    // @ts-expect-error Extracted factories retain their inferred extra keys.
    csp({ policy })

    csp({
      // @ts-expect-error A serialized-policy branch does not hide an invalid directive-object branch.
      policy({ nonce }) {
        if (nonce.length > 10) return "script-src 'self'"
        return { scriptSrc: [`'nonce-${nonce}'`], frameAncestorsxss: ["'none'"] }
      },
    })
    csp({
      // @ts-expect-error Async factories returning mixed policy forms also check every branch.
      async policy({ nonce }) {
        if (nonce.length > 10) return new ContentSecurityPolicy({ scriptSrc: ["'self'"] })
        return { scriptSrc: [`'nonce-${nonce}'`], frameAncestorsxss: ["'none'"] }
      },
    })
  })

  it('preserves inferred factory context and validates directive value types', () => {
    csp({
      policy({ nonce, context }) {
        // @ts-expect-error Nonce inference must remain string rather than any.
        let invalidNonce: number = nonce
        // @ts-expect-error Factory request context inference must remain RequestContext rather than any.
        let invalidContext: number = context
        void invalidNonce
        void invalidContext
        return { scriptSrc: [`'nonce-${nonce}'`, context.url.origin] }
      },
      filter(response) {
        // @ts-expect-error Response inference must remain Response rather than any.
        let invalidResponse: number = response
        void invalidResponse
        return response.ok
      },
    })
    csp({
      // @ts-expect-error Source directives require arrays of strings.
      policy: () => ({ scriptSrc: [123] }),
    })
    csp({
      // @ts-expect-error Boolean directives require booleans.
      policy: () => ({ upgradeInsecureRequests: 'yes' }),
    })
    csp({
      // @ts-expect-error Async factories also require arrays of strings for source directives.
      policy: async () => ({ scriptSrc: [123] }),
    })
    csp({
      // @ts-expect-error Reporting directives require a single endpoint name.
      policy: () => ({ reportTo: ['csp'] }),
    })
    csp({
      // @ts-expect-error Factories must accept the actual policy context.
      policy: ({ nonce }: { nonce: number }) => ({ scriptSrc: [String(nonce)] }),
    })
    csp({
      // @ts-expect-error Null is not a supported policy result.
      policy: () => null,
    })
  })

  it('accepts supported static, sync, async, and mixed policy forms without annotations', () => {
    let serialized = "script-src 'self'"
    let instance = new ContentSecurityPolicy({ scriptSrc: ["'self'"] })
    csp({ policy: { scriptSrc: ["'self'"], upgradeInsecureRequests: true } })
    csp({ policy: { scriptSrc: ["'self'"] } as const })
    csp({ policy: () => ({}) })
    csp({ policy: () => serialized })
    csp({ policy: async () => serialized })
    csp({ policy: () => instance })
    csp({ policy: async () => instance })
    csp({
      policy({ nonce }) {
        return nonce.length > 10 ? serialized : { scriptSrc: [`'nonce-${nonce}'`] }
      },
    })
    csp({
      async policy({ nonce }) {
        return nonce.length > 10 ? instance : { scriptSrc: [`'nonce-${nonce}'`] }
      },
    })

    let init: ContentSecurityPolicyInit = { scriptSrc: ["'self'"] }
    let factory: CspPolicyFactory = () => init
    let options: CspOptions = { policy: factory }
    csp({ policy: init })
    csp({ policy: factory })
    csp(options)
  })

  it('accepts serialized policies and ContentSecurityPolicy instances in the policy option', async () => {
    let router = createRouter()
    router.get('/serialized', {
      middleware: [csp({ policy: "default-src 'self'" })],
      handler: () => new Response('ok', { headers: { 'Content-Type': 'text/html' } }),
    })
    router.get('/instance', {
      middleware: [csp({ policy: new ContentSecurityPolicy({ scriptSrc: ["'none'"] }) })],
      handler: () => new Response('ok', { headers: { 'Content-Type': 'text/html' } }),
    })

    let serialized = await router.fetch('https://example.com/serialized')
    let instance = await router.fetch('https://example.com/instance')

    assert.equal(serialized.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.equal(instance.headers.get('Content-Security-Policy'), "script-src 'none'")
  })

  it('applies static rules to every response type when the filter accepts all responses', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          filter: () => true,
        }),
      ],
    })
    router.get('/json', () => Response.json({ ok: true }))
    router.get('/redirect', () => Response.redirect('https://example.com/'))
    router.get('/error', () => new Response('Unavailable', { status: 503 }))

    let json = await router.fetch('https://example.com/json')
    let redirect = await router.fetch('https://example.com/redirect')
    let error = await router.fetch('https://example.com/error')
    assert.equal(json.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.deepEqual(await json.json(), { ok: true })
    assert.equal(redirect.status, 302)
    assert.equal(redirect.headers.get('Location'), 'https://example.com/')
    assert.equal(redirect.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.equal(error.status, 503)
    assert.equal(error.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.equal(await error.text(), 'Unavailable')
  })

  it('applies policies and reporting endpoints only to HTML by default, including HTML errors', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          reportingEndpoints: { enforced: '/reports/enforced' },
        }),
        csp({
          policy: { scriptSrc: ["'self'"] },
          reportOnly: true,
          reportingEndpoints: { preview: '/reports/preview' },
        }),
      ],
    })
    let responses = {
      json: Response.json({ ok: true }),
      redirect: Response.redirect('https://example.com/'),
      error: new Response('Unavailable', { status: 503 }),
      worker: new Response('postMessage("ready")', {
        headers: {
          'Content-Type': 'application/javascript',
          'Content-Security-Policy': "connect-src 'none'",
          'Content-Security-Policy-Report-Only': "script-src 'self'",
          'Reporting-Endpoints': 'existing="/reports/existing"',
          'Cache-Control': 'public, max-age=3600',
        },
      }),
      missingType: new Response(null),
      similarType: new Response('custom', { headers: { 'Content-Type': 'text/html-custom' } }),
    }
    for (let [name, response] of Object.entries(responses)) {
      router.get(`/${name}`, () => response)
    }

    for (let [name, downstream] of Object.entries(responses)) {
      let headers = new Headers(downstream.headers)
      let response = await router.fetch(`https://example.com/${name}`)
      assert.equal(response, downstream)
      assert.deepEqual([...response.headers], [...headers])
      assert.equal(response.bodyUsed, false)
    }

    router.get(
      '/',
      () =>
        new Response('<h1>Unavailable</h1>', {
          status: 503,
          headers: { 'Content-Type': 'TeXt/HtMl ; charset=UTF-8' },
        }),
    )

    let response = await router.fetch('https://example.com/')

    assert.equal(response.status, 503)
    assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.equal(response.headers.get('Content-Security-Policy-Report-Only'), "script-src 'self'")
    assert.equal(
      response.headers.get('Reporting-Endpoints'),
      'preview="/reports/preview", enforced="/reports/enforced"',
    )
    assert.equal(await response.text(), '<h1>Unavailable</h1>')
  })

  it('replaces the HTML filter and filters policies and reporting endpoints together', async () => {
    let policyNonce: string | undefined
    let downstream: Response | undefined
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            policyNonce = nonce
            return { scriptSrc: [`'nonce-${nonce}'`], reportTo: 'csp' }
          },
          reportOnly: true,
          reportingEndpoints: { csp: '/reports/csp' },
          filter: (response) => response.status === 201,
        }),
      ] as const,
    })
    router.get(
      '/worker.js',
      () =>
        new Response('postMessage("ready")', {
          status: 201,
          headers: { 'Content-Type': 'application/javascript' },
        }),
    )
    router.get('/', (context) => {
      let nonce = getCspNonce(context)
      assert.ok(nonce)
      assert.equal(nonce, policyNonce)
      downstream = new Response(nonce, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy': "object-src 'none'",
          'Content-Security-Policy-Report-Only': 'img-src https:',
          'Reporting-Endpoints': 'existing="/reports/existing"',
        },
      })
      return downstream
    })

    let worker = await router.fetch('https://example.com/worker.js')
    assert.equal(worker.headers.get('Content-Security-Policy'), null)
    assert.equal(
      worker.headers.get('Content-Security-Policy-Report-Only'),
      `script-src 'nonce-${policyNonce}'; report-to csp`,
    )
    assert.equal(worker.headers.get('Reporting-Endpoints'), 'csp="/reports/csp"')
    assert.equal(await worker.text(), 'postMessage("ready")')

    let rejected = await router.fetch('https://example.com/')
    assert.equal(rejected, downstream)
    assert.equal(rejected.headers.get('Content-Security-Policy'), "object-src 'none'")
    assert.equal(rejected.headers.get('Content-Security-Policy-Report-Only'), 'img-src https:')
    assert.equal(rejected.headers.get('Reporting-Endpoints'), 'existing="/reports/existing"')
    assert.equal(rejected.bodyUsed, false)
    assert.equal(await rejected.text(), policyNonce)
  })

  it('leaves 304 responses unchanged even when a custom filter accepts them', async () => {
    let downstream = new Response(null, {
      status: 304,
      headers: {
        'Content-Type': 'text/html',
        'Content-Security-Policy': "script-src 'nonce-cached'",
        'Content-Security-Policy-Report-Only': "style-src 'nonce-cached'",
        'Reporting-Endpoints': 'cached="/reports/cached"',
        ETag: 'W/"page-v1"',
      },
    })
    let router = createRouter({
      middleware: [
        csp({
          policy: ({ nonce }) => ({ scriptSrc: [`'nonce-${nonce}'`] }),
          reportingEndpoints: { enforced: '/reports/enforced' },
          filter: () => true,
        }),
        csp({
          policy: ({ nonce }) => ({ styleSrc: [`'nonce-${nonce}'`] }),
          reportOnly: true,
          reportingEndpoints: { preview: '/reports/preview' },
          filter: () => true,
        }),
      ],
    })
    router.get('/cached', () => downstream)
    router.get(
      '/empty',
      () => new Response(null, { status: 304, headers: { 'Content-Type': 'text/html' } }),
    )

    let response = await router.fetch('https://example.com/cached')

    assert.equal(response.headers.get('Content-Security-Policy'), "script-src 'nonce-cached'")
    assert.equal(
      response.headers.get('Content-Security-Policy-Report-Only'),
      "style-src 'nonce-cached'",
    )
    assert.equal(response.headers.get('Reporting-Endpoints'), 'cached="/reports/cached"')
    assert.equal(response.headers.get('ETag'), 'W/"page-v1"')
    assert.equal(response, downstream)

    let empty = await router.fetch('https://example.com/empty')

    assert.equal(empty.status, 304)
    assert.equal(empty.body, null)
    assert.equal(empty.headers.get('Content-Security-Policy'), null)
    assert.equal(empty.headers.get('Content-Security-Policy-Report-Only'), null)
    assert.equal(empty.headers.get('Reporting-Endpoints'), null)
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
          reportingEndpoints: { enforced: '/reports/enforced' },
        }),
        csp({
          policy({ nonce }) {
            return { styleSrc: [`'nonce-${nonce}'`] }
          },
        }),
        csp({
          policy({ nonce }) {
            return { scriptSrc: [`'nonce-${nonce}'`], reportTo: 'preview' }
          },
          reportOnly: true,
          reportingEndpoints: { preview: 'https://reports.example.com/csp' },
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
      'default="/reports/default", enforced="/reports/old", preview="https://reports.example.com/csp", enforced="/reports/enforced"',
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

  it('omits reporting endpoints when unconfigured or empty without inferring a report-to directive', async () => {
    let router = createRouter()
    router.get('/unconfigured', {
      middleware: [
        csp({
          policy: { reportTo: 'csp' },
        }),
      ],
      handler: () => new Response('ok', { headers: { 'Content-Type': 'text/html' } }),
    })
    router.get('/empty', {
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          reportingEndpoints: {},
        }),
      ],
      handler: () => new Response('ok', { headers: { 'Content-Type': 'text/html' } }),
    })
    router.get('/configured', {
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          reportingEndpoints: { csp: '/reports' },
        }),
      ],
      handler: () => new Response('ok', { headers: { 'Content-Type': 'text/html' } }),
    })

    let unconfigured = await router.fetch('https://example.com/unconfigured')
    let empty = await router.fetch('https://example.com/empty')
    let configured = await router.fetch('https://example.com/configured')

    assert.equal(unconfigured.headers.get('Reporting-Endpoints'), null)
    assert.equal(empty.headers.get('Reporting-Endpoints'), null)
    assert.equal(configured.headers.get('Reporting-Endpoints'), 'csp="/reports"')
    assert.equal(configured.headers.get('Content-Security-Policy'), "default-src 'self'")
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
