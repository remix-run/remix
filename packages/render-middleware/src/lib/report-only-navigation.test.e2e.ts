import * as assert from '@remix-run/assert'
import { createAssetServer } from '@remix-run/assets'
import { createElement, Frame } from '@remix-run/component'
import { jsx } from '@remix-run/component/jsx-runtime'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { createRouter } from '@remix-run/fetch-router'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { fileURLToPath } from 'node:url'

import { render } from '../index.ts'

describe('report-only CSP navigation', () => {
  it('preserves valid nonces across frame and document reloads while reporting invalid nonces', async (t) => {
    let { page, getReports } = await createNavigationFixture(t, false)
    let initialResponse = await page.goto('/')
    assert.ok(initialResponse)
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    let documentNonce = initialResponse
      .headers()
      ['content-security-policy-report-only']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(documentNonce)

    let [childResponse] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).search === '?updated'),
      page.evaluate(async () => Reflect.get(globalThis, 'reloadFrame')('named')),
    ])
    let childNonce = childResponse
      .headers()
      ['content-security-policy-report-only']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(childNonce)
    assert.notEqual(childNonce, documentNonce)
    assert.equal(
      await page.locator('#child-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.equal(
      await page.locator('#child-styled').evaluate((element) => getComputedStyle(element).color),
      'rgb(65, 43, 21)',
    )
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [])
    assert.equal(getReports(), 0)

    let [clientResponse] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).search === '?client'),
      page.evaluate(async () => Reflect.get(globalThis, 'insertClientFrame')()),
    ])
    let clientNonce = clientResponse
      .headers()
      ['content-security-policy-report-only']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(clientNonce)
    assert.notEqual(clientNonce, documentNonce)
    assert.equal(
      await page.locator('#child-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.equal(
      await page.locator('#child-styled').evaluate((element) => getComputedStyle(element).color),
      'rgb(12, 34, 56)',
    )
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [])
    assert.equal(getReports(), 0)

    let [topResponse] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === '/next'),
      page.evaluate(async () => Reflect.get(globalThis, 'reloadFrame')('document')),
    ])
    let topNonce = topResponse
      .headers()
      ['content-security-policy-report-only']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(topNonce)
    assert.notEqual(topNonce, documentNonce)
    assert.equal(
      await page.locator('#top-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.equal(
      await page.locator('#top-styled').evaluate((element) => getComputedStyle(element).color),
      'rgb(21, 43, 65)',
    )
    assert.equal(
      await page.locator('#child-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [])
    assert.equal(getReports(), 0)

    let reportReceived = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/csp-report',
    )
    await page.evaluate(async () => Reflect.get(globalThis, 'reloadFrame')('invalid'))
    await reportReceived
    await page.waitForFunction(() => Reflect.get(globalThis, 'styleViolations').length === 2)
    assert.equal(
      await page.locator('#forged-style').evaluate((element) => element.nonce),
      'forged-nonce',
    )
    assert.equal(await page.locator('#unnonced-style').getAttribute('nonce'), null)
    assert.equal(
      await page.locator('#forged').evaluate((element) => getComputedStyle(element).color),
      'rgb(255, 0, 0)',
    )
    assert.equal(
      await page.locator('#unnonced').evaluate((element) => getComputedStyle(element).color),
      'rgb(255, 0, 0)',
    )
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [
      'report',
      'report',
    ])
    assert.ok(getReports() > 0)
  })

  it('does not authorize report-only response nonces in a document with an enforced policy', async (t) => {
    let { page, getReports } = await createNavigationFixture(t, true)
    let initialResponse = await page.goto('/')
    assert.ok(initialResponse)
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    let documentNonce = initialResponse
      .headers()
      ['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(documentNonce)

    let reportReceived = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/csp-report',
    )
    let [childResponse] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).search === '?updated'),
      page.evaluate(async () => Reflect.get(globalThis, 'reloadFrame')('named')),
    ])
    await reportReceived
    let childNonce = childResponse
      .headers()
      ['content-security-policy-report-only']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(childNonce)
    assert.notEqual(childNonce, documentNonce)
    assert.equal(childResponse.headers()['content-security-policy'], undefined)
    assert.equal(
      await page.locator('#child-style').evaluate((element) => element.nonce),
      childNonce,
    )
    assert.notEqual(
      await page.locator('#child-styled').evaluate((element) => getComputedStyle(element).color),
      'rgb(65, 43, 21)',
    )
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [
      'enforce',
    ])
    assert.ok(getReports() > 0)
  })
})

