import * as assert from '@remix-run/assert'
import { createAssetServer } from '@remix-run/assets'
import { createElement, Frame } from '@remix-run/component'
import { jsx } from '@remix-run/component/jsx-runtime'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { createRouter } from '@remix-run/fetch-router'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it, type TestContext } from '@remix-run/test'
import { fileURLToPath } from 'node:url'

import { render } from '../index.ts'

describe('CSP navigation', () => {
  it('keeps the document nonce across frame reloads, document navigation, and streamed frames', async (t) => {
    let { page, documentNonce, reloadFrame, getScriptRequests } = await createNavigationFixture(
      t,
      'enforced',
    )
    assert.equal(
      await page.locator('#child-styled').evaluate((el) => getComputedStyle(el).color),
      'rgb(12, 34, 56)',
    )

    let response = await reloadFrame('named')
    assert.notEqual(
      response.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1],
      documentNonce,
    )
    assert.equal(await page.locator('#child-style').evaluate((el) => el.nonce), documentNonce)
    assert.equal(
      await page.locator('#child-styled').evaluate((el) => getComputedStyle(el).color),
      'rgb(65, 43, 21)',
    )

    await reloadFrame('document')
    assert.equal(await page.title(), 'Next page')
    assert.equal(await page.locator('#top-style').evaluate((el) => el.nonce), documentNonce)
    assert.equal(
      await page.locator('#top-styled').evaluate((el) => getComputedStyle(el).color),
      'rgb(21, 43, 65)',
    )
    assert.equal(
      await page.locator('meta[name="rmx-nonce"]').evaluate((el) => el.nonce),
      documentNonce,
    )
    await page.locator('#late').waitFor()
    assert.equal(
      await page.locator('#late').evaluate((el) => getComputedStyle(el).color),
      'rgb(10, 20, 30)',
    )
    assert.equal(
      await page.evaluate(() => Reflect.get(globalThis, 'navigationScriptRan')),
      undefined,
    )
    assert.deepEqual(getScriptRequests(), [])

    await reloadFrame('invalid')
    await page.waitForFunction(() => Reflect.get(globalThis, 'styleViolations').length === 2)
    assert.equal(await page.locator('#child-style').evaluate((el) => el.nonce), documentNonce)
    assert.equal(await page.locator('#forged-style').evaluate((el) => el.nonce), 'forged-nonce')
    assert.equal(await page.locator('#unnonced-style').getAttribute('nonce'), null)
    assert.equal(
      await page.locator('#forged').evaluate((el) => getComputedStyle(el).color),
      'rgb(0, 0, 0)',
    )
    assert.equal(
      await page.locator('#unnonced').evaluate((el) => getComputedStyle(el).color),
      'rgb(0, 0, 0)',
    )
  })

  it('normalizes report-only response nonces and reports unauthorized styles without blocking them', async (t) => {
    let { page, documentNonce, reloadFrame, getReports } = await createNavigationFixture(
      t,
      'report-only',
    )
    let response = await reloadFrame('named')
    assert.equal(response.headers()['content-security-policy'], undefined)
    assert.notEqual(
      response.headers()['content-security-policy-report-only'].match(/'nonce-([^']+)'/)?.[1],
      documentNonce,
    )
    assert.equal(await page.locator('#child-style').evaluate((el) => el.nonce), documentNonce)
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [])
    assert.equal(getReports(), 0)

    let report = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/csp-report',
    )
    await reloadFrame('invalid')
    await report
    await page.waitForFunction(() => Reflect.get(globalThis, 'styleViolations').length === 2)
    assert.equal(await page.locator('#forged-style').evaluate((el) => el.nonce), 'forged-nonce')
    assert.equal(await page.locator('#unnonced-style').getAttribute('nonce'), null)
    assert.equal(
      await page.locator('#forged').evaluate((el) => getComputedStyle(el).color),
      'rgb(255, 0, 0)',
    )
    assert.equal(
      await page.locator('#unnonced').evaluate((el) => getComputedStyle(el).color),
      'rgb(255, 0, 0)',
    )
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [
      'report',
      'report',
    ])
    assert.ok(getReports() > 0)
  })

  it('accepts a report-only response nonce while the original document enforces its policy', async (t) => {
    let { page, documentNonce, reloadFrame } = await createNavigationFixture(t, 'mixed')
    let response = await reloadFrame('named')
    assert.equal(response.headers()['content-security-policy'], undefined)
    assert.ok(response.headers()['content-security-policy-report-only'])
    assert.equal(await page.locator('#child-style').evaluate((el) => el.nonce), documentNonce)
    assert.equal(
      await page.locator('#child-styled').evaluate((el) => getComputedStyle(el).color),
      'rgb(65, 43, 21)',
    )
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [])
  })
})

