import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Cookie } from './cookie.ts'

function getCookieFromSetCookie(setCookie: string): string {
  return setCookie.split(/;\s*/)[0]
}

describe('cookies', () => {
  it('parses/serializes empty string values', async () => {
    let cookie = new Cookie('my-cookie')
    let setCookie = await cookie.serialize('')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, '')
  })

  it('parses/serializes unsigned string values', async () => {
    let cookie = new Cookie('my-cookie')
    let setCookie = await cookie.serialize('hello world')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, 'hello world')
  })

  it('parses/serializes signed string values', async () => {
    let cookie = new Cookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize('hello michael')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, 'hello michael')
  })

  it('parses/serializes string values containing utf8 characters', async () => {
    let cookie = new Cookie('my-cookie')
    let setCookie = await cookie.serialize('日本語')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, '日本語')
  })

  it('fails to parses signed string values with invalid signature', async () => {
    let cookie = new Cookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize('hello michael')
    let cookie2 = new Cookie('my-cookie', {
      secrets: ['secret2'],
    })
    let value = await cookie2.parse(getCookieFromSetCookie(setCookie))

    assert.equal(value, null)
  })

  it('fails to parse signed string values with invalid signature encoding', async () => {
    let cookie = new Cookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize('hello michael')
    let cookie2 = new Cookie('my-cookie', {
      secrets: ['secret2'],
    })
    // use characters that are invalid for base64 encoding
    let value = await cookie2.parse(getCookieFromSetCookie(setCookie) + '%^&')

    assert.equal(value, null)
  })

  it('parses/serializes signed object values', async () => {
    let cookie = new Cookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize(JSON.stringify({ hello: 'mjackson' }))
    let value = JSON.parse((await cookie.parse(getCookieFromSetCookie(setCookie)))!)

    assert.deepEqual(value, { hello: 'mjackson' })
  })

  it('supports secret rotation', async () => {
    let cookie = new Cookie('my-cookie', {
      secrets: ['secret1'],
    })
    let setCookie = await cookie.serialize('mjackson')
    let value = await cookie.parse(getCookieFromSetCookie(setCookie))

    assert.deepEqual(value, 'mjackson')

    // A new secret enters the rotation...
    cookie = new Cookie('my-cookie', {
      secrets: ['secret2', 'secret1'],
    })

    // cookie should still be able to parse old cookies.
    let oldValue = await cookie.parse(getCookieFromSetCookie(setCookie))
    assert.deepEqual(oldValue, value)

    // New Set-Cookie should be different, it uses a different secret.
    let setCookie2 = await cookie.serialize(value)
    assert.notEqual(setCookie, setCookie2)

    let newValue = await cookie.parse(getCookieFromSetCookie(setCookie2))
    assert.deepEqual(oldValue, newValue)
  })

  it('makes the default secrets to be an empty array', async () => {
    let cookie = new Cookie('my-cookie')

    assert.equal(cookie.isSigned, false)

    let cookie2 = new Cookie('my-cookie2', {
      secrets: undefined,
    })

    assert.equal(cookie2.isSigned, false)
  })

  it('makes the default path of cookies to be /', async () => {
    let cookie = new Cookie('my-cookie')

    let setCookie = await cookie.serialize('hello world')
    assert.ok(setCookie.includes('Path=/'))

    let cookie2 = new Cookie('my-cookie2')

    let setCookie2 = await cookie2.serialize('hello world', {
      path: '/about',
    })
    assert.ok(setCookie2.includes('Path=/about'))
  })

  it('supports the Priority attribute', async () => {
    let cookie = new Cookie('my-cookie')

    let setCookie = await cookie.serialize('hello world')
    assert.ok(!setCookie.includes('Priority'))

    let cookie2 = new Cookie('my-cookie2')

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
        new Cookie('my-cookie', { expires: new Date(Date.now() + 60_000) })
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