async function createNavigationFixture(t: TestContext, enforcedDocument: boolean) {
  let assets = createAssetServer({
    rootDir: fileURLToPath(new URL('../../../../', import.meta.url)),
    basePath: '/assets',
    mounts: { component: 'packages/component/src' },
    allowFiles: ['packages/component/src/**'],
    watch: false,
    fingerprint: false,
  })
  t.after(() => assets.close())
  let entry = await assets.getScriptEntry('packages/component/src/index.ts')
  let reports = 0
  let bootstrap = `
    import { run, createElement, Frame } from ${JSON.stringify(entry.href)}
    let app = run({
      ${enforcedDocument ? '' : 'reportOnlyCsp: true,'}
      async loadModule(href, name) { return (await import(href))[name] }
    })
    await app.ready()
    Reflect.set(globalThis, 'reloadFrame', async (target) => {
      let frame = target === 'document' ? app.frames.top : app.frames.get('child')
      if (!frame) throw new Error('Missing frame')
      await frame.reload({ src: target === 'document' ? '/next' : target === 'invalid' ? '/child?updated&invalid' : '/child?updated' })
    })
    Reflect.set(globalThis, 'insertClientFrame', async () => {
      await app.frames.top.replace(createElement(Frame, { name: 'child', src: '/child?client' }))
      await app.ready()
    })
    document.documentElement.dataset.ready = 'true'
  `
  function policy({ nonce }: { nonce: string }) {
    return {
      defaultSrc: ["'none'"],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'", `'nonce-${nonce}'`],
      styleSrc: [`'nonce-${nonce}'`],
      reportUri: ['/csp-report'],
    }
  }
  let enforce = csp({ policy })
  let reportOnly = csp({ reportOnlyPolicy: policy })
  let router = createRouter({
    middleware: [
      (context, next) =>
        (enforcedDocument && context.url.pathname === '/' ? enforce : reportOnly)(context, next),
      render(),
    ] as const,
  })
  router.post('/csp-report', async ({ request }) => {
    let body: unknown = await request.json()
    assert.ok(typeof body === 'object' && body !== null && 'csp-report' in body)
    let report = body['csp-report']
    assert.ok(typeof report === 'object' && report !== null && 'effective-directive' in report)
    if (report['effective-directive'] === 'style-src-elem') reports++
    return new Response(null, { status: 204 })
  })
  router.get('/child', (context) => {
    let updated = context.url.searchParams.has('updated')
    let invalid = context.url.searchParams.has('invalid')
    return context.render(
      createElement(
        'section',
        {},
        createElement(
          'style',
          { id: 'child-style', nonce: getCspNonce(context) },
          `#child-styled { color: ${updated ? 'rgb(65, 43, 21)' : 'rgb(12, 34, 56)'} }`,
        ),
        createElement('p', { id: 'child-styled' }, 'Child'),
        invalid &&
          createElement(
            'style',
            { id: 'forged-style', nonce: 'forged-nonce' },
            '#forged { color: rgb(255, 0, 0) }',
          ),
        invalid && createElement('p', { id: 'forged' }, 'Forged'),
        invalid &&
          createElement('style', { id: 'unnonced-style' }, '#unnonced { color: rgb(255, 0, 0) }'),
        invalid && createElement('p', { id: 'unnonced' }, 'Unnonced'),
      ),
    )
  })
  function createDocument(nonce: string | undefined, updated: boolean) {
    return createElement(
      'html',
      {},
      createElement(
        'head',
        {},
        createElement('title', {}, updated ? 'Next page' : 'Initial page'),
        createElement(
          'style',
          { id: 'top-style', nonce },
          `#top-styled { color: ${updated ? 'rgb(21, 43, 65)' : 'rgb(56, 34, 12)'} }`,
        ),
        !updated &&
          jsx('script', { type: 'importmap', nonce, children: JSON.stringify(entry.importMap) }),
        !updated && jsx('script', { type: 'module', nonce, children: bootstrap }),
      ),
      createElement(
        'body',
        {},
        createElement('p', { id: 'top-styled' }, 'Top'),
        createElement(Frame, { name: 'child', src: updated ? '/child?updated' : '/child' }),
      ),
    )
  }
  router.get('/', (context) => context.render(createDocument(getCspNonce(context), false)))
  router.get('/next', (context) => context.render(createDocument(getCspNonce(context), true)))
  let page = await t.serve(
    await createTestServer(
      async (request) => (await assets.fetch(request)) ?? router.fetch(request),
    ),
  )
  await page.addInitScript(() => {
    let violations: string[] = []
    Reflect.set(globalThis, 'styleViolations', violations)
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.effectiveDirective === 'style-src-elem') violations.push(event.disposition)
    })
  })
  return { page, getReports: () => reports }
}
