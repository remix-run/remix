import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ContentType } from './content-type.ts'

describe('ContentType', () => {
  it('initializes with an empty string', () => {
    let header = new ContentType('')
    assert.equal(header.mediaType, undefined)
    assert.equal(header.charset, undefined)
  })

  it('initializes with a string', () => {
    let header = new ContentType('text/plain; charset=utf-8')
    assert.equal(header.mediaType, 'text/plain')
    assert.equal(header.charset, 'utf-8')
  })

  it('initializes with an object', () => {
    let header = new ContentType({ mediaType: 'text/plain', charset: 'utf-8' })
    assert.equal(header.mediaType, 'text/plain')
    assert.equal(header.charset, 'utf-8')
  })

  it('initializes with another ContentType', () => {
    let header = new ContentType(new ContentType('text/plain; charset=utf-8'))
    assert.equal(header.mediaType, 'text/plain')
    assert.equal(header.charset, 'utf-8')
  })

  it('handles whitespace in initial value', () => {
    let header = new ContentType(' text/html ;  charset = iso-8859-1 ')
    assert.equal(header.mediaType, 'text/html')
    assert.equal(header.charset, 'iso-8859-1')
  })

  it('sets and gets media type', () => {
    let header = new ContentType('text/plain')
    header.mediaType = 'application/json'
    assert.equal(header.mediaType, 'application/json')
  })

  it('sets and gets charset', () => {
    let header = new ContentType('text/plain')
    header.charset = 'utf-8'
    assert.equal(header.charset, 'utf-8')
  })

  it('sets and gets boundary', () => {
    let header = new ContentType('multipart/form-data')
    header.boundary = 'abc123'
    assert.equal(header.boundary, 'abc123')
  })

  it('handles quoted attribute values', () => {
    let header = new ContentType('text/plain; charset="us-ascii"')
    assert.equal(header.charset, 'us-ascii')
  })

  it('converts to string correctly', () => {
    let header = new ContentType('text/plain; charset=utf-8')
    assert.equal(header.toString(), 'text/plain; charset=utf-8')
  })

  it('converts to an empty string when media type is not set', () => {
    let header = new ContentType()
    header.charset = 'utf-8'
    assert.equal(header.toString(), '')
  })

  it('handles multiple attributes', () => {
    let header = new ContentType('multipart/form-data; boundary="abc123"; charset=utf-8')
    assert.equal(header.mediaType, 'multipart/form-data')
    assert.equal(header.boundary, 'abc123')
    assert.equal(header.charset, 'utf-8')
  })

  it('preserves case for media type', () => {
    let header = new ContentType('Text/HTML')
    assert.equal(header.mediaType, 'Text/HTML')
  })

  it('handles attribute values with special characters', () => {
    let header = new ContentType('multipart/form-data; boundary="---=_Part_0_1234567.89"')
    assert.equal(header.boundary, '---=_Part_0_1234567.89')
  })

  it('correctly quotes attribute values in toString()', () => {
    let header = new ContentType('multipart/form-data')
    header.boundary = 'abc 123'
    assert.equal(header.toString(), 'multipart/form-data; boundary="abc 123"')
  })

  it('handles empty attribute values', () => {
    let header = new ContentType('text/plain; charset=')
    assert.equal(header.charset, '')
  })

  it('ignores attributes without values', () => {
    let header = new ContentType('text/plain; charset')
    assert.equal(header.charset, undefined)
  })

  it('preserves order of attributes in toString()', () => {
    let header = new ContentType('multipart/form-data; charset=utf-8; boundary=abc123')
    assert.equal(header.toString(), 'multipart/form-data; charset=utf-8; boundary=abc123')
  })
})

describe('ContentType.from', () => {
  it('parses a string value', () => {
    let result = ContentType.from('text/html; charset=utf-8')
    assert.ok(result instanceof ContentType)
    assert.equal(result.mediaType, 'text/html')
    assert.equal(result.charset, 'utf-8')
  })

  it('accepts init object', () => {
    let result = ContentType.from({ mediaType: 'text/html', charset: 'utf-8' })
    assert.ok(result instanceof ContentType)
    assert.equal(result.mediaType, 'text/html')
    assert.equal(result.charset, 'utf-8')
  })
})
