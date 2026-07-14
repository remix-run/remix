import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { docsEtag, notModifiedDocsResponse } from './cache.ts'

describe('docsEtag', () => {
  it('produces a deterministic weak etag tagged with the label', () => {
    delete process.env.GITHUB_SHA
    let etag = docsEtag('chapter:start-here', [1, 'start-here', 2])

    assert.match(etag, /^W\/":chapter:start-here:[A-Za-z0-9_-]+"$/)
    assert.equal(etag, docsEtag('chapter:start-here', [1, 'start-here', 2]))
  })

  it('incorporates the deployed build sha', () => {
    process.env.GITHUB_SHA = 'abc123'
    assert.match(docsEtag('index', [1, 2]), /^W\/"abc123:index:/)
    delete process.env.GITHUB_SHA
  })

  it('drops undefined inputs', () => {
    delete process.env.GITHUB_SHA
    assert.equal(docsEtag('chapter:x', [1, undefined, 3]), docsEtag('chapter:x', [1, 3]))
  })

  it('changes when any cache input changes', () => {
    delete process.env.GITHUB_SHA
    assert.notEqual(docsEtag('chapter:x', [1, 'first']), docsEtag('chapter:x', [1, 'second']))
  })

  it('distinguishes string and numeric inputs', () => {
    delete process.env.GITHUB_SHA
    assert.notEqual(docsEtag('chapter:x', [1]), docsEtag('chapter:x', ['1']))
  })

  it('never contains a comma (If-None-Match separates tags with commas)', () => {
    delete process.env.GITHUB_SHA
    let etag = docsEtag('index', ['title, with comma'])
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
