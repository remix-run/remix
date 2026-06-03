import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { assetServer } from './asset-server.ts'
import { createRouter } from './router.tsx'

after(async () => {
  await assetServer.close()
})

describe('createRouter()', () => {
  it('preserves versioned markdown lookup targets', async () => {
    let router = createRouter(['v1.2.3'])
    let response = await router.fetch(new Request('http://localhost/v1.2.3/api.json'))
    assert.equal(response.status, 200)

    let body = await response.text()
    let href = '/v1.2.3/api/remix/headers/accept/class/Accept.md'
    assert.equal(body.includes(`"Accept":"${href}"`), true)
    assert.equal(body.includes(`"Accept":"${href}/"`), false)

    let markdownResponse = await router.fetch(new Request(`http://localhost${href}`))
    assert.equal(markdownResponse.status, 200)
    assert.equal(markdownResponse.headers.get('content-type'), 'text/markdown; charset=utf-8')
  })
})
