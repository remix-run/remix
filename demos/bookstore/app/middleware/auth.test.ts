import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { getPostAuthRedirect } from './auth.ts'

function redirectFor(returnTo: string): string {
  let url = new URL('https://app.test/login')
  url.searchParams.set('returnTo', returnTo)
  return getPostAuthRedirect(url, '/fallback')
}

describe('getPostAuthRedirect', () => {
  it('keeps same-site paths with their query and hash', () => {
    assert.equal(redirectFor('/books?sort=title#top'), '/books?sort=title#top')
  })

  it('rejects absolute URLs', () => {
    assert.equal(redirectFor('https://evil.test/'), '/fallback')
  })

  it('rejects protocol-relative URLs', () => {
    assert.equal(redirectFor('//evil.test/'), '/fallback')
  })

  it('rejects backslash paths that browsers resolve to another host', () => {
    assert.equal(redirectFor('/\\evil.test/'), '/fallback')
  })
})
