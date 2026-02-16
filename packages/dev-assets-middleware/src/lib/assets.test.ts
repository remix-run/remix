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
  it('sets context.assets before calling next()', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-context-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), 'export let value = "hello"')

      let nextCalled = false
      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**/*.ts'],
          }),
          async (context, _next) => {
            nextCalled = true
            let entry = context.assets.get('entry.ts')
            assert.deepEqual(entry, { href: '/entry.ts', chunks: ['/entry.ts'] })
            return new Response('next-called')
          },
        ],
      })

      let response = await router.fetch(new Request('http://localhost/not-served.ts'))
      assert.equal(nextCalled, true)
      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'next-called')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('exposes script entries via context.assets.get() when files config is not provided', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-context-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), 'export let value = "hello"')

      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**/*.ts'],
          }),
          async (context, _next) => {
            let entry = context.assets.get('entry.ts')
            let withVariant = context.assets.get('entry.ts', 'thumbnail' as never)
            return Response.json({ entry, withVariant })
          },
        ],
      })

      let response = await router.fetch(new Request('http://localhost/not-served.ts'))
      let json = await response.json()
      assert.deepEqual(json.entry, { href: '/entry.ts', chunks: ['/entry.ts'] })
      assert.equal(json.withVariant, null)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('exposes file entries via context.assets.get() when files config is provided', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-context-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      let imagesDir = path.join(appDir, 'images')
      await fsp.mkdir(imagesDir, { recursive: true })
      await fsp.writeFile(path.join(imagesDir, 'logo.png'), 'fake-png')

      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**/*'],
            files: [
              {
                include: 'images/**/*.png',
                variants: {
                  card(data) {
                    return data
                  },
                  thumb(data) {
                    return data
                  },
                },
                defaultVariant: 'card',
              },
            ],
          }),
          async (context, _next) => {
            let defaultVariant = context.assets.get('images/logo.png')
            let thumbVariant = context.assets.get('images/logo.png', 'thumb')
            let missingVariant = context.assets.get('images/logo.png', 'missing' as never)
            return Response.json({ defaultVariant, thumbVariant, missingVariant })
          },
        ],
      })

      let response = await router.fetch(new Request('http://localhost/not-served.ts'))
      let json = await response.json()
      assert.deepEqual(json.defaultVariant, {
        href: '/__@files/images/logo.png?@card',
        chunks: ['/__@files/images/logo.png?@card'],
      })
      assert.deepEqual(json.thumbVariant, {
        href: '/__@files/images/logo.png?@thumb',
        chunks: ['/__@files/images/logo.png?@thumb'],
      })
      assert.equal(json.missingVariant, null)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

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

  it('returns createDevAssetsHandler response and does not call next()', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-wiring-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), 'export let value = "served"')

      let nextCalled = false
      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**/*.ts'],
          }),
          async (_context, _next) => {
            nextCalled = true
            return new Response('next')
          },
        ],
      })

      let response = await router.fetch(new Request('http://localhost/entry.ts'))
      assert.equal(response.status, 200)
      assert.equal(nextCalled, false)
      assert.ok((await response.text()).includes('served'))
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

  it('passes allow and deny options through to request handling', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-allow-deny-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), 'export let value = "allowed"')
      await fsp.writeFile(path.join(appDir, 'secret.ts'), 'export let value = "denied"')

      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**/*.ts'],
            deny: ['**/secret.ts'],
          }),
        ],
      })

      let allowed = await router.fetch(new Request('http://localhost/entry.ts'))
      assert.equal(allowed.status, 200)

      let denied = await router.fetch(new Request('http://localhost/secret.ts'))
      assert.equal(denied.status, 404)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('passes workspaceRoot/workspaceAllow/workspaceDeny options through to workspace requests', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-workspace-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      let packagesDir = path.join(tmpDir, 'packages')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.mkdir(packagesDir, { recursive: true })
      await fsp.writeFile(path.join(packagesDir, 'utils.ts'), 'export let value = "workspace"')
      await fsp.writeFile(path.join(packagesDir, 'blocked.ts'), 'export let value = "blocked"')

      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**/*.ts'],
            workspaceRoot: tmpDir,
            workspaceAllow: ['packages/**'],
            workspaceDeny: ['**/blocked.ts'],
          }),
        ],
      })

      let allowed = await router.fetch(
        new Request('http://localhost/__@workspace/packages/utils.ts'),
      )
      assert.equal(allowed.status, 200)

      let denied = await router.fetch(
        new Request('http://localhost/__@workspace/packages/blocked.ts'),
      )
      assert.equal(denied.status, 403)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('passes external option through and preserves configured external imports', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-external-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(
        path.join(appDir, 'entry.ts'),
        'import { createElement } from "react"; export let el = createElement("div")',
      )

      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**/*.ts'],
            external: ['react'],
          }),
        ],
      })

      let response = await router.fetch(new Request('http://localhost/entry.ts'))
      let body = await response.text()
      assert.equal(response.status, 200)
      assert.ok(
        body.includes('from "react"') || body.includes("from 'react'"),
        'expected external import to remain as bare specifier',
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('passes sourcemap option through and omits inline source maps when disabled', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-sourcemap-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), 'export let value: string = "no-map"')

      let router = createRouter({
        middleware: [
          devAssets({
            root: appDir,
            allow: ['**/*.ts'],
            sourcemap: false,
          }),
        ],
      })

      let response = await router.fetch(new Request('http://localhost/entry.ts'))
      let body = await response.text()
      assert.equal(response.status, 200)
      assert.equal(body.includes('sourceMappingURL=data:application/json;base64,'), false)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
