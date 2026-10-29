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

describe('CSP navigation', () => {
  it('updates authorized styles and keeps scripts inert across frame reloads under an HTTP policy', async (t) => {
    await exerciseNavigation(t, false)
  })

  it('updates authorized styles and keeps scripts inert across frame reloads with strict-dynamic', async (t) => {
    await exerciseNavigation(t, true)
  })

  async function exerciseNavigation(t: TestContext, strictDynamic: boolean) {
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
    let scriptRequests = 0
    let lateFrame = Promise.withResolvers<void>()
    let bootstrap = `
      import { run } from ${JSON.stringify(entry.href)}
      let app = run({ async loadModule(href, name) { return (await import(href))[name] } })
      await app.ready()
      Reflect.set(globalThis, 'reloadFrame', async (target, blocked = false) => {
        let frame = target === 'document' ? app.frames.top : app.frames.get('child')
        if (!frame) throw new Error('Missing frame')
        await frame.reload({ src: target === 'document' ? '/next' : blocked ? '/child?updated&blocked' : '/child?updated' })
      })
      document.documentElement.dataset.ready = 'true'
    `
    let router = createRouter({
      middleware: [
        csp({
          policy: ({ nonce }) => ({
            defaultSrc: ["'none'"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'"],
            scriptSrc: [strictDynamic ? "'strict-dynamic'" : "'self'", `'nonce-${nonce}'`],
            styleSrc: [`'nonce-${nonce}'`, "'report-sample'"],
            reportUri: ['/csp-report'],
          }),
        }),
        render(),
      ] as const,
    })
    router.post('/csp-report', async ({ request }) => {
      let body: unknown = await request.json()
      assert.ok(typeof body === 'object' && body !== null && 'csp-report' in body)
      let report = body['csp-report']
      assert.ok(typeof report === 'object' && report !== null && 'effective-directive' in report)
      if (report['effective-directive'] === 'style-src-elem') {
        reports++
      }
      return new Response(null, { status: 204 })
    })
    router.get('/script-probe', () => {
      scriptRequests++
      return new Response('globalThis.navigationScriptRan = true', {
        headers: { 'Content-Type': 'text/javascript' },
      })
    })
    router.get('/late', async (context) => {
      await lateFrame.promise
      return context.render(
        createElement(
          'section',
          {},
          createElement(
            'style',
            { nonce: getCspNonce(context) },
            '#late { color: rgb(10, 20, 30) }',
          ),
          createElement('p', { id: 'late' }, 'Late frame'),
          jsx('script', {
            nonce: getCspNonce(context),
            children: 'globalThis.navigationScriptRan = true',
          }),
          createElement(
            'svg',
            {},
            jsx('script', {
              id: 'late-svg-script',
              type: 'text/javascript',
              nonce: getCspNonce(context),
              children: 'globalThis.navigationScriptRan = true',
            }),
            jsx('script', { nonce: getCspNonce(context), href: '/script-probe' }),
            jsx('script', { nonce: getCspNonce(context), 'xlink:href': '/script-probe' }),
          ),
        ),
      )
    })
    router.get('/child', (context) => {
      let updated = context.url.searchParams.has('updated')
      let blocked = context.url.searchParams.has('blocked')
      return context.render(
        createElement(
          'section',
          {},
          createElement(
            'style',
            { id: 'child-style', nonce: getCspNonce(context) },
            `#child-styled { color: ${updated ? 'rgb(65, 43, 21)' : 'rgb(12, 34, 56)'}; }`,
          ),
          createElement('p', { id: 'child-styled' }, 'Child'),
          blocked &&
            createElement(
              'style',
              { id: 'forged-style', nonce: 'forged-nonce' },
              '#forged { color: rgb(255, 0, 0); }',
            ),
          createElement('p', { id: 'forged' }, 'Forged'),
          blocked &&
            createElement(
              'style',
              { id: 'unnonced-style' },
              '#unnonced { color: rgb(255, 0, 0); }',
            ),
          createElement('p', { id: 'unnonced' }, 'Unnonced'),
        ),
      )
    })
    function createDocument(nonce: string | undefined, updated: boolean) {
      return createElement(
        'html',
        { lang: updated ? 'fr' : 'en', dir: updated ? 'rtl' : 'ltr', 'data-label': 'A > B & C' },
        createElement(
          'head',
          { 'data-page': updated ? 'next' : 'initial' },
          createElement('title', {}, updated ? 'Next page' : 'Initial page'),
          createElement(
            'style',
            { id: 'top-style', nonce },
            `#top-styled { color: ${updated ? 'rgb(21, 43, 65)' : 'rgb(56, 34, 12)'}; }`,
          ),
          !updated &&
            jsx('script', { type: 'importmap', nonce, children: JSON.stringify(entry.importMap) }),
          !updated && jsx('script', { type: 'module', nonce, children: bootstrap }),
          updated &&
            createElement(
              'noscript',
              {},
              createElement('style', {}, '#noscript { color: rgb(255, 0, 0) }'),
            ),
        ),
        createElement(
          'body',
          { className: updated ? 'next-page' : 'initial-page' },
          createElement('p', { id: 'top-styled' }, 'Top'),
          updated && jsx('script', { nonce, children: 'globalThis.navigationScriptRan = true' }),
          updated && jsx('script', { nonce, src: '/script-probe' }),
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
        if (event.effectiveDirective === 'style-src-elem') violations.push(event.sample)
      })
    })
    let initialResponse = await page.goto('/')
    assert.ok(initialResponse)
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    let documentNonce = initialResponse
      .headers()
      ['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(documentNonce)
    let childStyle = await page.locator('#child-style').elementHandle()
    let topStyle = await page.locator('#top-style').elementHandle()
    assert.ok(childStyle && topStyle)
    assert.equal(await page.locator('#child-style').getAttribute('nonce'), '')
    assert.equal(
      await page.locator('#child-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.equal(
      await page.locator('#child-styled').evaluate((element) => getComputedStyle(element).color),
      'rgb(12, 34, 56)',
    )

    let [childResponse] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).search === '?updated'),
      page.evaluate(async () => {
        await Reflect.get(globalThis, 'reloadFrame')('named')
      }),
    ])
    let childNonce = childResponse
      .headers()
      ['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(childNonce)
    assert.notEqual(childNonce, documentNonce)
    assert.equal(
      await childStyle.evaluate((element) => element === document.getElementById('child-style')),
      true,
    )
    assert.equal(
      await page.locator('#child-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.equal(
      await page.locator('#child-styled').evaluate((element) => getComputedStyle(element).color),
      'rgb(65, 43, 21)',
    )

    let [topResponse] = await Promise.all([
      page
        .waitForResponse((response) => new URL(response.url()).pathname === '/next')
        .then((response) => {
          lateFrame.resolve()
          return response
        }),
      page.evaluate(async () => {
        await Reflect.get(globalThis, 'reloadFrame')('document')
      }),
    ])
    let topNonce = topResponse.headers()['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(topNonce)
    assert.notEqual(topNonce, documentNonce)
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr')
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl')
    assert.equal(await page.locator('html').getAttribute('data-label'), 'A > B & C')
    assert.equal(await page.locator('head').getAttribute('data-page'), 'next')
    assert.equal(await page.locator('body').getAttribute('class'), 'next-page')
    assert.equal(await page.title(), 'Next page')
    assert.equal(
      await topStyle.evaluate((element) => element === document.getElementById('top-style')),
      true,
    )
    assert.equal(
      await page.locator('#top-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.equal(
      await page.locator('#top-styled').evaluate((element) => getComputedStyle(element).color),
      'rgb(21, 43, 65)',
    )
    assert.equal(
      await page.locator('head meta[name="rmx-nonce"]').evaluate((element) => element.nonce),
      documentNonce,
    )
    await page.locator('#late').waitFor()
    assert.equal(
      await page.locator('#late').evaluate((element) => getComputedStyle(element).color),
      'rgb(10, 20, 30)',
    )
    assert.equal(await page.locator('noscript').textContent(), '')
    assert.deepEqual(
      await page.locator('#late-svg-script').evaluate((script) => ({
        namespace: script.namespaceURI,
        nonce: script.nonce,
        type: script.getAttribute('type'),
        content: script.textContent,
      })),
      {
        namespace: 'http://www.w3.org/2000/svg',
        nonce: documentNonce,
        type: 'text/javascript',
        content: 'globalThis.navigationScriptRan = true',
      },
    )
    assert.equal(
      await page
        .locator('svg script')
        .last()
        .evaluate((script) => script.getAttributeNS('http://www.w3.org/1999/xlink', 'href')),
      '/script-probe',
    )
    assert.equal(
      await page.evaluate(() => Reflect.get(globalThis, 'navigationScriptRan')),
      undefined,
    )
    assert.equal(scriptRequests, 0)
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'styleViolations')), [])
    assert.equal(reports, 0)

    let blockedReport = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/csp-report',
    )
    await page.evaluate(async () => {
      await Reflect.get(globalThis, 'reloadFrame')('named', true)
    })
    await blockedReport
    assert.equal(
      await page.locator('#forged').evaluate((element) => getComputedStyle(element).color),
      'rgb(0, 0, 0)',
    )
    assert.equal(
      await page.locator('#unnonced').evaluate((element) => getComputedStyle(element).color),
      'rgb(0, 0, 0)',
    )
    assert.equal(
      await page.locator('#forged-style').evaluate((element) => element.nonce),
      'forged-nonce',
    )
    assert.equal(await page.locator('#unnonced-style').getAttribute('nonce'), null)
    let violations: string[] = await page.evaluate(() => Reflect.get(globalThis, 'styleViolations'))
    assert.equal(violations.length, 2)
    assert.ok(reports > 0)
  }
})
