import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  formatFingerprintedPathname,
  generateFingerprint,
  hashContent,
  parseFingerprintSuffix,
} from './fingerprint.ts'

describe('hashContent', () => {
  it('accepts byte content', async () => {
    let hashA = await hashContent(Uint8Array.from([0, 1, 2, 3]))
    let hashB = await hashContent(Uint8Array.from([0, 1, 2, 4]))

    assert.notEqual(hashA, hashB)
  })
})

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

  it('accepts byte content', async () => {
    let fingerprintA = await generateFingerprint({
      buildId: 'build-a',
      content: Uint8Array.from([0, 1, 2, 3]),
    })
    let fingerprintB = await generateFingerprint({
      buildId: 'build-a',
      content: Uint8Array.from([0, 1, 2, 4]),
    })

    assert.notEqual(fingerprintA, fingerprintB)
  })
})

describe('formatFingerprintedPathname', () => {
  it('inserts the fingerprint before the file extension', () => {
    assert.equal(
      formatFingerprintedPathname('/assets/app/entry.ts', 'abc123'),
      '/assets/app/entry.@abc123.ts',
    )
    assert.equal(
      formatFingerprintedPathname('/assets/app/styles.css.js', 'abc123'),
      '/assets/app/styles.css.@abc123.js',
    )
  })

  it('appends the fingerprint when there is no file extension', () => {
    assert.equal(
      formatFingerprintedPathname('/assets/app/entry', 'abc123'),
      '/assets/app/entry.@abc123',
    )
  })
})

describe('parseFingerprintSuffix', () => {
  it('parses fingerprints inserted before the file extension', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.@abc123.ts'), {
      pathname: '/assets/app/entry.ts',
      requestedFingerprint: 'abc123',
    })
    assert.deepEqual(parseFingerprintSuffix('/assets/app/styles.css.@abc123.js'), {
      pathname: '/assets/app/styles.css.js',
      requestedFingerprint: 'abc123',
    })
  })

  it('parses fingerprints appended to extensionless paths', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.@abc123'), {
      pathname: '/assets/app/entry',
      requestedFingerprint: 'abc123',
    })
  })
})
