import { SetCookie } from '@remix-run/headers'

import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Cookie } from './cookie.ts'

function getCookieFromSetCookie(setCookie: string): string {
  let header = new SetCookie(setCookie)
  return header.name + '=' + header.value
}

describe('Cookie', () => {
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

  it('is not signed by default', async () => {
    let cookie = new Cookie('my-cookie')

    assert.equal(cookie.signed, false)

    let cookie2 = new Cookie('my-cookie2', { secrets: undefined })

    assert.equal(cookie2.signed, false)
  })

  it('uses Path=/ by default', async () => {
    let cookie = new Cookie('my-cookie')

    let setCookie = await cookie.serialize('hello world')
    assert.ok(setCookie.includes('Path=/'))

    let cookie2 = new Cookie('my-cookie2')

    let setCookie2 = await cookie2.serialize('hello world', {
      path: '/about',
    })
    assert.ok(setCookie2.includes('Path=/about'))
  })

  it('uses SameSite=Lax by default', async () => {
    let cookie = new Cookie('my-cookie')
    let setCookie = await cookie.serialize('hello world')
    assert.ok(setCookie.includes('SameSite=Lax'))
  })

  it('supports overriding cookie properties in the constructor', async () => {
    let cookie = new Cookie('my-cookie', {
      domain: 'remix.run',
      path: '/about',
      maxAge: 3600,
      sameSite: 'None',
      secure: true,
      httpOnly: true,
    })
    let setCookie = await cookie.serialize('hello world')
    assert.ok(setCookie.includes('Domain=remix.run'))
    assert.ok(setCookie.includes('Path=/about'))
    assert.ok(setCookie.includes('Max-Age=3600'))
    assert.ok(setCookie.includes('SameSite=None'))
    assert.ok(setCookie.includes('Secure'))
    assert.ok(setCookie.includes('HttpOnly'))
  })

  it('supports overriding cookie properties in the serialize method', async () => {
    let cookie = new Cookie('my-cookie')
    let setCookie = await cookie.serialize('hello world', {
      domain: 'remix.run',
      path: '/about',
      maxAge: 3600,
      sameSite: 'None',
      secure: true,
      httpOnly: true,
    })
    assert.ok(setCookie.includes('Domain=remix.run'))
    assert.ok(setCookie.includes('Path=/about'))
    assert.ok(setCookie.includes('Max-Age=3600'))
    assert.ok(setCookie.includes('SameSite=None'))
    assert.ok(setCookie.includes('Secure'))
    assert.ok(setCookie.includes('HttpOnly'))
  })
})
