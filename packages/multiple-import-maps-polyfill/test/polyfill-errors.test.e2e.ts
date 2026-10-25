// This test adapts an intentional HTTP failure from ES Module Shims 2.8.4 test/polyfill.ts.
// It uses the e2e server because the browser test harness rejects failed requests.
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createErrorTestServer } from './error-server.ts'

describe('Polyfill tests', () => {
  it('should support dyanmic import failure', async (t) => {
    let page = await t.serve(await createErrorTestServer())

    await page.goto('/dynamic-import-failure')
    await page.locator('#result').waitFor({ state: 'attached' })
    assert.equal(await page.locator('#result').textContent(), 'true')
  })
})
