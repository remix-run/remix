import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, beforeEach, afterEach } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'
import { methodOverride } from '@remix-run/method-override-middleware'

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
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/test.txt')

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
      assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
    })

    it('serves a file with HEAD request', async () => {
      createTestFile('test.txt', 'Hello, World!')

      let router = createRouter()
      router.head('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/test.txt', { method: 'HEAD' })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '')
      assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
    })

    it('serves files from nested directories', async () => {
      createTestFile('dir/subdir/file.txt', 'Nested file')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/dir/subdir/file.txt')

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Nested file')
    })

    it('falls through to handler for non-existent file', async () => {
      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Custom Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/nonexistent.txt')

      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Custom Fallback Handler')
    })

    it('falls through to handler when requesting a directory', async () => {
      let dirPath = path.join(tmpDir, 'subdir')
      fs.mkdirSync(dirPath)

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir')

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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('https://remix.run/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    let etag = response.headers.get('ETag')
    assert.ok(etag)
    assert.equal(etag, 'W/"13-1735689600000"')

    let response2 = await router.fetch('https://remix.run/test.txt', {
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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('https://remix.run/test.txt')
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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('https://remix.run/test.txt')
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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('https://remix.run/test.txt')
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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('https://remix.run/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Accept-Ranges'), null)

    let response2 = await router.fetch('https://remix.run/test.txt', {
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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('https://remix.run/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes')

    let response2 = await router.fetch('https://remix.run/test.txt', {
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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    // test.txt should not have ranges (text/plain doesn't match video/* filter)
    let response = await router.fetch('https://remix.run/test.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, World!')
    assert.equal(response.headers.get('Accept-Ranges'), null)

    let response2 = await router.fetch('https://remix.run/test.txt', {
      headers: { Range: 'bytes=0-4' },
    })
    assert.equal(response2.status, 200)
    assert.equal(await response2.text(), 'Hello, World!')
  })

  it('supports cache-control', async () => {
    createTestFile('test.txt', 'Hello, World!')
    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir, { cacheControl: 'public, max-age=3600' })],
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response = await router.fetch('https://remix.run/test.txt')
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600')
  })

  it('works with multiple static middleware instances', async () => {
    createTestFile('assets/style.css', 'body {}')
    createTestFile('images/logo.png', 'PNG data')

    let router = createRouter()
    router.get('/*', {
      middleware: [staticFiles(tmpDir)],
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response1 = await router.fetch('https://remix.run/assets/style.css')
    assert.equal(response1.status, 200)
    assert.equal(await response1.text(), 'body {}')

    let response2 = await router.fetch('https://remix.run/images/logo.png')
    assert.equal(response2.status, 200)
    assert.equal(await response2.text(), 'PNG data')
  })

  it('works as fallback middleware', async () => {
    createTestFile('index.html', '<h1>Fallback Handler</h1>')

    let router = createRouter()
    router.get('/api/users', () => new Response('Users API'))
    router.get('*path', {
      middleware: [staticFiles(tmpDir)],
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let response1 = await router.fetch('https://remix.run/api/users')
    assert.equal(await response1.text(), 'Users API')

    let response2 = await router.fetch('https://remix.run/index.html')
    assert.equal(await response2.text(), '<h1>Fallback Handler</h1>')
  })

  for (let method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const) {
    it(`ignores ${method} requests`, async () => {
      createTestFile('test.txt', 'Hello, World!')

      let router = createRouter()
      router.route(method, '/*path', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/test.txt', { method })

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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    let allowedResponse = await router.fetch('https://remix.run/allowed.txt')
    assert.equal(allowedResponse.status, 200)
    assert.equal(await allowedResponse.text(), 'Allowed content')

    let traversalResponse = await router.fetch('https://remix.run/../secret.txt')
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
      action() {
        return new Response('Fallback Handler', { status: 404 })
      },
    })

    try {
      let response = await router.fetch(`https://remix.run/${secretPath}`)
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
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let secretResponse = await router.fetch('https://remix.run/secret.txt')
      assert.equal(secretResponse.status, 404)
      assert.equal(await secretResponse.text(), 'Fallback Handler')

      let publicResponse = await router.fetch('https://remix.run/public.txt')
      assert.equal(publicResponse.status, 200)
      assert.equal(await publicResponse.text(), 'Public')
    })
  })

  describe('index option', () => {
    it('serves default index.html when requesting a directory', async () => {
      createTestFile('subdir/index.html', '<h1>Index Page</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 200)
      assert.equal(await response.text(), '<h1>Index Page</h1>')
      assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8')
    })

    it('serves default index.html when requesting a directory without trailing slash', async () => {
      createTestFile('subdir/index.html', '<h1>Index Page</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir')
      assert.equal(response.status, 200)
      assert.equal(await response.text(), '<h1>Index Page</h1>')
      assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8')
    })

    it('serves default index.htm when index.html does not exist', async () => {
      createTestFile('subdir/index.htm', '<h1>HTM Index Page</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 200)
      assert.equal(await response.text(), '<h1>HTM Index Page</h1>')
      assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8')
    })

    it('prefers index.html over index.htm when both exist', async () => {
      createTestFile('subdir/index.html', '<h1>HTML Index</h1>')
      createTestFile('subdir/index.htm', '<h1>HTM Index</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 200)
      assert.equal(await response.text(), '<h1>HTML Index</h1>')
    })

    it('falls through when directory has no index file', async () => {
      let dirPath = path.join(tmpDir, 'subdir')
      fs.mkdirSync(dirPath)
      createTestFile('subdir/other.txt', 'Not an index file')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Fallback Handler')
    })

    it('serves custom index file when specified', async () => {
      createTestFile('subdir/default.html', '<h1>Custom Default Page</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir, { index: ['default.html'] })],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 200)
      assert.equal(await response.text(), '<h1>Custom Default Page</h1>')
    })

    it('tries custom index files in order', async () => {
      createTestFile('subdir/home.html', '<h1>Home Page</h1>')
      createTestFile('subdir/default.html', '<h1>Default Page</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir, { index: ['index.html', 'home.html', 'default.html'] })],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 200)
      assert.equal(await response.text(), '<h1>Home Page</h1>')
    })

    it('serves root directory index file', async () => {
      createTestFile('index.html', '<h1>Root Index</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/')
      assert.equal(response.status, 200)
      assert.equal(await response.text(), '<h1>Root Index</h1>')
    })

    it('supports empty index array to disable index file serving', async () => {
      createTestFile('subdir/index.html', '<h1>Index Page</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir, { index: [] })],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Fallback Handler')
    })

    it('supports index: false to disable index file serving', async () => {
      createTestFile('subdir/index.html', '<h1>Index Page</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir, { index: false })],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Fallback Handler')
    })

    it('supports index: true to use default index files', async () => {
      createTestFile('subdir/index.html', '<h1>Index Page</h1>')

      let router = createRouter()
      router.get('/*', {
        middleware: [staticFiles(tmpDir, { index: true })],
        action() {
          return new Response('Fallback Handler', { status: 404 })
        },
      })

      let response = await router.fetch('https://remix.run/subdir/')
      assert.equal(response.status, 200)
      assert.equal(await response.text(), '<h1>Index Page</h1>')
    })
  })

  describe('works with method-override middleware', () => {
    it('ignores overridden POST requests', async () => {
      createTestFile('test.txt', 'Hello, World!')

      let router = createRouter({
        middleware: [formData(), methodOverride()],
      })
      router.post('/*path', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('POST handler called', { status: 200 })
        },
      })

      let formDataPayload = new FormData()
      formDataPayload.append('_method', 'POST')
      formDataPayload.append('name', 'test')

      let response = await router.fetch('https://remix.run/test.txt', {
        method: 'POST',
        body: formDataPayload,
      })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'POST handler called')
    })

    it('serves files with overridden GET requests', async () => {
      createTestFile('test.txt', 'Hello, World!')

      let router = createRouter({
        middleware: [formData(), methodOverride()],
      })
      router.get('/*path', {
        middleware: [staticFiles(tmpDir)],
        action() {
          return new Response('GET handler fallback', { status: 404 })
        },
      })

      let formDataPayload = new FormData()
      formDataPayload.append('_method', 'GET')

      let response = await router.fetch('https://remix.run/test.txt', {
        method: 'POST',
        body: formDataPayload,
      })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'Hello, World!')
      assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
    })
  })
})
