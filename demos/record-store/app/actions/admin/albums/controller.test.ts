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
        artist: 'Test Artist',
        description: 'Test description',
        price: '29.99',
        genre: 'rock',
        catalogNumber: 'RSD-49998-1',
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
          slug: 'overpass-stereo',
          title: 'Revised Title',
          artist: 'Mile Marker Club',
          description: 'Revised description',
          price: 'invalid',
          genre: 'rock',
          catalogNumber: 'RSD-49005-1',
          releaseYear: '1994',
          inStock: 'false',
        }),
      }),
    )

    assert.equal(response.status, 400)
    let html = await response.text()
    assertContains(html, 'value="Revised Title"')
    assertContains(html, 'Revised description')
    assertContains(html, 'value="false" selected')
    assertContains(html, 'value="rock" selected')
  })

  it('rejects unsupported categories without updating the album', async () => {
    let sessionId = await loginAsAdmin(router)
    let response = await router.fetch(
      requestWithSession('https://remix.run/admin/albums/1', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({
          slug: 'overpass-stereo',
          title: 'Overpass Stereo',
          artist: 'Mile Marker Club',
          description: 'A 1994 rock LP.',
          price: '15.99',
          genre: 'music',
          catalogNumber: 'RSD-49005-1',
          releaseYear: '1994',
          inStock: 'true',
        }),
      }),
    )

    assert.equal(response.status, 400)
    assertContains(await response.text(), 'Expected one of:')
    let album = await router.fetch('https://remix.run/albums/overpass-stereo')
    assertContains(await album.text(), 'Rock')
  })
})
