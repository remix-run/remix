import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'

import { createAssetServer } from '../src/assets.ts'
import type { TestContext } from '@remix-run/test'

describe('authored asset imports', () => {
  it('loads authored and generated imports using import maps', async (t) => {
    await assertAuthoredImports(t, { importMaps: true })
  })

  it('loads authored and generated imports using rewritten URLs', async (t) => {
    await assertAuthoredImports(t, { importMaps: false })
  })
})

async function assertAuthoredImports(
  t: TestContext,
  options: { importMaps: boolean },
): Promise<void> {
  let rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-authored-imports-'))
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }))
  let packageDir = path.join(rootDir, 'node_modules/@oxc-project/runtime')
  await fs.mkdir(path.join(packageDir, 'src/helpers/esm'), { recursive: true })
  await fs.writeFile(
    path.join(packageDir, 'package.json'),
    JSON.stringify({ name: '@oxc-project/runtime' }),
  )
  await fs.writeFile(
    path.join(packageDir, 'src/helpers/esm/classPrivateMethodInitSpec.js'),
    'export default "authored"',
  )
  await fs.writeFile(
    path.join(rootDir, 'entry.ts'),
    `
      import helper from '@oxc-project/runtime/src/helpers/esm/classPrivateMethodInitSpec.js'
      export { helper }
      export { default as reexported } from '@oxc-project/runtime/src/helpers/esm/classPrivateMethodInitSpec.js'
      export async function loadHelper() {
        return (await import('@oxc-project/runtime/src/helpers/esm/classPrivateMethodInitSpec.js')).default
      }
      export class Example {
        #value = 1
        #read() { return this.#value }
        value() { return this.#read() }
      }
    `,
  )
  let assets = createAssetServer({
    rootDir,
    basePath: '/assets',
    mounts: { app: '.' },
    allowFiles: ['**'],
    target: { es: '2020' },
    fingerprint: true,
    importMaps: options.importMaps,
    watch: false,
  })
  t.after(() => assets.close())
  let entry = await assets.getScriptEntry('entry.ts')
  let server = http.createServer(async (request, response) => {
    try {
      let url = new URL(request.url ?? '/', `http://${request.headers.host}`)
      let assetResponse = await assets.fetch(new Request(url))
      if (assetResponse) {
        response.writeHead(assetResponse.status, Object.fromEntries(assetResponse.headers))
        response.end(new Uint8Array(await assetResponse.arrayBuffer()))
        return
      }
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end(`<!doctype html><html><head>
          ${options.importMaps ? `<script type="importmap">${JSON.stringify(entry.importMap)}</script>` : ''}
          </head><body><script type="module">
          import { helper, reexported, loadHelper, Example } from '${entry.href}'
          document.body.textContent = [helper, reexported, await loadHelper(), new Example().value()].join(':')
          document.body.dataset.ready = 'true'
          </script></body></html>`)
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
  await page.locator('body[data-ready="true"]').waitFor()
  assert.equal(await page.locator('body').textContent(), 'authored:authored:authored:1')
}
