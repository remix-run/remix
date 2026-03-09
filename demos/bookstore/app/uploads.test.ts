import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loginAsAdmin, requestWithSession } from '../test/helpers.ts'
import { router } from './router.ts'
import { books } from './data/schema.ts'
import { db } from './data/setup.ts'
import { uploadsStorage as uploads } from './utils/uploads.ts'

describe('uploads handler', () => {
  it('stores cover URL at /uploads/ when creating a book with a file upload', async () => {
    let sessionId = await loginAsAdmin(router)

    // Get initial book count
    let initialBookCount = await db.count(books)

    let boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    let formBody = [
      `------${boundary}`,
      'Content-Disposition: form-data; name="title"',
      '',
      'Book with Cover',
      `------${boundary}`,
      'Content-Disposition: form-data; name="author"',
      '',
      'Test Author',
      `------${boundary}`,
      'Content-Disposition: form-data; name="slug"',
      '',
      'book-with-cover',
      `------${boundary}`,
      'Content-Disposition: form-data; name="description"',
      '',
      'A book with a cover image',
      `------${boundary}`,
      'Content-Disposition: form-data; name="price"',
      '',
      '19.99',
      `------${boundary}`,
      'Content-Disposition: form-data; name="genre"',
      '',
      'test',
      `------${boundary}`,
      'Content-Disposition: form-data; name="isbn"',
      '',
      '978-1234567890',
      `------${boundary}`,
      'Content-Disposition: form-data; name="publishedYear"',
      '',
      '2024',
      `------${boundary}`,
      'Content-Disposition: form-data; name="inStock"',
      '',
      'true',
      `------${boundary}`,
      'Content-Disposition: form-data; name="cover"; filename="test-cover.jpg"',
      'Content-Type: image/jpeg',
      '',
      'fake image data',
      `------${boundary}--`,
    ].join('\r\n')

    let createResponse = await router.fetch(
      requestWithSession('https://remix.run/admin/books', sessionId, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=----${boundary}` },
        body: formBody,
      }),
    )

    assert.equal(createResponse.status, 302)
    assert.ok(createResponse.headers.get('Location')?.includes('/admin/books'))

    // Get the newly created book from the database
    let currentBookCount = await db.count(books)
    assert.equal(currentBookCount, initialBookCount + 1)

    let newBook = await db.findOne(books, { where: { slug: 'book-with-cover' } })
    assert.ok(newBook)
    assert.equal(newBook.slug, 'book-with-cover')
    assert.ok(
      newBook.cover_url.startsWith('/uploads/cover/'),
      `expected /uploads/cover/ prefix, got: ${newBook.cover_url}`,
    )
  })

  it('returns 404 for non-existent upload paths', async () => {
    let response = await router.fetch('https://remix.run/uploads/nonexistent/file.jpg')
    assert.equal(response.status, 404)
  })
})
