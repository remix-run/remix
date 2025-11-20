import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, beforeEach, afterEach } from 'node:test'

import { createRouter } from '../router.ts'
import { staticFiles } from './static.ts'

describe('staticFiles middleware', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-middleware-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function createTestFile(filename: string, content: string, date?: Date) {
    let filePath = path.join(tmpDir, filename)
    let dir = path.dirname(filePath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(filePath, content)

    if (date) {
      fs.utimesSync(filePath, date, date)
    }

    return filePath
  }

  describe('basic functionality', () => {
    it('serves a file', async () => {
      createTestFile('test.txt', 'Hello, World!')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        handler() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/test.txt')

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
      assert.equal(response.headers.get('Content-Type'), 'text/plain')
    })

    it('serves a file with HEAD request', async () => {
      createTestFile('test.txt', 'Hello, World!')

      let router = createRouter()
      router.head('/*', {
        middleware: [staticFiles(tmpDir)],
        handler() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/test.txt', { method: 'HEAD' })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '')
      assert.equal(response.headers.get('Content-Type'), 'text/plain')
    })

    it('serves files from nested directories', async () => {
      createTestFile('dir/subdir/file.txt', 'Nested file')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        handler() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/dir/subdir/file.txt')

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Nested file')
    })

    it('falls through to handler for non-existent file', async () => {
      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        handler() {
          return new Response('Custom Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/nonexistent.txt')

      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Custom Fallback Handler')
    })

    it('falls through to handler when requesting a directory', async () => {
      let dirPath = path.join(tmpDir, 'subdir')
      fs.mkdirSync(dirPath)

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        handler() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/subdir')

      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Fallback Handler')
    })
  })

  it('supports etag by default', async () => {
    let lastModified = new Date('2025-01-01')
    createTestFile('test.txt', 'Hello, World!', lastModified)
    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir)],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    let etag = response.headers.get('ETag')
    assert.ok(etag)
    assert.equal(etag, 'W/"13-1735689600000"')

    let response2 = await router.fetch('http://localhost/test.txt', {
      headers: { 'If-None-Match': etag },
    })
    assert.equal(response2.status, 304)
    assert.equal(await response2.text(), '')
  })

  it('does not send etag if etag is disabled', async () => {
    let lastModified = new Date('2025-01-01')
    createTestFile('test.txt', 'Hello, World!', lastModified)
    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir, { etag: false })],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('ETag'), null)
  })

  it('supports last-modified by default', async () => {
    let lastModified = new Date('2025-01-01')
    createTestFile('test.txt', 'Hello, World!', lastModified)
    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir)],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Last-Modified'), lastModified.toUTCString())
  })

  it('does not send last-modified if lastModified is disabled', async () => {
    let lastModified = new Date('2025-01-01')
    createTestFile('test.txt', 'Hello, World!', lastModified)
    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir, { lastModified: false })],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Last-Modified'), null)
  })

  it('does not support accept-ranges by default for compressible files', async () => {
    let lastModified = new Date('2025-01-01')
    createTestFile('test.txt', 'Hello, World!', lastModified)
    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir)],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Accept-Ranges'), null)

    let response2 = await router.fetch('http://localhost/test.txt', {
      headers: { Range: 'bytes=0-4' },
    })
    assert.equal(response2.status, 200)
    assert.equal(await response2.text(), 'Hello, World!')
  })

  it('supports range requests when acceptRanges is explicitly enabled', async () => {
    let lastModified = new Date('2025-01-01')
    createTestFile('test.txt', 'Hello, World!', lastModified)
    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir, { acceptRanges: true })],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes')

    let response2 = await router.fetch('http://localhost/test.txt', {
      headers: { Range: 'bytes=0-4' },
    })
    assert.equal(response2.status, 206)
    assert.equal(await response2.text(), 'Hello')
    assert.equal(response2.headers.get('Content-Range'), 'bytes 0-4/13')
    assert.equal(response2.headers.get('Content-Length'), '5')
    assert.equal(response2.headers.get('Accept-Ranges'), 'bytes')
  })

  it('supports range requests with acceptRanges function', async () => {
    createTestFile('test.txt', 'Hello, World!')
    createTestFile('video.dat', 'fake video data')
    let router = createRouter()
    router.get('/*', {
      middleware: [
        staticFiles(tmpDir, {
          acceptRanges: (file) => file.type.startsWith('video/'),
        }),
      ],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    // test.txt should not have ranges (text/plain)
    let textResponse = await router.fetch('http://localhost/test.txt')
    assert.equal(textResponse.headers.get('Accept-Ranges'), null)
  })

  it('supports cache-control', async () => {
    createTestFile('test.txt', 'Hello, World!')
    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir, { cacheControl: 'public, max-age=3600' })],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600')
  })

  it('works with multiple static middleware instances', async () => {
    createTestFile('assets/style.css', 'body {}')
    createTestFile('images/logo.png', 'PNG data')

    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir)],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response1 = await router.fetch('http://localhost/assets/style.css')
    assert.equal(response1.status, 200)
    assert.equal(await response1.text(), 'body {}')

    let response2 = await router.fetch('http://localhost/images/logo.png')
    assert.equal(response2.status, 200)
    assert.equal(await response2.text(), 'PNG data')
  })

  it('works as fallback middleware', async () => {
    createTestFile('index.html', '<h1>Fallback Handler</h1>')

    let router = createRouter()
    router.get('/api/users', () => {
      return new Response('Users API')
    })
    router.get('*path', {
      middleware: [staticFiles(tmpDir)],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response1 = await router.fetch('http://localhost/api/users')
    assert.equal(await response1.text(), 'Users API')

    let response2 = await router.fetch('http://localhost/index.html')
    assert.equal(await response2.text(), '<h1>Fallback Handler</h1>')
  })

  for (let method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const) {
    it(`ignores ${method} requests`, async () => {
      createTestFile('test.txt', 'Hello, World!')

      let router = createRouter()
      router.route(method, '/*path', {
        middleware: [staticFiles(tmpDir)],
        handler() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/test.txt', { method })

      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Fallback Handler')
    })
  }

  it('prevents path traversal with .. in pathname', async () => {
    createTestFile('secret.txt', 'Secret content')

    let publicDirName = 'public'
    createTestFile(`${publicDirName}/allowed.txt`, 'Allowed content')

    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(path.join(tmpDir, publicDirName))],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let allowedResponse = await router.fetch('http://localhost/allowed.txt')
    assert.equal(allowedResponse.status, 200)
    assert.equal(await allowedResponse.text(), 'Allowed content')

    let traversalResponse = await router.fetch('http://localhost/../secret.txt')
    assert.equal(traversalResponse.status, 404)
  })

  it('does not support absolute paths in the URL', async () => {
    let parentDir = path.dirname(tmpDir)
    let secretFileName = 'secret-outside-root.txt'
    let secretPath = path.join(parentDir, secretFileName)
    fs.writeFileSync(secretPath, 'Secret content')

    let router = createRouter()
    router.get('*path', {
      middleware: [staticFiles(tmpDir)],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    try {
      let response = await router.fetch(`http://localhost/${secretPath}`)
      assert.equal(response.status, 404)
    } finally {
      fs.unlinkSync(secretPath)
    }
  })

  describe('filter option', () => {
    it('filters files based on custom filter function', async () => {
      createTestFile('index.html', '<h1>Home</h1>')
      createTestFile('secret.txt', 'Secret')
      createTestFile('public.txt', 'Public')

      let router = createRouter()
      router.get('/*', {
        middleware: [
          staticFiles(tmpDir, {
            filter: (path) => !path.includes('secret'),
          }),
        ],
        handler() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let secretResponse = await router.fetch('http://localhost/secret.txt')
      assert.equal(secretResponse.status, 404)
      assert.equal(await secretResponse.text(), 'Fallback Handler')

      let publicResponse = await router.fetch('http://localhost/public.txt')
      assert.equal(publicResponse.status, 200)
      assert.equal(await publicResponse.text(), 'Public')
    })
  })
})
