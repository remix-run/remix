import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('scroll restoration', () => {
  it('restores traversal scroll when client entry reconciliation shrinks the document', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.scrollRestoration.href())

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
    await page.evaluate(() => window.history.back())
    await page.getByText('List row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(
      (expected) => Math.abs(window.scrollY - expected) < 50,
      scrollPosition,
    )
    let restoredPosition = await page.evaluate(() => window.scrollY)

    assert.ok(
      Math.abs(restoredPosition - scrollPosition) < 50,
      `Expected traversal to restore ${scrollPosition}, got ${restoredPosition}`,
    )
  })

  it('restores separate positions for duplicate URLs after an immediate traversal', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let pushCurrentUrl = async () => {
      await page.evaluate(() => {
        let anchor = document.createElement('a')
        anchor.href = window.location.href
        anchor.textContent = 'Reload current URL'
        document.body.append(anchor)
        anchor.click()
      })
    }
    await page.goto(routes.scrollRestoration.href())
    await page.locator('#scroll-restoration-list-end').waitFor()

    await page.evaluate(() => window.scrollTo(0, 100))
    await pushCurrentUrl()
    await page.waitForFunction(() => window.scrollY === 0)

    await page.evaluate(() => window.scrollTo(0, 200))
    await pushCurrentUrl()
    await page.waitForFunction(() => window.scrollY === 0)

    await page.evaluate(() => {
      window.scrollTo(0, 300)
      window.history.back()
    })
    await page.waitForFunction(() => window.scrollY === 200)

    await page.evaluate(() => window.history.forward())
    await page.waitForFunction(() => window.scrollY === 300)
  })
})
