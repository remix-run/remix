import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { stripTypeScriptTypes } from 'node:module'

async function serveImages(t: TestContext, width: number, source: 'img' | 'link' = 'img') {
  let images: string[] = []
  let server = createServer((request, response) => {
    void (async () => {
      let path = new URL(request.url ?? '/', 'http://localhost').pathname
      if (path.startsWith('/modules/')) {
        let source = await readFile(
          new URL(`../${path.slice('/modules/'.length)}`, import.meta.url),
          'utf8',
        )
        response.writeHead(200, { 'Content-Type': 'text/javascript' })
        response.end(stripTypeScriptTypes(source, { mode: 'transform' }))
      } else if (path === '/redirect') {
        response.writeHead(302, { Location: '/pages/destination' })
        response.end()
      } else if (path === '/pages/destination') {
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
        response.end(
          source === 'link'
            ? '<base href="../images/"><link rel="preload" as="image" imagesrcset="small.svg 400w, large.svg 1200w" imagesizes="100vw"><img src="ignored.svg">'
            : '<base href="../images/"><img src="fallback.svg" srcset="small.svg 400w, large.svg 1200w" sizes="100vw" data-prefetch><img src="ignored.svg">',
        )
      } else if (path.endsWith('.svg')) {
        images.push(path)
        response.writeHead(200, {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        })
        response.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>',
        )
      } else {
        response.writeHead(200, { 'Content-Type': 'text/html' })
        response.end(`<!doctype html><html><head></head><body><button id="start">Prefetch</button>
          <script type="module">
            import { run, prefetch } from '/modules/index.ts'
            let supports = DOMTokenList.prototype.supports
            DOMTokenList.prototype.supports = function(token) { return token === 'prefetch' ? false : supports.call(this, token) }
            let app = run({ loadModule: () => {}, prefetch: {
              assets: { scheduler(batch, { fragment }) { return [...batch, ...fragment.querySelectorAll('img[data-prefetch]')] } }
            } })
            document.querySelector('#start').onclick = () => prefetch('/redirect')
            await app.ready()
            document.body.dataset.ready = 'true'
          </script></body></html>`)
      }
    })().catch((error) => {
      response.writeHead(500)
      response.end(String(error))
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  let address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing image fixture port')
  let page = await t.serve({
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  })
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.ready === 'true')
  return { page, images }
}

describe('responsive image prefetch', () => {
  it('selects the small relative candidate without downloading the fallback at a narrow viewport', async (t) => {
    let { page, images } = await serveImages(t, 350)
    let loaded = page.waitForResponse((response) => response.url().endsWith('/images/small.svg'))
    await page.click('#start')
    await (await loaded).finished()
    await page.waitForFunction(() => !document.querySelector('link[rel="preload"][as="image"]'))
    expect(images).toEqual(['/images/small.svg'])
    // Matching image declarations reuse the preloaded response without a fallback request.
    await page.evaluate(() => {
      let image = document.createElement('img')
      image.sizes = '100vw'
      image.srcset = '/images/small.svg 400w, /images/large.svg 1200w'
      image.src = '/images/fallback.svg'
      document.body.append(image)
    })
    await page.waitForFunction(() => document.querySelector('img')?.complete)
    expect(images).toEqual(['/images/small.svg'])
  })

  it('preloads the large relative candidate from a declaration without href at a wide viewport', async (t) => {
    let { page, images } = await serveImages(t, 1050, 'link')
    let loaded = page.waitForResponse((response) => response.url().endsWith('/images/large.svg'))
    await page.click('#start')
    await (await loaded).finished()
    await page.waitForFunction(() => !document.querySelector('link[rel="preload"][as="image"]'))
    expect(images).toEqual(['/images/large.svg'])
  })
})
