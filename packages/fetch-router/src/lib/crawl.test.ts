import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { crawl } from './crawl.ts'
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

describe('crawl(router)', () => {
  it('visits the root path by default', async () => {
    let router = createRouter()
    router.get('/', () => html('hello'))

    let visited: [string, string, string][] = []
    for await (let { pathname, filepath, response } of crawl(router)) {
      visited.push([pathname, filepath, await response.text()])
    }
    assert.deepEqual(visited, [['/', '/index.html', 'hello']])
  })

  it('visits custom initial paths', async () => {
    let router = createRouter()
    router.get('/a', () => html('A'))
    router.get('/b', () => html('B'))

    let visited: [string, string, string][] = []
    for await (let { pathname, filepath, response } of crawl(router, {
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
    for await (let { filepath } of crawl(router, {
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
    for await (let { pathname } of crawl(router, { spider: false })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
  })

  it('follows links by default (spider is true)', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="/about">About</a>'))
    router.get('/about', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of crawl(router)) {
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
    for await (let { pathname } of crawl(router)) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/style.css', '/app.js', '/logo.png'])
  })

  it('skips absolute http/https URLs by default', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="https://example.com/page">External</a>'))

    let visited: string[] = []
    for await (let { pathname } of crawl(router)) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
  })

  it('skips protocol-relative URLs by default', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="//example.com/page">External</a>'))

    let visited: string[] = []
    for await (let { pathname } of crawl(router)) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
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
    for await (let { pathname } of crawl(router)) {
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
    for await (let { pathname } of crawl(router)) {
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
    for await (let { pathname } of crawl(router)) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/', '/real.css'])
  })

  it('resolves relative hrefs against the current page URL', async () => {
    let router = createRouter()
    router.get('/blog/', () => html('<a href="post-1">Post 1</a>'))
    router.get('/blog/post-1', () => html('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of crawl(router, { paths: ['/blog/'] })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/blog/', '/blog/post-1'])
  })

  it('throws on non-2xx responses', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Not Found', { status: 404, statusText: 'Not Found' }))

    await assert.rejects(
      async () => {
        for await (let _ of crawl(router)) {
        }
      },
      { message: 'Crawl failed: 404 Not Found (/)' },
    )
  })

  it('fetches pages concurrently when concurrency > 1', async () => {
    let router = createRouter()
    let inflight = 0
    let maxInflight = 0

    function slowHtml(content: string): Promise<Response> {
      inflight++
      maxInflight = Math.max(maxInflight, inflight)
      return new Promise((resolve) =>
        setTimeout(() => {
          inflight--
          resolve(html(content))
        }, 20),
      )
    }

    router.get('/', () => slowHtml('<a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>'))
    router.get('/a', () => slowHtml('<html></html>'))
    router.get('/b', () => slowHtml('<html></html>'))
    router.get('/c', () => slowHtml('<html></html>'))

    let visited: string[] = []
    for await (let { pathname } of crawl(router, { concurrency: 3 })) {
      visited.push(pathname)
    }

    assert.deepEqual(visited.toSorted(), ['/', '/a', '/b', '/c'])
    assert.ok(maxInflight > 1, `expected concurrent requests, got max inflight: ${maxInflight}`)
  })

  it('does not visit the same path twice', async () => {
    let router = createRouter()
    router.get('/', () => html('<a href="/shared">Shared</a>'))
    router.get('/about', () => html('<a href="/shared">Shared</a>'))
    router.get('/shared', () => html('<html></html>'))

    let visitCount: Record<string, number> = {}
    for await (let { pathname } of crawl(router, { paths: ['/', '/about'] })) {
      visitCount[pathname] = (visitCount[pathname] ?? 0) + 1
    }
    assert.equal(visitCount['/shared'], 1)
  })

  it('follows same-site link[rel="alternate"] when spider is true', async () => {
    let router = createRouter()
    router.get('/', () =>
      html('<link rel="alternate" type="text/markdown" href="/index.md"><h1>Home</h1>'),
    )
    router.get('/index.md', () => new Response('# Home', { headers: { 'Content-Type': 'text/markdown' } }))

    let visited: string[] = []
    for await (let { pathname } of crawl(router)) {
      visited.push(pathname)
    }
    assert.deepEqual(visited.toSorted(), ['/', '/index.md'])
  })

  it('does not follow link[rel="alternate"] when spider is false', async () => {
    let router = createRouter()
    router.get('/', () =>
      html('<link rel="alternate" type="text/markdown" href="/index.md"><h1>Home</h1>'),
    )
    router.get('/index.md', () => new Response('# Home', { headers: { 'Content-Type': 'text/markdown' } }))

    let visited: string[] = []
    for await (let { pathname } of crawl(router, { spider: false })) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
  })

  it('skips cross-origin link[rel="alternate"] hrefs', async () => {
    let router = createRouter()
    router.get('/', () =>
      html(`
        <link rel="alternate" type="application/rss+xml" href="https://example.com/feed.xml">
        <link rel="alternate" type="application/rss+xml" href="//example.com/feed.xml">
      `),
    )

    let visited: string[] = []
    for await (let { pathname } of crawl(router)) {
      visited.push(pathname)
    }
    assert.deepEqual(visited, ['/'])
  })

  it('does not follow link[rel="alternate nofollow"]', async () => {
    let router = createRouter()
    router.get('/', () =>
      html(`
        <link rel="alternate nofollow" type="text/markdown" href="/skip.md">
        <link rel="alternate" type="text/markdown" href="/follow.md">
      `),
    )
    router.get('/skip.md', () => new Response('skip', { headers: { 'Content-Type': 'text/markdown' } }))
    router.get('/follow.md', () => new Response('follow', { headers: { 'Content-Type': 'text/markdown' } }))

    let visited: string[] = []
    for await (let { pathname } of crawl(router)) {
      visited.push(pathname)
    }
    assert.deepEqual(visited.toSorted(), ['/', '/follow.md'])
  })

})
