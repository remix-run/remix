import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { assets } from './utils/assets.ts'

describe('browser assets', () => {
  it('serves every colocated browser entry graph and rejects server source', async () => {
    let hrefs = await assets.getPreloads([
      'demos/sse/app/actions/public/entry.tsx',
      'demos/sse/app/actions/public/message-stream.tsx',
    ])

    assert.ok(hrefs.length > 2)
    for (let href of hrefs) {
      let response = await router.fetch(new Request(new URL(href, 'http://localhost')))
      assert.equal(response.status, 200, href)
    }

    let blockedResponse = await router.fetch(
      new Request('http://localhost/assets/app/actions/controller.tsx'),
    )
    assert.equal(blockedResponse.status, 404)
  })
})
