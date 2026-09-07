import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createBookstoreRouter } from './router.ts'
import { assets } from './utils/assets.ts'

describe('browser assets', () => {
  it('serves every colocated browser entry graph and rejects server source', async () => {
    let router = createBookstoreRouter()
    let hrefs = await assets.getPreloads([
      'demos/bookstore/app/actions/public/entry.tsx',
      'demos/bookstore/app/actions/fragments/public/cart-button.tsx',
      'demos/bookstore/app/actions/fragments/public/cart-items.tsx',
      'demos/bookstore/app/actions/books/public/image-carousel.tsx',
    ])
    hrefs.push(await assets.getHref('demos/bookstore/app/actions/public/app.css'))

    await assertServed(router.fetch, hrefs)

    let blockedResponse = await router.fetch(
      new Request('http://localhost/assets/app/actions/controller.tsx'),
    )
    assert.equal(blockedResponse.status, 404)
  })
})

async function assertServed(
  fetch: (request: Request) => Promise<Response>,
  hrefs: string[],
): Promise<void> {
  assert.ok(hrefs.length > 5)

  for (let href of hrefs) {
    let response = await fetch(new Request(new URL(href, 'http://localhost')))
    assert.equal(response.status, 200, href)
  }
}
