import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTestRouter, loginAsAdmin, requestWithSession } from '../../../../test/helpers.ts'

const router = await createTestRouter()

describe('admin albums handlers', () => {
  it('POST /admin/albums creates new album when admin', async () => {
    let sessionId = await loginAsAdmin(router)

    // Create new album
    let createRequest = requestWithSession('https://remix.run/admin/albums', sessionId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        slug: 'test-album',
        title: 'Test Album',
        artist: 'Test Artist',
        description: 'Test description',
        price: '29.99',
        genre: 'test',
        catalogNumber: 'RSD-49000-2',
        releaseYear: '2024',
        inStock: 'true',
      }),
    })
    let response = await router.fetch(createRequest)

    assert.equal(response.status, 302)
    assert.ok(response.headers.get('Location')?.includes('/admin/albums'))
  })
})
