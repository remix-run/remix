import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('scroll restoration', () => {
  it('restores traversal scroll after the collection client entry reconciles', async (t) => {
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

    await page.goBack()
    await page.getByText('List row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    let restoredPosition = await page.evaluate(() => window.scrollY)

    assert.ok(
      Math.abs(restoredPosition - scrollPosition) < 50,
      `Expected traversal to restore ${scrollPosition}, got ${restoredPosition}`,
    )
  })

  it('restores the collection to the top after scrolling the detail page', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.scrollRestoration.href())
    await page.getByText('List row 48', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.scrollY), 0)

    await page.evaluate(() => {
      let link = document.querySelector<HTMLAnchorElement>('#scroll-restoration-detail-link')
      link?.click()
    })
    await page.getByRole('heading', { name: 'Short detail view' }).waitFor()
    await page.evaluate(() => window.scrollTo(0, 500))
    assert.ok((await page.evaluate(() => window.scrollY)) > 100)

    await Promise.all([
      page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
          }),
      ),
      page.goBack(),
    ])
    await page.getByText('List row 48', { exact: true }).waitFor()

    let restoredPosition = await page.evaluate(() => window.scrollY)
    assert.ok(restoredPosition < 50, `Expected top restoration, got ${restoredPosition}`)
  })
})
