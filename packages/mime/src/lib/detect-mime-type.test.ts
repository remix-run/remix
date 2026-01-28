import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { detectMimeType } from './detect-mime-type.ts'

describe('detectMimeType()', () => {
  it('returns MIME type for plain extension', () => {
    assert.equal(detectMimeType('txt'), 'text/plain')
    assert.equal(detectMimeType('html'), 'text/html')
    assert.equal(detectMimeType('json'), 'application/json')
    assert.equal(detectMimeType('js'), 'text/javascript')
    assert.equal(detectMimeType('css'), 'text/css')
  })

  it('returns MIME type for extension with leading dot', () => {
    assert.equal(detectMimeType('.txt'), 'text/plain')
    assert.equal(detectMimeType('.html'), 'text/html')
    assert.equal(detectMimeType('.json'), 'application/json')
  })

  it('returns MIME type for filename', () => {
    assert.equal(detectMimeType('file.txt'), 'text/plain')
    assert.equal(detectMimeType('index.html'), 'text/html')
    assert.equal(detectMimeType('data.json'), 'application/json')
    assert.equal(detectMimeType('script.js'), 'text/javascript')
    assert.equal(detectMimeType('style.css'), 'text/css')
  })

  it('returns MIME type for filename with multiple dots', () => {
    assert.equal(detectMimeType('file.backup.txt'), 'text/plain')
    assert.equal(detectMimeType('app.min.js'), 'text/javascript')
    assert.equal(detectMimeType('data.v1.json'), 'application/json')
  })

  it('returns MIME type for filename with path', () => {
    assert.equal(detectMimeType('path/to/file.txt'), 'text/plain')
    assert.equal(detectMimeType('/absolute/path/file.html'), 'text/html')
    assert.equal(detectMimeType('../relative/file.json'), 'application/json')
  })

  it('handles uppercase extensions', () => {
    assert.equal(detectMimeType('TXT'), 'text/plain')
    assert.equal(detectMimeType('.HTML'), 'text/html')
    assert.equal(detectMimeType('FILE.JSON'), 'application/json')
  })

  it('handles mixed case extensions', () => {
    assert.equal(detectMimeType('TxT'), 'text/plain')
    assert.equal(detectMimeType('HtMl'), 'text/html')
    assert.equal(detectMimeType('file.JsOn'), 'application/json')
  })

  it('trims whitespace', () => {
    assert.equal(detectMimeType('  txt  '), 'text/plain')
    assert.equal(detectMimeType('  .html  '), 'text/html')
    assert.equal(detectMimeType('  file.json  '), 'application/json')
  })

  it('returns undefined for unknown extensions', () => {
    assert.equal(detectMimeType('notarealextension'), undefined)
    assert.equal(detectMimeType('.unknown'), undefined)
    assert.equal(detectMimeType('file.notarealextension'), undefined)
  })

  it('returns undefined for empty string', () => {
    assert.equal(detectMimeType(''), undefined)
    assert.equal(detectMimeType('   '), undefined)
  })

  it('returns MIME type for common image formats', () => {
    assert.equal(detectMimeType('png'), 'image/png')
    assert.equal(detectMimeType('jpg'), 'image/jpeg')
    assert.equal(detectMimeType('jpeg'), 'image/jpeg')
    assert.equal(detectMimeType('gif'), 'image/gif')
    assert.equal(detectMimeType('svg'), 'image/svg+xml')
    assert.equal(detectMimeType('webp'), 'image/webp')
  })

  it('returns MIME type for common video formats', () => {
    assert.equal(detectMimeType('mp4'), 'application/mp4')
    assert.equal(detectMimeType('webm'), 'video/webm')
    assert.equal(detectMimeType('mov'), 'video/quicktime')
  })

  it('returns MIME type for common audio formats', () => {
    assert.equal(detectMimeType('mp3'), 'audio/mpeg')
    assert.equal(detectMimeType('wav'), 'audio/wav')
    assert.equal(detectMimeType('ogg'), 'audio/ogg')
  })

  it('returns MIME type for common archive formats', () => {
    assert.equal(detectMimeType('zip'), 'application/zip')
    assert.equal(detectMimeType('gz'), 'application/gzip')
  })

  it('returns MIME type for common document formats', () => {
    assert.equal(detectMimeType('pdf'), 'application/pdf')
    assert.equal(detectMimeType('doc'), 'application/msword')
    assert.equal(detectMimeType('rtf'), 'text/rtf')
  })
})
