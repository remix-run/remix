import * as assert from '@remix-run/assert'
import { createAssetServer } from '@remix-run/assets'
import { clientEntry, createElement, Frame } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { jsx } from '@remix-run/component/jsx-runtime'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { createRouter } from '@remix-run/fetch-router'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it } from '@remix-run/test'
import { fileURLToPath } from 'node:url'

import { render } from '../index.ts'

describe('strict-dynamic', () => {
  it('allows scripts loaded by a trusted script while blocking parser-inserted scripts without a nonce', async (t) => {
    let requests: string[] = []
    let router = createRouter({
      middleware: [
        csp({
          policy: ({ nonce }) => ({
            scriptSrc: ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
          }),
        }),
        render(),
      ] as const,
    })
    router.get('/script.js', (context) => {
      let source = context.url.searchParams.get('source')
      assert.ok(source)
      requests.push(source)
      return new Response(`document.documentElement.dataset[${JSON.stringify(source)}] = 'ran'`, {
        headers: { 'Content-Type': 'text/javascript' },
      })
    })
    router.get('/', (context) =>
      context.render(
        createElement(
          'html',
          {},
          createElement(
            'head',
            {},
            jsx('script', { src: '/script.js?source=parser' }),
            jsx('script', {
              nonce: 'incorrect-nonce',
              children: "document.documentElement.dataset.inline = 'ran'",
            }),
            jsx('script', {
              nonce: getCspNonce(context),
              children: `
                let script = document.createElement('script')
                script.id = 'dynamic-script'
                script.src = '/script.js?source=dynamic'
                document.head.append(script)
              `,
            }),
          ),
          createElement('body'),
        ),
      ),
    )
    let page = await t.serve(await createTestServer(router.fetch))
    await page.addInitScript(() => {
      let violations: string[] = []
      Reflect.set(globalThis, 'violations', violations)
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push(event.blockedURI)
      })
    })

    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.dynamic === 'ran')
    await page.waitForFunction(() => Reflect.get(globalThis, 'violations').length === 2)

    assert.deepEqual(requests, ['dynamic'])
    assert.equal(await page.locator('#dynamic-script').getAttribute('nonce'), null)
    assert.equal(await page.locator('html').getAttribute('data-parser'), null)
    assert.equal(await page.locator('html').getAttribute('data-inline'), null)
    assert.deepEqual(
      (await page.evaluate<string[]>(() => Reflect.get(globalThis, 'violations'))).sort(),
      [new URL('/script.js?source=parser', page.url()).href, 'inline'].sort(),
    )
  })

  it('loads a late island and import map while translating its response nonce for styles', async (t) => {
    let assets = createAssetServer({
      rootDir: fileURLToPath(new URL('../../../../', import.meta.url)),
      basePath: '/assets',
      mounts: {
        component: 'packages/component/src',
        polyfill: 'packages/multiple-import-maps-polyfill/src',
        fixtures: 'packages/render-middleware/src/lib/fixtures',
      },
      allowFiles: [
        'packages/component/src/**',
        'packages/multiple-import-maps-polyfill/src/**',
        'packages/render-middleware/src/lib/fixtures/**',
      ],
      allowPackages: ['es-module-lexer'],
      watch: false,
      fingerprint: false,
    })
    t.after(() => assets.close())
    let entry = await assets.getScriptEntry(
      'packages/render-middleware/src/lib/fixtures/strict-dynamic-entry.ts',
    )
    let Island = clientEntry(
      'file:///app/island.ts#Island',
      function Island(handle: Handle<{ nonce: string }>) {
        return () =>
          createElement(
            'section',
            {},
            createElement(
              'style',
              { id: 'island-style', nonce: handle.props.nonce },
              '#island-target { color: rgb(12, 34, 56) }',
            ),
            createElement('p', { id: 'island-target' }, 'Late island'),
          )
      },
    )
    let router = createRouter({
      middleware: [
        csp({
          policy: ({ nonce }) => ({
            defaultSrc: ["'none'"],
            connectSrc: ["'self'", 'blob:'],
            imgSrc: ["'self'"],
            frameSrc: ["'self'"],
            scriptSrc: [`'nonce-${nonce}'`, "'strict-dynamic'"],
            styleSrc: [`'nonce-${nonce}'`],
          }),
        }),
        render({
          assets: {
            async getScriptEntry() {
              return {
                href: '/island.js',
                importMap: { imports: { 'late-dependency': '/dependency.js' } },
                preloads: ['/island.js'],
              }
            },
          },
        }),
      ] as const,
    })
    router.get(
      '/island.js',
      () =>
        new Response(
          `
          import { createElement } from ${JSON.stringify(entry.href)}
          import { label } from 'late-dependency'
          export function Island(handle) {
            handle.queueTask(() => { document.documentElement.dataset.hydrated = 'true' })
            return () => createElement('section', {},
              createElement('style', { id: 'island-style', nonce: handle.props.nonce },
                '#island-target { color: rgb(12, 34, 56) }'),
              createElement('p', { id: 'island-target' }, label),
            )
          }
        `,
          { headers: { 'Content-Type': 'text/javascript' } },
        ),
    )
    router.get(
      '/dependency.js',
      () =>
        new Response("export let label = 'Late island'", {
          headers: { 'Content-Type': 'text/javascript' },
        }),
    )
    router.get('/child', (context) => {
      let nonce = getCspNonce(context)
      assert.ok(nonce)
      return context.render(
        context.url.searchParams.has('updated')
          ? createElement(Island, { nonce })
          : createElement('p', {}, 'Initial frame'),
      )
    })
    router.get('/', (context) =>
      context.render(
        createElement(
          'html',
          {},
          createElement(
            'head',
            {},
            jsx('script', {
              type: 'importmap',
              nonce: getCspNonce(context),
              children: JSON.stringify(entry.importMap),
            }),
            jsx('script', {
              type: 'module',
              nonce: getCspNonce(context),
              children: `
                import { run, detectMultipleImportMapSupport, importModule, preloadShim } from ${JSON.stringify(entry.href)}
                let app = run({
                  async loadModule(href, name) { return (await importModule(href))[name] },
                  async processClientEntryPreloads(preloads) {
                    if (await detectMultipleImportMapSupport()) return preloads
                    preloadShim(preloads)
                    return []
                  },
                })
                app.addEventListener('error', event => { document.documentElement.dataset.error = String(event.error) })
                await app.ready()
                globalThis.reloadFrame = () => app.frames.get('child').reload({ src: '/child?updated' })
                document.documentElement.dataset.ready = 'true'
              `,
            }),
          ),
          createElement('body', {}, createElement(Frame, { name: 'child', src: '/child' })),
        ),
      ),
    )
    let page = await t.serve(
      await createTestServer(
        async (request) => (await assets.fetch(request)) ?? router.fetch(request),
      ),
    )
    await page.addInitScript(() => {
      let violations: string[] = []
      Reflect.set(globalThis, 'violations', violations)
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push(`${event.effectiveDirective}: ${event.blockedURI}`)
      })
    })

    let initialResponse = await page.goto('/')
    assert.ok(initialResponse)
    let documentNonce = initialResponse
      .headers()
      ['content-security-policy'].match(/'nonce-([^']+)'/)?.[1]
    assert.ok(documentNonce)
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')

    let [response] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).search === '?updated'),
      page.evaluate(async () => {
        await Reflect.get(globalThis, 'reloadFrame')()
      }),
    ])
    let responseNonce = response.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1]
    assert.ok(responseNonce)
    assert.notEqual(responseNonce, documentNonce)
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.hydrated === 'true' ||
        document.documentElement.dataset.error,
    )
    assert.equal(await page.locator('html').getAttribute('data-error'), null)

    assert.equal(await page.locator('#island-target').textContent(), 'Late island')
    assert.equal(
      await page.locator('#island-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.equal(
      await page.locator('#island-target').evaluate((element) => getComputedStyle(element).color),
      'rgb(12, 34, 56)',
    )
    assert.deepEqual(await page.evaluate(() => Reflect.get(globalThis, 'violations')), [])
  })
})
