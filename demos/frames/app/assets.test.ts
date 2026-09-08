import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { assets } from './utils/assets.ts'

describe('browser assets', () => {
  it('serves every colocated browser entry graph and rejects server source', async () => {
    let hrefs = await assets.getPreloads([
      'demos/frames/app/actions/public/entry.tsx',
      'demos/frames/app/actions/public/client-mounted-page-example.tsx',
      'demos/frames/app/actions/public/root-reload-client-entries.tsx',
      'demos/frames/app/actions/public/state-search-page.tsx',
      'demos/frames/app/actions/frames/public/reload-time.tsx',
      'demos/frames/app/ui/public/client-frame-example.tsx',
      'demos/frames/app/ui/public/counter.tsx',
      'demos/frames/app/ui/public/reload-scope.tsx',
    ])

    assert.ok(hrefs.length > 8)
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
