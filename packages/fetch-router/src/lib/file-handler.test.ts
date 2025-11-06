import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import SuperHeaders, { type SuperHeadersInit } from '@remix-run/headers'

import { createFileHandler } from './file-handler.ts'
import type { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import { AppStorage } from './app-storage.ts'

describe('createFileHandler', () => {
  function createMockFile(
    content: string,
    options: {
      type?: string
      lastModified?: number
    } = {},
  ): { file: File; path: string } {
    let file = new File([content], 'mock.txt', {
      type: options.type || 'text/plain',
      lastModified: options.lastModified || Date.now(),
    })
    return { file, path: `/path/to/${file.name}` }
  }

  function createContext(
    url: string,
    options: {
      method?: RequestMethod
      headers?: SuperHeadersInit
    } = {},
  ): RequestContext<'GET', {}> {
    let headers = new SuperHeaders(options.headers ?? {})
    return {
      formData: undefined,
      storage: new AppStorage(),
      url: new URL(url),
      files: null,
      method: 'GET',
      request: new Request(url, {
        method: options.method || 'GET',
        headers,
      }),
      params: {},
      headers,
    }
  }

  describe('basic functionality', () => {
    it('serves a file', async () => {
      let handler = createFileHandler(() => createMockFile('Hello, World!'))

      let response = await handler(createContext('http://localhost/test.txt'))

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
      assert.equal(response.headers.get('Content-Type'), 'text/plain')
      assert.equal(response.headers.get('Content-Length'), '13')
    })

    it('serves a file with HEAD request', async () => {
      let handler = createFileHandler(() => createMockFile('Hello, World!'))

      let response = await handler(createContext('http://localhost/test.txt', { method: 'HEAD' }))

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '')
      assert.equal(response.headers.get('Content-Type'), 'text/plain')
      assert.equal(response.headers.get('Content-Length'), '13')
    })

    it('returns 404 when file resolver returns null', async () => {
      let handler = createFileHandler(() => null)

      let response = await handler(createContext('http://localhost/test.txt'))

      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Not Found')
    })

    it('returns 405 for unsupported methods', async () => {
      let handler = createFileHandler(() => createMockFile('Hello, World!'))

      let response = await handler(createContext('http://localhost/test.txt', { method: 'POST' }))

      assert.equal(response.status, 405)
      assert.equal(await response.text(), 'Method Not Allowed')
    })

    it('passes request context to file resolver', async () => {
      let file = createMockFile('Hello, World!')
      let mockFileResolver = mock.fn((_context: RequestContext<'GET', {}>) => file)
      let handler = createFileHandler(mockFileResolver)

      let response = await handler(createContext('http://localhost/test.txt', { method: 'GET' }))

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
      assert.equal(mockFileResolver.mock.callCount(), 1)
      assert.equal(mockFileResolver.mock.calls[0].arguments[0].method, 'GET')
      assert.equal(
        mockFileResolver.mock.calls[0].arguments[0].request.url,
        'http://localhost/test.txt',
      )
    })
  })

  describe('ETag support', () => {
    for (let method of ['GET', 'HEAD'] as const) {
      describe(method, () => {
        it('includes weak ETag header by default', async () => {
          let file = createMockFile('Hello, World!', { lastModified: 1000000 })
          let handler = createFileHandler(() => file)

          let response = await handler(createContext('http://localhost/test.txt', { method }))

          let etag = response.headers.get('ETag')
          assert.equal(response.status, 200)
          assert.ok(etag)
          assert.match(etag, /^W\/"[\d]+-[\d]+\.?[\d]*"$/)
        })

        it('does not include ETag when etag=false', async () => {
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file, { etag: false })

          let response = await handler(createContext('http://localhost/test.txt', { method }))

          assert.equal(response.status, 200)
          assert.equal(response.headers.get('ETag'), null)
        })

        it('generates strong ETag when etag=strong', async () => {
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file, { etag: 'strong' })

          let response = await handler(createContext('http://localhost/test.txt', { method }))

          let etag = response.headers.get('ETag')
          assert.equal(response.status, 200)
          assert.ok(etag)
          assert.ok(!etag.startsWith('W/'), 'Should not be a weak ETag')
          assert.match(etag, /^"[a-f0-9]+"$/, 'Should be a hex digest wrapped in quotes')
        })

        it('uses SHA-256 by default for strong ETags', async () => {
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file, { etag: 'strong' })

          let response = await handler(createContext('http://localhost/test.txt', { method }))

          let etag = response.headers.get('ETag')
          assert.ok(etag)
          // SHA-256 produces 64 hex characters (32 bytes * 2)
          assert.match(etag, /^"[a-f0-9]{64}"$/)
        })

        it('supports custom digest algorithm', async () => {
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file, {
            etag: 'strong',
            digest: 'SHA-512',
          })

          let response = await handler(createContext('http://localhost/test.txt', { method }))

          let etag = response.headers.get('ETag')
          assert.ok(etag)
          // SHA-512 produces 128 hex characters (64 bytes * 2)
          assert.match(etag, /^"[a-f0-9]{128}"$/)
        })

        it('supports custom digest function', async () => {
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file, {
            etag: 'strong',
            digest: async () => 'custom-hash-12345',
          })

          let response = await handler(createContext('http://localhost/test.txt', { method }))

          let etag = response.headers.get('ETag')
          assert.equal(etag, '"custom-hash-12345"')
        })

        it('caches digests when digestCache is provided', async () => {
          let file = createMockFile('Hello, World!')
          let cache = new Map<string, string>()
          let computeCount = 0

          let handler = createFileHandler(() => file, {
            etag: 'strong',
            digest: async () => {
              computeCount++
              return `digest-${computeCount}`
            },
            digestCache: cache,
          })

          // First request - should compute
          let response1 = await handler(createContext('http://localhost/test.txt', { method }))
          assert.equal(response1.headers.get('ETag'), '"digest-1"')

          // Second request - should use cache
          let response2 = await handler(createContext('http://localhost/test.txt', { method }))
          assert.equal(response2.headers.get('ETag'), '"digest-1"')

          // Clear cache - should recompute with new digest
          cache.clear()
          // Third request - should recompute with new digest
          let response3 = await handler(createContext('http://localhost/test.txt', { method }))
          assert.equal(response3.headers.get('ETag'), '"digest-2"')

          // Fourth request - should use cache
          let response4 = await handler(createContext('http://localhost/test.txt', { method }))
          assert.equal(response4.headers.get('ETag'), '"digest-2"')
        })

        it('uses custom cache key function', async () => {
          let file = createMockFile('Hello, World!', { lastModified: 1000000 })
          let cache = new Map<string, string>()

          let handler = createFileHandler(() => file, {
            etag: 'strong',
            digestCache: cache,
            digestCacheKey: ({ path }) => `custom:${path}`, // Stable key without mtime
          })

          await handler(createContext('http://localhost/test.txt', { method }))

          // Cache key should be custom format (path defaults to file.name which is 'mock.txt')
          assert.ok(cache.has('custom:/path/to/mock.txt'))
        })
      })
    }
  })

  describe('If-None-Match support', () => {
    for (let method of ['GET', 'HEAD'] as const) {
      describe(method, () => {
        it('returns 304 (Not Modified) when If-None-Match matches ETag', async () => {
          let file = createMockFile('Hello, World!', { lastModified: 1000000 })
          let handler = createFileHandler(() => file)

          let response1 = await handler(createContext('http://localhost/test.txt', { method }))
          let etag = response1.headers.get('ETag')
          assert.ok(etag)

          let response2 = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-None-Match': etag },
            }),
          )

          assert.equal(response2.status, 304)
          assert.equal(await response2.text(), '')
        })

        it('returns 304 (Not Modified) when If-None-Match is *', async () => {
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file)

          let response = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-None-Match': '*' },
            }),
          )

          assert.equal(response.status, 304)
        })

        it('returns 200 (OK) when If-None-Match does not match', async () => {
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file)

          let response = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-None-Match': 'W/"wrong-etag"' },
            }),
          )

          assert.equal(response.status, 200)
          assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
        })

        it('handles multiple ETags in If-None-Match', async () => {
          let file = createMockFile('Hello, World!', { lastModified: 1000000 })
          let handler = createFileHandler(() => file)

          let response1 = await handler(createContext('http://localhost/test.txt', { method }))
          let etag = response1.headers.get('ETag')
          assert.ok(etag)

          let response2 = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-None-Match': `W/"wrong-1", ${etag}, W/"wrong-2"` },
            }),
          )

          assert.equal(response2.status, 304)
        })

        it('ignores If-None-Match when etag is disabled', async () => {
          let file = createMockFile('Hello, World!')

          // First, get the ETag that would be generated
          let handlerWithEtag = createFileHandler(() => file)
          let response1 = await handlerWithEtag(
            createContext('http://localhost/test.txt', { method }),
          )
          let etag = response1.headers.get('ETag')
          assert.ok(etag)

          // Now test with etag disabled but send the matching ETag
          let handler = createFileHandler(() => file, { etag: false })
          let response = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-None-Match': etag },
            }),
          )

          // Should return 200, not 304, because etag is disabled
          assert.equal(response.status, 200)
          assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
        })
      })
    }
  })

  describe('If-Match support', () => {
    for (let method of ['GET', 'HEAD'] as const) {
      describe(method, () => {
        describe('precondition validation', () => {
          it('returns 412 (Precondition Failed) when resource has weak ETag', async () => {
            let file = createMockFile('Hello, World!', { lastModified: 1000000 })
            let handler = createFileHandler(() => file)

            let response1 = await handler(createContext('http://localhost/test.txt', { method }))
            let etag = response1.headers.get('ETag')
            assert.ok(etag)
            assert.ok(etag.startsWith('W/')) // Verify it's a weak ETag

            // If-Match uses strong comparison, so weak ETags never match
            let response2 = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Match': etag },
              }),
            )

            assert.equal(response2.status, 412)
          })

          it('returns 200 (OK) when resource has strong ETag and If-Match matches', async () => {
            let file = createMockFile('Hello, World!')
            let handler = createFileHandler(() => file, { etag: 'strong' })

            // Get the strong ETag
            let response1 = await handler(createContext('http://localhost/test.txt', { method }))
            let etag = response1.headers.get('ETag')
            assert.ok(etag)
            assert.ok(!etag.startsWith('W/')) // Verify it's a strong ETag

            // If-Match should work with strong ETags
            let response2 = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Match': etag },
              }),
            )

            assert.equal(response2.status, 200)
            assert.equal(await response2.text(), method === 'HEAD' ? '' : 'Hello, World!')
          })

          it('returns 412 (Precondition Failed) when If-Match does not match (weak ETag)', async () => {
            let file = createMockFile('Hello, World!')
            let handler = createFileHandler(() => file)

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Match': '"wrong-etag"' },
              }),
            )

            assert.equal(response.status, 412)
          })

          it('returns 412 (Precondition Failed) when If-Match does not match (strong ETag)', async () => {
            let file = createMockFile('Hello, World!')
            let handler = createFileHandler(() => file, { etag: 'strong' })

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Match': '"wrong-etag"' },
              }),
            )

            assert.equal(response.status, 412)
          })

          it('returns 200 (OK) when If-Match is *', async () => {
            let file = createMockFile('Hello, World!')
            let handler = createFileHandler(() => file)

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Match': '*' },
              }),
            )

            assert.equal(response.status, 200)
            assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
          })

          it('returns 412 (Precondition Failed) when If-Match contains multiple ETags and none match', async () => {
            let file = createMockFile('Hello, World!')
            let handler = createFileHandler(() => file)

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Match': '"wrong-1", "wrong-2"' },
              }),
            )

            assert.equal(response.status, 412)
          })
        })

        describe('prioritization', () => {
          it('returns 412 (Precondition Failed) when If-Match fails, even if If-None-Match would match', async () => {
            let file = createMockFile('Hello, World!', { lastModified: 1000000 })
            let handler = createFileHandler(() => file)

            let response1 = await handler(createContext('http://localhost/test.txt', { method }))
            let etag = response1.headers.get('ETag')
            assert.ok(etag)

            let response2 = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: {
                  'If-Match': 'W/"wrong-etag"',
                  'If-None-Match': etag,
                },
              }),
            )

            assert.equal(response2.status, 412)
          })
        })

        it('ignores If-Match when etag is disabled', async () => {
          let file = createMockFile('Hello, World!')

          // First, get the ETag that would be generated
          let handlerWithEtag = createFileHandler(() => file)
          let response1 = await handlerWithEtag(
            createContext('http://localhost/test.txt', { method }),
          )
          let etag = response1.headers.get('ETag')
          assert.ok(etag)

          // Now test with etag disabled but send a non-matching ETag
          // (If we weren't ignoring it, this would return 412)
          let handler = createFileHandler(() => file, { etag: false })
          let response = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-Match': 'W/"wrong-etag"' },
            }),
          )

          // Should return 200, not 412, because etag is disabled
          assert.equal(response.status, 200)
          assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
        })
      })
    }
  })

  describe('If-Unmodified-Since support', () => {
    for (let method of ['GET', 'HEAD'] as const) {
      describe(method, () => {
        describe('precondition validation', () => {
          it('returns 200 (OK) when If-Unmodified-Since is after Last-Modified', async () => {
            let fileDate = new Date('2025-01-01')
            let futureDate = new Date('2026-01-01')
            let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
            let handler = createFileHandler(() => file)

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Unmodified-Since': futureDate.toUTCString() },
              }),
            )

            assert.equal(response.status, 200)
            assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
          })

          it('returns 200 (OK) when If-Unmodified-Since matches Last-Modified', async () => {
            let fileDate = new Date('2025-01-01')
            let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
            let handler = createFileHandler(() => file)

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Unmodified-Since': fileDate.toUTCString() },
              }),
            )

            assert.equal(response.status, 200)
            assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
          })

          it('returns 412 (Precondition Failed) when If-Unmodified-Since is before Last-Modified', async () => {
            let fileDate = new Date('2025-01-01')
            let pastDate = new Date('2024-01-01')
            let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
            let handler = createFileHandler(() => file)

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Unmodified-Since': pastDate.toUTCString() },
              }),
            )

            assert.equal(response.status, 412)
          })

          it('ignores malformed If-Unmodified-Since', async () => {
            let fileDate = new Date('2025-01-01')
            let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
            let handler = createFileHandler(() => file)

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: { 'If-Unmodified-Since': 'invalid-date' },
              }),
            )

            assert.equal(response.status, 200)
            assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
          })
        })

        describe('prioritization', () => {
          it('returns 412 (Precondition Failed) when If-Match fails, even if If-Unmodified-Since would pass', async () => {
            let fileDate = new Date('2025-01-01')
            let futureDate = new Date('2026-01-01')
            let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
            let handler = createFileHandler(() => file)

            let response = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: {
                  'If-Match': 'W/"wrong-etag"',
                  'If-Unmodified-Since': futureDate.toUTCString(),
                },
              }),
            )

            assert.equal(response.status, 412)
          })

          it('ignores If-Unmodified-Since when If-Match is present (strong ETag)', async () => {
            let pastDate = new Date('2024-01-01')
            let file = createMockFile('Hello, World!', { lastModified: pastDate.getTime() })
            let handler = createFileHandler(() => file, { etag: 'strong' })

            // Get the strong ETag
            let response1 = await handler(createContext('http://localhost/test.txt', { method }))
            let etag = response1.headers.get('ETag')
            assert.ok(etag)
            assert.ok(!etag.startsWith('W/')) // Verify it's a strong ETag

            // If-Match passes, so If-Unmodified-Since should be ignored
            // (even though it would fail if evaluated - pastDate is before file's lastModified)
            let response2 = await handler(
              createContext('http://localhost/test.txt', {
                method,
                headers: {
                  'If-Match': etag,
                  'If-Unmodified-Since': pastDate.toUTCString(),
                },
              }),
            )

            assert.equal(response2.status, 200)
            assert.equal(await response2.text(), method === 'HEAD' ? '' : 'Hello, World!')
          })
        })

        it('ignores If-Unmodified-Since when lastModified is disabled', async () => {
          let pastDate = new Date('2024-01-01')
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file, { lastModified: false })

          let response = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-Unmodified-Since': pastDate.toUTCString() },
            }),
          )

          assert.equal(response.status, 200)
          assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
        })
      })
    }
  })

  describe('Last-Modified support', () => {
    for (let method of ['GET', 'HEAD'] as const) {
      describe(method, () => {
        it('includes Last-Modified header', async () => {
          let fileDate = new Date('2025-01-01')
          let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
          let handler = createFileHandler(() => file)

          let response = await handler(createContext('http://localhost/test.txt', { method }))

          assert.equal(response.status, 200)
          assert.equal(response.headers.get('Last-Modified'), fileDate.toUTCString())
        })

        it('does not include Last-Modified when lastModified=false', async () => {
          let file = createMockFile('Hello, World!')
          let handler = createFileHandler(() => file, { lastModified: false })

          let response = await handler(createContext('http://localhost/test.txt', { method }))

          assert.equal(response.status, 200)
          assert.equal(response.headers.get('Last-Modified'), null)
        })

        it('returns 304 (Not Modified) when If-Modified-Since matches Last-Modified', async () => {
          let fileDate = new Date('2025-01-01')
          let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
          let handler = createFileHandler(() => file)

          let response = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-Modified-Since': fileDate.toUTCString() },
            }),
          )

          assert.equal(response.status, 304)
          assert.equal(await response.text(), '')
        })

        it('returns 304 (Not Modified) when If-Modified-Since is after Last-Modified', async () => {
          let fileDate = new Date('2025-01-01')
          let futureDate = new Date('2026-01-01')
          let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
          let handler = createFileHandler(() => file)

          let response = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-Modified-Since': futureDate.toUTCString() },
            }),
          )

          assert.equal(response.status, 304)
        })

        it('returns 200 (OK) when If-Modified-Since is before Last-Modified', async () => {
          let fileDate = new Date('2025-01-01')
          let pastDate = new Date('2024-01-01')
          let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
          let handler = createFileHandler(() => file)

          let response = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: { 'If-Modified-Since': pastDate.toUTCString() },
            }),
          )

          assert.equal(response.status, 200)
          assert.equal(await response.text(), method === 'HEAD' ? '' : 'Hello, World!')
        })

        it('prioritizes ETag over If-Modified-Since when both are present', async () => {
          let fileDate = new Date('2025-01-01')
          let file = createMockFile('Hello, World!', { lastModified: fileDate.getTime() })
          let handler = createFileHandler(() => file)

          let response1 = await handler(createContext('http://localhost/test.txt', { method }))
          let etag = response1.headers.get('ETag')

          let response2 = await handler(
            createContext('http://localhost/test.txt', {
              method,
              headers: {
                'If-None-Match': 'W/"wrong-etag"',
                'If-Modified-Since': fileDate.toUTCString(),
              },
            }),
          )

          assert.equal(response2.status, 200)
        })
      })
    }
  })

  describe('Range requests (GET only)', () => {
    it('includes Accept-Ranges header', async () => {
      let file = createMockFile('Hello')
      let handler = createFileHandler(() => file)

      let response = await handler(createContext('http://localhost/test.txt'))

      assert.equal(response.headers.get('Accept-Ranges'), 'bytes')
    })

    it('omits Accept-Ranges header when acceptRanges=false', async () => {
      let file = createMockFile('Hello')
      let handler = createFileHandler(() => file, { acceptRanges: false })

      let response = await handler(createContext('http://localhost/test.txt'))

      assert.equal(response.headers.get('Accept-Ranges'), null)
    })

    it('handles simple range request', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=0-4' },
        }),
      )

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '01234')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10')
      assert.equal(response.headers.get('Content-Length'), '5')
    })

    it('handles range with only start', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=5-' },
        }),
      )

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '56789')
      assert.equal(response.headers.get('Content-Range'), 'bytes 5-9/10')
    })

    it('handles suffix range (last N bytes)', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=-3' },
        }),
      )

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '789')
      assert.equal(response.headers.get('Content-Range'), 'bytes 7-9/10')
    })

    it('clamps end byte to file size when it exceeds', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=0-999' },
        }),
      )

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-9/10')
      assert.equal(response.headers.get('Content-Length'), '10')
    })

    it('returns 416 (Range Not Satisfiable) for unsatisfiable range', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=20-30' },
        }),
      )

      assert.equal(response.status, 416)
      assert.equal(response.headers.get('Content-Range'), 'bytes */10')
    })

    it('returns 416 (Range Not Satisfiable) for multipart ranges (not supported)', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=0-2,5-7' },
        }),
      )

      assert.equal(response.status, 416)
      assert.equal(response.headers.get('Content-Range'), 'bytes */10')
    })

    it('returns 400 (Bad Request) for malformed multipart range syntax', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=0-2,garbage' },
        }),
      )

      assert.equal(response.status, 400)
      assert.equal(await response.text(), 'Bad Request')
    })

    it('returns 400 (Bad Request) for start > end', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=5-2' },
        }),
      )

      assert.equal(response.status, 400)
      assert.equal(await response.text(), 'Bad Request')
    })

    it('returns 400 (Bad Request) for malformed range', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'invalid' },
        }),
      )

      assert.equal(response.status, 400)
      assert.equal(await response.text(), 'Bad Request')
    })

    it('returns 400 (Bad Request) for "bytes=" with no range', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=' },
        }),
      )

      assert.equal(response.status, 400)
      assert.equal(await response.text(), 'Bad Request')
    })

    it('returns full file when acceptRanges=false', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file, { acceptRanges: false })

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: { Range: 'bytes=0-4' },
        }),
      )

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns 412 (Precondition Failed) when If-Match fails before processing Range', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-Match': 'W/"wrong-etag"',
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response.status, 412)
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) when If-Match succeeds with Range request (strong ETag)', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file, { etag: 'strong' })

      // Get the strong ETag
      let response1 = await handler(createContext('http://localhost/test.txt'))
      let etag = response1.headers.get('ETag')
      assert.ok(etag)
      assert.ok(!etag.startsWith('W/')) // Verify it's a strong ETag

      // If-Match passes, Range should be processed
      let response2 = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-Match': etag,
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response2.status, 206)
      assert.equal(await response2.text(), '01234')
      assert.equal(response2.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 206 (Partial Content) when If-Unmodified-Since passes with Range request', async () => {
      let fileDate = new Date('2025-01-01')
      let futureDate = new Date('2026-01-01')
      let file = createMockFile('0123456789', { lastModified: fileDate.getTime() })
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-Unmodified-Since': futureDate.toUTCString(),
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '01234')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 412 (Precondition Failed) when If-Unmodified-Since fails before processing Range', async () => {
      let fileDate = new Date('2025-01-01')
      let pastDate = new Date('2024-01-01')
      let file = createMockFile('0123456789', { lastModified: fileDate.getTime() })
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-Unmodified-Since': pastDate.toUTCString(),
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response.status, 412)
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) when If-Range matches Last-Modified date', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response1 = await handler(createContext('http://localhost/test.txt'))
      let lastModified = response1.headers.get('Last-Modified')
      assert.ok(lastModified)

      let response2 = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            Range: 'bytes=0-4',
            'If-Range': lastModified,
          },
        }),
      )

      assert.equal(response2.status, 206)
      assert.equal(await response2.text(), '01234')
      assert.equal(response2.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 200 (OK, full file) when If-Range does not match Last-Modified date', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            Range: 'bytes=0-4',
            'If-Range': 'Wed, 21 Oct 2015 07:28:00 GMT',
          },
        }),
      )

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('ignores If-Range when acceptRanges is disabled', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file, { acceptRanges: false })

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            Range: 'bytes=0-4',
            'If-Range': 'Wed, 21 Oct 2015 07:28:00 GMT',
          },
        }),
      )

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('ignores If-Range when lastModified is disabled', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file, { lastModified: false })

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            Range: 'bytes=0-4',
            'If-Range': 'Wed, 21 Oct 2015 07:28:00 GMT',
          },
        }),
      )

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
    })

    it('ignores If-Range with weak ETag value (only Last-Modified date supported)', async () => {
      let file = createMockFile('0123456789', { lastModified: 1000000 })
      let handler = createFileHandler(() => file)

      let response1 = await handler(createContext('http://localhost/test.txt'))
      let etag = response1.headers.get('ETag')
      assert.ok(etag)

      let response2 = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            Range: 'bytes=0-4',
            'If-Range': etag,
          },
        }),
      )

      assert.equal(response2.status, 200)
      assert.equal(await response2.text(), '0123456789')
    })

    it('returns full file when If-Range has invalid date format', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            Range: 'bytes=0-4',
            'If-Range': '2025-01-01',
          },
        }),
      )

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns full file when If-Range is malformed', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            Range: 'bytes=0-4',
            'If-Range': 'not-a-valid-value',
          },
        }),
      )

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('returns 304 (Not Modified) when If-None-Match matches etag', async () => {
      let file = createMockFile('0123456789', { lastModified: 1000000 })
      let handler = createFileHandler(() => file)

      let response1 = await handler(createContext('http://localhost/test.txt'))
      let etag = response1.headers.get('ETag')
      assert.ok(etag)

      let response2 = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-None-Match': etag,
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response2.status, 304)
      assert.equal(response2.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) when If-None-Match does not match', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-None-Match': '"wrong-etag"',
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '01234')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 304 (Not Modified) when If-Modified-Since matches', async () => {
      let fileDate = new Date('2025-01-01')
      let file = createMockFile('0123456789', { lastModified: fileDate.getTime() })
      let handler = createFileHandler(() => file)

      let response1 = await handler(createContext('http://localhost/test.txt'))
      let lastModified = response1.headers.get('Last-Modified')
      assert.ok(lastModified)

      let response2 = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-Modified-Since': lastModified,
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response2.status, 304)
      assert.equal(response2.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) when If-Modified-Since does not match', async () => {
      let fileDate = new Date('2025-01-01')
      let pastDate = new Date('2024-01-01')
      let file = createMockFile('0123456789', { lastModified: fileDate.getTime() })
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-Modified-Since': pastDate.toUTCString(),
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response.status, 206)
      assert.equal(await response.text(), '01234')
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 304 (Not Modified) with If-None-Match + If-Range when If-None-Match matches', async () => {
      let fileDate = new Date('2025-01-01')
      let file = createMockFile('0123456789', { lastModified: fileDate.getTime() })
      let handler = createFileHandler(() => file)

      let response1 = await handler(createContext('http://localhost/test.txt'))
      let etag = response1.headers.get('ETag')
      assert.ok(etag)
      let lastModified = response1.headers.get('Last-Modified')
      assert.ok(lastModified)

      let response2 = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-None-Match': etag,
            'If-Range': lastModified,
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response2.status, 304)
      assert.equal(response2.headers.get('Content-Range'), null)
    })

    it('returns 206 (Partial Content) with If-None-Match + If-Range when If-Range matches and If-None-Match does not match', async () => {
      let fileDate = new Date('2025-01-01')
      let file = createMockFile('0123456789', { lastModified: fileDate.getTime() })
      let handler = createFileHandler(() => file)

      let response1 = await handler(createContext('http://localhost/test.txt'))
      let lastModified = response1.headers.get('Last-Modified')
      assert.ok(lastModified)

      let response2 = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-None-Match': '"wrong-etag"',
            'If-Range': lastModified,
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response2.status, 206)
      assert.equal(await response2.text(), '01234')
      assert.equal(response2.headers.get('Content-Range'), 'bytes 0-4/10')
    })

    it('returns 200 (OK) with If-None-Match + If-Range when both If-None-Match and If-Range do not match', async () => {
      let fileDate = new Date('2025-01-01')
      let pastDate = new Date('2024-01-01')
      let file = createMockFile('0123456789', { lastModified: fileDate.getTime() })
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          headers: {
            'If-None-Match': '"wrong-etag"',
            'If-Range': pastDate.toUTCString(),
            Range: 'bytes=0-4',
          },
        }),
      )

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '0123456789')
      assert.equal(response.headers.get('Content-Range'), null)
    })

    it('ignores Range header for HEAD requests', async () => {
      let file = createMockFile('0123456789')
      let handler = createFileHandler(() => file)

      let response = await handler(
        createContext('http://localhost/test.txt', {
          method: 'HEAD',
          headers: { Range: 'bytes=0-4' },
        }),
      )

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Accept-Ranges'), 'bytes')
      assert.equal(response.headers.get('Content-Range'), null)
      assert.equal(await response.text(), '')
    })
  })

  describe('Cache-Control', () => {
    it('does not include Cache-Control header by default', async () => {
      let file = createMockFile('Hello')
      let handler = createFileHandler(() => file)

      let response = await handler(createContext('http://localhost/test.txt'))

      assert.equal(response.headers.get('Cache-Control'), null)
    })

    it('uses custom Cache-Control header', async () => {
      let file = createMockFile('Hello')
      let handler = createFileHandler(() => file, {
        cacheControl: 'no-cache',
      })

      let response = await handler(createContext('http://localhost/test.txt'))

      assert.equal(response.headers.get('Cache-Control'), 'no-cache')
    })
  })

  describe('Content-Type', () => {
    it('sets correct Content-Type from file', async () => {
      let testCases = [
        { file: 'test.html', type: 'text/html' },
        { file: 'test.css', type: 'text/css' },
        { file: 'test.js', type: 'text/javascript' },
        { file: 'test.json', type: 'application/json' },
        { file: 'test.png', type: 'image/png' },
        { file: 'test.jpg', type: 'image/jpeg' },
        { file: 'test.svg', type: 'image/svg+xml' },
      ]

      for (let { file, type } of testCases) {
        let file = createMockFile('test content', { type })
        let handler = createFileHandler(() => file)

        let response = await handler(createContext(`http://localhost/${file}`))
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('Content-Type'), type)
      }
    })
  })
})
