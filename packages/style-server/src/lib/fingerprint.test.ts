import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatFingerprintedPathname,
  generateFingerprint,
  parseFingerprintSuffix,
} from './fingerprint.ts'

describe('generateFingerprint', () => {
  it('changes when the buildId changes', async () => {
    let fingerprintA = await generateFingerprint({
      buildId: 'build-a',
      content: 'body { color: red; }',
    })
    let fingerprintB = await generateFingerprint({
      buildId: 'build-b',
      content: 'body { color: red; }',
    })

    assert.notEqual(fingerprintA, fingerprintB)
  })

  it('uses an unambiguous serialization format', async () => {
    let fingerprintA = await generateFingerprint({
      buildId: 'b\0c',
      content: 'a',
    })
    let fingerprintB = await generateFingerprint({
      buildId: 'c',
      content: 'a\0b',
    })

    assert.notEqual(fingerprintA, fingerprintB)
  })
})

describe('formatFingerprintedPathname', () => {
  it('inserts the fingerprint before the file extension', () => {
    assert.equal(
      formatFingerprintedPathname('/styles/app.css', 'abc123'),
      '/styles/app.@abc123.css',
    )
    assert.equal(
      formatFingerprintedPathname('/styles/app.min.css', 'abc123'),
      '/styles/app.min.@abc123.css',
    )
  })

  it('appends the fingerprint when there is no file extension', () => {
    assert.equal(formatFingerprintedPathname('/styles/app', 'abc123'), '/styles/app.@abc123')
  })
})

describe('parseFingerprintSuffix', () => {
  it('parses fingerprints inserted before the file extension', () => {
    assert.deepEqual(parseFingerprintSuffix('/styles/app.@abc123.css'), {
      pathname: '/styles/app.css',
      requestedFingerprint: 'abc123',
    })
    assert.deepEqual(parseFingerprintSuffix('/styles/app.min.@abc123.css'), {
      pathname: '/styles/app.min.css',
      requestedFingerprint: 'abc123',
    })
  })

  it('parses fingerprints appended to extensionless paths', () => {
    assert.deepEqual(parseFingerprintSuffix('/styles/app.@abc123'), {
      pathname: '/styles/app',
      requestedFingerprint: 'abc123',
    })
  })
})
