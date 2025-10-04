import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { html, json, redirect } from './response.ts'

describe('html()', () => {
  it('creates a Response with HTML content-type header', async () => {
    let response = html('<h1>Hello</h1>')

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<h1>Hello</h1>')
  })

  it('preserves custom headers from init', async () => {
    let response = html('<h1>Hello</h1>', {
      headers: { 'X-Custom': 'test' },
      status: 201,
    })

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(response.headers.get('X-Custom'), 'test')
    assert.equal(response.status, 201)
  })

  it('allows overriding Content-Type header', async () => {
    let response = html('<h1>Hello</h1>', {
      headers: { 'Content-Type': 'text/plain' },
    })

    assert.equal(response.headers.get('Content-Type'), 'text/plain')
  })

  it('handles ReadableStream content without modification', async () => {
    let stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<h1>Stream</h1>'))
        controller.close()
      },
    })

    let response = html(stream)

    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.equal(await response.text(), '<h1>Stream</h1>')
  })
})

describe('json()', () => {
  it('creates a Response with JSON content-type header', async () => {
    let response = json({ message: 'Hello' })

    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=UTF-8')
    assert.deepEqual(await response.json(), { message: 'Hello' })
  })

  it('handles arrays and primitive types', async () => {
    let arrayResponse = json([1, 2, 3])
    assert.deepEqual(await arrayResponse.json(), [1, 2, 3])

    let stringResponse = json('test')
    assert.equal(await stringResponse.json(), 'test')

    let numberResponse = json(42)
    assert.equal(await numberResponse.json(), 42)
  })

  it('preserves custom headers and status from init', async () => {
    let response = json(
      { success: true },
      {
        headers: { 'X-Custom': 'test' },
        status: 201,
      },
    )

    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=UTF-8')
    assert.equal(response.headers.get('X-Custom'), 'test')
    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), { success: true })
  })

  it('allows overriding Content-Type header', async () => {
    let response = json(
      { data: 'test' },
      {
        headers: { 'Content-Type': 'application/vnd.api+json' },
      },
    )

    assert.equal(response.headers.get('Content-Type'), 'application/vnd.api+json')
  })
})

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
})
