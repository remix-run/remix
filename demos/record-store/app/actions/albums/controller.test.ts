import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { assertContains, createTestRouter } from '../../../test/helpers.ts'

const router = await createTestRouter()

describe('albums handlers', () => {
  it('GET /albums returns list of albums', async () => {
    let response = await router.fetch('https://remix.run/albums')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Browse Albums')
    assertContains(html, 'Flannel Overdrive')
    assertContains(html, 'Shred Till Dawn')
    assertContains(html, 'Boom Bap Boulevard')
  })

  it('GET /albums/:slug returns album details', async () => {
    let response = await router.fetch('https://remix.run/albums/flannel-overdrive')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Flannel Overdrive')
    assertContains(html, 'Puddle of Angst')
    assertContains(html, 'Add to Cart')
  })

  it('GET /albums/:slug shows out-of-stock state instead of add to cart', async () => {
    let response = await router.fetch('https://remix.run/albums/pick-it-up-again')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Pick It Up (Again)')
    assertContains(html, 'The Checkered Slacks')
    assertContains(html, 'RSD-49007-2')
    assertContains(html, '1997')
    assertContains(html, 'Out of Stock')
    assertContains(html, 'This album is currently out of stock.')
    assert.ok(!html.includes('Add to Cart'))
  })

  it('GET /albums/:slug returns 404 for non-existent album', async () => {
    let response = await router.fetch('https://remix.run/albums/does-not-exist')

    assert.equal(response.status, 404)
    let html = await response.text()
    assertContains(html, 'Album Not Found')
  })
})
