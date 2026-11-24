import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { assertContains, createTestRouter } from '../../../test/helpers.ts'
import { db } from '../../db.ts'
import { albums } from '../../data/schema.ts'

const router = await createTestRouter()

describe('albums handlers', () => {
  it('GET /albums lists records from the vinyl catalog', async () => {
    let response = await router.fetch('https://remix.run/albums')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Browse Records')
    assertContains(html, 'Overpass Stereo')
    assertContains(html, 'Shred Till Dawn')
    assertContains(html, 'Last Bell, First Kiss')
    assertFirstCoverPreload(html)
    assert.deepEqual(
      [...html.matchAll(/<img[^>]+loading="(eager|lazy)"/g)].map((match) => match[1]),
      [...Array(4).fill('eager'), ...Array(46).fill('lazy')],
    )
  })

  it('GET /albums/:slug returns album details', async () => {
    let response = await router.fetch('https://remix.run/albums/overpass-stereo')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Overpass Stereo')
    assertContains(html, 'Mile Marker Club')
    assertContains(html, '<strong>Catalog Number:</strong> RSD-49005-1')
    assertContains(html, '<strong>Release Year:</strong> 1994')
    assertContains(html, 'Add to Cart')
    assert.deepEqual(
      [...html.matchAll(/<img[^>]+loading="(eager|lazy)"/g)].map((match) => match[1]),
      ['eager', 'lazy', 'lazy'],
    )
  })

  it('GET /albums/:slug returns 404 for non-existent album', async () => {
    let response = await router.fetch('https://remix.run/albums/does-not-exist')

    assert.equal(response.status, 404)
    let html = await response.text()
    assertContains(html, 'Record Not Found')
  })

  it('returns at most three other albums from the same genre', async () => {
    let response = await router.fetch('https://remix.run/albums/overpass-stereo/related', {
      headers: { 'X-Remix-Frame': 'true' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'private, max-age=30')
    let html = await response.text()
    assert.deepEqual(
      [...html.matchAll(/data-test-slug="([^"]+)"/g)].map((match) => match[1]),
      ['shred-till-dawn', 'dial-up-heartbreak', 'magnetic-northline'],
    )
  })

  it('browses the rock category with an early cover preload', async () => {
    let response = await router.fetch('https://remix.run/albums/genre/rock')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Rock')
    assert.deepEqual(
      [...html.matchAll(/data-test-slug="([^"]+)"/g)].map((match) => match[1]),
      [
        'overpass-stereo',
        'shred-till-dawn',
        'dial-up-heartbreak',
        'magnetic-northline',
        'no-sleep-at-channel-nine',
        'corrosion-bloom',
      ],
    )
    assertFirstCoverPreload(html)
  })

  it('shows an empty related section for a record alone in its genre', async () => {
    let album = await db.find(albums, 7)
    assert.ok(album)
    let { id, ...fields } = album
    let slug = 'only-record-in-genre'
    await db.create(albums, { ...fields, slug, genre: 'solo-genre' })

    try {
      let response = await router.fetch(`https://remix.run/albums/${slug}/related`)

      assert.equal(response.status, 200)
      let html = await response.text()
      assertContains(html, 'No other records in this category yet.')
      assert.ok(!html.includes('data-test-slug'))
    } finally {
      await db.deleteMany(albums, { where: { slug } })
    }
  })

  it('shows the sold-out record without a purchase button', async () => {
    let response = await router.fetch('https://remix.run/albums/pick-it-up-again')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Pick It Up (Again)')
    assertContains(html, 'This record is currently out of stock.')
    assert.ok(!html.includes('Add to Cart'))
  })

  it('returns an uncached 404 when the related-albums source does not exist', async () => {
    let response = await router.fetch('https://remix.run/albums/does-not-exist/related', {
      headers: { 'X-Remix-Frame': 'true' },
    })

    assert.equal(response.status, 404)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assertContains(await response.text(), 'Record not found.')
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
