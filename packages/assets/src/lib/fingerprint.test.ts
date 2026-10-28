import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { formatFingerprintedPathname, hashContent, parseFingerprintSuffix } from './fingerprint.ts'

describe('hashContent', () => {
  it('accepts byte content', async () => {
    let hashA = await hashContent(Uint8Array.from([0, 1, 2, 3]))
    let hashB = await hashContent(Uint8Array.from([0, 1, 2, 4]))

    assert.notEqual(hashA, hashB)
  })

  it('hashes only the bytes within a view', async () => {
    let bytes = new TextEncoder().encode('before hello after')
    let view = bytes.subarray(7, 12)

    assert.equal(await hashContent(view), await hashContent('hello'))
    assert.equal(await hashContent(Buffer.from(bytes).subarray(7, 12)), await hashContent('hello'))
  })

  it('accepts views backed by shared memory', async () => {
    let bytes = new Uint8Array(new SharedArrayBuffer(18))
    bytes.set(new TextEncoder().encode('before hello after'))

    assert.equal(await hashContent(bytes.subarray(7, 12)), await hashContent('hello'))
  })

  it('snapshots the input before returning', async () => {
    let bytes = new TextEncoder().encode('hello')
    let hash = hashContent(bytes)
    bytes.fill(0)

    assert.equal(await hash, await hashContent('hello'))
  })
})

describe('formatFingerprintedPathname', () => {
  it('inserts the fingerprint before the file extension', () => {
    assert.equal(
      formatFingerprintedPathname('/assets/app/entry.ts', 'abc123'),
      '/assets/app/entry.~abc123.ts',
    )
    assert.equal(
      formatFingerprintedPathname('/assets/app/styles.css.js', 'abc123'),
      '/assets/app/styles.css.~abc123.js',
    )
  })

  it('appends the fingerprint when there is no file extension', () => {
    assert.equal(
      formatFingerprintedPathname('/assets/app/entry', 'abc123'),
      '/assets/app/entry.~abc123',
    )
  })

  it('emits pathnames that are unchanged by per-segment encodeURIComponent canonicalization', () => {
    let pathname = formatFingerprintedPathname(
      '/assets/app/node_modules/%40remix-run/ui/styles.css',
      '-NI2nv',
    )

    assert.equal(pathname, '/assets/app/node_modules/%40remix-run/ui/styles.~-NI2nv.css')
    assert.equal(
      pathname
        .split('/')
        .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
        .join('/'),
      pathname,
    )
  })
})

describe('parseFingerprintSuffix', () => {
  it('parses fingerprints inserted before the file extension', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.~abc123.ts'), {
      pathname: '/assets/app/entry.ts',
      requestedFingerprint: 'abc123',
    })
    assert.deepEqual(parseFingerprintSuffix('/assets/app/styles.css.~abc123.js'), {
      pathname: '/assets/app/styles.css.js',
      requestedFingerprint: 'abc123',
    })
  })

  it('parses fingerprints appended to extensionless paths', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.~abc123'), {
      pathname: '/assets/app/entry',
      requestedFingerprint: 'abc123',
    })
  })

  it('parses legacy .@ fingerprints', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.@abc123.ts'), {
      pathname: '/assets/app/entry.ts',
      requestedFingerprint: 'abc123',
    })
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.@abc123'), {
      pathname: '/assets/app/entry',
      requestedFingerprint: 'abc123',
    })
  })

  it('parses percent-encoded fingerprint separators', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/styles.%40-NI2nv.css'), {
      pathname: '/assets/app/styles.css',
      requestedFingerprint: '-NI2nv',
    })
    assert.deepEqual(parseFingerprintSuffix('/assets/app/styles.%7E-NI2nv.css'), {
      pathname: '/assets/app/styles.css',
      requestedFingerprint: '-NI2nv',
    })
  })

  it('keeps the stable pathname encoded per segment', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/%40scope/my%20file.@abc123.ts'), {
      pathname: '/assets/app/%40scope/my%20file.ts',
      requestedFingerprint: 'abc123',
    })
    assert.deepEqual(parseFingerprintSuffix('/assets/app/..%2Fsecret.%40abc123.ts'), {
      pathname: '/assets/app/..%2Fsecret.ts',
      requestedFingerprint: 'abc123',
    })
  })

  it('ignores suffixes that would leave a dot segment', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/...~abc123'), {
      pathname: '/assets/app/...~abc123',
      requestedFingerprint: null,
    })
    assert.deepEqual(parseFingerprintSuffix('/assets/app/..%2E%40abc123'), {
      pathname: '/assets/app/..%2E%40abc123',
      requestedFingerprint: null,
    })
  })

  it('ignores malformed percent-encoding', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.%E0%A4%A.~abc123.ts'), {
      pathname: '/assets/app/entry.%E0%A4%A.~abc123.ts',
      requestedFingerprint: null,
    })
  })

  it('does not treat other separators as fingerprints', () => {
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.-abc123.ts'), {
      pathname: '/assets/app/entry.-abc123.ts',
      requestedFingerprint: null,
    })
    assert.deepEqual(parseFingerprintSuffix('/assets/app/entry.ts~'), {
      pathname: '/assets/app/entry.ts~',
      requestedFingerprint: null,
    })
  })
})
