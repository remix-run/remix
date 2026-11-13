// These tests adapt intentional HTTP failures from ES Module Shims 2.8.4 test/shim.ts.
// They use the e2e server because the browser test harness rejects failed requests.
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createErrorTestServer } from './error-server.ts'

describe('Errors', () => {
  it('404 error', async (t) => {
    let page = await t.serve(await createErrorTestServer())

    await page.goto('/load-error')
    await page.locator('#error').waitFor({ state: 'attached' })
    assert.ok(
      (await page.locator('#error').textContent())?.startsWith(
        'TypeError: 404 Not Found ' + new URL('/non-existent.js', page.url()).href,
      ),
    )
  })

  it('network error should include response', async (t) => {
    let page = await t.serve(await createErrorTestServer())

    await page.goto('/load-error')
    await page.locator('#response').waitFor({ state: 'attached' })
    assert.equal(await page.locator('#response').textContent(), 'true')
  })
})
