import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRouter } from '@remix-run/fetch-router'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { createElement, css, Frame } from '@remix-run/component'
import { jsx } from '@remix-run/component/jsx-runtime'
import { createTestServer } from '@remix-run/node-fetch-server/test'

import { render } from '../index.ts'

describe('CSP rendering', () => {
  it('blocks inline and same-origin scripts without matching nonces', async (t) => {
    let router = createRouter({
      middleware: [
        csp({ policy: ({ nonce }) => ({ scriptSrc: [`'nonce-${nonce}'`] }) }),
        render(),
      ] as const,
    })
    let requests: (string | null)[] = []
    router.get('/script.js', (context) => {
      requests.push(context.url.searchParams.get('nonce'))
      return new Response("document.documentElement.dataset.externalAllowed = 'executed'", {
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
            jsx('script', {
              children: "document.documentElement.dataset.missing = 'executed'",
            }),
            jsx('script', {
              nonce: 'incorrect-nonce',
              children: "document.documentElement.dataset.incorrect = 'executed'",
            }),
            jsx('script', {
              nonce: getCspNonce(context),
              children: "document.documentElement.dataset.inlineAllowed = 'executed'",
            }),
            jsx('script', { src: '/script.js?nonce=missing' }),
            jsx('script', { src: '/script.js?nonce=incorrect', nonce: 'incorrect-nonce' }),
            jsx('script', { src: '/script.js?nonce=allowed', nonce: getCspNonce(context) }),
          ),
          createElement('body'),
        ),
      ),
    )
    let page = await t.serve(await createTestServer(router.fetch))
    await page.addInitScript(() => {
      let violations: string[] = []
      Reflect.set(window, 'cspViolations', violations)
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push(`${event.effectiveDirective}: ${event.blockedURI}`)
      })
    })

    await page.goto('/')

    assert.equal(await page.locator('html').getAttribute('data-inline-allowed'), 'executed')
    assert.equal(await page.locator('html').getAttribute('data-external-allowed'), 'executed')
    assert.equal(await page.locator('html').getAttribute('data-missing'), null)
    assert.equal(await page.locator('html').getAttribute('data-incorrect'), null)
    assert.deepEqual(requests, ['allowed'])
    await page.waitForFunction(() => Reflect.get(window, 'cspViolations').length >= 4)
    let violations: string[] = await page.evaluate(() => Reflect.get(window, 'cspViolations'))
    assert.deepEqual(
      violations.sort(),
      [
        `script-src-elem: ${new URL('/script.js?nonce=incorrect', page.url()).href}`,
        `script-src-elem: ${new URL('/script.js?nonce=missing', page.url()).href}`,
        'script-src-elem: inline',
        'script-src-elem: inline',
      ].sort(),
    )
  })

  it('allows authored scripts and blocking frame styles through redirects under an enforced CSP', async (t) => {
    let router = createRouter({
      middleware: [
        csp({
          policy({ nonce }) {
            return {
              defaultSrc: ["'none'"],
              scriptSrc: [`'nonce-${nonce}'`],
              styleSrc: [`'nonce-${nonce}'`],
            }
          },
        }),
        render(),
      ] as const,
    })
    router.get('/', (context) =>
      context.render(
        createElement(
          'html',
          {},
          createElement('head'),
          createElement('body', {}, createElement(Frame, { src: '/first' })),
        ),
      ),
    )
    router.get('/first', (context) => Response.redirect(new URL('/second', context.url)))
    router.get('/second', (context) => Response.redirect(new URL('/child', context.url)))
    router.get('/child', (context) =>
      context.render(
        createElement(
          'section',
          {},
          createElement('p', { id: 'child', mix: css({ color: 'rgb(12, 34, 56)' }) }, 'Child'),
          jsx('script', {
            nonce: getCspNonce(context),
            children: "document.documentElement.dataset.child = 'executed'",
          }),
          createElement(Frame, { src: '/grandchild' }),
        ),
      ),
    )
    router.get('/grandchild', (context) =>
      context.render(
        createElement(
          'p',
          {
            id: 'grandchild',
            mix: css({ color: 'rgb(65, 43, 21)' }),
          },
          'Grandchild',
        ),
      ),
    )

    let page = await t.serve(await createTestServer(router.fetch))
    let response = await page.goto('/')
    assert.ok(response)
    assert.match(response.headers()['content-security-policy'], /script-src 'nonce-/)
    assert.equal(await page.locator('html').getAttribute('data-child'), 'executed')
    assert.equal(
      await page.locator('#child').evaluate((element) => getComputedStyle(element).color),
      'rgb(12, 34, 56)',
    )
    assert.equal(
      await page.locator('#grandchild').evaluate((element) => getComputedStyle(element).color),
      'rgb(65, 43, 21)',
    )
  })
})
