import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'

import { createStyleServer } from './style-server.ts'

describe('createStyleServer', () => {
  it('handles GET and HEAD requests but ignores POST', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let getResponse = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.ok(getResponse)
    assert.equal(getResponse.status, 200)
    assert.match(await getResponse.text(), /red/)

    let headResponse = await styleServer.fetch(
      new Request('http://remix.run/styles/app.css', { method: 'HEAD' }),
    )
    assert.ok(headResponse)
    assert.equal(headResponse.status, 200)
    assert.equal(await headResponse.text(), '')

    let postResponse = await styleServer.fetch(
      new Request('http://remix.run/styles/app.css', { method: 'POST' }),
    )
    assert.equal(postResponse, null)

    await styleServer.close()
  })

  it('serves entry points with no-cache and ETags', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let response = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-cache')

    let etag = response.headers.get('ETag')
    assert.ok(etag)

    let notModified = await styleServer.fetch(
      new Request('http://remix.run/styles/app.css', {
        headers: { 'If-None-Match': etag },
      }),
    )
    assert.ok(notModified)
    assert.equal(notModified.status, 304)

    await styleServer.close()
  })

  it('serves live css imports, preserves authored asset urls, and ignores asset requests', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write(
      'styles/app.css',
      '@import "./reset.css";\n.hero { background: url("../assets/logo.svg"); }\n',
    )
    await fixture.write('styles/reset.css', 'body { color: red; }\n')
    await fixture.write('assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n')

    let styleServer = createStyleServer({
      allow: ['styles/**', 'assets/**'],
      root: fixture.root,
      routes: [
        { urlPattern: '/styles/*path', filePattern: 'styles/*path' },
        { urlPattern: '/assets/*path', filePattern: 'assets/*path' },
      ],
    })

    let href = '/styles/app.css'
    assert.equal(href, '/styles/app.css')

    let response = await styleServer.fetch(new Request(`http://remix.run${href}`))
    assert.ok(response)
    assert.equal(response.status, 200)

    let css = await response.text()
    assert.match(css, /@import "\/styles\/reset\.css";/)
    assert.match(css, /url\("\.\.\/assets\/logo\.svg"\)/)

    let assetResponse = await styleServer.fetch(new Request('http://remix.run/assets/logo.svg'))
    assert.equal(assetResponse, null)

    let preloads = await styleServer.getPreloads(path.join(fixture.root, 'styles/app.css'))
    assert.deepEqual(preloads, ['/styles/app.css', '/styles/reset.css'])

    await styleServer.close()
  })

  it('fingerprints imported css graph urls', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', '@import "./reset.css";\nbody { color: black; }\n')
    await fixture.write('styles/reset.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      fingerprint: { buildId: 'build-123' },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let appFile = path.join(fixture.root, 'styles/app.css')
    let resetFile = path.join(fixture.root, 'styles/reset.css')
    let appHref = await styleServer.getHref(appFile)
    let resetHref = await styleServer.getHref(resetFile)

    assert.match(appHref, /^\/styles\/app\.@[A-Za-z0-9_-]+\.css$/)
    assert.match(resetHref, /^\/styles\/reset\.@[A-Za-z0-9_-]+\.css$/)

    let response = await styleServer.fetch(new Request(`http://remix.run${appHref}`))
    assert.ok(response)

    let css = await response.text()
    assert.match(css, new RegExp(escapeRegExp(`@import "${resetHref}";`)))

    let preloads = await styleServer.getPreloads(appFile)
    assert.deepEqual(preloads, [appHref, resetHref])

    await styleServer.close()
  })

  it('uses immutable caching for fingerprinted style requests', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      fingerprint: { buildId: 'build-123' },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let href = await styleServer.getHref(path.join(fixture.root, 'styles/app.css'))
    let response = await styleServer.fetch(new Request(`http://remix.run${href}`))
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')

    await styleServer.close()
  })

  it('returns null for stable stylesheet requests when fingerprinting is enabled', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      fingerprint: { buildId: 'build-123' },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let response = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.equal(response, null)

    await styleServer.close()
  })

  it('returns null for fingerprint mismatches', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      fingerprint: { buildId: 'build-123' },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let href = await styleServer.getHref(path.join(fixture.root, 'styles/app.css'))
    let badHref = href.replace(/\.@[A-Za-z0-9_-]+(?=\.)/, '.@bad123')
    let response = await styleServer.fetch(new Request(`http://remix.run${badHref}`))
    assert.equal(response, null)

    await styleServer.close()
  })

  it('allows css files by default when allow is omitted', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')
    await fixture.write('assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n')

    let styleServer = createStyleServer({
      root: fixture.root,
      routes: [
        { urlPattern: '/styles/*path', filePattern: 'styles/*path' },
        { urlPattern: '/assets/*path', filePattern: 'assets/*path' },
      ],
    })

    let styleResponse = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.ok(styleResponse)
    assert.equal(styleResponse.status, 200)

    let assetResponse = await styleServer.fetch(new Request('http://remix.run/assets/logo.svg'))
    assert.equal(assetResponse, null)

    await styleServer.close()
  })

  it('supports allow and deny rules for direct requests and helper APIs', async (t) => {
    let fixture = await createFixture(t)

    let publicFile = await fixture.write('styles/public.css', 'body { color: red; }\n')
    await fixture.write('styles/private.css', 'body { color: blue; }\n')

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      deny: ['styles/private.css'],
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let publicResponse = await styleServer.fetch(new Request('http://remix.run/styles/public.css'))
    assert.ok(publicResponse)
    assert.equal(publicResponse.status, 200)

    let privateResponse = await styleServer.fetch(
      new Request('http://remix.run/styles/private.css'),
    )
    assert.equal(privateResponse, null)

    assert.equal(await styleServer.getHref(publicFile), '/styles/public.css')
    await assert.rejects(
      () => styleServer.getHref(path.join(fixture.root, 'styles/private.css')),
      /File is not allowed/,
    )

    await styleServer.close()
  })

  it('treats root-relative css imports as external', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', '@import "/styles/reset.css";\nbody { color: black; }\n')
    await fixture.write('styles/reset.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      fingerprint: { buildId: 'build-123' },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let appFile = path.join(fixture.root, 'styles/app.css')
    let appHref = await styleServer.getHref(appFile)
    let response = await styleServer.fetch(new Request(`http://remix.run${appHref}`))
    assert.ok(response)
    assert.equal(response.status, 200)

    let css = await response.text()
    assert.match(css, /@import "\/styles\/reset\.css";/)

    let preloads = await styleServer.getPreloads(appFile)
    assert.deepEqual(preloads, [appHref])

    await styleServer.close()
  })

  it('treats absolute and data css imports as external', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write(
      'styles/app.css',
      '@import "https://example.com/reset.css";\n@import "data:text/css,body{color:red}";\nbody { color: black; }\n',
    )

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let appFile = path.join(fixture.root, 'styles/app.css')
    let href = await styleServer.getHref(appFile)
    let response = await styleServer.fetch(new Request(`http://remix.run${href}`))
    assert.ok(response)
    assert.equal(response.status, 200)

    let css = await response.text()
    assert.match(css, /@import "https:\/\/example\.com\/reset\.css";/)
    assert.match(css, /@import "data:text\/css,body\{color:red\}";/)

    let preloads = await styleServer.getPreloads(appFile)
    assert.deepEqual(preloads, [href])

    await styleServer.close()
  })

  it('accepts relative paths, absolute paths, and file urls in getHref', async (t) => {
    let fixture = await createFixture(t)

    let appFile = await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    assert.equal(await styleServer.getHref('styles/app.css'), '/styles/app.css')
    assert.equal(await styleServer.getHref(appFile), '/styles/app.css')
    assert.equal(await styleServer.getHref(pathToFileURL(appFile).href), '/styles/app.css')

    await styleServer.close()
  })

  it('dedupes shared dependencies across multiple preload roots', async (t) => {
    let fixture = await createFixture(t)

    let appFile = await fixture.write(
      'styles/app.css',
      '@import "./shared.css";\nbody { color: red; }\n',
    )
    await fixture.write(
      'styles/print.css',
      '@import "./shared.css";\n@media print { body { color: black; } }\n',
    )
    let sharedFile = await fixture.write('styles/shared.css', 'body { margin: 0; }\n')

    let styleServer = createStyleServer({
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let preloads = await styleServer.getPreloads([
      'styles/app.css',
      path.join(fixture.root, 'styles/print.css'),
      pathToFileURL(sharedFile).href,
      appFile,
    ])
    assert.deepEqual(preloads, ['/styles/app.css', '/styles/print.css', '/styles/shared.css'])

    await styleServer.close()
  })

  it('rejects http urls passed to getPreloads', async (t) => {
    let fixture = await createFixture(t)

    let styleServer = createStyleServer({
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    await assert.rejects(
      () => styleServer.getPreloads('http://remix.run/styles/app.css'),
      /Expected a file path or file:\/\/ URL/,
    )

    await styleServer.close()
  })

  it('applies browserslist targets when transforming css', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write(
      'styles/app.css',
      'a { appearance: none; user-select: none; text-size-adjust: none; }\n',
    )

    let defaultStyleServer = createStyleServer({
      allow: ['styles/**'],
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let href = await defaultStyleServer.getHref(path.join(fixture.root, 'styles/app.css'))
    let defaultResponse = await defaultStyleServer.fetch(new Request(`http://remix.run${href}`))
    assert.ok(defaultResponse)
    let defaultCss = await defaultResponse.text()
    assert.doesNotMatch(defaultCss, /-webkit-appearance/)
    assert.doesNotMatch(defaultCss, /-webkit-user-select/)
    await defaultStyleServer.close()

    let targetedStyleServer = createStyleServer({
      allow: ['styles/**'],
      browserslist: 'safari 14',
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let targetedResponse = await targetedStyleServer.fetch(new Request(`http://remix.run${href}`))
    assert.ok(targetedResponse)
    let targetedCss = await targetedResponse.text()
    assert.match(targetedCss, /-webkit-appearance: none;/)
    assert.match(targetedCss, /-webkit-user-select: none;/)
    await targetedStyleServer.close()
  })

  it('minifies output when requested', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: blue; }\n')

    let styleServer = createStyleServer({
      minify: true,
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let response = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.ok(response)

    let css = await response.text()
    assert.equal(css, 'body{color:#00f}')

    await styleServer.close()
  })

  it('updates watched styles without restarting the server', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', '@import "./reset.css";\nbody { color: black; }\n')
    await fixture.write('styles/reset.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      onError() {
        return new Response('Internal Server Error', { status: 500 })
      },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
      watch: {
        poll: true,
        pollInterval: 25,
      },
    })

    let href = await styleServer.getHref(path.join(fixture.root, 'styles/reset.css'))
    let initial = await styleServer.fetch(new Request(`http://remix.run${href}`))
    assert.ok(initial)
    assert.match(await initial.text(), /red/)

    await fixture.write('styles/reset.css', 'body { color: blue; }\n')

    await waitFor(async () => {
      let response = await styleServer.fetch(new Request(`http://remix.run${href}`))
      assert.ok(response)
      let css = await response.text()
      assert.match(css, /#00f/)
    })

    await styleServer.close()
  })

  it('recovers when a missing watched import is created later', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', '@import "./late.css";\nbody { color: black; }\n')

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      onError() {
        return new Response('Internal Server Error', { status: 500 })
      },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
      watch: {
        poll: true,
        pollInterval: 25,
      },
    })

    let href = '/styles/app.css'
    let initial = await styleServer.fetch(new Request(`http://remix.run${href}`))
    assert.ok(initial)
    assert.equal(initial.status, 500)

    await fixture.write('styles/late.css', 'body { color: blue; }\n')

    await waitFor(async () => {
      let response = await styleServer.fetch(new Request(`http://remix.run${href}`))
      assert.ok(response)
      assert.equal(response.status, 200)
      assert.match(await response.text(), /@import "\/styles\/late\.css";/)
    })

    await styleServer.close()
  })

  it('rewrites source map sources to served urls by default', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
      sourceMaps: 'external',
    })

    let href = await styleServer.getHref(path.join(fixture.root, 'styles/app.css'))
    let sourceMapResponse = await styleServer.fetch(new Request(`http://remix.run${href}.map`))
    assert.ok(sourceMapResponse)
    assert.equal(sourceMapResponse.status, 200)

    let sourceMap = JSON.parse(await sourceMapResponse.text()) as { sources?: string[] }
    assert.deepEqual(sourceMap.sources, ['/styles/app.css'])

    await styleServer.close()
  })

  it('supports inline source maps', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
      sourceMaps: 'inline',
    })

    let response = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.ok(response)
    assert.equal(response.status, 200)

    let css = await response.text()
    let sourceMap = decodeInlineSourceMap(css)
    assert.deepEqual(sourceMap.sources, ['/styles/app.css'])

    await styleServer.close()
  })

  it('uses fingerprinted hrefs for external source map comments', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      fingerprint: { buildId: 'maps-build' },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
      sourceMaps: 'external',
    })

    let href = await styleServer.getHref(path.join(fixture.root, 'styles/app.css'))
    let response = await styleServer.fetch(new Request(`http://remix.run${href}`))
    assert.ok(response)
    assert.equal(response.status, 200)

    let css = await response.text()
    assert.match(css, new RegExp(escapeRegExp(`/*# sourceMappingURL=${href}.map */`)))

    let sourceMapResponse = await styleServer.fetch(new Request(`http://remix.run${href}.map`))
    assert.ok(sourceMapResponse)
    assert.equal(sourceMapResponse.status, 200)

    await styleServer.close()
  })

  it('supports HEAD requests for external source map urls', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', 'body { color: red; }\n')

    let styleServer = createStyleServer({
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
      sourceMaps: 'external',
    })

    let href = await styleServer.getHref(path.join(fixture.root, 'styles/app.css'))
    let response = await styleServer.fetch(
      new Request(`http://remix.run${href}.map`, { method: 'HEAD' }),
    )
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8')
    assert.equal(await response.text(), '')

    await styleServer.close()
  })

  it('supports css import cycles without throwing', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/a.css', '@import "./b.css";\n.a { color: red; }\n')
    await fixture.write('styles/b.css', '@import "./a.css";\n.b { color: blue; }\n')

    let styleServer = createStyleServer({
      allow: ['styles/**'],
      fingerprint: { buildId: 'cycle-build' },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let aFile = path.join(fixture.root, 'styles/a.css')
    let aHref = await styleServer.getHref(aFile)
    let response = await styleServer.fetch(new Request(`http://remix.run${aHref}`))
    assert.ok(response)
    assert.equal(response.status, 200)

    let css = await response.text()
    assert.match(css, /@import "\/styles\/b\.@[A-Za-z0-9_-]+\.css";/)

    let preloads = await styleServer.getPreloads(aFile)
    assert.equal(preloads.length, 2)
    assert.match(preloads[0]!, /^\/styles\/a\.@[A-Za-z0-9_-]+\.css$/)
    assert.match(preloads[1]!, /^\/styles\/b\.@[A-Za-z0-9_-]+\.css$/)

    await styleServer.close()
  })

  it('uses a custom response returned from onError', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', '@import "./missing.css";\n')

    let styleServer = createStyleServer({
      onError() {
        return new Response('stylesheet build failed', { status: 555 })
      },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let response = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.ok(response)
    assert.equal(response.status, 555)
    assert.equal(await response.text(), 'stylesheet build failed')

    await styleServer.close()
  })

  it('falls back to the default 500 when onError returns nothing', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', '@import "./missing.css";\n')

    let styleServer = createStyleServer({
      onError() {},
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let response = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.ok(response)
    assert.equal(response.status, 500)
    assert.equal(await response.text(), 'Internal Server Error')

    await styleServer.close()
  })

  it('falls back to the default 500 when onError throws', async (t) => {
    let fixture = await createFixture(t)

    await fixture.write('styles/app.css', '@import "./missing.css";\n')

    let styleServer = createStyleServer({
      onError() {
        throw new Error('boom')
      },
      root: fixture.root,
      routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
    })

    let response = await styleServer.fetch(new Request('http://remix.run/styles/app.css'))
    assert.ok(response)
    assert.equal(response.status, 500)
    assert.equal(await response.text(), 'Internal Server Error')

    await styleServer.close()
  })

  it('validates fingerprint options', async () => {
    assert.throws(
      () =>
        createStyleServer({
          fingerprint: { buildId: '' },
          routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
        }),
      /fingerprint\.buildId must be a non-empty string/,
    )

    assert.throws(
      () =>
        createStyleServer({
          fingerprint: { buildId: 'build-123' },
          routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
          watch: true,
        }),
      /fingerprint cannot be used with watch mode/,
    )
  })

  it('validates browserslist options', async () => {
    assert.throws(
      () =>
        createStyleServer({
          browserslist: '   ',
          routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
        }),
      /browserslist must be a non-empty string/,
    )

    assert.throws(
      () =>
        createStyleServer({
          browserslist: 123 as unknown as string,
          routes: [{ urlPattern: '/styles/*path', filePattern: 'styles/*path' }],
        }),
      /browserslist must be a string/,
    )
  })
})

async function createFixture(t: { after(fn: () => void | Promise<void>): void }) {
  let root = await fs.mkdtemp(path.join(os.tmpdir(), 'style-server-'))

  t.after(async () => {
    await fs.rm(root, { force: true, recursive: true })
  })

  return {
    root,
    async write(relativePath: string, content: string) {
      let filePath = path.join(root, relativePath)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content)
      return filePath
    },
  }
}

async function waitFor(assertion: () => Promise<void>): Promise<void> {
  let lastError: unknown

  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  throw lastError
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeInlineSourceMap(css: string): { sources?: string[] } {
  let match = css.match(/\/\*# sourceMappingURL=data:application\/json;base64,([^*]+)\*\//)
  assert.ok(match)

  let encoded = match[1]!.trim()
  let decoded = Buffer.from(encoded, 'base64').toString('utf8')
  return JSON.parse(decoded) as { sources?: string[] }
}
