import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { html, json, redirect } from './response-helpers.ts'
import { Route } from './route-map.ts'

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

  it('accepts a Route with no required params', () => {
    let route = new Route('GET', '/home')
    let response = redirect(route)

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/home')
  })

  it('accepts a Route with no required params and custom status', () => {
    let route = new Route('ANY', '/login')
    let response = redirect(route, 301)

    assert.equal(response.status, 301)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('accepts a Route with no required params and ResponseInit', () => {
    let route = new Route('GET', '/dashboard')
    let response = redirect(route, {
      status: 303,
      headers: { 'X-Reason': 'post-redirect' },
    })

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/dashboard')
    assert.equal(response.headers.get('X-Reason'), 'post-redirect')
  })

  it('works with Routes that have optional params', () => {
    let route = new Route('GET', '/search?q')
    let response = redirect(route)

    assert.equal(response.status, 302)
    // Optional params are included in the pattern
    assert.equal(response.headers.get('Location'), '/search?q')
  })

  it('prevents using routes that do not support GET', () => {
    let route = new Route('POST', '/books')

    assert.throws(() => {
      // @ts-expect-error - Should not allow routes that do not support GET
      redirect(route)
    }, /Route does not support GET/)
  })

  it('prevents using routes with required params', () => {
    let route = new Route('GET', '/books/:slug')

    assert.throws(() => {
      // @ts-expect-error - Should not allow routes with required params
      redirect(route)
    }, /Missing required parameter/)
  })
})
