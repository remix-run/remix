import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { assertContains, createTestRouter } from '../../../test/helpers.ts'

const router = await createTestRouter()

describe('books handlers', () => {
  it('GET /books returns list of books', async () => {
    let response = await router.fetch('https://remix.run/books')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Browse Books')
    assertContains(html, 'Ash &amp; Smoke')
    assertContains(html, 'Heavy Metal Guitar Riffs')
    assertContains(html, 'Three Ways to Change Your Life')
  })

  it('GET /books/:slug returns book details', async () => {
    let response = await router.fetch('https://remix.run/books/bbq')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Ash &amp; Smoke')
    assertContains(html, 'Rusty Char-Broil')
    assertContains(html, 'Add to Cart')
  })

  it('GET /books/:slug returns 404 for non-existent book', async () => {
    let response = await router.fetch('https://remix.run/books/does-not-exist')

    assert.equal(response.status, 404)
    let html = await response.text()
    assertContains(html, 'Book Not Found')
  })

  it('returns three other books from the same genre', async () => {
    let response = await router.fetch('https://remix.run/books/bbq/related', {
      headers: { 'X-Remix-Frame': 'true' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'private, max-age=30')
    let html = await response.text()
    assert.deepEqual(
      [...html.matchAll(/data-test-slug="([^"]+)"/g)].map((match) => match[1]),
      ['bread-before-dawn', 'sunday-noodle-shop', 'citrus-and-salt'],
    )
  })

  it('shows available matches without filling sparse genres with unrelated books', async () => {
    let response = await router.fetch('https://remix.run/books/midnight-platform/related')
    let html = await response.text()
    assert.deepEqual(
      [...html.matchAll(/data-test-slug="([^"]+)"/g)].map((match) => match[1]),
      ['clockmakers-letter', 'ninth-passenger'],
    )

    let empty = await router.fetch('https://remix.run/books/light-through-lens/related')
    assert.equal(empty.status, 200)
    assertContains(await empty.text(), 'No other books in this genre yet.')
  })

  it('returns an uncached 404 when the related-books source does not exist', async () => {
    let response = await router.fetch('https://remix.run/books/does-not-exist/related', {
      headers: { 'X-Remix-Frame': 'true' },
    })

    assert.equal(response.status, 404)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assertContains(await response.text(), 'Book not found.')
  })
})
