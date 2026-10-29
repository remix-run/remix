import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  loginAsAdmin,
  requestWithSession,
} from '../../../../test/helpers.ts'

const router = await createTestRouter()

describe('admin books handlers', () => {
  it('POST /admin/books creates new book when admin', async () => {
    let sessionId = await loginAsAdmin(router)

    // Create new book
    let createRequest = requestWithSession('https://remix.run/admin/books', sessionId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test description',
        price: '29.99',
        genre: 'test',
        isbn: '978-0000000000',
        publishedYear: '2024',
        inStock: 'true',
      }),
    })
    let response = await router.fetch(createRequest)

    assert.equal(response.status, 302)
    assert.ok(response.headers.get('Location')?.includes('/admin/books'))
  })

  it('POST /admin/books returns numeric errors and restores text fields', async () => {
    let sessionId = await loginAsAdmin(router)
    let response = await router.fetch(
      requestWithSession('https://remix.run/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'bad-price',
          title: 'Book With Bad Price',
          author: 'Test Author',
          description: 'Test description',
          price: 'abc',
          genre: 'test',
          isbn: '978-0000000000',
          publishedYear: '2024',
          inStock: 'false',
        }),
      }),
    )

    assert.equal(response.status, 400)
    let html = await response.text()
    assertContains(html, 'value="Book With Bad Price"')
    assertContains(html, 'value="abc"')
    assertContains(html, 'aria-invalid="true"')
    assertContains(html, 'value="false" selected')
  })

  it('PUT /admin/books/:bookId prefers submitted values over the saved book after failure', async () => {
    let sessionId = await loginAsAdmin(router)
    let response = await router.fetch(
      requestWithSession('https://remix.run/admin/books/1', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({
          slug: 'bbq',
          title: 'Revised Title',
          author: 'Rusty Char-Broil',
          description: 'Revised description',
          price: 'invalid',
          genre: 'cookbook',
          isbn: '978-0525559474',
          publishedYear: '2020',
          inStock: 'false',
        }),
      }),
    )

    assert.equal(response.status, 400)
    let html = await response.text()
    assertContains(html, 'value="Revised Title"')
    assertContains(html, 'Revised description')
    assertContains(html, 'value="false" selected')
  })
})
