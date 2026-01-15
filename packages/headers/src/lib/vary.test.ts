import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Vary } from './vary.ts'

describe('Vary', () => {
  it('initializes with an empty string', () => {
    let header = new Vary('')
    assert.equal(header.size, 0)
    assert.deepEqual(header.headerNames, [])
  })

  it('initializes with a string', () => {
    let header = new Vary('Accept-Encoding, Accept-Language')
    assert.deepEqual(header.headerNames, ['accept-encoding', 'accept-language'])
    assert.equal(header.size, 2)
  })

  it('initializes with an array', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language'])
    assert.deepEqual(header.headerNames, ['accept-encoding', 'accept-language'])
    assert.equal(header.size, 2)
  })

  it('initializes with an object', () => {
    let header = new Vary({ headerNames: ['Accept-Encoding', 'Accept-Language'] })
    assert.deepEqual(header.headerNames, ['accept-encoding', 'accept-language'])
    assert.equal(header.size, 2)
  })

  it('initializes with another Vary', () => {
    let header = new Vary(new Vary('Accept-Encoding, Accept-Language'))
    assert.deepEqual(header.headerNames, ['accept-encoding', 'accept-language'])
    assert.equal(header.size, 2)
  })

  it('handles whitespace in initial value', () => {
    let header = new Vary('  Accept-Encoding  ,   Accept-Language  ')
    assert.deepEqual(header.headerNames, ['accept-encoding', 'accept-language'])
  })

  it('normalizes header names to lowercase', () => {
    let header = new Vary(['Accept-Encoding', 'ACCEPT-LANGUAGE', 'user-agent'])
    assert.deepEqual(header.headerNames, ['accept-encoding', 'accept-language', 'user-agent'])
  })

  it('gets all header names', () => {
    let header = new Vary('Accept-Encoding, Accept-Language')
    assert.deepEqual(header.headerNames, ['accept-encoding', 'accept-language'])
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
    assert.equal(header.has('accept-encoding'), true)
    assert.equal(header.size, 1)
  })

  it('adds multiple header names', () => {
    let header = new Vary()
    header.add('Accept-Encoding')
    header.add('Accept-Language')
    header.add('User-Agent')
    assert.equal(header.size, 3)
    assert.deepEqual(header.headerNames, ['accept-encoding', 'accept-language', 'user-agent'])
  })

  it('does not add duplicate header names (case-insensitive)', () => {
    let header = new Vary('Accept-Encoding')
    header.add('accept-encoding')
    header.add('ACCEPT-ENCODING')
    header.add('Accept-Encoding')
    assert.equal(header.size, 1)
    assert.deepEqual(header.headerNames, ['accept-encoding'])
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
    assert.deepEqual(header.headerNames, ['accept-language'])
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
    assert.equal(header.toString(), 'accept-encoding, accept-language, user-agent')
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
    assert.deepEqual(names, ['accept-encoding', 'accept-language', 'user-agent'])
  })

  it('supports forEach', () => {
    let header = new Vary(['Accept-Encoding', 'Accept-Language'])
    let names: string[] = []
    header.forEach((name) => {
      names.push(name)
    })
    assert.deepEqual(names, ['accept-encoding', 'accept-language'])
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
