import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTestRouter, getCookiePair, origin } from '../../test/helpers.ts'

const router = await createTestRouter()

describe('settings', () => {
  it('saves the speed settings and returns to the current page', async () => {
    let response = await router.fetch(`${origin}/settings`, {
      method: 'POST',
      body: new URLSearchParams({ techniques: 'off', latency: '300' }),
      headers: { Referer: `${origin}/products/gears?pitch=32` },
    })

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/products/gears?pitch=32')

    let page = await router.fetch(`${origin}/`, {
      headers: { Cookie: getCookiePair(response, 'speed-settings') },
    })
    let html = await page.text()

    assert.match(html, /data-speed-techniques="off"/)
    assert.match(html, /<option value="300" selected>/)
  })

  it('falls back to the defaults for values it does not offer', async () => {
    let response = await router.fetch(`${origin}/settings`, {
      method: 'POST',
      body: new URLSearchParams({ techniques: 'turbo', latency: '5' }),
    })

    let page = await router.fetch(`${origin}/`, {
      headers: { Cookie: getCookiePair(response, 'speed-settings') },
    })
    let html = await page.text()

    assert.equal(response.headers.get('Location'), '/')
    assert.match(html, /data-speed-techniques="on"/)
    assert.match(html, /<option value="0" selected>/)
  })
})

describe('home', () => {
  it('lists every catalog section with prefetching links into the content frame', async () => {
    let response = await router.fetch(`${origin}/`, {
      headers: { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'content' },
    })
    let html = await response.text()

    assert.match(html, /Fastening &amp; Joining/)
    assert.match(html, /Springs &amp; Sealing/)
    assert.match(
      html,
      /<a href="\/products\/screws\/socket-head-screws" data-rmx-target="content" data-rmx-prefetch="intent"/,
    )
  })
})
