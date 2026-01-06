import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LazyFile } from '@remix-run/lazy-file'

import { createFileResponse, type FileLike } from './file.ts'

// Type assertions: ensure FileLike is compatible with native File and LazyFile.
// If FileLike drifts from their APIs, TypeScript will error here.
null as unknown as File satisfies FileLike
null as unknown as LazyFile satisfies FileLike

describe('createFileResponse()', () => {
  it('serves a file', async () => {
    let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
    let request = new Request('http://localhost/test.txt')

    let response = await createFileResponse(mockFile, request)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
    assert.equal(response.headers.get('Content-Length'), '13')
  })

  it('serves a LazyFile', async () => {
    let lazyFile = new LazyFile(['Hello, World!'], 'test.txt', { type: 'text/plain' })
    let request = new Request('http://localhost/test.txt')

    let response = await createFileResponse(lazyFile, request)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
    assert.equal(response.headers.get('Content-Length'), '13')
  })

  it('serves a file with HEAD request', async () => {
    let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
    let request = new Request('http://localhost/test.txt', { method: 'HEAD' })

    let response = await createFileResponse(mockFile, request)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), '')
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
    assert.equal(response.headers.get('Content-Length'), '13')
  })

  describe('ETag support', () => {
    it('includes weak ETag header by default', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: 1000000,
      })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request)

      let etag = response.headers.get('ETag')
      assert.equal(response.status, 200)
      assert.ok(etag)
      assert.match(etag, /^W\/"[\d]+-[\d]+\.?[\d]*"$/)
    })

    it('does not include ETag when etag=false', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, { etag: false })

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('ETag'), null)
    })

    it('generates strong ETag when etag=strong', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, { etag: 'strong' })

      let etag = response.headers.get('ETag')
      assert.equal(response.status, 200)
      assert.ok(etag)
      assert.ok(!etag.startsWith('W/'), 'Should not be a weak ETag')
      assert.match(etag, /^"[a-f0-9]+"$/, 'Should be a hex digest wrapped in quotes')
    })

    it('uses SHA-256 by default for strong ETags', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, { etag: 'strong' })

      let etag = response.headers.get('ETag')
      assert.ok(etag)
      // SHA-256 produces 64 hex characters (32 bytes * 2)
      assert.match(etag, /^"[a-f0-9]{64}"$/)
    })

    it('supports custom digest algorithm', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, {
        etag: 'strong',
        digest: 'SHA-512',
      })

      let etag = response.headers.get('ETag')
      assert.ok(etag)
      // SHA-512 produces 128 hex characters (64 bytes * 2)
      assert.match(etag, /^"[a-f0-9]{128}"$/)
    })

    it('supports custom digest function', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, {
        etag: 'strong',
        digest: async () => 'custom-hash-12345',
      })

      let etag = response.headers.get('ETag')
      assert.equal(etag, '"custom-hash-12345"')
    })

    it('throws error for unsupported algorithm', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      await assert.rejects(
        async () => {
          await createFileResponse(mockFile, request, {
            etag: 'strong',
            digest: 'MD5',
          })
        },
        {
          name: 'NotSupportedError',
        },
      )
    })

    it('supports SHA-1 algorithm', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, {
        etag: 'strong',
        digest: 'SHA-1',
      })

      let etag = response.headers.get('ETag')
      assert.ok(etag)
      // SHA-1 produces 40 hex characters (20 bytes * 2)
      assert.match(etag, /^"[a-f0-9]{40}"$/)
    })

    it('supports SHA-384 algorithm', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, {
        etag: 'strong',
        digest: 'SHA-384',
      })

      let etag = response.headers.get('ETag')
      assert.ok(etag)
      // SHA-384 produces 96 hex characters (48 bytes * 2)
      assert.match(etag, /^"[a-f0-9]{96}"$/)
    })
  })

  describe('If-None-Match support', () => {
    it('returns 304 (Not Modified) when If-None-Match matches ETag', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: 1000000,
      })
      let request1 = new Request('http://localhost/test.txt')

      let response1 = await createFileResponse(mockFile, request1)
      let etag = response1.headers.get('ETag')
      assert.ok(etag)

      let request2 = new Request('http://localhost/test.txt', {
        headers: { 'If-None-Match': etag },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 304)
      assert.equal(await response2.text(), '')
    })

    it('returns 304 (Not Modified) when If-None-Match is *', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt', {
        headers: { 'If-None-Match': '*' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 304)
    })

    it('returns 200 (OK) when If-None-Match does not match', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt', {
        headers: { 'If-None-Match': 'W/"wrong-etag"' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
    })

    it('handles multiple ETags in If-None-Match', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: 1000000,
      })
      let request1 = new Request('http://localhost/test.txt')

      let response1 = await createFileResponse(mockFile, request1)
      let etag = response1.headers.get('ETag')
      assert.ok(etag)

      let request2 = new Request('http://localhost/test.txt', {
        headers: { 'If-None-Match': `W/"wrong-1", ${etag}, W/"wrong-2"` },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 304)
    })

    it('ignores If-None-Match when etag is disabled', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })

      // First, get the ETag that would be generated
      let request1 = new Request('http://localhost/test.txt')
      let response1 = await createFileResponse(mockFile, request1)
      let etag = response1.headers.get('ETag')
      assert.ok(etag)

      // Now test with etag disabled but send the matching ETag
      let request2 = new Request('http://localhost/test.txt', {
        headers: { 'If-None-Match': etag },
      })
      let response2 = await createFileResponse(mockFile, request2, { etag: false })

      // Should return 200, not 304, because etag is disabled
      assert.equal(response2.status, 200)
      assert.equal(await response2.text(), 'Hello, World!')
    })

    it('ignores If-Modified-Since when If-None-Match is present but does not match', async () => {
      let fileDate = new Date('2025-01-01')
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/test.txt', {
        headers: {
          'If-None-Match': '"wrong-etag"',
          'If-Modified-Since': fileDate.toUTCString(), // Would normally return 304
        },
      })

      let response = await createFileResponse(mockFile, request)

      // Should return 200, not 304, because If-None-Match takes precedence
      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
    })
  })

  describe('If-Match support', () => {
    describe('precondition validation', () => {
      it('returns 412 (Precondition Failed) when resource has weak ETag', async () => {
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: 1000000,
        })
        let request1 = new Request('http://localhost/test.txt')

        let response1 = await createFileResponse(mockFile, request1)
        let etag = response1.headers.get('ETag')
        assert.ok(etag)
        assert.ok(etag.startsWith('W/')) // Verify it's a weak ETag

        // If-Match uses strong comparison, so weak ETags never match
        let request2 = new Request('http://localhost/test.txt', {
          headers: { 'If-Match': etag },
        })
        let response2 = await createFileResponse(mockFile, request2)

        assert.equal(response2.status, 412)
      })

      it('returns 200 (OK) when resource has strong ETag and If-Match matches', async () => {
        let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
        let request1 = new Request('http://localhost/test.txt')

        // Get the strong ETag
        let response1 = await createFileResponse(mockFile, request1, { etag: 'strong' })
        let etag = response1.headers.get('ETag')
        assert.ok(etag)
        assert.ok(!etag.startsWith('W/')) // Verify it's a strong ETag

        // If-Match should work with strong ETags
        let request2 = new Request('http://localhost/test.txt', {
          headers: { 'If-Match': etag },
        })
        let response2 = await createFileResponse(mockFile, request2, { etag: 'strong' })

        assert.equal(response2.status, 200)
        assert.equal(await response2.text(), 'Hello, World!')
      })

      it('returns 412 (Precondition Failed) when If-Match does not match (weak ETag)', async () => {
        let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Match': '"wrong-etag"' },
        })

        let response = await createFileResponse(mockFile, request)

        assert.equal(response.status, 412)
      })

      it('returns 412 (Precondition Failed) when If-Match does not match (strong ETag)', async () => {
        let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Match': '"wrong-etag"' },
        })

        let response = await createFileResponse(mockFile, request, { etag: 'strong' })

        assert.equal(response.status, 412)
      })

      it('returns 200 (OK) when If-Match is *', async () => {
        let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Match': '*' },
        })

        let response = await createFileResponse(mockFile, request)

        assert.equal(response.status, 200)
        assert.equal(await response.text(), 'Hello, World!')
      })

      it('returns 412 (Precondition Failed) when If-Match contains multiple ETags and none match', async () => {
        let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Match': '"wrong-1", "wrong-2"' },
        })

        let response = await createFileResponse(mockFile, request)

        assert.equal(response.status, 412)
      })
    })

    describe('prioritization', () => {
      it('returns 412 (Precondition Failed) when If-Match fails, even if If-None-Match would match', async () => {
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: 1000000,
        })
        let request1 = new Request('http://localhost/test.txt')

        let response1 = await createFileResponse(mockFile, request1)
        let etag = response1.headers.get('ETag')
        assert.ok(etag)

        let request2 = new Request('http://localhost/test.txt', {
          headers: {
            'If-Match': 'W/"wrong-etag"',
            'If-None-Match': etag,
          },
        })
        let response2 = await createFileResponse(mockFile, request2)

        assert.equal(response2.status, 412)
      })
    })

    it('ignores If-Match when etag is disabled', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })

      // First, get the ETag that would be generated
      let request1 = new Request('http://localhost/test.txt')
      let response1 = await createFileResponse(mockFile, request1)
      let etag = response1.headers.get('ETag')
      assert.ok(etag)

      // Now test with etag disabled but send a non-matching ETag
      // (If we weren't ignoring it, this would return 412)
      let request2 = new Request('http://localhost/test.txt', {
        headers: { 'If-Match': 'W/"wrong-etag"' },
      })
      let response2 = await createFileResponse(mockFile, request2, { etag: false })

      // Should return 200, not 412, because etag is disabled
      assert.equal(response2.status, 200)
      assert.equal(await response2.text(), 'Hello, World!')
    })
  })

  describe('If-Unmodified-Since support', () => {
    describe('precondition validation', () => {
      it('returns 200 (OK) when If-Unmodified-Since is after Last-Modified', async () => {
        let fileDate = new Date('2025-01-01')
        let futureDate = new Date('2026-01-01')
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: fileDate.getTime(),
        })
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Unmodified-Since': futureDate.toUTCString() },
        })

        let response = await createFileResponse(mockFile, request)

        assert.equal(response.status, 200)
        assert.equal(await response.text(), 'Hello, World!')
      })

      it('returns 200 (OK) when If-Unmodified-Since matches Last-Modified', async () => {
        let fileDate = new Date('2025-01-01')
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: fileDate.getTime(),
        })
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Unmodified-Since': fileDate.toUTCString() },
        })

        let response = await createFileResponse(mockFile, request)

        assert.equal(response.status, 200)
        assert.equal(await response.text(), 'Hello, World!')
      })

      it('returns 412 (Precondition Failed) when If-Unmodified-Since is before Last-Modified', async () => {
        let fileDate = new Date('2025-01-01')
        let pastDate = new Date('2024-01-01')
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: fileDate.getTime(),
        })
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Unmodified-Since': pastDate.toUTCString() },
        })

        let response = await createFileResponse(mockFile, request)

        assert.equal(response.status, 412)
      })

      it('ignores malformed If-Unmodified-Since', async () => {
        let fileDate = new Date('2025-01-01')
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: fileDate.getTime(),
        })
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Unmodified-Since': 'invalid-date' },
        })

        let response = await createFileResponse(mockFile, request)

        assert.equal(response.status, 200)
        assert.equal(await response.text(), 'Hello, World!')
      })

      it('treats dates with same second but different milliseconds as equal', async () => {
        // File last modified at 1000100ms (1.000100 seconds)
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: 1000100,
        })
        // Client's If-Unmodified-Since at 1000900ms (1.000900 seconds) - same second
        let ifUnmodifiedSinceDate = new Date(1000900)
        let request = new Request('http://localhost/test.txt', {
          headers: { 'If-Unmodified-Since': ifUnmodifiedSinceDate.toUTCString() },
        })

        let response = await createFileResponse(mockFile, request)

        // Should return 200 because both round down to the same second
        assert.equal(response.status, 200)
        assert.equal(await response.text(), 'Hello, World!')
      })
    })

    describe('prioritization', () => {
      it('returns 412 (Precondition Failed) when If-Match fails, even if If-Unmodified-Since would pass', async () => {
        let fileDate = new Date('2025-01-01')
        let futureDate = new Date('2026-01-01')
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: fileDate.getTime(),
        })
        let request = new Request('http://localhost/test.txt', {
          headers: {
            'If-Match': 'W/"wrong-etag"',
            'If-Unmodified-Since': futureDate.toUTCString(),
          },
        })

        let response = await createFileResponse(mockFile, request)

        assert.equal(response.status, 412)
      })

      it('ignores If-Unmodified-Since when If-Match is present (strong ETag)', async () => {
        let pastDate = new Date('2024-01-01')
        let mockFile = new File(['Hello, World!'], 'test.txt', {
          type: 'text/plain',
          lastModified: pastDate.getTime(),
        })
        let request1 = new Request('http://localhost/test.txt')

        // Get the strong ETag
        let response1 = await createFileResponse(mockFile, request1, { etag: 'strong' })
        let etag = response1.headers.get('ETag')
        assert.ok(etag)
        assert.ok(!etag.startsWith('W/')) // Verify it's a strong ETag

        // If-Match passes, so If-Unmodified-Since should be ignored
        // (even though it would fail if evaluated - pastDate is before file's lastModified)
        let request2 = new Request('http://localhost/test.txt', {
          headers: {
            'If-Match': etag,
            'If-Unmodified-Since': pastDate.toUTCString(),
          },
        })
        let response2 = await createFileResponse(mockFile, request2, { etag: 'strong' })

        assert.equal(response2.status, 200)
        assert.equal(await response2.text(), 'Hello, World!')
      })
    })

    it('ignores If-Unmodified-Since when lastModified is disabled', async () => {
      let pastDate = new Date('2024-01-01')
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt', {
        headers: { 'If-Unmodified-Since': pastDate.toUTCString() },
      })

      let response = await createFileResponse(mockFile, request, { lastModified: false })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
    })
  })

  describe('Last-Modified support', () => {
    it('includes Last-Modified header', async () => {
      let fileDate = new Date('2025-01-01')
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Last-Modified'), fileDate.toUTCString())
    })

    it('does not include Last-Modified when lastModified=false', async () => {
      let mockFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, { lastModified: false })

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Last-Modified'), null)
    })

    it('returns 304 (Not Modified) when If-Modified-Since matches Last-Modified', async () => {
      let fileDate = new Date('2025-01-01')
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/test.txt', {
        headers: { 'If-Modified-Since': fileDate.toUTCString() },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 304)
      assert.equal(await response.text(), '')
    })

    it('returns 304 (Not Modified) when If-Modified-Since is after Last-Modified', async () => {
      let fileDate = new Date('2025-01-01')
      let futureDate = new Date('2026-01-01')
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/test.txt', {
        headers: { 'If-Modified-Since': futureDate.toUTCString() },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 304)
    })

    it('returns 200 (OK) when If-Modified-Since is before Last-Modified', async () => {
      let fileDate = new Date('2025-01-01')
      let pastDate = new Date('2024-01-01')
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/test.txt', {
        headers: { 'If-Modified-Since': pastDate.toUTCString() },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
    })

    it('treats dates with same second but different milliseconds as equal', async () => {
      // File last modified at 1000999ms (1.000999 seconds)
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: 1000999,
      })
      // Client's If-Modified-Since at 1000500ms (1.000500 seconds) - same second
      let ifModifiedSinceDate = new Date(1000500)
      let request = new Request('http://localhost/test.txt', {
        headers: { 'If-Modified-Since': ifModifiedSinceDate.toUTCString() },
      })

      let response = await createFileResponse(mockFile, request)

      // Should return 304 because both round down to the same second
      assert.equal(response.status, 304)
    })

    it('prioritizes ETag over If-Modified-Since when both are present', async () => {
      let fileDate = new Date('2025-01-01')
      let mockFile = new File(['Hello, World!'], 'test.txt', {
        type: 'text/plain',
        lastModified: fileDate.getTime(),
      })
      let request1 = new Request('http://localhost/test.txt')

      let response1 = await createFileResponse(mockFile, request1)
      let etag = response1.headers.get('ETag')

      let request2 = new Request('http://localhost/test.txt', {
        headers: {
          'If-None-Match': 'W/"wrong-etag"',
          'If-Modified-Since': fileDate.toUTCString(),
        },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 200)
    })
  })

  describe('Range requests', () => {
    it('includes Accept-Ranges header for non-compressible media types by default', async () => {
      let mockFile = new File(['fake video data'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4')

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.headers.get('Accept-Ranges'), 'bytes')
    })

    it('does not include Accept-Ranges header for compressible media types by default', async () => {
      let mockFile = new File(['Hello'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.headers.get('Accept-Ranges'), null)
    })

    it('includes Accept-Ranges header when explicitly enabled', async () => {
      let mockFile = new File(['Hello'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, { acceptRanges: true })

      assert.equal(response.headers.get('Accept-Ranges'), 'bytes')
    })

    it('omits Accept-Ranges header when acceptRanges=false', async () => {
      let mockFile = new File(['Hello'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, { acceptRanges: false })

      assert.equal(response.headers.get('Accept-Ranges'), null)
    })

    it('handles simple range request', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=0-4' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '01234')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10')
      assert.equal(response.headers.get('Content-Length'), '5')
    })

    it('handles range with only start', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=5-' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '56789')
      assert.equal(response.headers.get('Content-Range'), 'bytes 5-9/10')
    })

    it('handles suffix range (last N bytes)', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=-3' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '789')
      assert.equal(response.headers.get('Content-Range'), 'bytes 7-9/10')
    })

    it('clamps end byte to file size when it exceeds', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=0-999' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-9/10')
      assert.equal(response.headers.get('Content-Length'), '10')
    })

    it('ignores Range header for non-GET/HEAD requests', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        method: 'POST',
        headers: { Range: 'bytes=0-4' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('ignores Range header for HEAD requests', async () => {
      let mockFile = new File(['0123456789'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt', {
        method: 'HEAD',
        headers: { Range: 'bytes=0-4' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Content-Range'), null)
      assert.equal(response.headers.get('Content-Length'), '10')
      assert.equal(await response.text(), '')
    })

    it('returns 416 (Range Not Satisfiable) for unsatisfiable range', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=20-30' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 416)
      assert.equal(response.headers.get('Content-Range'), 'bytes */10')
    })

    it('returns 416 (Range Not Satisfiable) for multipart ranges (not supported)', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=0-2,5-7' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 416)
      assert.equal(response.headers.get('Content-Range'), 'bytes */10')
    })

    it('returns 400 (Bad Request) for malformed multipart range syntax', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=0-2,garbage' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 400)
      assert.equal(await response.text(), 'Bad Request')
    })

    it('returns 400 (Bad Request) for start > end', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=5-2' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 400)
      assert.equal(await response.text(), 'Bad Request')
    })

    it('returns 400 (Bad Request) for malformed range', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'invalid' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 400)
      assert.equal(await response.text(), 'Bad Request')
    })

    it('returns 400 (Bad Request) for "bytes=" with no range', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: { Range: 'bytes=' },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 400)
      assert.equal(await response.text(), 'Bad Request')
    })

    it('returns full file when acceptRanges=false', async () => {
      let mockFile = new File(['0123456789'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt', {
        headers: { Range: 'bytes=0-4' },
      })

      let response = await createFileResponse(mockFile, request, { acceptRanges: false })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns 412 (Precondition Failed) when If-Match fails before processing Range', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: {
          'If-Match': 'W/"wrong-etag"',
          Range: 'bytes=0-4',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 412)
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) when If-Match succeeds with Range request (strong ETag)', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request1 = new Request('http://localhost/video.mp4')

      // Get the strong ETag
      let response1 = await createFileResponse(mockFile, request1, {
        etag: 'strong',
      })
      let etag = response1.headers.get('ETag')
      assert.ok(etag)
      assert.ok(!etag.startsWith('W/')) // Verify it's a strong ETag

      // If-Match passes, Range should be processed
      let request2 = new Request('http://localhost/video.mp4', {
        headers: {
          'If-Match': etag,
          Range: 'bytes=0-4',
        },
      })
      let response2 = await createFileResponse(mockFile, request2, {
        etag: 'strong',
      })

      assert.equal(response2.status, 206)
      assert.equal(await response2.text(), '01234')
      assert.equal(response2.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 206 (Partial Content) when If-Unmodified-Since passes with Range request', async () => {
      let fileDate = new Date('2025-01-01')
      let futureDate = new Date('2026-01-01')
      let mockFile = new File(['0123456789'], 'video.mp4', {
        type: 'video/mp4',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/video.mp4', {
        headers: {
          'If-Unmodified-Since': futureDate.toUTCString(),
          Range: 'bytes=0-4',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '01234')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 412 (Precondition Failed) when If-Unmodified-Since fails before processing Range', async () => {
      let fileDate = new Date('2025-01-01')
      let pastDate = new Date('2024-01-01')
      let mockFile = new File(['0123456789'], 'test.txt', {
        type: 'text/plain',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/test.txt', {
        headers: {
          'If-Unmodified-Since': pastDate.toUTCString(),
          Range: 'bytes=0-4',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 412)
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns 304 (Not Modified) when If-None-Match matches etag', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', {
        type: 'video/mp4',
        lastModified: 1000000,
      })
      let request1 = new Request('http://localhost/video.mp4')

      let response1 = await createFileResponse(mockFile, request1)
      let etag = response1.headers.get('ETag')
      assert.ok(etag)

      let request2 = new Request('http://localhost/video.mp4', {
        headers: {
          'If-None-Match': etag,
          Range: 'bytes=0-4',
        },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 304)
      assert.equal(response2.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) when If-None-Match does not match', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: {
          'If-None-Match': '"wrong-etag"',
          Range: 'bytes=0-4',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '01234')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 304 (Not Modified) when If-Modified-Since matches', async () => {
      let fileDate = new Date('2025-01-01')
      let mockFile = new File(['0123456789'], 'video.mp4', {
        type: 'video/mp4',
        lastModified: fileDate.getTime(),
      })
      let request1 = new Request('http://localhost/video.mp4')

      let response1 = await createFileResponse(mockFile, request1)
      let lastModified = response1.headers.get('Last-Modified')
      assert.ok(lastModified)

      let request2 = new Request('http://localhost/video.mp4', {
        headers: {
          'If-Modified-Since': lastModified,
          Range: 'bytes=0-4',
        },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 304)
      assert.equal(response2.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) when If-Modified-Since does not match', async () => {
      let fileDate = new Date('2025-01-01')
      let pastDate = new Date('2024-01-01')
      let mockFile = new File(['0123456789'], 'video.mp4', {
        type: 'video/mp4',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/video.mp4', {
        headers: {
          'If-Modified-Since': pastDate.toUTCString(),
          Range: 'bytes=0-4',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '01234')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 206 (Partial Content) when If-Range matches Last-Modified date', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request1 = new Request('http://localhost/video.mp4')

      let response1 = await createFileResponse(mockFile, request1)
      let lastModified = response1.headers.get('Last-Modified')
      assert.ok(lastModified)

      let request2 = new Request('http://localhost/video.mp4', {
        headers: {
          Range: 'bytes=0-4',
          'If-Range': lastModified,
        },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 206)
      assert.equal(await response2.text(), '01234')
      assert.equal(response2.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 200 (OK, full file) when If-Range does not match Last-Modified date', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: {
          Range: 'bytes=0-4',
          'If-Range': 'Wed, 21 Oct 2015 07:28:00 GMT',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('ignores If-Range with weak ETag value (only Last-Modified date supported)', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', {
        type: 'video/mp4',
        lastModified: 1000000,
      })
      let request1 = new Request('http://localhost/video.mp4')

      let response1 = await createFileResponse(mockFile, request1)
      let etag = response1.headers.get('ETag')
      assert.ok(etag)

      let request2 = new Request('http://localhost/video.mp4', {
        headers: {
          Range: 'bytes=0-4',
          'If-Range': etag,
        },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 200)
      assert.equal(await response2.text(), '0123456789')
    })

    it('returns full file when If-Range has invalid date format', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: {
          Range: 'bytes=0-4',
          'If-Range': '2025-01-01',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns full file when If-Range is malformed', async () => {
      let mockFile = new File(['0123456789'], 'video.mp4', { type: 'video/mp4' })
      let request = new Request('http://localhost/video.mp4', {
        headers: {
          Range: 'bytes=0-4',
          'If-Range': 'not-a-valid-value',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('ignores If-Range when acceptRanges is disabled', async () => {
      let mockFile = new File(['0123456789'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt', {
        headers: {
          Range: 'bytes=0-4',
          'If-Range': 'Wed, 21 Oct 2015 07:28:00 GMT',
        },
      })

      let response = await createFileResponse(mockFile, request, { acceptRanges: false })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('ignores If-Range when lastModified is disabled', async () => {
      let mockFile = new File(['0123456789'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt', {
        headers: {
          Range: 'bytes=0-4',
          'If-Range': 'Wed, 21 Oct 2015 07:28:00 GMT',
        },
      })

      let response = await createFileResponse(mockFile, request, { lastModified: false })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
    })

    it('returns 304 (Not Modified) with If-None-Match + If-Range when If-None-Match matches', async () => {
      let fileDate = new Date('2025-01-01')
      let mockFile = new File(['0123456789'], 'video.mp4', {
        type: 'video/mp4',
        lastModified: fileDate.getTime(),
      })
      let request1 = new Request('http://localhost/video.mp4')

      let response1 = await createFileResponse(mockFile, request1)
      let etag = response1.headers.get('ETag')
      assert.ok(etag)
      let lastModified = response1.headers.get('Last-Modified')
      assert.ok(lastModified)

      let request2 = new Request('http://localhost/video.mp4', {
        headers: {
          'If-None-Match': etag,
          'If-Range': lastModified,
          Range: 'bytes=0-4',
        },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 304)
      assert.equal(response2.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) with If-None-Match + If-Range when If-Range matches and If-None-Match does not match', async () => {
      let fileDate = new Date('2025-01-01')
      let mockFile = new File(['0123456789'], 'video.mp4', {
        type: 'video/mp4',
        lastModified: fileDate.getTime(),
      })
      let request1 = new Request('http://localhost/video.mp4')

      let response1 = await createFileResponse(mockFile, request1)
      let lastModified = response1.headers.get('Last-Modified')
      assert.ok(lastModified)

      let request2 = new Request('http://localhost/video.mp4', {
        headers: {
          'If-None-Match': '"wrong-etag"',
          'If-Range': lastModified,
          Range: 'bytes=0-4',
        },
      })
      let response2 = await createFileResponse(mockFile, request2)

      assert.equal(response2.status, 206)
      assert.equal(await response2.text(), '01234')
      assert.equal(response2.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 200 (OK) with If-None-Match + If-Range when both If-None-Match and If-Range do not match', async () => {
      let fileDate = new Date('2025-01-01')
      let pastDate = new Date('2024-01-01')
      let mockFile = new File(['0123456789'], 'video.mp4', {
        type: 'video/mp4',
        lastModified: fileDate.getTime(),
      })
      let request = new Request('http://localhost/video.mp4', {
        headers: {
          'If-None-Match': '"wrong-etag"',
          'If-Range': pastDate.toUTCString(),
          Range: 'bytes=0-4',
        },
      })

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })
  })

  describe('Cache-Control', () => {
    it('does not include Cache-Control header by default', async () => {
      let mockFile = new File(['Hello'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.headers.get('Cache-Control'), null)
    })

    it('uses custom Cache-Control header', async () => {
      let mockFile = new File(['Hello'], 'test.txt', { type: 'text/plain' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request, {
        cacheControl: 'no-cache',
      })

      assert.equal(response.headers.get('Cache-Control'), 'no-cache')
    })
  })

  describe('Content-Type', () => {
    it('sets Content-Type from file with charset for text-based types', async () => {
      let testCases = [
        { type: 'text/html', name: 'test.html', expected: 'text/html; charset=utf-8' },
        { type: 'text/css', name: 'test.css', expected: 'text/css; charset=utf-8' },
        { type: 'text/plain', name: 'test.txt', expected: 'text/plain; charset=utf-8' },
        { type: 'text/javascript', name: 'test.js', expected: 'text/javascript; charset=utf-8' },
        {
          type: 'application/json',
          name: 'test.json',
          expected: 'application/json; charset=utf-8',
        },
      ]

      for (let { type, name, expected } of testCases) {
        let mockFile = new File(['test content'], name, { type })
        let request = new Request(`http://localhost/${name}`)

        let response = await createFileResponse(mockFile, request)
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('Content-Type'), expected)
      }
    })

    it('does not add charset to XML types', async () => {
      let testCases = [
        { type: 'image/svg+xml', name: 'test.svg' },
        { type: 'application/xml', name: 'test.xml' },
      ]

      for (let { type, name } of testCases) {
        let mockFile = new File(['test content'], name, { type })
        let request = new Request(`http://localhost/${name}`)

        let response = await createFileResponse(mockFile, request)
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('Content-Type'), type)
      }
    })

    it('sets Content-Type with charset for application/javascript', async () => {
      let mockFile = new File(['test content'], 'app.js', { type: 'application/javascript' })
      let request = new Request('http://localhost/app.js')

      let response = await createFileResponse(mockFile, request)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Content-Type'), 'application/javascript; charset=utf-8')
    })

    it('does not add charset to binary types', async () => {
      let testCases = [
        { type: 'image/png', name: 'test.png' },
        { type: 'image/jpeg', name: 'test.jpg' },
        { type: 'application/pdf', name: 'test.pdf' },
        { type: 'application/zip', name: 'test.zip' },
      ]

      for (let { type, name } of testCases) {
        let mockFile = new File(['test content'], name, { type })
        let request = new Request(`http://localhost/${name}`)

        let response = await createFileResponse(mockFile, request)
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('Content-Type'), type)
      }
    })

    it('handles file with empty type', async () => {
      let mockFile = new File(['test content'], 'test.txt', { type: '' })
      let request = new Request('http://localhost/test.txt')

      let response = await createFileResponse(mockFile, request)

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Content-Type'), null)
    })
  })
})
