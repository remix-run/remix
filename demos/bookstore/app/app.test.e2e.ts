import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Locator, Page } from 'playwright'
import { createBookstoreRouter } from './router.ts'
import { db, getMigrations, seed } from './db.ts'
import { books } from './data/schema.ts'
import { routes } from './routes.ts'

const router = createBookstoreRouter()

await db.reset({ migrations: await getMigrations(), seed })

describe('e2e', () => {
  it('preloads modules for client entries rendered by documents and frames', async () => {
    let book = await db.findOne(books, { where: { in_stock: true } })
    if (!book) throw new Error('Expected an in-stock book')

    for (let href of [
      routes.books.show.href({ slug: book.slug }),
      routes.fragments.cartButton.href({ bookId: book.id }),
    ]) {
      let response = await router.fetch(new Request(`http://bookstore.test${href}`))
      let html = await response.text()
      let payloads = [...html.matchAll(/<script[^>]*id="rmx-data"[^>]*>([\s\S]*?)<\/script>/g)]
      let moduleUrls = payloads.flatMap(([, payload]) => {
        let data = JSON.parse(payload ?? '{}') as { h?: Record<string, { moduleUrl: string }> }
        return Object.values(data.h ?? {}).map(({ moduleUrl }) => moduleUrl)
      })

      assert.ok(moduleUrls.length > 0)
      for (let moduleUrl of moduleUrls) {
        assert.match(html, new RegExp(`rel="modulepreload" href="${escapeRegExp(moduleUrl)}"`))
      }
    }
  })

  it('deduplicates module preloads shared by client entries', async () => {
    let response = await router.fetch(new Request('http://bookstore.test/'))
    let html = await response.text()
    let head = html.match(/<head>(.*?)<\/head>/s)?.[1]
    if (!head) throw new Error('Expected a document head')

    let hrefs = [...head.matchAll(/<link data-rmx rel="modulepreload" href="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((href): href is string => href !== undefined)

    assert.ok(hrefs.length > 0)
    assert.equal(new Set(hrefs).size, hrefs.length)
  })

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
