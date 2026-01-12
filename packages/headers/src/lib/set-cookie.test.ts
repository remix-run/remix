import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SetCookie } from './set-cookie.ts'

describe('SetCookie', () => {
  it('initializes with an empty string', () => {
    let header = new SetCookie('')
    assert.equal(header.name, undefined)
    assert.equal(header.value, undefined)
  })

  it('initializes with a string', () => {
    let header = new SetCookie(
      'session=abc123; Domain=example.com; Path=/; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Secure; HttpOnly',
    )
    assert.equal(header.name, 'session')
    assert.equal(header.value, 'abc123')
    assert.equal(header.domain, 'example.com')
    assert.equal(header.path, '/')
    assert.equal(header.expires?.toUTCString(), 'Wed, 21 Oct 2015 07:28:00 GMT')
    assert.equal(header.secure, true)
    assert.equal(header.httpOnly, true)
  })

  it('initializes with an object', () => {
    let header = new SetCookie({
      name: 'session',
      value: 'abc123',
      domain: 'example.com',
      path: '/',
      expires: new Date('Wed, 21 Oct 2015 07:28:00 GMT'),
      secure: true,
      httpOnly: true,
    })
    assert.equal(header.name, 'session')
    assert.equal(header.value, 'abc123')
    assert.equal(header.domain, 'example.com')
    assert.equal(header.path, '/')
    assert.equal(header.expires?.toUTCString(), 'Wed, 21 Oct 2015 07:28:00 GMT')
    assert.equal(header.secure, true)
    assert.equal(header.httpOnly, true)
  })

  it('initializes with httpOnly: false', () => {
    let header = new SetCookie({
      name: 'session',
      value: 'abc123',
      httpOnly: false,
    })
    assert.equal(header.name, 'session')
    assert.equal(header.value, 'abc123')
    assert.equal(header.httpOnly, false)
  })

  it('initializes with secure: false', () => {
    let header = new SetCookie({
      name: 'session',
      value: 'abc123',
      secure: false,
    })
    assert.equal(header.name, 'session')
    assert.equal(header.value, 'abc123')
    assert.equal(header.secure, false)
  })

  it('initializes with another SetCookie', () => {
    let header = new SetCookie(
      new SetCookie('session=abc123; Domain=example.com; Path=/; Secure; HttpOnly'),
    )
    assert.equal(header.name, 'session')
    assert.equal(header.value, 'abc123')
    assert.equal(header.domain, 'example.com')
    assert.equal(header.path, '/')
    assert.equal(header.secure, true)
    assert.equal(header.httpOnly, true)
  })

  it('handles cookies without attributes', () => {
    let header = new SetCookie('user=john')
    assert.equal(header.name, 'user')
    assert.equal(header.value, 'john')
  })

  it('handles cookie values with commas', () => {
    let header = new SetCookie('list=apple,banana,cherry; Domain=example.com')
    assert.equal(header.name, 'list')
    assert.equal(header.value, 'apple,banana,cherry')
    assert.equal(header.domain, 'example.com')
  })

  it('handles cookie values with semicolons', () => {
    let header = new SetCookie('complex="value; with; semicolons"; Path=/')
    assert.equal(header.name, 'complex')
    assert.equal(header.value, 'value; with; semicolons')
    assert.equal(header.path, '/')
  })

  it('handles cookie values with equals signs', () => {
    let header = new SetCookie('equation="1+1=2"; Secure')
    assert.equal(header.name, 'equation')
    assert.equal(header.value, '1+1=2')
    assert.equal(header.secure, true)
  })

  it('sets and gets attributes', () => {
    let header = new SetCookie('test=value')
    header.domain = 'example.org'
    header.path = '/api'
    header.maxAge = 3600
    header.secure = true
    header.httpOnly = true
    header.sameSite = 'Strict'

    assert.equal(header.domain, 'example.org')
    assert.equal(header.path, '/api')
    assert.equal(header.maxAge, 3600)
    assert.equal(header.secure, true)
    assert.equal(header.httpOnly, true)
    assert.equal(header.sameSite, 'Strict')
  })

  it('converts to string correctly', () => {
    let header = new SetCookie('session=abc123')
    header.domain = 'example.com'
    header.path = '/'
    header.secure = true
    header.httpOnly = true
    header.sameSite = 'Lax'
    header.maxAge = 0

    assert.equal(
      header.toString(),
      'session=abc123; Domain=example.com; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure',
    )
  })

  it('converts to an empty string when name is not set', () => {
    let header = new SetCookie()
    header.value = 'test'
    assert.equal(header.toString(), '')
  })

  it('handles quoted values', () => {
    let header = new SetCookie('complex="quoted value; with semicolon"')
    assert.equal(header.name, 'complex')
    assert.equal(header.value, 'quoted value; with semicolon')
  })

  it('parses and formats expires attribute correctly', () => {
    let expiresDate = new Date('Wed, 21 Oct 2015 07:28:00 GMT')
    let header = new SetCookie(`test=value; Expires=${expiresDate.toUTCString()}`)
    assert.equal(header.expires?.toUTCString(), expiresDate.toUTCString())

    header.expires = new Date('Thu, 22 Oct 2015 07:28:00 GMT')
    assert.equal(header.toString(), 'test=value; Expires=Thu, 22 Oct 2015 07:28:00 GMT')
  })

  it('handles SameSite attribute case-insensitively', () => {
    let header = new SetCookie('test=value; SameSite=lax')
    assert.equal(header.sameSite, 'Lax')

    header = new SetCookie('test=value; SameSite=STRICT')
    assert.equal(header.sameSite, 'Strict')

    header = new SetCookie('test=value; SameSite=NoNe')
    assert.equal(header.sameSite, 'None')
  })

  it('handles cookies with empty value', () => {
    let header = new SetCookie('name=')
    assert.equal(header.name, 'name')
    assert.equal(header.value, '')
  })

  it('handles multiple identical attributes', () => {
    let header = new SetCookie('test=value; Path=/; Path=/api')
    assert.equal(header.path, '/api')
  })

  it('ignores unknown attributes', () => {
    let header = new SetCookie('test=value; Unknown=something')
    assert.equal(header.toString(), 'test=value')
  })

  it('handles Max-Age as a number', () => {
    let header = new SetCookie('test=value; Max-Age=3600')
    assert.equal(header.maxAge, 3600)
  })

  it('ignores invalid Max-Age', () => {
    let header = new SetCookie('test=value; Max-Age=invalid')
    assert.equal(header.maxAge, undefined)
  })

  it('handles missing value in attributes', () => {
    let header = new SetCookie('test=value; Domain=; Path')
    assert.equal(header.domain, '')
    assert.equal(header.path, undefined)
  })

  it('preserves the case of the cookie name and value', () => {
    let header = new SetCookie('TestName=TestValue')
    assert.equal(header.name, 'TestName')
    assert.equal(header.value, 'TestValue')
  })

  it('handles setting new name and value', () => {
    let header = new SetCookie('old=value')
    header.name = 'new'
    header.value = 'newvalue'
    assert.equal(header.toString(), 'new=newvalue')
  })

  it('correctly quotes values when necessary', () => {
    let header = new SetCookie('test=value')
    header.value = 'need; quotes'
    assert.equal(header.toString(), 'test="need; quotes"')
  })
})

describe('SetCookie.from', () => {
  it('parses a string value', () => {
    let result = SetCookie.from('session=abc123; Path=/; HttpOnly')
    assert.ok(result instanceof SetCookie)
    assert.equal(result.name, 'session')
    assert.equal(result.value, 'abc123')
    assert.equal(result.path, '/')
    assert.equal(result.httpOnly, true)
  })
})
