import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRouter } from '@remix-run/fetch-router'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import playwrightConfig from '../../playwright.config.ts'

// The shared policy runs WebKit separately from Chromium and Firefox.
const isWebKit =
  playwrightConfig.projects?.every((project) => project.use?.browserName === 'webkit') === true

describe('CSP revalidation', () => {
  it(
    'executes cached nonce-bearing scripts after a 304 response',
    { skip: isWebKit && 'WebKit contexts fetch a fresh document on reload' },
    async (t) => {
      let { router, statuses, nonces } = createFixture()
      let page = await t.serve(await createTestServer(router.fetch))

      let initialResponse = await page.goto('/')
      assert.ok(initialResponse)
      assert.equal(await page.locator('html').getAttribute('data-booted'), 'true')
      await page.reload()

      assert.deepEqual(statuses, [200, 304])
      assert.notEqual(nonces[0], nonces[1])
      assert.equal(await page.locator('html').getAttribute('data-booted'), 'true')
      assert.equal(await page.locator('script').evaluate((script) => script.nonce), nonces[0])
      assert.equal(
        initialResponse.headers()['content-security-policy'],
        `script-src 'nonce-${nonces[0]}'`,
      )
    },
  )

  it(
    'executes fresh nonce-bearing scripts after a WebKit document reload',
    { skip: !isWebKit && 'Fresh-document reload coverage runs in WebKit' },
    async (t) => {
      let { router, statuses, nonces } = createFixture()
      let page = await t.serve(await createTestServer(router.fetch))

      await page.goto('/')
      assert.equal(await page.locator('html').getAttribute('data-booted'), 'true')
      let response = await page.reload()
      assert.ok(response)

      assert.deepEqual(statuses, [200, 200])
      assert.notEqual(nonces[0], nonces[1])
      assert.equal(await page.locator('html').getAttribute('data-booted'), 'true')
      assert.equal(await page.locator('script').evaluate((script) => script.nonce), nonces[1])
      assert.equal(response.headers()['content-security-policy'], `script-src 'nonce-${nonces[1]}'`)
    },
  )
})

function createFixture() {
  let statuses: number[] = []
  let nonces: string[] = []
  let router = createRouter({
    middleware: [csp({ policy: ({ nonce }) => ({ scriptSrc: [`'nonce-${nonce}'`] }) })] as const,
  })
  router.get('/', (context) => {
    let nonce = getCspNonce(context)
    assert.ok(nonce)
    nonces.push(nonce)
    let etag = 'W/"page-v1"'
    let headers = {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
      ETag: etag,
    }
    if (context.headers.get('If-None-Match') === etag) {
      statuses.push(304)
      return new Response(null, { status: 304, headers })
    }
    statuses.push(200)
    return new Response(
      `<!DOCTYPE html><html><head><script nonce="${nonce}">document.documentElement.dataset.booted = 'true'</script></head><body>Hello</body></html>`,
      { headers },
    )
  })
  return { router, statuses, nonces }
}
