import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from './router.ts'

function html(content: string): Response {
  return new Response(content, { headers: { 'Content-Type': 'text/html' } })
}

function css(content = ''): Response {
  return new Response(content, { headers: { 'Content-Type': 'text/css' } })
}

function js(content = ''): Response {
  return new Response(content, { headers: { 'Content-Type': 'application/javascript' } })
}

describe('router.crawl()', () => {
  it('visits the root path by default', async () => {
    let router = createRouter()
    router.get('/', () => html('hello'))

    let visited: [string, string, string][] = []
    for await (let { pathname, filepath, response } of router.crawl()) {
      visited.push([pathname, filepath, await response.text()])
    }
    assert.deepEqual(visited, [['/', '/index.html', 'hello']])
  })

  it('visits custom initial paths', async () => {
    let router = createRouter()
    router.get('/a', () => html('A'))
    router.get('/b', () => html('B'))

    let visited: [string, string, string][] = []
    for await (let { pathname, filepath, response } of router.crawl({
      paths: ['/a', '/b'],
    })) {
      visited.push([pathname, filepath, await response.text()])
    }
    assert.deepEqual(visited, [
      ['/a', '/a/index.html', 'A'],
      ['/b', '/b/index.html', 'B'],
    ])
  })

  it('uses correct file paths based on content type', async () => {
    let router = createRouter()
    router.get('/', () => html('<html></html>'))
    router.get('/about', () => html('<html></html>'))
    router.get('/about/', () => html('<html></html>'))
    router.get('/style.css', () => css('body {}'))
    router.get('/app.js', () => js('console.log()'))

    let filePaths: string[] = []
    for await (let { filepath } of router.crawl({
      paths: ['/', '/about', '/about/', '/style.css', '/app.js'],
    })) {
      filePaths.push(filepath)
    }
    assert.deepEqual(filePaths, [
      '/index.html',
      '/about/index.html',
      '/about/index.html',
      '/style.css',
      '/app.js',
    ])
  })

  it('does not follow links when spider is false', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="/about">About</a>'))
    router.get('/about', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl({ spider: false })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
  })

  it('follows links by default (spider is true)', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="/about">About</a>'))
    router.get('/about', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl()) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/about'])
  })

  it('always queues CSS, JS, and image assets regardless of spider mode', async () => {
    let router = createRouter()
    router.get('/', () =>
      html(`
        <link rel="stylesheet" href="/style.css">
        <script src="/app.js"></script>
        <img src="/logo.png">
      `),
    )
    router.get('/style.css', () => css('body {}'))
    router.get('/app.js', () => js())
    router.get('/logo.png', () => new Response('', { headers: { 'Content-Type': 'image/png' } }))

    let visited: string[] = []
    for await (let { pathname } of router.crawl()) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/style.css', '/app.js', '/logo.png'])
  })

  it('skips absolute http/https URLs by default', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="https://example.com/page">External</a>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl()) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
  })

  it('skips protocol-relative URLs by default', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="//example.com/page">External</a>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl()) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
  })

  it('supports a custom filter function', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="/allowed">OK</a><a href="/blocked">No</a>'))
    router.get('/allowed', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl({
      filter: (href) => href !== '/blocked',
    })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/allowed'])
  })

  it('skips non-navigable href schemes', async () => {
    let router = createRouter()
    router.get('/', () =>
      html(`
        <a href="#section">Anchor</a>
        <a href="mailto:a@b.com">Email</a>
        <a href="tel:123">Phone</a>
        <a href="javascript:void(0)">JS</a>
        <a href="data:text/plain,hello">Data</a>
        <a href="/real">Real</a>
      `),
    )
    router.get('/real', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl()) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/real'])
  })

  it('does not follow links with rel="nofollow"', async () => {
    let router = createRouter()
    router.get('/', () =>
      html('<a href="/nofollow" rel="nofollow">Skip</a><a href="/follow">Follow</a>'),
    )
    router.get('/follow', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl()) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/follow'])
  })

  it('does not queue preload, prefetch, or modulepreload link elements', async () => {
    let router = createRouter()
    router.get('/', () =>
      html(`
        <link rel="preload" href="/preload.css" as="style">
        <link rel="prefetch" href="/prefetch.js">
        <link rel="modulepreload" href="/module.js">
        <link rel="stylesheet" href="/real.css">
      `),
    )
    router.get('/real.css', () => css())

    let visited: string[] = []
    for await (let { pathname } of router.crawl()) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/real.css'])
  })

  it('resolves relative hrefs against the current page URL', async () => {
    let router = createRouter()
    router.get('/blog/', () => html('<a href="post-1">Post 1</a>'))
    router.get('/blog/post-1', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl({ paths: ['/blog/'] })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/blog/', '/blog/post-1'])
  })

  it('does not visit the same path twice', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="/shared">Shared</a>'))
    router.get('/about', () => html('<a href="/shared">Shared</a>'))
    router.get('/shared', () => html('<html></html>'))

    let visitCount: Record<string, number> = {}
    for await (let { pathname } of router.crawl({ paths: ['/', '/about'] })) {
      visitCount[pathname] = (visitCount[pathname] ?? 0) + 1
    }
    assert.equal(visitCount['/shared'], 1)
  })

  it('calls variants and queues the returned paths', async () => {
    let router = createRouter()
    router.get('/source', () => html('<html></html>'))
    router.get(
      '/source.md',
      () => new Response('# Home', { headers: { 'Content-Type': 'text/plain' } }),
    )

    debugger
    let visited: string[] = []
    for await (let { pathname } of router.crawl({
      paths: ['/source'],
      variants: (pathname) => (!pathname.endsWith('.md') ? [`${pathname}.md`] : []),
    })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/source', '/source.md'])
  })

  it('supports async variants', async () => {
    let router = createRouter()
    router.get('/', () => html('<html></html>'))
    router.get('/async-variant', () => new Response(''))

    let visited: string[] = []
    for await (let { pathname } of router.crawl({
      variants: async (pathname) => {
        await Promise.resolve()
        return pathname === '/' ? ['/async-variant'] : undefined
      },
    })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/async-variant'])
  })

  it('handles variants that return undefined', async () => {
    let router = createRouter()
    router.get('/', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of router.crawl({ variants: () => undefined })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
  })
})
