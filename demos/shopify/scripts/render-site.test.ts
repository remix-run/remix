import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { assets } from '../app/assets.ts'
import { pagePaths } from '../app/data/pages.ts'
import { router } from '../app/router.ts'
import { renderSite } from './render-site.ts'

describe('static export', () => {
  it('exports nested pages, local assets, a sitemap, and a 404 without stale output', async () => {
    let directory = await mkdtemp(path.join(os.tmpdir(), 'shopify-export-'))
    let output = path.join(directory, 'dist')
    try {
      await mkdir(output)
      await writeFile(path.join(output, 'stale.html'), 'old output')
      let count = await renderSite(output)
      assert.equal(count, 33)
      for (let pathname of pagePaths) {
        let html = await readFile(path.join(output, pathname.slice(1), 'index.html'), 'utf8')
        assert.match(html, /^<!doctype html>/i)
      }
      assert.match(
        await readFile(path.join(output, 'website/builder/index.html'), 'utf8'),
        /Website Builder/,
      )
      assert.match(
        await readFile(path.join(output, 'sitemap/index.html'), 'utf8'),
        /\/solutions\/b2b\/enterprise/,
      )
      assert.match(await readFile(path.join(output, '404.html'), 'utf8'), /404/)
      assert.match(await readFile(path.join(output, assets.styles.slice(1)), 'utf8'), /@font-face/)
      await access(path.join(output, assets.font.slice(1)))
      assert.match(
        await readFile(path.join(output, '_headers'), 'utf8'),
        new RegExp(`^${assets.styles}\\n  Cache-Control: `, 'm'),
      )
      for (let filename of ['llms.txt', 'llms-full.txt', 'agents.md']) {
        assert.equal(
          await readFile(path.join(output, filename), 'utf8'),
          await readFile(path.join(import.meta.dirname, '../public', filename), 'utf8'),
        )
      }
      await assert.rejects(() => access(path.join(output, 'stale.html')))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('keeps the last good export when a page fails to render', async () => {
    let directory = await mkdtemp(path.join(os.tmpdir(), 'shopify-export-'))
    let output = path.join(directory, 'dist')
    try {
      await mkdir(output)
      await writeFile(path.join(output, 'index.html'), 'last good export')
      await assert.rejects(
        () =>
          renderSite(output, (request) =>
            new URL(request.url).pathname === '/payments'
              ? new Response('Unavailable', { status: 503 })
              : router.fetch(request),
          ),
        /Cannot prerender \/payments/,
      )
      assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'last good export')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('accepts a relative output directory', async () => {
    let directory = await mkdtemp(path.join(os.tmpdir(), 'shopify-export-'))
    let output = path.join(directory, 'dist')
    try {
      await renderSite(path.relative(process.cwd(), output))
      assert.match(await readFile(path.join(output, 'index.html'), 'utf8'), /^<!doctype html>/i)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects a broken local link before publishing the export', async () => {
    let directory = await mkdtemp(path.join(os.tmpdir(), 'shopify-export-'))
    try {
      await assert.rejects(
        () =>
          renderSite(path.join(directory, 'dist'), (request) =>
            new URL(request.url).pathname === '/'
              ? new Response('<!doctype html><a href="/missing-page">Broken link</a>', {
                  headers: { 'Content-Type': 'text/html' },
                })
              : router.fetch(request),
          ),
        /Missing local page or asset on \/: \/missing-page/,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects a link to a directory without an exported page', async () => {
    let directory = await mkdtemp(path.join(os.tmpdir(), 'shopify-export-'))
    try {
      await assert.rejects(
        () =>
          renderSite(path.join(directory, 'dist'), (request) =>
            new URL(request.url).pathname === '/'
              ? new Response('<!doctype html><a href="/website">Website</a>', {
                  headers: { 'Content-Type': 'text/html' },
                })
              : router.fetch(request),
          ),
        /Missing local page or asset on \/: \/website/,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects a missing responsive image before publishing the export', async () => {
    let directory = await mkdtemp(path.join(os.tmpdir(), 'shopify-export-'))
    try {
      await assert.rejects(
        () =>
          renderSite(path.join(directory, 'dist'), (request) =>
            new URL(request.url).pathname === '/'
              ? new Response(
                  `<!doctype html><img src="${assets.logo}" srcset="${assets.logo} 1600w, /assets/missing.webp 400w">`,
                  { headers: { 'Content-Type': 'text/html' } },
                )
              : router.fetch(request),
          ),
        /Missing local page or asset on \/: \/assets\/missing.webp/,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('percent-encodes fingerprint separators in exported asset URLs for Cloudflare', async () => {
    let directory = await mkdtemp(path.join(os.tmpdir(), 'shopify-export-'))
    let output = path.join(directory, 'dist')
    let stylesheet = '/assets/app/ui/public/demo.@abc123.css'
    let font = '/assets/app/ui/public/demo.@def456.woff2'
    let immutable = 'public, max-age=31536000, immutable'
    try {
      await renderSite(output, (request) => {
        let { pathname } = new URL(request.url)
        if (pathname === '/') {
          return new Response(`<!doctype html><link rel="stylesheet" href="${stylesheet}">`, {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        if (pathname === stylesheet) {
          return new Response(`@font-face{src:url("${font}")}`, {
            headers: { 'Content-Type': 'text/css', 'Cache-Control': immutable },
          })
        }
        if (pathname === font) {
          return new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'Content-Type': 'font/woff2', 'Cache-Control': immutable },
          })
        }
        return router.fetch(request)
      })

      let encodedStylesheet = stylesheet.replace('.@', '.%40')
      let encodedFont = font.replace('.@', '.%40')
      assert.match(
        await readFile(path.join(output, 'index.html'), 'utf8'),
        new RegExp(`href="${encodedStylesheet}"`),
      )
      assert.equal(
        await readFile(path.join(output, stylesheet.slice(1)), 'utf8'),
        `@font-face{src:url("${encodedFont}")}`,
      )
      await access(path.join(output, font.slice(1)))
      let headers = await readFile(path.join(output, '_headers'), 'utf8')
      assert.match(
        headers,
        new RegExp(`^${encodedStylesheet}\\n  Cache-Control: ${immutable}$`, 'm'),
      )
      assert.match(headers, new RegExp(`^${encodedFont}\\n  Cache-Control: ${immutable}$`, 'm'))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects missing video files, deferred sources, posters, and captions before publishing', async () => {
    let directory = await mkdtemp(path.join(os.tmpdir(), 'shopify-export-'))
    let output = path.join(directory, 'dist')
    try {
      await mkdir(output)
      await writeFile(path.join(output, 'index.html'), 'last good export')
      for (let markup of [
        '<video src="/media/missing.mp4"></video>',
        '<video><source data-src="/media/missing.webm"></video>',
        '<video poster="/media/missing.png"></video>',
        '<video><track src="/media/missing.vtt"></video>',
      ]) {
        await assert.rejects(
          () =>
            renderSite(output, (request) =>
              new URL(request.url).pathname === '/'
                ? new Response(`<!doctype html>${markup}`, {
                    headers: { 'Content-Type': 'text/html' },
                  })
                : router.fetch(request),
            ),
          /Missing local page or asset on \/: \/media\/missing/,
        )
        assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'last good export')
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
