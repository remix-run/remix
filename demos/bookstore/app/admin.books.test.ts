import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, requestWithSession } from '../test/helpers.ts'

describe('admin books handlers', () => {
  it('POST /admin/books creates new book when admin', async () => {
    // Log in as admin
    let loginResponse = await router.fetch('http://localhost:3000/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'admin@bookstore.com',
        password: 'admin123',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(loginResponse)
    assert.ok(sessionId)

    // Create new book
    let createRequest = requestWithSession('http://localhost:3000/admin/books', sessionId, {
      method: 'POST',
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
})
