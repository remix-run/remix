import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  detectFileMimeType,
  getExtension,
  getImageMimeType,
  isLikelyText,
  isTextContent,
  isTextFile,
} from './mime-type.ts'

const encoder = new TextEncoder()

describe('mime type helpers', () => {
  it('detects display MIME types for package files', () => {
    assert.equal(detectFileMimeType('package.json'), 'application/json')
    assert.equal(detectFileMimeType('unknown-file.nope'), 'application/octet-stream')
  })

  it('gets extensions from filenames', () => {
    assert.equal(getExtension('index.ts'), '.ts')
    assert.equal(getExtension('archive.tar.gz'), '.gz')
    assert.equal(getExtension('.env'), '.env')
    assert.equal(getExtension('README'), 'README')
  })

  it('detects image MIME types supported by inline previews', () => {
    assert.equal(getImageMimeType('logo.png'), 'image/png')
    assert.equal(getImageMimeType('photo.jpg'), 'image/jpeg')
    assert.equal(getImageMimeType('photo.jpeg'), 'image/jpeg')
    assert.equal(getImageMimeType('README.md'), undefined)
  })

  it('detects filenames that should be treated as text', () => {
    assert.equal(isTextFile('index.ts'), true)
    assert.equal(isTextFile('README'), true)
    assert.equal(isTextFile('.env'), true)
    assert.equal(isTextFile('logo.png'), false)
  })

  it('detects likely text bytes', () => {
    assert.equal(isLikelyText(encoder.encode('hello\nworld')), true)
    assert.equal(isLikelyText(new Uint8Array([104, 0, 105])), false)
    assert.equal(isLikelyText(new Uint8Array([104, 1, 105])), false)
  })

  it('uses either the filename or content bytes for text previews', () => {
    assert.equal(isTextContent('README', new Uint8Array([0])), true)
    assert.equal(isTextContent('unknown', encoder.encode('plain text')), true)
    assert.equal(isTextContent('unknown', new Uint8Array([0])), false)
  })
})
