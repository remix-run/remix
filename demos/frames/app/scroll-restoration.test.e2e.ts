import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

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
      ({ expected, tolerance }) => Math.abs(window.scrollY - expected) < tolerance,
      { expected: scrollPosition, tolerance: 50 },
    )
    let restoredPosition = await page.evaluate(() => window.scrollY)

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
    await page.evaluate(() => window.scrollTo(0, 0))
    assert.equal(await page.evaluate(() => window.scrollY), 0)

    await page.getByRole('button', { name: 'Select size without resetting scroll' }).click()
    await page.waitForURL((url) => url.searchParams.get('size') === 'small')
    await page.waitForFunction(() => window.navigation.transition === null)
    assert.equal(await page.evaluate(() => window.scrollY), 0)

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
    await page.waitForFunction(() => window.navigation.transition === null && window.scrollY === 0)
    let detailRestoredPosition = await page.evaluate(() => window.scrollY)

    assert.equal(
      detailRestoredPosition,
      0,
      `Expected forward traversal to restore detail scroll position 0, got ${detailRestoredPosition}`,
    )
  })
})
