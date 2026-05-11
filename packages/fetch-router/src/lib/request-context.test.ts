import { describe, it } from '@remix-run/test'
import assert from '@remix-run/assert'
import { createContextKey, RequestContext } from './request-context.ts'
import type { IsEqual } from './type-utils.ts'

function expectTypeEquality<_check extends true>() {}

describe('new RequestContext()', () => {
  it('provides access to request headers', () => {
    let req = new Request('https://remix.run/test', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    let context = new RequestContext(req)

    assert.equal(context.headers.get('Content-Type'), 'application/json')
  })

  it('lazily creates a mutable copy of request headers', () => {
    let req = new Request('https://remix.run/test', {
      headers: { 'Content-Type': 'text/html' },
    })
    let context = new RequestContext(req)

    req.headers.set('Content-Type', 'application/json')

    let headers = context.headers

    assert.ok(headers instanceof Headers)
    assert.equal(headers.get('Content-Type'), 'application/json')

    req.headers.set('Content-Type', 'text/plain')

    assert.equal(context.headers, headers)
    assert.equal(context.headers.get('Content-Type'), 'application/json')
  })

  it('allows overriding request headers', () => {
    let context = new RequestContext(new Request('https://remix.run/test'))
    let headers = new Headers({ 'Content-Type': 'text/plain' })

    context.headers = headers

    assert.equal(context.headers, headers)
    assert.equal(context.headers.get('Content-Type'), 'text/plain')
  })

  it('provides a copy of request headers that can be mutated independently', () => {
    let req = new Request('https://remix.run/test', {
      headers: { 'X-Original': 'value' },
    })
    let context = new RequestContext(req)

    context.headers.set('X-New', 'new-value')
    context.headers.delete('X-Original')

    // context.headers was mutated
    assert.equal(context.headers.get('X-New'), 'new-value')
    assert.equal(context.headers.get('X-Original'), null)

    // original request.headers unchanged
    assert.equal(req.headers.get('X-Original'), 'value')
    assert.equal(req.headers.get('X-New'), null)
  })

  it('stores and reads FormData using the FormData constructor as a context key', async () => {
    let context = new RequestContext(new Request('https://remix.run/test', { method: 'POST' }))
    let formData = new FormData()
    let file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

    assert.equal(context.has(FormData), false)

    formData.set('avatar', file)
    formData.set('name', 'Jane')
    context.set(FormData, formData)

    assert.equal(context.has(FormData), true)
    let storedFormData = context.get(FormData)
    if (storedFormData == null) {
      throw new Error('Expected FormData in request context')
    }

    expectTypeEquality<IsEqual<typeof storedFormData, FormData>>()

    assert.equal(storedFormData.get('name'), 'Jane')
    let avatar = storedFormData.get('avatar')
    assert.ok(avatar instanceof File)
    assert.equal(avatar.name, file.name)
    assert.equal(avatar.type, file.type)
    assert.equal(await avatar.text(), await file.text())
  })

  it('does not type constructor keys as available unless they are in context', () => {
    let context = new RequestContext(new Request('https://remix.run/test'))
    let formData = context.get(FormData)

    expectTypeEquality<IsEqual<typeof formData, FormData | undefined>>()

    if (false as boolean) {
      // @ts-expect-error - FormData is not available until it is set or provided by middleware
      context.get(FormData).get('name')
    }
  })

  it('stores arbitrary request methods as strings', () => {
    let context = new RequestContext(new Request('https://remix.run/test', { method: 'PROPFIND' }))

    assert.equal(context.method, 'PROPFIND')
  })

  it('sets and gets values in request context', () => {
    let key = createContextKey('hello')
    let context = new RequestContext(new Request('https://remix.run/test'))

    context.set(key, 'world')

    assert.equal(context.get(key), 'world')
  })

  it('gets a default value from request context when one is available', () => {
    let key = createContextKey('hello')
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.get(key), 'hello')
  })

  it('allows `null` as a valid default value in request context', () => {
    let key = createContextKey(null)
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.get(key), null)
  })

  it('allows `undefined` as a valid default value in request context', () => {
    let key = createContextKey(undefined)
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.get(key), undefined)
  })

  it('returns undefined if a context value is not set and no default value exists', () => {
    let key = createContextKey<string>()
    let context = new RequestContext(new Request('https://remix.run/test'))
    let value = context.get(key)

    expectTypeEquality<IsEqual<typeof value, string | undefined>>()
    assert.equal(value, undefined)
  })

  it('checks if a key has a context value', () => {
    let key = createContextKey('default')
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.has(key), false)
    context.set(key, 'value')
    assert.equal(context.has(key), true)
  })

  it('gets values without a default only when they have been set', () => {
    let key = createContextKey<string>()
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.get(key), undefined)
    context.set(key, 'value')
    assert.equal(context.get(key), 'value')
  })

  it('supports destructuring get/set/has from request context', () => {
    let defaultKey = createContextKey('default')
    let key = createContextKey<string>()
    let context = new RequestContext(new Request('https://remix.run/test'))
    let { get, has, set } = context

    assert.equal(has(key), false)
    assert.equal(get(defaultKey), 'default')
    assert.equal(get(key), undefined)

    set(key, 'value')

    assert.equal(has(key), true)
    assert.equal(get(defaultKey), 'default')
    assert.equal(get(key), 'value')
  })

  it('supports class constructors as context keys', () => {
    class Value {
      text: string

      constructor(text: string) {
        this.text = text
      }
    }

    let context = new RequestContext(new Request('https://remix.run/test'))
    let value = new Value('hello')

    context.set(Value, value)

    assert.equal(context.has(Value), true)
    let storedValue = context.get(Value)
    if (storedValue == null) {
      throw new Error('Expected Value in request context')
    }

    assert.equal(storedValue, value)
  })
})
