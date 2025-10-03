import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { assertContains } from '../test/helpers.ts'

describe('books handlers', () => {
  it('GET /books returns list of books', async () => {
    let response = await router.fetch('http://localhost:3000/books')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Browse Books')
    assertContains(html, 'The Midnight Library')
    assertContains(html, 'Atomic Habits')
    assertContains(html, 'Dune')
  })

  it('GET /books/:slug returns book details', async () => {
    let response = await router.fetch('http://localhost:3000/books/dune')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Dune')
    assertContains(html, 'Frank Herbert')
    assertContains(html, 'Add to Cart')
  })

  it('GET /books/:slug returns 404 for non-existent book', async () => {
    let response = await router.fetch('http://localhost:3000/books/does-not-exist')

    assert.equal(response.status, 404)
    let html = await response.text()
    assertContains(html, 'Book Not Found')
  })
})
