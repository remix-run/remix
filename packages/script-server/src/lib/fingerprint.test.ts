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
      content: 'export const value = 1',
    })
    let fingerprintB = await generateFingerprint({
      buildId: 'build-b',
      content: 'export const value = 1',
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
      formatFingerprintedPathname('/scripts/app/entry.ts', 'abc123'),
      '/scripts/app/entry.@abc123.ts',
    )
    assert.equal(
      formatFingerprintedPathname('/scripts/app/styles.css.js', 'abc123'),
      '/scripts/app/styles.css.@abc123.js',
    )
  })

  it('appends the fingerprint when there is no file extension', () => {
    assert.equal(
      formatFingerprintedPathname('/scripts/app/entry', 'abc123'),
      '/scripts/app/entry.@abc123',
    )
  })
})

describe('parseFingerprintSuffix', () => {
  it('parses fingerprints inserted before the file extension', () => {
    assert.deepEqual(parseFingerprintSuffix('/scripts/app/entry.@abc123.ts'), {
      pathname: '/scripts/app/entry.ts',
      requestedFingerprint: 'abc123',
    })
    assert.deepEqual(parseFingerprintSuffix('/scripts/app/styles.css.@abc123.js'), {
      pathname: '/scripts/app/styles.css.js',
      requestedFingerprint: 'abc123',
    })
  })

  it('parses fingerprints appended to extensionless paths', () => {
    assert.deepEqual(parseFingerprintSuffix('/scripts/app/entry.@abc123'), {
      pathname: '/scripts/app/entry',
      requestedFingerprint: 'abc123',
    })
  })
})
