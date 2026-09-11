import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  loginAsAdmin,
  requestWithSession,
} from '../../test/helpers.ts'
import { db } from '../db.ts'
import { albums } from '../data/schema.ts'
import { uploadsStorage as uploads } from '../utils/uploads.ts'

const router = await createTestRouter()

describe('root controller', () => {
  it('GET / returns home page', async () => {
    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Welcome to the Record Store')
    assertContains(html, 'Browse Albums')
  })

  it('GET /uploads/*key serves uploaded files from storage', async () => {
    let sessionId = await loginAsAdmin(router)

    let initialAlbumCount = await db.count(albums)

    let boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    let fileContent = 'fake image data'
    let formBody = [
      `------${boundary}`,
      'Content-Disposition: form-data; name="title"',
      '',
      'Album with Cover',
      `------${boundary}`,
      'Content-Disposition: form-data; name="artist"',
      '',
      'Test Artist',
      `------${boundary}`,
      'Content-Disposition: form-data; name="slug"',
      '',
      'album-with-cover',
      `------${boundary}`,
      'Content-Disposition: form-data; name="description"',
      '',
      'An album with a cover image',
      `------${boundary}`,
      'Content-Disposition: form-data; name="price"',
      '',
      '19.99',
      `------${boundary}`,
      'Content-Disposition: form-data; name="genre"',
      '',
      'test',
      `------${boundary}`,
      'Content-Disposition: form-data; name="catalogNumber"',
      '',
      'RSD-49010-2',
      `------${boundary}`,
      'Content-Disposition: form-data; name="releaseYear"',
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

    let createRequest = requestWithSession('https://remix.run/admin/albums', sessionId, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=----${boundary}`,
      },
      body: formBody,
    })

    let createResponse = await router.fetch(createRequest)
    assert.equal(createResponse.status, 302)
    assert.ok(createResponse.headers.get('Location')?.includes('/admin/albums'))

    let currentAlbumCount = await db.count(albums)
    assert.equal(currentAlbumCount, initialAlbumCount + 1)

    let newAlbum = await db.findOne(albums, { where: { slug: 'album-with-cover' } })
    assert.ok(newAlbum)
    assert.equal(newAlbum.slug, 'album-with-cover')
    assert.equal(newAlbum.title, 'Album with Cover')
    assert.equal(newAlbum.artist, 'Test Artist')
    assert.equal(newAlbum.catalog_number, 'RSD-49010-2')
    assert.equal(newAlbum.release_year, 2024)
    assert.ok(newAlbum.cover_url.startsWith('/uploads/'))

    let fileResponse = await router.fetch(`https://remix.run${newAlbum.cover_url}`)

    assert.equal(fileResponse.status, 200)
    assert.equal(fileResponse.headers.get('Content-Type'), 'image/jpeg')
    assert.equal(fileResponse.headers.get('Cache-Control'), 'public, max-age=31536000')
    assert.equal(await fileResponse.text(), fileContent)
  })

  it('GET /uploads/*key returns 404 for non-existent files', async () => {
    let response = await router.fetch('https://remix.run/uploads/nonexistent/file.jpg')

    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'File not found')
  })

  it('GET /uploads/*key serves files with correct content type', async () => {
    let pngFile = new File(['png data'], 'test.png', { type: 'image/png' })
    let pdfFile = new File(['pdf data'], 'test.pdf', { type: 'application/pdf' })

    await uploads.set('images/test.png', pngFile)
    await uploads.set('docs/test.pdf', pdfFile)

    let pngResponse = await router.fetch('https://remix.run/uploads/images/test.png')
    assert.equal(pngResponse.status, 200)
    assert.equal(pngResponse.headers.get('Content-Type'), 'image/png')

    let pdfResponse = await router.fetch('https://remix.run/uploads/docs/test.pdf')
    assert.equal(pdfResponse.status, 200)
    assert.equal(pdfResponse.headers.get('Content-Type'), 'application/pdf')
  })
})
