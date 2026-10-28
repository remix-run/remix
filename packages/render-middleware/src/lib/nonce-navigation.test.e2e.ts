import * as assert from '@remix-run/assert'
import { createAssetServer } from '@remix-run/assets'
import { createElement, Frame } from '@remix-run/component'
import { jsx } from '@remix-run/component/jsx-runtime'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { createRouter } from '@remix-run/fetch-router'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it } from '@remix-run/test'
import { fileURLToPath } from 'node:url'

import { render } from '../index.ts'

describe('CSP navigation', () => {
  it('updates authorized styles across named-frame and document reloads under an HTTP policy', async (t) => {
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
    let bootstrap = `
      import { run } from ${JSON.stringify(entry.href)}
      let app = run({ async loadModule(href, name) { return (await import(href))[name] } })
      await app.ready()
      Reflect.set(globalThis, 'reloadFrame', async (target) => {
        let frame = target === 'document' ? app.frames.top : app.frames.get('child')
        if (!frame) throw new Error('Missing frame')
        await frame.reload({ src: target === 'document' ? '/next' : '/child?updated' })
      })
      document.documentElement.dataset.ready = 'true'
    `
    let router = createRouter({
      middleware: [
        csp({
          policy: ({ nonce }) => ({
            defaultSrc: ["'none'"],
            connectSrc: ["'self'"],
            scriptSrc: ["'self'", `'nonce-${nonce}'`],
            styleSrc: [`'nonce-${nonce}'`],
          }),
        }),
        render(),
      ] as const,
    })
    router.get('/child', (context) => {
      let updated = context.url.searchParams.has('updated')
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
          createElement(
            'style',
            { id: 'forged-style', nonce: 'forged-nonce' },
            '#forged { color: rgb(255, 0, 0); }',
          ),
          createElement('p', { id: 'forged' }, 'Forged'),
          createElement('style', { id: 'unnonced-style' }, '#unnonced { color: rgb(255, 0, 0); }'),
          createElement('p', { id: 'unnonced' }, 'Unnonced'),
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
          createElement(
            'style',
            { id: 'top-style', nonce },
            `#top-styled { color: ${updated ? 'rgb(21, 43, 65)' : 'rgb(56, 34, 12)'}; }`,
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

    let initialResponse = await page.goto('/')
    assert.ok(initialResponse)
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    let documentNonce = initialResponse
      .headers()
      ['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(documentNonce)
    assert.equal(initialResponse.headers()['x-remix-nonce'], undefined)
    assert.match(initialResponse.headers()['content-security-policy'], /style-src 'nonce-/)
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
    assert.equal(childResponse.headers()['x-remix-nonce'], undefined)
    assert.equal(
      await childStyle.evaluate((element) => element === document.getElementById('child-style')),
      true,
    )
    assert.equal(await page.locator('#child-style').getAttribute('nonce'), '')
    assert.equal(
      await page.locator('#child-style').evaluate((element) => element.nonce),
      documentNonce,
    )
    assert.equal(
      await page.locator('#child-styled').evaluate((element) => getComputedStyle(element).color),
      'rgb(65, 43, 21)',
    )
    assert.equal(
      await page.locator('#forged').evaluate((element) => getComputedStyle(element).color),
      'rgb(0, 0, 0)',
    )
    assert.equal(
      await page.locator('#unnonced').evaluate((element) => getComputedStyle(element).color),
      'rgb(0, 0, 0)',
    )

    let [topResponse] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === '/next'),
      page.evaluate(async () => {
        await Reflect.get(globalThis, 'reloadFrame')('document')
      }),
    ])
    let topNonce = topResponse.headers()['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(topNonce)
    assert.notEqual(topNonce, documentNonce)
    assert.equal(topResponse.headers()['x-remix-nonce'], undefined)
    assert.equal(
      await topStyle.evaluate((element) => element === document.getElementById('top-style')),
      true,
    )
    assert.equal(await page.locator('#top-style').getAttribute('nonce'), '')
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
    assert.equal(
      await page.locator('#forged').evaluate((element) => getComputedStyle(element).color),
      'rgb(0, 0, 0)',
    )
    assert.equal(
      await page.locator('#unnonced').evaluate((element) => getComputedStyle(element).color),
      'rgb(0, 0, 0)',
    )
  })
})
