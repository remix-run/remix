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
        use: [staticFiles(tmpDir)],
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
        use: [staticFiles(tmpDir)],
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
        use: [staticFiles(tmpDir)],
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
        use: [staticFiles(tmpDir)],
        handler() {
          return new Response('Custom Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/nonexistent.txt')

      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Custom Fallback Handler')
    })

    it('supports custom path resolver using params', async () => {
      createTestFile('custom/file.txt', 'Custom path content')

      let router = createRouter()
      router.get('/assets/*path', {
        use: [
          staticFiles(tmpDir, {
            path: ({ params }) => `custom/${params.path}`,
          }),
        ],
        handler() {
          return new Response('Not Found', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/assets/file.txt')

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Custom path content')
    })

    it('supports custom path resolver using request URL', async () => {
      createTestFile('file.txt', 'File content')

      let router = createRouter()
      router.get('/*', {
        use: [
          staticFiles(tmpDir, {
            path: ({ request }) => {
              return new URL(request.url).pathname.replace(/^\/prefix\//, '')
            },
          }),
        ],
        handler() {
          return new Response('Not Found', { status: 404 })
        },
      })

      let response = await router.fetch('http://localhost/prefix/file.txt')

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'File content')
    })

    it('enforces type safety for params in path resolver', async () => {
      let router = createRouter()
      router.get('/assets/*path', {
        use: [
          staticFiles(tmpDir, {
            // @ts-expect-error - 'nonexistent' does not exist on params
            path: ({ params }) => params.nonexistent,
          }),
        ],
        handler() {
          return new Response('Not Found', { status: 404 })
        },
      })

      // This is just a compile-time test, no runtime assertion needed
      assert.ok(router)
    })

    it('falls through to handler when requesting a directory', async () => {
      let dirPath = path.join(tmpDir, 'subdir')
      fs.mkdirSync(dirPath)

      let router = createRouter()
      router.get('/*', {
        use: [staticFiles(tmpDir)],
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
      use: [staticFiles(tmpDir)],
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
      use: [staticFiles(tmpDir, { etag: false })],
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
      use: [staticFiles(tmpDir)],
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
      use: [staticFiles(tmpDir, { lastModified: false })],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Last-Modified'), null)
  })

  it('supports accept-ranges by default', async () => {
    let lastModified = new Date('2025-01-01')
    createTestFile('test.txt', 'Hello, World!', lastModified)
    let router = createRouter()
    router.get('/*', {
      use: [staticFiles(tmpDir)],
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

  it('does not support range requests if acceptRanges is disabled', async () => {
    let lastModified = new Date('2025-01-01')
    createTestFile('test.txt', 'Hello, World!', lastModified)
    let router = createRouter()
    router.get('/*', {
      use: [staticFiles(tmpDir, { acceptRanges: false })],
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

  it('supports cache-control', async () => {
    createTestFile('test.txt', 'Hello, World!')
    let router = createRouter()
    router.get('/*', {
      use: [staticFiles(tmpDir, { cacheControl: 'public, max-age=3600' })],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('http://localhost/test.txt')
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600')
  })

  it('works with multiple static middleware instances', async () => {
    let assetsDirName = 'assets'
    let imagesDirName = 'images'

    createTestFile(`${assetsDirName}/style.css`, 'body {}')
    createTestFile(`${imagesDirName}/logo.png`, 'PNG data')

    let assetsDir = path.join(tmpDir, assetsDirName)
    let imagesDir = path.join(tmpDir, imagesDirName)

    let router = createRouter()
    router.get('/assets/*path', {
      use: [
        staticFiles(assetsDir, {
          path: ({ params }) => params.path,
        }),
      ],
      handler() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })
    router.get('/images/*path', {
      use: [
        staticFiles(imagesDir, {
          path: ({ params }) => params.path,
        }),
      ],
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
      use: [staticFiles(tmpDir)],
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
        use: [staticFiles(tmpDir)],
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
      use: [staticFiles(path.join(tmpDir, publicDirName))],
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
      use: [staticFiles(tmpDir)],
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
})
