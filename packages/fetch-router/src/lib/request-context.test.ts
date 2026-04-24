import { describe, it } from '@remix-run/test'
import assert from '@remix-run/assert'
import { createContextKey, RequestContext } from './request-context.ts'

describe('new RequestContext()', () => {
  it('provides access to request headers', () => {
    let req = new Request('https://remix.run/test', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    let context = new RequestContext(req)

    assert.equal(context.headers.get('content-type'), 'application/json')
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

  it(
    'stores and reads FormData using the FormData constructor as a context key',
    async () => {
    let context = new RequestContext(new Request('https://remix.run/test', { method: 'POST' }))
    let formData = new FormData()
    let file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

    assert.equal(context.has(FormData), false)

    formData.set('avatar', file)
    formData.set('name', 'Jane')
    context.set(FormData, formData)

    assert.equal(context.has(FormData), true)
    assert.equal(context.get(FormData).get('name'), 'Jane')
    let avatar = context.get(FormData).get('avatar')
    assert.ok(avatar instanceof File)
    assert.equal(avatar.name, file.name)
    assert.equal(avatar.type, file.type)
    assert.equal(await avatar.text(), await file.text())
    },
  )

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

  it('throws if a context value is not set and no default value exists', () => {
    let key = createContextKey()
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.throws(() => context.get(key), Error)
  })

  it('checks if a key has a context value', () => {
    let key = createContextKey('default')
    let context = new RequestContext(new Request('https://remix.run/test'))

    assert.equal(context.has(key), false)
    context.set(key, 'value')
    assert.equal(context.has(key), true)
  })

  it('supports destructuring get/set/has from request context', () => {
    let key = createContextKey('default')
    let context = new RequestContext(new Request('https://remix.run/test'))
    let { get, has, set } = context

    assert.equal(has(key), false)
    assert.equal(get(key), 'default')

    set(key, 'value')

    assert.equal(has(key), true)
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
    assert.equal(context.get(Value), value)
  })
})
