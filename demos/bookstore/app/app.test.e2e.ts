import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Locator, Page } from 'playwright'
import { createBookstoreRouter } from './router.ts'
import { books } from './data/schema.ts'
import { db, initializeBookstoreDatabase } from './data/setup.ts'
import { routes } from './routes.ts'

const router = createBookstoreRouter()

// Initialize DB for this worker thread
await initializeBookstoreDatabase()

describe('e2e', () => {
  it('adds to cart', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))

    // Load the homepage
    await page.goto('/')

    let book = await db.findOne(books, { where: { in_stock: true } })

    // Add an item to cart
    let bookCard = page.locator(`[data-test-slug="${book?.slug}"]`)
    await clickCartButton(page, bookCard.getByRole('button', { name: 'Add to Cart' }))
    await bookCard.getByRole('button', { name: 'Remove from Cart' }).waitFor({ timeout: 10_000 })

    // Navigate to cart and validate
    await page.getByRole('link', { name: 'Cart' }).click()
    await page.getByRole('heading', { name: 'Shopping Cart' }).waitFor()
    let cartRow = await page.locator(`table tr`)
    assert.equal(await cartRow.getByRole('link').innerText(), book?.title)
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
