import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mimeTypeToContentType } from './mime-type-to-content-type.ts'

describe('mimeTypeToContentType()', () => {
  it('adds charset for all text/* types (except text/xml)', () => {
    assert.equal(mimeTypeToContentType('text/plain'), 'text/plain; charset=utf-8')
    assert.equal(mimeTypeToContentType('text/html'), 'text/html; charset=utf-8')
    assert.equal(mimeTypeToContentType('text/css'), 'text/css; charset=utf-8')
    assert.equal(mimeTypeToContentType('text/javascript'), 'text/javascript; charset=utf-8')
    assert.equal(mimeTypeToContentType('text/markdown'), 'text/markdown; charset=utf-8')
    assert.equal(mimeTypeToContentType('text/csv'), 'text/csv; charset=utf-8')
  })

  it('adds charset for +json suffixed types', () => {
    assert.equal(mimeTypeToContentType('application/json'), 'application/json; charset=utf-8')
    assert.equal(
      mimeTypeToContentType('application/manifest+json'),
      'application/manifest+json; charset=utf-8',
    )
    assert.equal(mimeTypeToContentType('application/ld+json'), 'application/ld+json; charset=utf-8')
    assert.equal(
      mimeTypeToContentType('application/geo+json'),
      'application/geo+json; charset=utf-8',
    )
  })

  it('adds charset for application/javascript', () => {
    assert.equal(
      mimeTypeToContentType('application/javascript'),
      'application/javascript; charset=utf-8',
    )
  })

  it('does not add charset for text/xml (has built-in encoding declarations)', () => {
    assert.equal(mimeTypeToContentType('text/xml'), 'text/xml')
  })

  it('does not add charset for binary types', () => {
    assert.equal(mimeTypeToContentType('image/png'), 'image/png')
    assert.equal(mimeTypeToContentType('image/jpeg'), 'image/jpeg')
    assert.equal(mimeTypeToContentType('video/mp4'), 'video/mp4')
    assert.equal(mimeTypeToContentType('audio/mpeg'), 'audio/mpeg')
    assert.equal(mimeTypeToContentType('application/pdf'), 'application/pdf')
    assert.equal(mimeTypeToContentType('application/zip'), 'application/zip')
    assert.equal(mimeTypeToContentType('application/octet-stream'), 'application/octet-stream')
    assert.equal(mimeTypeToContentType('font/woff2'), 'font/woff2')
  })

  it('does not duplicate charset if already present', () => {
    assert.equal(mimeTypeToContentType('text/plain; charset=utf-8'), 'text/plain; charset=utf-8')
    assert.equal(
      mimeTypeToContentType('text/html;charset=iso-8859-1'),
      'text/html;charset=iso-8859-1',
    )
  })

  it('handles unknown MIME types', () => {
    assert.equal(mimeTypeToContentType('application/x-custom'), 'application/x-custom')
  })
})
