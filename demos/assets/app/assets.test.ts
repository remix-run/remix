import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from './router.ts'

describe('browser assets', () => {
  it('serves the colocated browser graph and rejects server source', async () => {
    let pageResponse = await router.fetch(new Request('http://localhost/'))
    let html = await pageResponse.text()
    let hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1])

    assert.equal(pageResponse.status, 200)
    assert.ok(hrefs.length >= 4)

    for (let href of hrefs) {
      assert.ok(href)
      let response = await router.fetch(new Request(new URL(href, 'http://localhost')))
      assert.equal(response.status, 200, href)
    }

    let blockedResponse = await router.fetch(
      new Request('http://localhost/assets/app/actions/controller.ts'),
    )
    assert.equal(blockedResponse.status, 404)
  })
})
