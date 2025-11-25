import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isCompressibleMimeType } from './is-compressible-mime-type.ts'

describe('isCompressibleMimeType()', () => {
  it('returns true for common compressible MIME types', () => {
    assert.equal(isCompressibleMimeType('text/html'), true)
    assert.equal(isCompressibleMimeType('text/plain'), true)
    assert.equal(isCompressibleMimeType('application/json'), true)
    assert.equal(isCompressibleMimeType('application/javascript'), true)
    assert.equal(isCompressibleMimeType('text/css'), true)
  })

  it('returns true for text/* types', () => {
    assert.equal(isCompressibleMimeType('text/custom'), true)
    assert.equal(isCompressibleMimeType('text/markdown'), true)
  })

  it('returns true for types with +json, +text, or +xml suffix', () => {
    assert.equal(isCompressibleMimeType('application/vnd.api+json'), true)
    assert.equal(isCompressibleMimeType('application/custom+xml'), true)
    assert.equal(isCompressibleMimeType('application/something+text'), true)
  })

  it('returns false for non-compressible MIME types', () => {
    assert.equal(isCompressibleMimeType('image/png'), false)
    assert.equal(isCompressibleMimeType('image/jpeg'), false)
    assert.equal(isCompressibleMimeType('video/mp4'), false)
    assert.equal(isCompressibleMimeType('audio/mpeg'), false)
  })

  it('returns false for empty string', () => {
    assert.equal(isCompressibleMimeType(''), false)
  })

  it('handles Content-Type header values', () => {
    assert.equal(isCompressibleMimeType('text/html; charset=utf-8'), true)
    assert.equal(isCompressibleMimeType('application/json; charset=utf-8'), true)
    assert.equal(isCompressibleMimeType('text/plain; charset=iso-8859-1'), true)
    assert.equal(
      isCompressibleMimeType('multipart/form-data; boundary=----WebKitFormBoundary'),
      false,
    )
    assert.equal(isCompressibleMimeType('image/png; name="photo.png"'), false)
  })

  it('handles Content-Type with whitespace around semicolon', () => {
    assert.equal(isCompressibleMimeType('text/html ; charset=utf-8'), true)
    assert.equal(isCompressibleMimeType(' text/html;charset=utf-8'), true)
    assert.equal(isCompressibleMimeType('  application/json  ;  charset=utf-8'), true)
  })
})
