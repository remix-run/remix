import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { formatFingerprintedPathname, hashContent, parseFingerprintSuffix } from './fingerprint.ts'

describe('hashContent', () => {
  it('accepts byte content', async () => {
    let hashA = await hashContent(Uint8Array.from([0, 1, 2, 3]))
    let hashB = await hashContent(Uint8Array.from([0, 1, 2, 4]))

    assert.notEqual(hashA, hashB)
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
