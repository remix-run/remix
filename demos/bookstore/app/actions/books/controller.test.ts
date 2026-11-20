import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { assertContains, createTestRouter } from '../../../test/helpers.ts'
import { db } from '../../db.ts'
import { books } from '../../data/schema.ts'

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
    assertFirstCoverPreload(html)
    assert.deepEqual(
      [...html.matchAll(/<img[^>]+loading="(eager|lazy)"/g)].map((match) => match[1]),
      [...Array(4).fill('eager'), ...Array(46).fill('lazy')],
    )
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

  it('browses and relates books across the consolidated arts categories', async () => {
    let category = await router.fetch('https://remix.run/books/genre/art')
    assert.equal(category.status, 200)
    let categoryHtml = await category.text()
    assertContains(categoryHtml, 'Arts, Music &amp; Crafts')
    assert.equal([...categoryHtml.matchAll(/data-test-slug="([^"]+)"/g)].length, 9)
    assertContains(categoryHtml, 'Heavy Metal Guitar Riffs')
    assertContains(categoryHtml, 'Clay in Your Hands')
    assertContains(categoryHtml, 'Light Through the Lens')
    assertFirstCoverPreload(categoryHtml)
    assert.deepEqual(
      [...categoryHtml.matchAll(/<img[^>]+loading="(eager|lazy)"/g)].map((match) => match[1]),
      ['eager', 'eager', 'eager', 'eager', 'lazy', 'lazy', 'lazy', 'lazy', 'lazy'],
    )

    let related = await router.fetch('https://remix.run/books/light-through-lens/related')
    assert.deepEqual(
      [...(await related.text()).matchAll(/data-test-slug="([^"]+)"/g)].map((match) => match[1]),
      ['heavy-metal', 'clay-in-your-hands', 'vinyl-after-hours'],
    )
  })

  it('shows available matches without filling sparse categories with unrelated books', async () => {
    let response = await router.fetch('https://remix.run/books/pip-paper-moon/related')
    let html = await response.text()
    assert.deepEqual(
      [...html.matchAll(/data-test-slug="([^"]+)"/g)].map((match) => match[1]),
      ['fox-found-tuesday'],
    )

    let other = await db.find(books, 46)
    assert.ok(other)
    await db.delete(books, other.id)
    try {
      let empty = await router.fetch('https://remix.run/books/pip-paper-moon/related')
      assert.equal(empty.status, 200)
      assertContains(await empty.text(), 'No other books in this category yet.')
    } finally {
      await db.create(books, other)
    }
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

function assertFirstCoverPreload(html: string): void {
  let head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1]
  assert.ok(head)
  let preload = head.match(/<link rel="preload" as="image"[^>]*>/)?.[0]
  let cover = html.match(/<img[^>]*>/)?.[0]
  assert.ok(preload)
  assert.ok(cover)
  assert.equal(preload.match(/href="([^"]+)"/)?.[1], cover.match(/src="([^"]+)"/)?.[1])
  assert.equal(preload.match(/imagesrcset="([^"]+)"/)?.[1], cover.match(/srcset="([^"]+)"/)?.[1])
  assert.equal(preload.match(/imagesizes="([^"]+)"/)?.[1], cover.match(/sizes="([^"]+)"/)?.[1])
  assert.equal(head.match(/<link rel="preload" as="image"/g)?.length, 1)
  assert.ok(head.indexOf(preload) < head.indexOf('<link rel="stylesheet"'))
  assert.ok(head.indexOf(preload) < head.indexOf('<script'))
}
