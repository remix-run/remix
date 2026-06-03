import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { assetServer } from './asset-server.ts'
import { getVersionedLookupHref } from './lookup.ts'
import { createRouter } from './router.tsx'

after(async () => {
  await assetServer.close()
})

describe('createRouter()', () => {
  it('does not load generated docs output while creating the router', () => {
    let router = createRouter(['v1.2.3'])
    assert.equal(typeof router.fetch, 'function')
  })
})

describe('getVersionedLookupHref()', () => {
  it('preserves versioned markdown lookup targets', () => {
    assert.equal(
      getVersionedLookupHref('/api/remix/headers/accept/class/Accept.md', 'v1.2.3'),
      '/v1.2.3/api/remix/headers/accept/class/Accept.md',
    )
  })

  it('uses docs routes for HTML lookup targets', () => {
    assert.equal(
      getVersionedLookupHref('/api/remix/headers/accept/class/Accept', 'v1.2.3'),
      '/v1.2.3/api/remix/headers/accept/class/Accept/',
    )
  })

  it('preserves query strings and hashes', () => {
    assert.equal(
      getVersionedLookupHref(
        '/api/remix/headers/accept/class/Accept.md?tab=docs#example',
        'v1.2.3',
      ),
      '/v1.2.3/api/remix/headers/accept/class/Accept.md?tab=docs#example',
    )
  })

  it('leaves non-API lookup targets unchanged', () => {
    assert.equal(
      getVersionedLookupHref('https://example.com/Accept', 'v1.2.3'),
      'https://example.com/Accept',
    )
  })
})
