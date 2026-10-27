import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRouter } from '@remix-run/fetch-router'
import { ContentSecurityPolicy } from '@remix-run/headers/content-security-policy'

import { csp, CspNonce, getCspNonce, inheritCspNonce } from '../index.ts'

describe('csp', () => {
  it('accepts serialized policies and ContentSecurityPolicy instances in the policy option', async () => {
    let router = createRouter()
    router.get('/serialized', {
      middleware: [csp({ policy: "default-src 'self'" })],
      handler: () => new Response('ok'),
    })
    router.get('/instance', {
      middleware: [csp({ policy: new ContentSecurityPolicy({ scriptSrc: ["'none'"] }) })],
      handler: () => new Response('ok'),
    })

    let serialized = await router.fetch('https://example.com/serialized')
    let instance = await router.fetch('https://example.com/instance')

    assert.equal(serialized.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.equal(instance.headers.get('Content-Security-Policy'), "script-src 'none'")
  })

  it('applies static rules to every response type in its scope', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
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

  it('filters downstream responses so HTML pages receive CSP and asset routes do not', async () => {
    let pageResponse = new Response('<h1>Page</h1>', {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    })
    let assetResponse = new Response('export default 1', {
      headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=3600' },
    })
    let router = createRouter({
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          filter(response) {
            assert.equal(response.headers.get('Content-Security-Policy'), null)
            return (
              response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ===
              'text/html'
            )
          },
        }),
      ],
    })
    router.get('/', () => pageResponse)
    router.get('/assets/app.js', () => assetResponse)

    let page = await router.fetch('https://example.com/')
    let asset = await router.fetch('https://example.com/assets/app.js')

    assert.equal(page.headers.get('Content-Security-Policy'), "default-src 'self'")
    assert.equal(await page.text(), '<h1>Page</h1>')
    assert.equal(asset, assetResponse)
    assert.equal(asset.headers.get('Content-Security-Policy'), null)
    assert.equal(asset.headers.get('Cache-Control'), 'public, max-age=3600')
    assert.equal(await asset.text(), 'export default 1')
  })

  it('preserves existing policies on filtered responses and establishes the nonce before rendering', async () => {
    let policyNonce: string | undefined
    let downstream: Response | undefined
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            policyNonce = nonce
            return { scriptSrc: [`'nonce-${nonce}'`] }
          },
          reportOnly: true,
          filter: () => false,
        }),
      ] as const,
    })
    router.get('/', (context) => {
      let nonce = getCspNonce(context)
      assert.ok(nonce)
      assert.equal(nonce, policyNonce)
      downstream = new Response(nonce, {
        status: 202,
        headers: {
          'Content-Security-Policy': "object-src 'none'",
          'Content-Security-Policy-Report-Only': 'img-src https:',
        },
      })
      return downstream
    })

    let response = await router.fetch('https://example.com/')

    assert.equal(response, downstream)
    assert.equal(response.status, 202)
    assert.equal(response.headers.get('Content-Security-Policy'), "object-src 'none'")
    assert.equal(response.headers.get('Content-Security-Policy-Report-Only'), 'img-src https:')
    assert.equal(response.bodyUsed, false)
    assert.equal(await response.text(), policyNonce)
  })

  it('makes the nonce available to an async policy factory and downstream handlers', async () => {
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
      return new Response(nonce)
    })

    let response = await router.fetch('https://example.com/')
    let nonce = await response.text()
    assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/)
    assert.equal(atob(nonce).length, 16)
    assert.equal(response.headers.get('Content-Security-Policy'), `script-src 'nonce-${nonce}'`)
  })

  it('appends enforced and report-only policies while sharing a nonce', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            return { scriptSrc: [`'nonce-${nonce}'`] }
          },
        }),
        csp({
          policy({ nonce }) {
            return { styleSrc: [`'nonce-${nonce}'`] }
          },
        }),
        csp({
          policy({ nonce }) {
            return { scriptSrc: [`'nonce-${nonce}'`], reportTo: ['csp'] }
          },
          reportOnly: true,
        }),
      ] as const,
    })
    router.get(
      '/',
      (context) =>
        new Response(getCspNonce(context), {
          headers: {
            'Content-Security-Policy': "object-src 'none'",
            'Content-Security-Policy-Report-Only': 'img-src https:',
            'Reporting-Endpoints': 'csp="/reports"',
          },
        }),
    )

    let response = await router.fetch('https://example.com/')
    let nonce = await response.text()

    assert.ok(nonce)
    assert.equal(
      response.headers.get('Content-Security-Policy'),
      `object-src 'none', style-src 'nonce-${nonce}', script-src 'nonce-${nonce}'`,
    )
    assert.equal(
      response.headers.get('Content-Security-Policy-Report-Only'),
      `img-src https:, script-src 'nonce-${nonce}'; report-to csp`,
    )
    assert.equal(response.headers.get('Reporting-Endpoints'), 'csp="/reports"')
  })

  it('adds reporting endpoints for enforced and report-only policies without removing existing endpoints', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            return { scriptSrc: [`'nonce-${nonce}'`], reportTo: ['enforced'] }
          },
          reportingEndpoints: { enforced: '/reports/enforced' },
        }),
        csp({
          policy: { defaultSrc: ["'self'"], reportTo: ['preview'] },
          reportOnly: true,
          reportingEndpoints: { preview: 'https://reports.example.com/csp' },
        }),
      ] as const,
    })
    router.get(
      '/',
      (context) =>
        new Response(getCspNonce(context), {
          headers: { 'Reporting-Endpoints': 'default="/reports/default", enforced="/reports/old"' },
        }),
    )

    let response = await router.fetch('https://example.com/')
    let nonce = await response.text()

    assert.equal(
      response.headers.get('Content-Security-Policy'),
      `script-src 'nonce-${nonce}'; report-to enforced`,
    )
    assert.equal(
      response.headers.get('Content-Security-Policy-Report-Only'),
      "default-src 'self'; report-to preview",
    )
    assert.equal(
      response.headers.get('Reporting-Endpoints'),
      'default="/reports/default", enforced="/reports/old", preview="https://reports.example.com/csp", enforced="/reports/enforced"',
    )
  })

  it('filters reporting endpoints together with the policy and preserves rejected responses', async () => {
    let downstream = new Response('asset', {
      headers: { 'Reporting-Endpoints': 'default="/reports/default"' },
    })
    let router = createRouter({
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"], reportTo: ['csp'] },
          reportOnly: true,
          reportingEndpoints: { csp: '/reports/csp' },
          filter: (response) => response.status === 201,
        }),
      ],
    })
    router.get('/', () => new Response('created', { status: 201 }))
    router.get('/asset', () => downstream)

    let accepted = await router.fetch('https://example.com/')
    let rejected = await router.fetch('https://example.com/asset')

    assert.equal(accepted.headers.get('Content-Security-Policy'), null)
    assert.equal(
      accepted.headers.get('Content-Security-Policy-Report-Only'),
      "default-src 'self'; report-to csp",
    )
    assert.equal(accepted.headers.get('Reporting-Endpoints'), 'csp="/reports/csp"')
    assert.equal(await accepted.text(), 'created')
    assert.equal(rejected, downstream)
    assert.equal(rejected.headers.get('Content-Security-Policy'), null)
    assert.equal(rejected.headers.get('Content-Security-Policy-Report-Only'), null)
    assert.equal(rejected.headers.get('Reporting-Endpoints'), 'default="/reports/default"')
    assert.equal(await rejected.text(), 'asset')
  })

  it('quotes reporting endpoint URLs and replaces an empty downstream header', async () => {
    let router = createRouter({
      middleware: [
        csp({
          policy: { reportTo: ['csp'] },
          reportingEndpoints: {
            csp: String.raw`/reports?label="csp",path=\test`,
            'other_1.*-': '/reports/other',
          },
        }),
      ],
    })
    router.get('/', () => new Response('ok', { headers: { 'Reporting-Endpoints': '' } }))

    let response = await router.fetch('https://example.com/')

    assert.equal(
      response.headers.get('Reporting-Endpoints'),
      String.raw`csp="/reports?label=\"csp\",path=\\test", other_1.*-="/reports/other"`,
    )
  })

  it('rejects reporting endpoint names and URLs that cannot be serialized as structured fields', () => {
    assert.throws(
      () =>
        csp({
          policy: {},
          reportingEndpoints: { CSP: '/reports' },
        }),
      /Invalid reporting endpoint name/,
    )
    assert.throws(
      () =>
        csp({
          policy: {},
          reportingEndpoints: { '': '/reports' },
        }),
      /Invalid reporting endpoint name/,
    )
    assert.throws(
      () =>
        csp({
          policy: {},
          reportingEndpoints: { 'csp,other': '/reports' },
        }),
      /Invalid reporting endpoint name/,
    )
    assert.throws(
      () =>
        csp({
          policy: {},
          reportingEndpoints: { 'csp\n': '/reports' },
        }),
      /Invalid reporting endpoint name/,
    )
    assert.throws(
      () =>
        csp({
          policy: {},
          reportingEndpoints: { csp: '/reports\r\nX-Injected: true' },
        }),
      /Invalid reporting endpoint URL/,
    )
    assert.throws(
      () =>
        csp({
          policy: {},
          reportingEndpoints: { csp: '/r\u00e9ports' },
        }),
      /Invalid reporting endpoint URL/,
    )
  })

  it('omits reporting endpoints when unconfigured or empty without inferring a report-to directive', async () => {
    let router = createRouter()
    router.get('/unconfigured', {
      middleware: [
        csp({
          policy: { reportTo: ['csp'] },
        }),
      ],
      handler: () => new Response('ok'),
    })
    router.get('/empty', {
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          reportingEndpoints: {},
        }),
      ],
      handler: () => new Response('ok'),
    })
    router.get('/configured', {
      middleware: [
        csp({
          policy: { defaultSrc: ["'self'"] },
          reportingEndpoints: { csp: '/reports' },
        }),
      ],
      handler: () => new Response('ok'),
    })

    let unconfigured = await router.fetch('https://example.com/unconfigured')
    let empty = await router.fetch('https://example.com/empty')
    let configured = await router.fetch('https://example.com/configured')

    assert.equal(unconfigured.headers.get('Reporting-Endpoints'), null)
    assert.equal(empty.headers.get('Reporting-Endpoints'), null)
    assert.equal(configured.headers.get('Reporting-Endpoints'), 'csp="/reports"')
    assert.equal(configured.headers.get('Content-Security-Policy'), "default-src 'self'")
  })

  it('creates distinct nonces for concurrent document and frame requests', async () => {
    let router = createRouter({
      middleware: [
        csp({
          async policy({ nonce }) {
            await Promise.resolve()
            return { styleSrc: [`'nonce-${nonce}'`] }
          },
        }),
      ] as const,
    })
    router.get('/', (context) => new Response(getCspNonce(context)))
    let [first, second] = await Promise.all([
      router.fetch('https://example.com/', {
        headers: { 'X-Remix-Frame': 'true' },
      }),
      router.fetch('https://example.com/'),
    ])
    let firstNonce = await first.text()
    let secondNonce = await second.text()
    assert.notEqual(firstNonce, secondNonce)
    assert.equal(first.headers.get('Content-Security-Policy'), `style-src 'nonce-${firstNonce}'`)
    assert.equal(second.headers.get('Content-Security-Policy'), `style-src 'nonce-${secondNonce}'`)
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
    router.get('/', (context) => new Response(getCspNonce(context)))
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
    router.get('/', () => new Response(body, { status: 201 }))
    let response = await router.fetch('https://example.com/')
    assert.equal(response.status, 201)
    assert.equal(response.body, body)
    assert.equal(response.bodyUsed, false)
    writer?.enqueue(new TextEncoder().encode('streamed'))
    writer?.close()
    assert.equal(await response.text(), 'streamed')
  })
})
