import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { Vary } from './vary.ts'

describe('Vary', () => {
  it('initializes with an empty string', () => {
    let header = new Vary('')
    assert.equal(header.size, 0)
    assert.deepEqual(header.headerNames, [])
  })

  it('initializes with a string', () => {
    let header = new Vary('Accept-Encoding, Accept-Language')
    assert.deepEqual(header.headerNames, ['Accept-Encoding', 'Accept-Language'])
    assert.equal(header.size, 2)
  })

  it('initializes with an array', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language'])
    assert.deepEqual(header.headerNames, ['Accept-Encoding', 'Accept-Language'])
    assert.equal(header.size, 2)
  })

  it('initializes with an object', () => {
    let header = new Vary({ headerNames: ['Accept-Encoding', 'Accept-Language'] })
    assert.deepEqual(header.headerNames, ['Accept-Encoding', 'Accept-Language'])
    assert.equal(header.size, 2)
  })

  it('initializes with another Vary', () => {
    let header = new Vary(new Vary('Accept-Encoding, Accept-Language'))
    assert.deepEqual(header.headerNames, ['Accept-Encoding', 'Accept-Language'])
    assert.equal(header.size, 2)
  })

  it('handles whitespace in initial value', () => {
    let header = new Vary('  Accept-Encoding  ,   Accept-Language  ')
    assert.deepEqual(header.headerNames, ['Accept-Encoding', 'Accept-Language'])
  })

  it('keeps header names as given', () => {
    let header = new Vary(['Accept-Encoding', 'ACCEPT-LANGUAGE', 'user-agent'])
    assert.deepEqual(header.headerNames, ['Accept-Encoding', 'ACCEPT-LANGUAGE', 'user-agent'])
    assert.equal(header.toString(), 'Accept-Encoding, ACCEPT-LANGUAGE, user-agent')
  })

  it('keeps the first spelling of a header name from a string', () => {
    let header = new Vary('Cookie, cookie, Accept-Encoding')
    assert.equal(header.size, 2)
    assert.deepEqual(header.headerNames, ['Cookie', 'Accept-Encoding'])
    assert.equal(header.toString(), 'Cookie, Accept-Encoding')
  })

  it('keeps the first spelling of a header name from an array', () => {
    let header = new Vary(['Cookie', 'COOKIE', 'Accept-Encoding'])
    assert.equal(header.size, 2)
    assert.deepEqual(header.headerNames, ['Cookie', 'Accept-Encoding'])
    assert.equal(header.toString(), 'Cookie, Accept-Encoding')
  })

  it('keeps the first spelling of a header name from an object', () => {
    let header = new Vary({ headerNames: ['Cookie', 'cookie', 'Accept-Encoding'] })
    assert.equal(header.size, 2)
    assert.deepEqual(header.headerNames, ['Cookie', 'Accept-Encoding'])
    assert.equal(header.toString(), 'Cookie, Accept-Encoding')
  })

  it('keeps the first spelling of a header name when adding', () => {
    let header = new Vary()
    header.add('Cookie')
    header.add('cookie')
    assert.equal(header.size, 1)
    assert.deepEqual(header.headerNames, ['Cookie'])
    assert.deepEqual([...header], ['Cookie'])
    assert.equal(header.toString(), 'Cookie')
    assert.equal(header.has('COOKIE'), true)
  })

  it('deletes a header name regardless of its spelling', () => {
    let header = new Vary(['Cookie', 'Accept-Encoding'])
    header.delete('cookie')
    assert.equal(header.has('Cookie'), false)
    assert.deepEqual(header.headerNames, ['Accept-Encoding'])
  })

  it('does not recase lowercase header names', () => {
    let header = new Vary('cookie')
    header.add('accept-encoding')
    assert.deepEqual(header.headerNames, ['cookie', 'accept-encoding'])
    assert.equal(header.toString(), 'cookie, accept-encoding')
  })

  it('gets all header names', () => {
    let header = new Vary('Accept-Encoding, Accept-Language')
    assert.deepEqual(header.headerNames, ['Accept-Encoding', 'Accept-Language'])
  })

  it('returns size', () => {
    let header = new Vary('Accept-Encoding, Accept-Language, User-Agent')
    assert.equal(header.size, 3)
  })

  it('checks if a header name exists (case-insensitive)', () => {
    let header = new Vary('Accept-Encoding, Accept-Language')
    assert.equal(header.has('accept-encoding'), true)
    assert.equal(header.has('Accept-Encoding'), true)
    assert.equal(header.has('ACCEPT-ENCODING'), true)
    assert.equal(header.has('user-agent'), false)
  })

  it('adds a header name', () => {
    let header = new Vary()
    header.add('Accept-Encoding')
    assert.equal(header.has('Accept-Encoding'), true)
    assert.equal(header.size, 1)
  })

  it('adds multiple header names', () => {
    let header = new Vary()
    header.add('Accept-Encoding')
    header.add('Accept-Language')
    header.add('User-Agent')
    assert.equal(header.size, 3)
    assert.deepEqual(header.headerNames, ['Accept-Encoding', 'Accept-Language', 'User-Agent'])
  })

  it('does not add duplicate header names (case-insensitive)', () => {
    let header = new Vary('Accept-Encoding')
    header.add('accept-encoding')
    header.add('ACCEPT-ENCODING')
    header.add('Accept-Encoding')
    assert.equal(header.size, 1)
    assert.deepEqual(header.headerNames, ['Accept-Encoding'])
  })

  it('handles empty header names', () => {
    let header = new Vary()
    header.add('')
    header.add('  ')
    assert.equal(header.size, 0)
  })

  it('deletes a header name', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language'])
    header.delete('Accept-Encoding')
    assert.equal(header.has('Accept-Encoding'), false)
    assert.equal(header.size, 1)
    assert.deepEqual(header.headerNames, ['Accept-Language'])
  })

  it('deletes a header name (case-insensitive)', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language'])
    header.delete('accept-encoding')
    assert.equal(header.has('Accept-Encoding'), false)
    assert.equal(header.size, 1)
  })

  it('clears all header names', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language', 'User-Agent'])
    header.clear()
    assert.equal(header.size, 0)
    assert.deepEqual(header.headerNames, [])
  })

  it('converts to string', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language', 'User-Agent'])
    assert.equal(header.toString(), 'Accept-Encoding, Accept-Language, User-Agent')
  })

  it('converts empty header to empty string', () => {
    let header = new Vary()
    assert.equal(header.toString(), '')
  })

  it('is directly iterable', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language', 'User-Agent'])
    let names = []
    for (let name of header) {
      names.push(name)
    }
    assert.deepEqual(names, ['Accept-Encoding', 'Accept-Language', 'User-Agent'])
  })

  it('supports forEach', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language'])
    let names: string[] = []
    header.forEach((name) => {
      names.push(name)
    })
    assert.deepEqual(names, ['Accept-Encoding', 'Accept-Language'])
  })
})

describe('Vary.from', () => {
  it('parses a string value', () => {
    let result = Vary.from('Accept-Encoding, Accept-Language')
    assert.ok(result instanceof Vary)
    assert.equal(result.size, 2)
    assert.equal(result.has('Accept-Encoding'), true)
    assert.equal(result.has('Accept-Language'), true)
  })

  it('parses an array value', () => {
    let result = Vary.from(['Accept-Encoding', 'Accept-Language'])
    assert.ok(result instanceof Vary)
    assert.equal(result.size, 2)
  })
})
