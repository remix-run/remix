import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRouter } from '@remix-run/fetch-router'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { createElement, css, Frame } from '@remix-run/component'
import { jsx } from '@remix-run/component/jsx-runtime'
import { createTestServer } from '@remix-run/node-fetch-server/test'

import { render } from '../index.ts'

describe('CSP rendering', () => {
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
          filter(response) {
            return response.headers.get('Content-Type')?.split(';')[0] === 'text/html'
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
