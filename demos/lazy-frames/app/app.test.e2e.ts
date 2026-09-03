import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { motionArtifact } from './data/exhibits.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'

describe('lazy frames in the browser', () => {
  it('loads a Frame once and pauses its animation offscreen', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let framePath = routes.frames.html.href({ id: motionArtifact.id })
    let frameRequests = 0

    page.on('request', (request) => {
      if (new URL(request.url()).pathname === framePath) frameRequests++
    })

    await page.goto(routes.home.href())
    let lazyExample = page.locator('[data-delivery="lazy"]')
    await lazyExample.waitFor()
    await page.waitForTimeout(100)

    assert.equal(frameRequests, 0)

    await lazyExample.scrollIntoViewIfNeeded()
    await lazyExample.locator('[data-motion-artifact]').waitFor()
    assert.equal(frameRequests, 1)

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForFunction(() => {
      let node = document.querySelector('[data-delivery="lazy"] .edition-orbit__orbit')
      return node !== null && getComputedStyle(node).animationPlayState === 'paused'
    })

    await lazyExample.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => {
      let node = document.querySelector('[data-delivery="lazy"] .edition-orbit__orbit')
      return node !== null && getComputedStyle(node).animationPlayState === 'running'
    })

    assert.equal(frameRequests, 1)
  })

  it('changes theme without requesting an inserted Frame again', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let framePath = routes.frames.interactive.href({ id: 'retained-counter' })
    let frameRequests = 0

    page.on('request', (request) => {
      if (new URL(request.url()).pathname === framePath) frameRequests++
    })

    await page.goto(routes.home.href())
    let lazyExample = page.locator('main > section').last()
    await lazyExample.scrollIntoViewIfNeeded()
    let frame = lazyExample.locator('article')
    await frame.waitFor()

    assert.equal(frameRequests, 1)

    await page.locator('button[aria-label]').click()
    await page.locator('html[data-theme="dark"]').waitFor()

    assert.equal(frameRequests, 1)
    assert.equal(await frame.count(), 1)
  })
})
