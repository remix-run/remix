import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Locator, Page } from 'playwright'
import { createRecordStoreRouter } from './router.ts'
import { db, loadAppMigrations, loadAppSeed } from './db.ts'
import { albums } from './data/schema.ts'
import { routes } from './routes.ts'

const router = createRecordStoreRouter()

await db.reset({ migrations: await loadAppMigrations(), seed: await loadAppSeed() })

describe('e2e', () => {
  it('adds to cart', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))

    // Load the homepage
    await page.goto('/')

    let album = await db.findOne(albums, { where: { in_stock: true } })

    // Add an item to cart
    let albumCard = page.locator(`[data-test-slug="${album?.slug}"]`)
    await clickCartButton(page, albumCard.getByRole('button', { name: 'Add to Cart' }))
    await albumCard.getByRole('button', { name: 'Remove from Cart' }).waitFor({ timeout: 10_000 })

    // Navigate to cart and validate
    await page.getByRole('link', { name: 'Cart' }).click()
    await page.getByRole('heading', { name: 'Shopping Cart' }).waitFor()
    let cartRow = await page.locator(`table tr`)
    assert.equal(await cartRow.getByRole('link').innerText(), album?.title)
    assert.equal(await cartRow.getByRole('spinbutton').inputValue(), '1')
  })
})

async function clickCartButton(page: Page, button: Locator): Promise<void> {
  let cartTogglePath = routes.api.cartToggle.href()

  for (let attempt = 0; attempt < 10; attempt++) {
    let responsePromise = page
      .waitForResponse((response) => new URL(response.url()).pathname === cartTogglePath, {
        timeout: 1_000,
      })
      .catch(() => null)

    await button.click()

    let response = await responsePromise
    if (response) {
      assert.equal(response.ok(), true)
      return
    }

    await page.waitForTimeout(100)
  }

  throw new Error(`Timed out waiting for ${cartTogglePath} request`)
}
