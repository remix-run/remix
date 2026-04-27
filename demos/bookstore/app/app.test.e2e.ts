import * as assert from 'remix/assert'
import { afterAll, describe, it } from 'remix/test'
import { createBookstoreRouter } from './router.ts'
import { books } from './data/schema.ts'
import { closeBookstoreDatabase, db, initializeBookstoreDatabase } from './data/setup.ts'

const router = createBookstoreRouter()

// Initialize DB for this worker thread
await initializeBookstoreDatabase()

afterAll(() => closeBookstoreDatabase())

describe('e2e', () => {
  it('adds to cart', async (t) => {
    let page = await t.serve(router.fetch)

    // Load the homepage
    await page.goto('/', { waitUntil: 'networkidle' })

    let book = await db.findOne(books, { where: { in_stock: true } })

    // Add an item to cart
    let bookCard = page.locator(`[data-test-slug="${book?.slug}"]`)
    await bookCard.getByRole('button', { name: 'Add to Cart' }).click()
    await bookCard.getByRole('button', { name: 'Remove from Cart' }).waitFor()

    // Navigate to cart and validate
    await page.getByRole('link', { name: 'Cart' }).click()
    await page.getByRole('heading', { name: 'Shopping Cart' }).waitFor()
    let cartRow = await page.locator(`table tr`)
    assert.equal(await cartRow.getByRole('link').innerText(), book?.title)
    assert.equal(await cartRow.getByRole('spinbutton').getAttribute('defaultvalue'), '1')
  })
})
