import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AcceptEncoding } from './accept-encoding.ts'

describe('Accept-Encoding', () => {
  it('initializes with an empty string', () => {
    let header = new AcceptEncoding('')
    assert.equal(header.size, 0)
  })

  it('initializes with a string', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.equal(header.size, 2)
  })

  it('initializes with an array', () => {
    let header = new AcceptEncoding(['gzip', ['deflate', 0.9]])
    assert.equal(header.size, 2)
  })

  it('initializes with an object', () => {
    let header = new AcceptEncoding({ gzip: 1, deflate: 0.9 })
    assert.equal(header.size, 2)
  })

  it('initializes with another AcceptEncoding', () => {
    let header = new AcceptEncoding(new AcceptEncoding('gzip, deflate;q=0.9'))
    assert.equal(header.size, 2)
  })

  it('handles whitespace in initial value', () => {
    let header = new AcceptEncoding(' gzip ,  deflate;q=  0.9  ')
    assert.equal(header.size, 2)
  })

  it('gets all encodings', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.deepEqual(header.encodings, ['gzip', 'deflate'])
  })

  it('gets all weights', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.deepEqual(header.weights, [1, 0.9])
  })

  it('checks if an encoding is acceptable', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9,br;q=0.8')
    assert.equal(header.accepts('gzip'), true)
    assert.equal(header.accepts('deflate'), true)
    assert.equal(header.accepts('br'), true)
    assert.equal(header.accepts('compress'), false)
    assert.equal(header.accepts('identity'), true) // special case
  })

  it('gets the correct weights', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9,*;q=0.8')
    assert.equal(header.getWeight('gzip'), 1)
    assert.equal(header.getWeight('deflate'), 0.9)
    assert.equal(header.getWeight('br'), 0.8)
  })

  it('gets the preferred encoding', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9,*;q=0.8')
    assert.equal(header.getPreferred(['gzip', 'deflate']), 'gzip')
    assert.equal(header.getPreferred(['deflate', 'br']), 'deflate')
  })

  it('sets and gets encodings', () => {
    let header = new AcceptEncoding()
    header.set('gzip', 1)
    assert.equal(header.get('gzip'), 1)
  })

  it('deletes encodings', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.equal(header.has('gzip'), true)
    header.delete('gzip')
    assert.equal(header.has('gzip'), false)
  })

  it('clears all encodings', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.equal(header.size, 2)
    header.clear()
    assert.equal(header.size, 0)
  })

  it('iterates over entries', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.deepEqual(Array.from(header.entries()), [
      ['gzip', 1],
      ['deflate', 0.9],
    ])
  })

  it('is directly iterable', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.deepEqual(Array.from(header), [
      ['gzip', 1],
      ['deflate', 0.9],
    ])
  })

  it('uses forEach correctly', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    let result: [string, number][] = []
    header.forEach((encoding, weight) => {
      result.push([encoding, weight])
    })
    assert.deepEqual(result, [
      ['gzip', 1],
      ['deflate', 0.9],
    ])
  })

  it('returns correct size', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.equal(header.size, 2)
  })

  it('converts to a string', () => {
    let header = new AcceptEncoding('gzip, deflate;q=0.9')
    assert.equal(header.toString(), 'gzip,deflate;q=0.9')
  })

  it('handles setting empty weights', () => {
    let header = new AcceptEncoding()
    header.set('deflate')
    assert.equal(header.get('deflate'), 1)
  })

  it('handles setting wildcard value', () => {
    let header = new AcceptEncoding()
    header.set('*', 0.8)
    assert.equal(header.get('*'), 0.8)
  })

  it('sorts initial value', () => {
    let header = new AcceptEncoding('deflate;q=0.9,gzip')
    assert.equal(header.toString(), 'gzip,deflate;q=0.9')
  })

  it('sorts updated value', () => {
    let header = new AcceptEncoding('gzip;q=0.8,deflate')
    header.set('br')
    assert.equal(header.toString(), 'deflate,br,gzip;q=0.8')
    header.set('deflate', 0.9)
    assert.equal(header.toString(), 'br,deflate;q=0.9,gzip;q=0.8')
  })
})

describe('AcceptEncoding.from', () => {
  it('parses a string value', () => {
    let result = AcceptEncoding.from('gzip, deflate;q=0.5')
    assert.ok(result instanceof AcceptEncoding)
    assert.equal(result.size, 2)
  })
})
