import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

process.env.SESSION_SECRET = 'test-session-secret'

const { assetServer } = await import('./actions/assets/controller.ts')
const { router } = await import('./router.ts')

describe('browser assets', () => {
  it('serves every colocated browser entry graph and rejects test source', async () => {
    let hrefs = await assetServer.getPreloads([
      'demos/timeboxer/app/actions/public/entry.ts',
      'demos/timeboxer/app/actions/schedules/public/new-schedule-action.tsx',
      'demos/timeboxer/app/actions/schedules/public/schedule-grid.tsx',
      'demos/timeboxer/app/actions/schedules/public/schedule-sidebar.tsx',
    ])

    assert.ok(hrefs.length > 5)
    for (let href of hrefs) {
      let response = await router.fetch(new Request(new URL(href, 'http://localhost')))
      assert.equal(response.status, 200, href)
    }

    let blockedResponse = await router.fetch(
      new Request(
        'http://localhost/assets/app/actions/schedules/public/schedule-grid.test.browser.tsx',
      ),
    )
    assert.equal(blockedResponse.status, 404)
  })
})
