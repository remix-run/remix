import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it, type TestContext } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('scroll restoration', () => {
  it('restores traversal scroll when client entry reconciliation shrinks the document', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.scrollRestoration.href())
    await page.locator('html[data-frames-ready="true"]').waitFor()

    let reproduction = page.locator('#store-scroll-reproduction')
    let hydrationCheck = reproduction.getByRole('button', {
      name: 'Hydration check: 0',
      exact: true,
    })
    await hydrationCheck.waitFor()
    await hydrationCheck.click()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

    await page.locator('#scroll-restoration-list-end').scrollIntoViewIfNeeded()
    let scrollPosition = await page.evaluate(() => window.scrollY)
    await page.getByRole('link', { name: 'Open the shorter detail page' }).click()
    await page.getByRole('heading', { name: 'Short detail view' }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.evaluate(() => window.scrollTo(0, 500))
    let detailScrollPosition = await page.evaluate(() => window.scrollY)
    assert.ok(
      detailScrollPosition > 100,
      `Expected the detail page to scroll, got ${detailScrollPosition}`,
    )
    await page.goBack()
    await page.getByText('List row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(
      ({ expected, tolerance }) =>
        window.navigation.transition === null && Math.abs(window.scrollY - expected) < tolerance,
      { expected: scrollPosition, tolerance: 50 },
    )
    // The restored position must survive the page shrinking to its own height.
    let restoredPosition = await readScrollAfterAnchoringRestored(page)

    assert.ok(
      Math.abs(restoredPosition - scrollPosition) < 50,
      `Expected traversal to restore ${scrollPosition}, got ${restoredPosition}`,
    )
  })

  it('restores destination scroll on forward traversal after a replace navigation with resetScroll=false', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.scrollRestoration.href())
    await page.locator('html[data-frames-ready="true"]').waitFor()

    let reproduction = page.locator('#store-scroll-reproduction')
    let hydrationCheck = reproduction.getByRole('button', {
      name: 'Hydration check: 0',
      exact: true,
    })
    await hydrationCheck.waitFor()
    await hydrationCheck.click()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

    await page.locator('#scroll-restoration-list-end').scrollIntoViewIfNeeded()
    let listScrollPosition = await page.evaluate(() => window.scrollY)
    assert.ok(
      listScrollPosition > 1000,
      `Expected the list page to scroll far down, got ${listScrollPosition}`,
    )

    await page.getByRole('link', { name: 'Open the shorter detail page' }).click()
    await page.getByRole('heading', { name: 'Short detail view' }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(() => window.navigation.transition === null)
    await page.evaluate(() => window.scrollTo(0, 150))
    let detailScrollPosition = await page.evaluate(() => window.scrollY)
    assert.equal(detailScrollPosition, 150)

    await page.getByRole('button', { name: 'Select size without resetting scroll' }).click()
    await page.waitForURL((url) => url.searchParams.get('size') === 'small')
    await page.waitForFunction(() => window.navigation.transition === null)
    assert.equal(await page.evaluate(() => window.scrollY), detailScrollPosition)
    assert.equal(
      await page.evaluate(() => {
        let state = window.navigation.currentEntry?.getState()
        return typeof state === 'object' && state !== null && 'resetScroll' in state
          ? state.resetScroll
          : undefined
      }),
      'manual',
    )

    await page.goBack()
    await page.getByText('List row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(
      ({ expected, tolerance }) => Math.abs(window.scrollY - expected) < tolerance,
      { expected: listScrollPosition, tolerance: 50 },
    )

    await page.goForward()
    await page.getByRole('heading', { name: 'Short detail view' }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(
      ({ expected, tolerance }) =>
        window.navigation.transition === null && Math.abs(window.scrollY - expected) < tolerance,
      { expected: detailScrollPosition, tolerance: 50 },
    )
    let detailRestoredPosition = await readScrollAfterAnchoringRestored(page)

    assert.ok(
      Math.abs(detailRestoredPosition - detailScrollPosition) < 50,
      `Expected forward traversal to restore detail scroll position ${detailScrollPosition}, got ${detailRestoredPosition}`,
    )
  })

  it('restores the list position after the detail page scrolls and the list loads slowly', async (t) => {
    let server = createServerWithSlowList()
    let page = await t.serve(await createTestServer(server.fetch))
    let listPosition = await scrollToListEnd(page)
    await openDetailPage(page)
    await page.evaluate(() => window.scrollTo(0, 150))

    server.slowDownList()
    await page.goBack()

    let restoredPosition = await readListScrollAfterTraversal(page)
    assert.ok(
      Math.abs(restoredPosition - listPosition) < 50,
      `Expected traversal to restore ${listPosition}, got ${restoredPosition}`,
    )
  })

  it('restores the list position when going back right after the detail page opens and the list loads slowly', async (t) => {
    let server = createServerWithSlowList()
    let page = await t.serve(await createTestServer(server.fetch))
    let listPosition = await scrollToListEnd(page)
    await openDetailPage(page)

    server.slowDownList()
    await page.goBack()

    let restoredPosition = await readListScrollAfterTraversal(page)
    assert.ok(
      Math.abs(restoredPosition - listPosition) < 50,
      `Expected traversal to restore ${listPosition}, got ${restoredPosition}`,
    )
  })
})

type Page = Awaited<ReturnType<TestContext['serve']>>

async function readScrollAfterAnchoringRestored(page: Page): Promise<number> {
  // Traversals suppress scroll anchoring until after a paint. Wait for that suppression to be
  // removed, then read scroll in the next frame, where re-enabled anchoring would move it.
  await page.waitForFunction(() => getComputedStyle(document.body).overflowAnchor !== 'none')
  return page.evaluate(
    () => new Promise<number>((resolve) => requestAnimationFrame(() => resolve(window.scrollY))),
  )
}

// WebKit saves the window's position into the current history entry once the page has gone 300 ms
// without scrolling, and a traversal makes its destination current before the page loads, so a
// list that takes longer to load gets the detail page's position. That wait runs on WebKit's own
// clock, so the server delays in real time.
function createServerWithSlowList() {
  let slow = false
  return {
    slowDownList() {
      slow = true
    },
    async fetch(request: Request) {
      if (slow && new URL(request.url).pathname === routes.scrollRestoration.href()) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      return router.fetch(request)
    },
  }
}

async function scrollToListEnd(page: Page): Promise<number> {
  await page.goto(routes.scrollRestoration.href())
  await page.locator('html[data-frames-ready="true"]').waitFor()
  await page.locator('#scroll-restoration-list-end').scrollIntoViewIfNeeded()
  return page.evaluate(() => window.scrollY)
}

async function openDetailPage(page: Page) {
  await page.getByRole('link', { name: 'Open the shorter detail page' }).click()
  await page.getByRole('heading', { name: 'Short detail view' }).waitFor()
  await page.waitForFunction(() => window.navigation.transition === null)
}

async function readListScrollAfterTraversal(page: Page): Promise<number> {
  await page.getByText('List row 48', { exact: true }).waitFor()
  await page.waitForFunction(() => window.navigation.transition === null)
  return readScrollAfterAnchoringRestored(page)
}
