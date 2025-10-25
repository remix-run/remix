import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { redirect } from './redirect.ts'

describe('redirect()', () => {
  it('creates a redirect with default 302 status', () => {
    let response = redirect('/home')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/home')
  })

  it('creates a redirect with custom status code', () => {
    let response = redirect('/login', 301)

    assert.equal(response.status, 301)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('accepts ResponseInit object as second parameter', () => {
    let response = redirect('/dashboard', {
      status: 307,
      headers: { 'X-Redirect-Reason': 'authentication' },
    })

    assert.equal(response.status, 307)
    assert.equal(response.headers.get('Location'), '/dashboard')
    assert.equal(response.headers.get('X-Redirect-Reason'), 'authentication')
  })

  it('handles relative URLs', () => {
    let response = redirect('../parent', 303)

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '../parent')
  })

  it('allows overriding Location header', () => {
    let response = redirect('/default', {
      headers: { Location: '/override' },
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/override')
  })

  it('allows overriding Location header with Headers object', () => {
    let headers = new Headers()
    headers.set('Location', '/custom-location')
    headers.set('X-Custom', 'value')

    let response = redirect('/default', { headers })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/custom-location')
    assert.equal(response.headers.get('X-Custom'), 'value')
  })

  it('accepts a URL object', () => {
    let response = redirect(new URL('https://example.com/login'), 301)
    assert.equal(response.status, 301)
    assert.equal(response.headers.get('Location'), 'https://example.com/login')
  })
})
