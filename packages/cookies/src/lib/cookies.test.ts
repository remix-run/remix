import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie, isCookie } from './cookies.ts'

function getCookieFromSetCookie(setCookie: string): string {
  return setCookie.split(/;\s*/)[0]
}

describe('isCookie', () => {
  it('returns `true` for Cookie objects', () => {
    assert.equal(isCookie(createCookie('my-cookie')), true)
  })

  it('returns `false` for non-Cookie objects', () => {
    assert.equal(isCookie({}), false)
    assert.equal(isCookie([]), false)
    assert.equal(isCookie(''), false)
    assert.equal(isCookie(true), false)
  })
})

describe('cookies', () => {
  it('parses/serializes empty string values', async () => {
    let cookie = createCookie('my-cookie')
    let setCookie = await cookie.serialize('')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, '')
  })

  it('parses/serializes unsigned string values', async () => {
    let cookie = createCookie('my-cookie')
    let setCookie = await cookie.serialize('hello world')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, 'hello world')
  })

  it('parses/serializes unsigned boolean values', async () => {
    let cookie = createCookie('my-cookie')
    let setCookie = await cookie.serialize(true)
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, true)
  })

  it('parses/serializes signed string values', async () => {
    let cookie = createCookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize('hello michael')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, 'hello michael')
  })

  it('parses/serializes string values containing utf8 characters', async () => {
    let cookie = createCookie('my-cookie')
    let setCookie = await cookie.serialize('日本語')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, '日本語')
  })

  it('fails to parses signed string values with invalid signature', async () => {
    let cookie = createCookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize('hello michael')
    let cookie2 = createCookie('my-cookie', {
      secrets: ['secret2'],
    })
    let value = await cookie2.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, null)
  })

  it('fails to parse signed string values with invalid signature encoding', async () => {
    let cookie = createCookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize('hello michael')
    let cookie2 = createCookie('my-cookie', {
      secrets: ['secret2'],
    })
    // use characters that are invalid for base64 encoding
    let value = await cookie2.parse(getCookieFromSetCookie(setCookie) + '%^&')

    assert.equal(value, null)
  })

  it('parses/serializes signed object values', async () => {
    let cookie = createCookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize({ hello: 'mjackson' })
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.deepEqual(value, { hello: 'mjackson' })
  })

  it('fails to parse signed object values with invalid signature', async () => {
    let cookie = createCookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize({ hello: 'mjackson' })
    let cookie2 = createCookie('my-cookie', {
      secrets: ['secret2'],
    })
    let value = await cookie2.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, null)
  })

  it('supports secret rotation', async () => {
    let cookie = createCookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize({ hello: 'mjackson' })
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.deepEqual(value, { hello: 'mjackson' })

    // A new secret enters the rotation...
    cookie = createCookie('my-cookie', {
      secrets: ['secret2', 'secret1'],
    })

    // cookie should still be able to parse old cookies.
    let oldValue = await cookie.parse(getCookieFromSetCookie(setCookie))
    assert.deepEqual(oldValue, value)

    // New Set-Cookie should be different, it uses a different secret.
    let setCookie2 = await cookie.serialize(value)
    assert.notEqual(setCookie, setCookie2)
  })

  it('makes the default secrets to be an empty array', async () => {
    let cookie = createCookie('my-cookie')

    assert.equal(cookie.isSigned, false)

    let cookie2 = createCookie('my-cookie2', {
      secrets: undefined,
    })

    assert.equal(cookie2.isSigned, false)
  })

  it('makes the default path of cookies to be /', async () => {
    let cookie = createCookie('my-cookie')

    let setCookie = await cookie.serialize('hello world')
    assert.ok(setCookie.includes('Path=/'))

    let cookie2 = createCookie('my-cookie2')

    let setCookie2 = await cookie2.serialize('hello world', {
      path: '/about',
    })
    assert.ok(setCookie2.includes('Path=/about'))
  })

  it('supports the Priority attribute', async () => {
    let cookie = createCookie('my-cookie')

    let setCookie = await cookie.serialize('hello world')
    assert.ok(!setCookie.includes('Priority'))

    let cookie2 = createCookie('my-cookie2')

    let setCookie2 = await cookie2.serialize('hello world', {
      priority: 'high',
    })
    assert.ok(setCookie2.includes('Priority=High'))
  })

  describe('warnings when providing options you may not want to', () => {
    it('warns against using `expires` when creating the cookie instance', async () => {
      let consoleCalls: string[] = []
      let originalWarn = console.warn
      console.warn = (...args: any[]) => {
        consoleCalls.push(args.join(' '))
      }

      try {
        createCookie('my-cookie', { expires: new Date(Date.now() + 60_000) })
        assert.equal(consoleCalls.length, 1)
        assert.ok(consoleCalls[0].includes('The "my-cookie" cookie has an "expires" property set'))
        assert.ok(
          consoleCalls[0].includes(
            'Instead, you should set the expires value when serializing the cookie',
          ),
        )
      } finally {
        console.warn = originalWarn
      }
    })
  })
})
