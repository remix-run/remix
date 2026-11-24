import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  loginAsAdmin,
  requestWithSession,
} from '../../../../test/helpers.ts'

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
        artist: 'Test Author',
        description: 'Test description',
        price: '29.99',
        genre: 'fiction',
        catalogNumber: '978-0000000000',
        releaseYear: '2024',
        inStock: 'true',
      }),
    })
    let response = await router.fetch(createRequest)

    assert.equal(response.status, 302)
    assert.ok(response.headers.get('Location')?.includes('/admin/albums'))
  })

  it('PUT /admin/albums/:albumId prefers submitted values over the saved album after failure', async () => {
    let sessionId = await loginAsAdmin(router)
    let response = await router.fetch(
      requestWithSession('https://remix.run/admin/albums/1', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({
          slug: 'bbq',
          title: 'Revised Title',
          artist: 'Rusty Char-Broil',
          description: 'Revised description',
          price: 'invalid',
          genre: 'cookbook',
          catalogNumber: '978-0525559474',
          releaseYear: '2020',
          inStock: 'false',
        }),
      }),
    )

    assert.equal(response.status, 400)
    let html = await response.text()
    assertContains(html, 'value="Revised Title"')
    assertContains(html, 'Revised description')
    assertContains(html, 'value="false" selected')
    assertContains(html, 'value="cookbook" selected')
  })

  it('rejects categories outside the supported ten without updating the album', async () => {
    let sessionId = await loginAsAdmin(router)
    let response = await router.fetch(
      requestWithSession('https://remix.run/admin/albums/1', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({
          slug: 'bbq',
          title: 'Ash & Smoke',
          artist: 'Rusty Char-Broil',
          description: 'The perfect gift for the BBQ enthusiast in your life!',
          price: '16.99',
          genre: 'music',
          catalogNumber: '978-0525559474',
          releaseYear: '2020',
          inStock: 'true',
        }),
      }),
    )

    assert.equal(response.status, 400)
    assertContains(await response.text(), 'Expected one of:')
    let album = await router.fetch('https://remix.run/albums/bbq')
    assertContains(await album.text(), 'Food &amp; Cooking')
  })
})