async function createNavigationFixture(t: TestContext, mode: 'enforced' | 'report-only' | 'mixed') {
  let assets = createAssetServer({
    rootDir: fileURLToPath(new URL('../../../../', import.meta.url)),
    basePath: '/assets',
    mounts: { component: 'packages/component/src' },
    allowFiles: ['packages/component/src/**'],
    watch: false,
    fingerprint: false,
  })
  t.after(() => assets.close())
  let entry = await assets.getScriptEntry('packages/component/src/runtime/run.ts')
  let reports = 0
  let scriptRequests: string[] = []
  let lateFrame = Promise.withResolvers<void>()
  let bootstrap = `
    import { run } from ${JSON.stringify(entry.href)}
    let app = run({ async loadModule(href, name) { return (await import(href))[name] } })
    await app.ready()
    globalThis.reloadFrame = async target => {
      let frame = target === 'document' ? app.frames.top : app.frames.get('child')
      await frame.reload({ src: target === 'document' ? '/next' : target === 'invalid' ? '/child?updated&invalid' : '/child?updated' })
    }
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
        (mode === 'report-only' || (mode === 'mixed' && context.url.pathname !== '/')
          ? reportOnly
          : enforce)(context, next),
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
  router.get('/script-probe', () => {
    scriptRequests.push('/script-probe')
    return new Response('globalThis.navigationScriptRan = true', {
      headers: { 'Content-Type': 'text/javascript' },
    })
  })
  router.get('/late', async (context) => {
    await lateFrame.promise
    let nonce = getCspNonce(context)
    return context.render(
      createElement(
        'section',
        {},
        createElement('style', { nonce }, '#late { color: rgb(10, 20, 30) }'),
        createElement('p', { id: 'late' }, 'Late frame'),
        jsx('script', { nonce, children: 'globalThis.navigationScriptRan = true' }),
        jsx('script', { nonce, src: '/script-probe' }),
        createElement('svg', {}, jsx('script', { nonce, href: '/script-probe' })),
      ),
    )
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
            '#forged { color: red }',
          ),
        invalid && createElement('p', { id: 'forged' }, 'Forged'),
        invalid && createElement('style', { id: 'unnonced-style' }, '#unnonced { color: red }'),
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
          '#top-styled { color: rgb(21, 43, 65) }',
        ),
        !updated &&
          jsx('script', { type: 'importmap', nonce, children: JSON.stringify(entry.importMap) }),
        !updated && jsx('script', { type: 'module', nonce, children: bootstrap }),
      ),
      createElement(
        'body',
        {},
        createElement('p', { id: 'top-styled' }, 'Top'),
        updated &&
          jsx('script', {
            type: 'module',
            nonce,
            children: 'globalThis.navigationScriptRan = true',
          }),
        createElement(Frame, { name: 'child', src: updated ? '/child?updated' : '/child' }),
        updated &&
          createElement(Frame, { src: '/late', fallback: createElement('p', {}, 'Loading') }),
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
  let initialResponse = await page.goto('/')
  assert.ok(initialResponse)
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  let header =
    mode === 'report-only' ? 'content-security-policy-report-only' : 'content-security-policy'
  let documentNonce = initialResponse.headers()[header].match(/'nonce-([^']+)'/)?.[1]
  assert.ok(documentNonce)
  return {
    page,
    documentNonce,
    getScriptRequests: () => scriptRequests,
    getReports: () => reports,
    async reloadFrame(target: 'named' | 'document' | 'invalid') {
      let [response] = await Promise.all([
        page
          .waitForResponse(
            (response) =>
              new URL(response.url()).pathname === (target === 'document' ? '/next' : '/child'),
          )
          .then((response) => {
            if (target === 'document') lateFrame.resolve()
            return response
          }),
        page.evaluate(async (target) => Reflect.get(globalThis, 'reloadFrame')(target), target),
      ])
      return response
    },
  }
}
