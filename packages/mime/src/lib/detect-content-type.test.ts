import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { detectContentType } from './detect-content-type.ts'

describe('detectContentType()', () => {
  it('returns Content-Type with charset for text types', () => {
    assert.equal(detectContentType('css'), 'text/css; charset=utf-8')
    assert.equal(detectContentType('.css'), 'text/css; charset=utf-8')
    assert.equal(detectContentType('style.css'), 'text/css; charset=utf-8')
  })

  it('returns Content-Type with charset for JavaScript', () => {
    assert.equal(detectContentType('js'), 'text/javascript; charset=utf-8')
    assert.equal(detectContentType('mjs'), 'text/javascript; charset=utf-8')
  })

  it('returns Content-Type with charset for JSON', () => {
    assert.equal(detectContentType('json'), 'application/json; charset=utf-8')
    assert.equal(detectContentType('data.json'), 'application/json; charset=utf-8')
  })

  it('returns Content-Type without charset for binary types', () => {
    assert.equal(detectContentType('png'), 'image/png')
    assert.equal(detectContentType('jpg'), 'image/jpeg')
    assert.equal(detectContentType('gif'), 'image/gif')
    assert.equal(detectContentType('pdf'), 'application/pdf')
    assert.equal(detectContentType('zip'), 'application/zip')
  })

  it('returns Content-Type with charset for all text/* types', () => {
    assert.equal(detectContentType('txt'), 'text/plain; charset=utf-8')
    assert.equal(detectContentType('html'), 'text/html; charset=utf-8')
    assert.equal(detectContentType('md'), 'text/markdown; charset=utf-8')
    assert.equal(detectContentType('csv'), 'text/csv; charset=utf-8')
  })

  it('returns Content-Type without charset for XML types', () => {
    // XML has built-in encoding declarations, so charset is not added
    assert.equal(detectContentType('xml'), 'text/xml')
    assert.equal(detectContentType('svg'), 'image/svg+xml')
  })

  it('returns undefined for unknown extensions', () => {
    assert.equal(detectContentType('unknown'), undefined)
    assert.equal(detectContentType('.xxyyzz'), undefined)
    assert.equal(detectContentType('file.xxyyzz'), undefined)
  })

  it('handles paths', () => {
    assert.equal(detectContentType('path/to/style.css'), 'text/css; charset=utf-8')
    assert.equal(detectContentType('/absolute/path/image.png'), 'image/png')
  })

  it('is case-insensitive', () => {
    assert.equal(detectContentType('CSS'), 'text/css; charset=utf-8')
    assert.equal(detectContentType('JSON'), 'application/json; charset=utf-8')
    assert.equal(detectContentType('PNG'), 'image/png')
  })
})
