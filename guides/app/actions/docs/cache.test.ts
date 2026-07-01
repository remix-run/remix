import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { docsEtag, notModifiedDocsResponse } from './cache.ts'

describe('docsEtag', () => {
  it('produces a weak etag tagged with the label and joined mtimes', () => {
    delete process.env.GITHUB_SHA
    assert.equal(docsEtag('chapter:start-here', [1, 2, 3]), 'W/":chapter:start-here:1-2-3"')
  })

  it('incorporates the deployed build sha', () => {
    process.env.GITHUB_SHA = 'abc123'
    assert.equal(docsEtag('index', [1, 2]), 'W/"abc123:index:1-2"')
    delete process.env.GITHUB_SHA
  })

  it('drops undefined mtimes so missing neighbors do not change the tag', () => {
    delete process.env.GITHUB_SHA
    assert.equal(docsEtag('chapter:x', [1, undefined, 3]), 'W/":chapter:x:1-3"')
  })

  it('changes when any mtime changes', () => {
    delete process.env.GITHUB_SHA
    assert.notEqual(docsEtag('chapter:x', [1, 2]), docsEtag('chapter:x', [1, 3]))
  })

  it('never contains a comma in the mtime body (If-None-Match separates tags with commas)', () => {
    delete process.env.GITHUB_SHA
    let etag = docsEtag('index', [1, 2, 3])
    assert.equal(etag.includes(','), false)
  })
})

after(() => {
  delete process.env.GITHUB_SHA
})

describe('notModifiedDocsResponse', () => {
  it('returns a 304 when If-None-Match matches the etag', () => {
    let etag = 'W/"abc123:index:1-2"'
    let response = notModifiedDocsResponse(
      new Request('https://remix.run/docs', { headers: { 'If-None-Match': etag } }),
      etag,
    )
    assert.equal(response?.status, 304)
    assert.equal(response?.headers.get('ETag'), etag)
    assert.equal(
      response?.headers.get('Cache-Control'),
      'public, max-age=300, stale-while-revalidate=86400',
    )
  })

  it('returns undefined when If-None-Match does not match', () => {
    let response = notModifiedDocsResponse(
      new Request('https://remix.run/docs', { headers: { 'If-None-Match': 'W/"other"' } }),
      'W/"abc123:index:1-2"',
    )
    assert.equal(response, undefined)
  })

  it('returns undefined when If-None-Match is absent', () => {
    let response = notModifiedDocsResponse(
      new Request('https://remix.run/docs'),
      'W/"abc123:index:1-2"',
    )
    assert.equal(response, undefined)
  })

  it('matches the wildcard If-None-Match: *', () => {
    let response = notModifiedDocsResponse(
      new Request('https://remix.run/docs', { headers: { 'If-None-Match': '*' } }),
      'W/"abc123:index:1-2"',
    )
    assert.equal(response?.status, 304)
  })
})
