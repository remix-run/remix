import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('prefetch demo', () => {
  it('opens a hovered product from the prefetched response', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())
    await waitForNavigationRuntime(page)

    let link = page.getByRole('link', { name: /Canvas Tote/ })
    let prefetched = page.waitForResponse(routes.product.href({ slug: 'canvas-tote' }))
    await link.hover()
    await prefetched
    await link.click()

    await page.getByRole('heading', { name: 'Canvas Tote' }).waitFor()
    assert.equal(await page.getByTestId('requested-as').textContent(), 'prefetch')
  })

  it('loads products without the attribute when they are clicked', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())
    await waitForNavigationRuntime(page)

    await page.getByRole('link', { name: /Brass Keyring/ }).click()

    await page.getByRole('heading', { name: 'Brass Keyring' }).waitFor()
    assert.equal(await page.getByTestId('requested-as').textContent(), 'frame navigation')
  })
})

async function waitForNavigationRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    let state = window.navigation.currentEntry?.getState()
    return typeof state === 'object' && state != null && '$rmx' in state
  })
}
