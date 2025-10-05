import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loginAsAdmin, requestWithSession } from '../test/helpers.ts'
import { router } from './router.ts'
import { getAllBooks } from './models/books.ts'
import { uploadsStorage as uploads } from './utils/uploads.ts'

describe('uploads handler', () => {
  it('serves uploaded files from storage', async () => {
    let sessionId = await loginAsAdmin(router)

    // Get initial book count
    let initialBookCount = getAllBooks().length

    // Create a multipart form with a file upload
    let boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    let fileContent = 'fake image data'
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
      fileContent,
      `------${boundary}--`,
    ].join('\r\n')

    // Create book with file upload
    let createRequest = requestWithSession('http://localhost:3000/admin/books', sessionId, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=----${boundary}`,
      },
      body: formBody,
    })

    let createResponse = await router.fetch(createRequest)
    assert.equal(createResponse.status, 302)
    assert.ok(createResponse.headers.get('Location')?.includes('/admin/books'))

    // Get the newly created book from the model
    let books = getAllBooks()
    assert.equal(books.length, initialBookCount + 1)

    let newBook = books[books.length - 1]
    assert.equal(newBook.slug, 'book-with-cover')
    assert.ok(newBook.coverUrl.startsWith('/uploads/'))

    // Now fetch the uploaded file from the /uploads route using the book's coverUrl
    let fileResponse = await router.fetch(`http://localhost:3000${newBook.coverUrl}`)

    assert.equal(fileResponse.status, 200)
    assert.equal(fileResponse.headers.get('Content-Type'), 'image/jpeg')
    assert.equal(fileResponse.headers.get('Cache-Control'), 'public, max-age=31536000')
    assert.equal(await fileResponse.text(), fileContent)
  })

  it('returns 404 for non-existent files', async () => {
    let response = await router.fetch('http://localhost:3000/uploads/nonexistent/file.jpg')

    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'File not found')
  })

  it('serves files with correct content type', async () => {
    // Store different file types
    let pngFile = new File(['png data'], 'test.png', { type: 'image/png' })
    let pdfFile = new File(['pdf data'], 'test.pdf', { type: 'application/pdf' })

    await uploads.set('images/test.png', pngFile)
    await uploads.set('docs/test.pdf', pdfFile)

    // Verify PNG
    let pngResponse = await router.fetch('http://localhost:3000/uploads/images/test.png')
    assert.equal(pngResponse.status, 200)
    assert.equal(pngResponse.headers.get('Content-Type'), 'image/png')

    // Verify PDF
    let pdfResponse = await router.fetch('http://localhost:3000/uploads/docs/test.pdf')
    assert.equal(pdfResponse.status, 200)
    assert.equal(pdfResponse.headers.get('Content-Type'), 'application/pdf')
  })
})
