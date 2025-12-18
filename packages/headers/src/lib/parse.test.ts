import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Accept, parseAccept } from './accept.ts'
import { AcceptEncoding, parseAcceptEncoding } from './accept-encoding.ts'
import { AcceptLanguage, parseAcceptLanguage } from './accept-language.ts'
import { CacheControl, parseCacheControl } from './cache-control.ts'
import { ContentDisposition, parseContentDisposition } from './content-disposition.ts'
import { ContentRange, parseContentRange } from './content-range.ts'
import { ContentType, parseContentType } from './content-type.ts'
import { Cookie, parseCookie } from './cookie.ts'
import { IfMatch, parseIfMatch } from './if-match.ts'
import { IfNoneMatch, parseIfNoneMatch } from './if-none-match.ts'
import { IfRange, parseIfRange } from './if-range.ts'
import { Range, parseRange } from './range.ts'
import { SetCookie, parseSetCookie } from './set-cookie.ts'
import { Vary, parseVary } from './vary.ts'

describe('parseAccept', () => {
  it('parses a string value', () => {
    let result = parseAccept('text/html, application/json;q=0.9')
    assert(result instanceof Accept)
    assert.equal(result.size, 2)
    assert.equal(result.getWeight('text/html'), 1)
    assert.equal(result.getWeight('application/json'), 0.9)
  })

  it('returns empty instance for null', () => {
    let result = parseAccept(null)
    assert(result instanceof Accept)
    assert.equal(result.size, 0)
  })

  it('accepts init object', () => {
    let result = parseAccept({ 'text/html': 1 })
    assert(result instanceof Accept)
    assert.equal(result.size, 1)
  })
})

describe('parseAcceptEncoding', () => {
  it('parses a string value', () => {
    let result = parseAcceptEncoding('gzip, deflate;q=0.5')
    assert(result instanceof AcceptEncoding)
    assert.equal(result.size, 2)
  })
})

describe('parseAcceptLanguage', () => {
  it('parses a string value', () => {
    let result = parseAcceptLanguage('en-US, en;q=0.9')
    assert(result instanceof AcceptLanguage)
    assert.equal(result.size, 2)
  })
})

describe('parseCacheControl', () => {
  it('parses a string value', () => {
    let result = parseCacheControl('max-age=3600, public')
    assert(result instanceof CacheControl)
    assert.equal(result.maxAge, 3600)
    assert.equal(result.public, true)
  })

  it('accepts init object', () => {
    let result = parseCacheControl({ maxAge: 3600, public: true })
    assert(result instanceof CacheControl)
    assert.equal(result.maxAge, 3600)
    assert.equal(result.public, true)
  })
})

describe('parseContentDisposition', () => {
  it('parses a string value', () => {
    let result = parseContentDisposition('attachment; filename="test.txt"')
    assert(result instanceof ContentDisposition)
    assert.equal(result.type, 'attachment')
    assert.equal(result.filename, 'test.txt')
  })
})

describe('parseContentRange', () => {
  it('parses a string value', () => {
    let result = parseContentRange('bytes 0-499/1234')
    assert(result instanceof ContentRange)
    assert.equal(result.unit, 'bytes')
    assert.equal(result.start, 0)
    assert.equal(result.end, 499)
    assert.equal(result.size, 1234)
  })
})

describe('parseContentType', () => {
  it('parses a string value', () => {
    let result = parseContentType('text/html; charset=utf-8')
    assert(result instanceof ContentType)
    assert.equal(result.mediaType, 'text/html')
    assert.equal(result.charset, 'utf-8')
  })

  it('accepts init object', () => {
    let result = parseContentType({ mediaType: 'text/html', charset: 'utf-8' })
    assert(result instanceof ContentType)
    assert.equal(result.mediaType, 'text/html')
    assert.equal(result.charset, 'utf-8')
  })
})

describe('parseCookie', () => {
  it('parses a string value', () => {
    let result = parseCookie('session=abc123; user=john')
    assert(result instanceof Cookie)
    assert.equal(result.get('session'), 'abc123')
    assert.equal(result.get('user'), 'john')
  })
})

describe('parseIfMatch', () => {
  it('parses a string value', () => {
    let result = parseIfMatch('"abc", "def"')
    assert(result instanceof IfMatch)
    assert.equal(result.tags.length, 2)
  })
})

describe('parseIfNoneMatch', () => {
  it('parses a string value', () => {
    let result = parseIfNoneMatch('"abc", "def"')
    assert(result instanceof IfNoneMatch)
    assert.equal(result.tags.length, 2)
  })
})

describe('parseIfRange', () => {
  it('parses a string value', () => {
    let result = parseIfRange('"abc"')
    assert(result instanceof IfRange)
    assert.equal(result.value, '"abc"')
  })

  it('parses a Date value', () => {
    let date = new Date('2024-01-01T00:00:00.000Z')
    let result = parseIfRange(date)
    assert(result instanceof IfRange)
    assert.equal(result.value, date.toUTCString())
  })
})

describe('parseRange', () => {
  it('parses a string value', () => {
    let result = parseRange('bytes=0-499')
    assert(result instanceof Range)
    assert.equal(result.unit, 'bytes')
    assert.equal(result.ranges.length, 1)
  })
})

describe('parseSetCookie', () => {
  it('parses a string value', () => {
    let result = parseSetCookie('session=abc123; Path=/; HttpOnly')
    assert(result instanceof SetCookie)
    assert.equal(result.name, 'session')
    assert.equal(result.value, 'abc123')
    assert.equal(result.path, '/')
    assert.equal(result.httpOnly, true)
  })
})

describe('parseVary', () => {
  it('parses a string value', () => {
    let result = parseVary('Accept-Encoding, Accept-Language')
    assert(result instanceof Vary)
    assert.equal(result.size, 2)
    assert.equal(result.has('Accept-Encoding'), true)
    assert.equal(result.has('Accept-Language'), true)
  })

  it('parses an array value', () => {
    let result = parseVary(['Accept-Encoding', 'Accept-Language'])
    assert(result instanceof Vary)
    assert.equal(result.size, 2)
  })
})
