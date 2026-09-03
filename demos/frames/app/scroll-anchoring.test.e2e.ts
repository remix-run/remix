import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('scroll anchoring', () => {
  it('restores traversal scroll after an earlier client entry is removed', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.scrollAnchoring.href())

    let reproduction = page.locator('#scroll-anchoring-reproduction')
    let hydrationCheck = reproduction.getByRole('button', {
      name: 'Hydration check: 0',
      exact: true,
    })
    await hydrationCheck.waitFor()
    await hydrationCheck.click()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

    await page.locator('#scroll-anchoring-list-end').scrollIntoViewIfNeeded()
    let scrollPosition = await page.evaluate(() => window.scrollY)
    await page.getByRole('link', { name: 'Open the anchoring detail page' }).click()
    await page.getByRole('heading', { name: 'Scroll anchoring detail' }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.evaluate(() => window.scrollTo(0, 500))
    let detailScrollPosition = await page.evaluate(() => window.scrollY)
    assert.ok(
      detailScrollPosition > 100,
      `Expected the detail page to scroll, got ${detailScrollPosition}`,
    )

    await Promise.all([
      page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
          }),
      ),
      page.goBack(),
    ])
    await page.getByText('Anchoring row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    let restoredPosition = await page.evaluate(() => window.scrollY)

    assert.ok(
      Math.abs(restoredPosition - scrollPosition) < 50,
      `Expected traversal to restore ${scrollPosition}, got ${restoredPosition}`,
    )
  })
})
