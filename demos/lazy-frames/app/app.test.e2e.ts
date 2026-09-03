import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { motionArtifact } from './data/exhibits.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'

describe('lazy frames in the browser', () => {
  it('persists the global latency toggle and applies it to browser requests', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let framePath = routes.frames.ui.href({ id: 'signal-board' })

    await page.goto(routes.home.href())
    await page.getByRole('button', { name: 'Enable' }).click()
    await page.getByText('Global latency on', { exact: true }).waitFor()

    let enabledTiming = await page.evaluate(async (href) => {
      let response = await fetch(href)
      return response.headers.get('Server-Timing')
    }, framePath)
    assert.equal(enabledTiming, 'demo-latency;dur=20')

    await page.getByRole('button', { name: 'Disable' }).click()
    await page.getByText('Global latency off', { exact: true }).waitFor()

    let disabledTiming = await page.evaluate(async (href) => {
      let response = await fetch(href)
      return response.headers.get('Server-Timing')
    }, framePath)
    assert.equal(disabledTiming, null)
  })

  it('themes every inserted response shape from the document root without refetching', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let frameRequests = 0

    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/frames/')) frameRequests++
    })

    await page.goto(routes.home.href())

    let plainFrame = page.locator('#field-notes .plain-frame')
    await page.locator('#field-notes').scrollIntoViewIfNeeded()
    await plainFrame.waitFor()

    let uiFrame = page.locator('#signal-board article')
    await page.locator('#signal-board').scrollIntoViewIfNeeded()
    await uiFrame.waitFor()

    let interactiveFrame = page.locator('#idea-counter article')
    await page.locator('#idea-counter').scrollIntoViewIfNeeded()
    await interactiveFrame.waitFor()
    await page
      .locator('#idea-counter')
      .getByRole('button', { name: 'Increment local count' })
      .click()
    await page.getByText('Local count: 13', { exact: true }).waitFor()

    let eagerMotionArtifact = page.locator('[data-delivery="eager"] [data-motion-artifact]')
    let lightMotionBackground = await eagerMotionArtifact.evaluate(
      (node) => getComputedStyle(node).backgroundImage,
    )
    let lightPlainBackground = await plainFrame.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    )
    let lightUiBackground = await uiFrame.evaluate((node) => getComputedStyle(node).backgroundColor)
    let lightInteractiveBackground = await interactiveFrame.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    )
    let requestsBeforeThemeChange = frameRequests

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await page.locator('html[data-theme="dark"]').waitFor()
    await page.waitForTimeout(220)

    assert.notEqual(
      await eagerMotionArtifact.evaluate((node) => getComputedStyle(node).backgroundImage),
      lightMotionBackground,
    )
    assert.notEqual(
      await plainFrame.evaluate((node) => getComputedStyle(node).backgroundColor),
      lightPlainBackground,
    )
    assert.notEqual(
      await uiFrame.evaluate((node) => getComputedStyle(node).backgroundColor),
      lightUiBackground,
    )
    assert.notEqual(
      await interactiveFrame.evaluate((node) => getComputedStyle(node).backgroundColor),
      lightInteractiveBackground,
    )
    assert.equal(frameRequests, requestsBeforeThemeChange)
    assert.equal(await page.getByText('Local count: 13', { exact: true }).count(), 1)

    await page.reload()
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  })

  it('renders a motion artifact eagerly and requests the same artifact lazily', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let framePath = routes.frames.html.href({ id: motionArtifact.id })
    let browserRequests = 0

    page.on('request', (request) => {
      if (new URL(request.url()).pathname === framePath) browserRequests++
    })

    await page.goto(routes.home.href())
    let eagerArtifact = page.locator(
      `[data-delivery="eager"] [data-motion-artifact="${motionArtifact.id}"]`,
    )
    let lazyExample = page.locator('[data-delivery="lazy"]')

    await eagerArtifact.waitFor()
    await lazyExample.waitFor()
    await page.waitForTimeout(100)

    assert.equal(browserRequests, 0)
    assert.equal(
      await lazyExample.locator(`[data-motion-artifact="${motionArtifact.id}"]`).count(),
      0,
    )

    await lazyExample.scrollIntoViewIfNeeded()
    let lazyArtifact = lazyExample.locator(`[data-motion-artifact="${motionArtifact.id}"]`)
    await lazyArtifact.waitFor()

    assert.equal(browserRequests, 1)
    assert.equal(await lazyExample.locator('style').count(), 1)
    let orbiter = lazyArtifact.locator('.edition-orbit__orbit')
    assert.equal(
      await orbiter.evaluate((node) => getComputedStyle(node).animationName),
      'lazy-frames-motion-orbit',
    )
    assert.equal(
      await orbiter.evaluate((node) => getComputedStyle(node).animationPlayState),
      'running',
    )

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
    assert.equal(
      await orbiter.evaluate((node) => getComputedStyle(node).animationPlayState),
      'running',
    )
    assert.equal(browserRequests, 1)
  })

  it('requests a distant frame once, retains it, and hydrates its client component', async (t) => {
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)
    let framePath = routes.frames.interactive.href({ id: 'retained-counter' })
    let frameRequests = 0

    page.on('request', (request) => {
      if (new URL(request.url()).pathname === framePath) frameRequests++
    })

    await page.goto(routes.home.href())
    let lazyExample = page.locator('#retained-counter')
    await lazyExample.waitFor()
    await page.waitForTimeout(100)

    assert.equal(frameRequests, 0)

    await lazyExample.scrollIntoViewIfNeeded()
    let frameContent = page.locator('#retained-counter article')
    await frameContent.waitFor()
    await page.getByText('Client component ready', { exact: true }).waitFor()

    assert.equal(frameRequests, 1)

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(100)
    assert.equal(await frameContent.count(), 1)

    await lazyExample.scrollIntoViewIfNeeded()
    await page.waitForTimeout(100)
    assert.equal(frameRequests, 1)
    assert.equal(await frameContent.count(), 1)

    await page
      .locator('#retained-counter')
      .getByRole('button', { name: 'Increment local count' })
      .click()
    await page.getByText('Local count: 25', { exact: true }).waitFor()
  })
})
