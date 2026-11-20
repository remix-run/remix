import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRouter } from '@remix-run/fetch-router'
import { csp, getCspNonce } from '@remix-run/csp-middleware'
import { createTestServer } from '@remix-run/node-fetch-server/test'

describe('CSP revalidation', () => {
  it('executes nonce-bearing scripts after reloading a document', async (t) => {
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
    let page = await t.serve(await createTestServer(router.fetch))

    let initialResponse = await page.goto('/')
    assert.ok(initialResponse)
    assert.equal(await page.locator('html').getAttribute('data-booted'), 'true')
    let response = await page.reload()
    assert.ok(response)

    // Playwright's WebKit contexts do not retain the document's HTTP cache across reloads.
    let isWebKit = page.context().browser()?.browserType().name() === 'webkit'
    assert.deepEqual(statuses, isWebKit ? [200, 200] : [200, 304])
    assert.notEqual(nonces[0], nonces[1])
    assert.equal(await page.locator('html').getAttribute('data-booted'), 'true')
    let documentNonce = isWebKit ? nonces[1] : nonces[0]
    assert.equal(await page.locator('script').evaluate((script) => script.nonce), documentNonce)
    assert.equal(
      (isWebKit ? response : initialResponse).headers()['content-security-policy'],
      `script-src 'nonce-${documentNonce}'`,
    )
  })
})
