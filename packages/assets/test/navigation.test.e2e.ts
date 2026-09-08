import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'

import { createAssetServer } from '../src/assets.ts'

const workspaceDir = path.resolve(import.meta.dirname, '../../..')

describe('asset import maps during navigation', () => {
  it('loads a fresh document at the destination after a dependency changes', async (t) => {
    let temporaryDir = path.join(workspaceDir, '.tmp')
    await fs.mkdir(temporaryDir, { recursive: true })
    let fixtureDir = await fs.mkdtemp(path.join(temporaryDir, 'import-map-navigation-'))
    t.after(() => fs.rm(fixtureDir, { recursive: true, force: true }))
    await fs.writeFile(path.join(fixtureDir, 'shared.ts'), 'export let version = "A"')
    await fs.writeFile(
      path.join(fixtureDir, 'entry.ts'),
      `
      import { run } from '../../packages/ui/src/index.ts'
      import { version } from './shared.ts'
      let app = run({ loadModule: (href) => import(href) })
      await app.ready()
      document.body.dataset.version = version
    `,
    )
    function createAssets() {
      return createAssetServer({
        rootDir: workspaceDir,
        basePath: '/assets',
        mounts: { app: path.relative(workspaceDir, fixtureDir), ui: 'packages/ui/src' },
        allowFiles: [path.relative(workspaceDir, fixtureDir) + '/**', 'packages/ui/src/**'],
        fingerprint: true,
        watch: false,
      })
    }
    let assets = createAssets()
    t.after(() => assets.close())
    let documents: string[] = []
    let frames: string[] = []
    let server = http.createServer(async (request, response) => {
      try {
        let url = new URL(request.url ?? '/', `http://${request.headers.host}`)
        let assetResponse = await assets.fetch(new Request(url))
        if (assetResponse) {
          response.writeHead(assetResponse.status, Object.fromEntries(assetResponse.headers))
          response.end(new Uint8Array(await assetResponse.arrayBuffer()))
          return
        }
        if (url.pathname === '/favicon.ico') {
          response.writeHead(204).end()
          return
        }
        let isFrame = request.headers['sec-fetch-dest'] !== 'document'
        ;(isFrame ? frames : documents).push(url.pathname)
        let entry = await assets.getScriptEntry(path.join(fixtureDir, 'entry.ts'))
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
        response.end(`<!doctype html><html><head>
          <script data-rmx-import-map type="importmap">${JSON.stringify(entry.importMap)}</script>
          <script type="module" src="${entry.href}"></script>
          </head><body><a href="/next">Next</a><input value="fresh"></body></html>`)
      } catch (error) {
        response.writeHead(500).end(String(error))
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    let address = server.address()
    assert.ok(address && typeof address === 'object')
    let page = await t.serve({
      baseUrl: `http://127.0.0.1:${address.port}`,
      close: () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        }),
    })
    await page.goto('/')
    await page.locator('body[data-version="A"]').waitFor()
    await page.locator('input').fill('keep until reload')
    await assets.close()
    await fs.writeFile(path.join(fixtureDir, 'shared.ts'), 'export let version = "B"')
    assets = createAssets()

    await page.getByRole('link', { name: 'Next' }).click()
    await page.locator('body[data-version="B"]').waitFor()

    assert.equal(new URL(page.url()).pathname, '/next')
    assert.equal(await page.locator('input').inputValue(), 'fresh')
    assert.deepEqual(documents, ['/', '/next'], JSON.stringify({ documents, frames }))
    assert.deepEqual(frames, ['/next'], JSON.stringify({ documents, frames }))
  })
})
