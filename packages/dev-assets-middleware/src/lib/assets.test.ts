import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { createRouter } from '@remix-run/fetch-router'

import { devAssets } from './assets.ts'

describe('devAssets middleware', () => {
  it('returns a function (middleware)', () => {
    let mw = devAssets({ allow: ['**'] })
    assert.equal(typeof mw, 'function')
  })
})

describe('middleware wiring', () => {
  it('serves and transforms a file when using createRouter + devAssets', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-wiring-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(
        path.join(appDir, 'entry.ts'),
        'export function greet(): string { return "hello" }',
      )

      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**'],
          }),
        ],
      })

      let request = new Request('http://localhost/entry.ts')
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      assert.ok(response.headers.get('content-type')?.includes('application/javascript'))
      let body = await response.text()
      assert.ok(body.includes('hello') || body.includes('greet'), 'Expected transformed code')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('calls next() when path is not served by assets (404 from later middleware)', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-wiring-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })

      let router = createRouter({
        middleware: [
          devAssets({ root: appDir, allow: ['**'] }),
          async (_context, _next) => new Response('not-found', { status: 404 }),
        ],
      })

      let request = new Request('http://localhost/nonexistent.ts')
      let response = await router.fetch(request)

      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'not-found')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
