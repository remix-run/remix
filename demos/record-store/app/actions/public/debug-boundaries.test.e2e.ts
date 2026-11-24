import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../../../test/helpers.ts'
import { installDebugBoundaries } from './debug-boundaries.ts'

const bookmarklet =
  'javascript:' +
  encodeURIComponent(`void (() => {
  let event = new Event('remix:toggle-debug-boundaries', { cancelable: true })
  if (document.dispatchEvent(event)) (${installDebugBoundaries.toString()})('bookmarklet')
})()`)

describe('frame debug bookmarklet', () => {
  it('toggles standalone boundaries without loading scripts and can be reinstalled', async (t) => {
    let requests: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        requests.push(new URL(request.url).pathname)
        return new Response(
          '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><!--rmx:f:example--><div style="padding:24px">' +
            '<!--rmx:h:example--><p>Album details</p><!--/rmx:h--></div><!--/rmx:f--></body></html>',
          { headers: { 'Content-Type': 'text/html' } },
        )
      }),
    )
    await page.goto('/example')
    await page.evaluate(() => {
      let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node instanceof Comment && node.data === 'rmx:h:example') {
          Object.defineProperty(node, '$rmx', { value: {} })
        }
      }
    })
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await toggleBookmarklet(page)
    let overlay = page.locator('#record-store-debug-boundaries')
    assert.equal(await overlay.locator('[data-boundary="frame"]').count(), 1)
    assert.equal(await overlay.locator('[data-boundary="client-entry"]').count(), 1)
    await toggleBookmarklet(page)
    assert.equal(await overlay.count(), 0)
    await toggleBookmarklet(page)
    assert.equal(await overlay.count(), 1)
    await toggleBookmarklet(page)
    assert.equal(await overlay.count(), 0)
    assert.deepEqual(requests, ['/example'], `Bookmarklet requests: ${JSON.stringify(requests)}`)
    assert.deepEqual(errors, [])
  })

  it('reuses the record store inspector and preserves Cmd-D', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    await page.goto('/albums/bbq')
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      await app.ready()
    })
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    let overlay = page.locator('#record-store-debug-boundaries')
    await page.keyboard.press('Meta+d')
    await overlay.waitFor()
    let original = await overlay.elementHandle()
    assert.ok(original)
    await toggleBookmarklet(page)
    assert.equal(await overlay.count(), 0)
    await toggleBookmarklet(page)
    assert.equal(await overlay.count(), 1)
    assert.equal(await original.evaluate((element) => element.isConnected), true)
    await page.keyboard.press('Meta+d')
    assert.equal(await overlay.count(), 0)
    assert.deepEqual(errors, [])
  })
})

async function toggleBookmarklet(page: Page): Promise<void> {
  await page.evaluate((snippet) => {
    let code = decodeURIComponent(snippet.slice('javascript:'.length))
    ;(0, eval)(code)
  }, bookmarklet)
}
