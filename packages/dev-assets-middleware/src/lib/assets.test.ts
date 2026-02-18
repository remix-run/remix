import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { createRouter } from '@remix-run/fetch-router'

import { createDevAssets } from './assets.ts'

describe('createDevAssets', () => {
  it('returns an object with middleware and close()', () => {
    let devAssets = createDevAssets({ allow: ['**'] })
    assert.equal(typeof devAssets.middleware, 'function')
    assert.equal(typeof devAssets.close, 'function')
  })

  it('generates .dev.ts files for configured script entries on startup', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-script-codegen-'))
    let appDir = path.join(tmpDir, 'app')
    fs.mkdirSync(appDir, { recursive: true })
    fs.writeFileSync(path.join(appDir, 'entry.tsx'), 'export default function App() {}')

    let devAssets = createDevAssets({
      root: tmpDir,
      allow: ['app/**'],
      scripts: ['app/entry.tsx'],
    })
    try {
      let router = createRouter({
        middleware: [devAssets.middleware, async (_ctx, _next) => new Response('ok')],
      })
      // First request awaits codegenInit, ensuring the initial codegen pass has run
      await router.fetch(new Request('http://localhost/'))

      let devFilePath = path.join(tmpDir, '.assets', 'app', 'entry.tsx.dev.ts')
      let content = fs.readFileSync(devFilePath, 'utf-8')
      assert.ok(
        content.includes("export const href = '/app/entry.tsx'"),
        `Expected dev URL in generated .dev.ts, got:\n${content}`,
      )
    } finally {
      devAssets.close()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('does not generate script .dev.ts files when scripts option is omitted', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-no-script-codegen-'))
    let appDir = path.join(tmpDir, 'app')
    let imagesDir = path.join(appDir, 'images')
    fs.mkdirSync(imagesDir, { recursive: true })
    fs.writeFileSync(path.join(appDir, 'entry.tsx'), 'export default function App() {}')
    fs.writeFileSync(path.join(imagesDir, 'logo.png'), 'fake-png')

    // files is provided (triggering codegenWatch) but scripts is intentionally omitted
    let devAssets = createDevAssets({
      root: tmpDir,
      allow: ['app/**'],
      files: [{ include: 'app/images/**/*.png' }],
    })
    try {
      let router = createRouter({
        middleware: [devAssets.middleware, async (_ctx, _next) => new Response('ok')],
      })
      await router.fetch(new Request('http://localhost/'))

      let scriptDevFile = path.join(tmpDir, '.assets', 'app', 'entry.tsx.dev.ts')
      assert.ok(
        !fs.existsSync(scriptDevFile),
        'entry.tsx.dev.ts should not be generated when scripts option is omitted',
      )
    } finally {
      devAssets.close()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('auto-allows the default codegenDir (.assets) so browsers can fetch .dev.ts files', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-codegen-allow-'))
    try {
      let assetsDir = path.join(tmpDir, '.assets', 'app')
      await fsp.mkdir(assetsDir, { recursive: true })
      await fsp.writeFile(path.join(assetsDir, 'logo.dev.ts'), "export default '/dev-url'\n")

      let router = createRouter({
        middleware: [
          createDevAssets({
            root: tmpDir,
            allow: ['app/**'],
            // Intentionally omit .assets/** — should be auto-allowed
          }).middleware,
        ],
      })

      let response = await router.fetch(new Request('http://localhost/.assets/app/logo.dev.ts'))
      assert.equal(
        response.status,
        200,
        'codegenDir should be auto-allowed even when not in allow option',
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('auto-allows a custom codegenDir when specified', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-codegen-custom-'))
    try {
      let assetsDir = path.join(tmpDir, 'custom-assets', 'app')
      await fsp.mkdir(assetsDir, { recursive: true })
      await fsp.writeFile(path.join(assetsDir, 'logo.dev.ts'), "export default '/dev-url'\n")

      let router = createRouter({
        middleware: [
          createDevAssets({
            root: tmpDir,
            allow: ['app/**'],
            codegenDir: 'custom-assets',
          }).middleware,
        ],
      })

      let response = await router.fetch(
        new Request('http://localhost/custom-assets/app/logo.dev.ts'),
      )
      assert.equal(response.status, 200, 'custom codegenDir should be auto-allowed')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
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
          createDevAssets({
            root: appDir,
            allow: ['**/*.ts'],
          }).middleware,
          async (context, _next) => {
            nextCalled = true
            let entry = context.assets.resolve('entry.ts')
            assert.deepEqual(entry, { href: '/entry.ts', preloads: ['/entry.ts'] })
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

  it('exposes script entries via context.assets.resolve() when files config is not provided', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-context-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), 'export let value = "hello"')

      let router = createRouter({
        middleware: [
          createDevAssets({
            root: appDir,
            allow: ['**/*.ts'],
          }).middleware,
          async (context, _next) => {
            let entry = context.assets.resolve('entry.ts')
            let withVariant = context.assets.resolve('entry.ts', 'thumbnail' as never)
            return Response.json({ entry, withVariant })
          },
        ],
      })

      let response = await router.fetch(new Request('http://localhost/not-served.ts'))
      let json = await response.json()
      assert.deepEqual(json.entry, { href: '/entry.ts', preloads: ['/entry.ts'] })
      assert.equal(json.withVariant, null)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('exposes file entries via context.assets.resolve() when files config is provided', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-context-'))
    let appDir = path.join(tmpDir, 'app')
    let imagesDir = path.join(appDir, 'images')
    await fsp.mkdir(imagesDir, { recursive: true })
    await fsp.writeFile(path.join(imagesDir, 'logo.png'), 'fake-png')

    let devAssets = createDevAssets({
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
    })
    try {
      let router = createRouter({
        middleware: [
          devAssets.middleware,
          async (context, _next) => {
            let defaultVariant = context.assets.resolve('images/logo.png')
            let thumbVariant = context.assets.resolve('images/logo.png', 'thumb')
            let missingVariant = context.assets.resolve('images/logo.png', 'missing' as never)
            return Response.json({ defaultVariant, thumbVariant, missingVariant })
          },
        ],
      })

      let response = await router.fetch(new Request('http://localhost/not-served.ts'))
      let json = await response.json()
      assert.deepEqual(json.defaultVariant, {
        href: '/__@files/images/logo.png?@card',
        preloads: [],
      })
      assert.deepEqual(json.thumbVariant, {
        href: '/__@files/images/logo.png?@thumb',
        preloads: [],
      })
      assert.equal(json.missingVariant, null)
    } finally {
      devAssets.close()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('serves and transforms a file when using createRouter + createDevAssets', async () => {
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
          createDevAssets({
            root: appDir,
            allow: ['**'],
          }).middleware,
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
          createDevAssets({
            root: appDir,
            allow: ['**/*.ts'],
          }).middleware,
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
          createDevAssets({ root: appDir, allow: ['**'] }).middleware,
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
          createDevAssets({
            root: appDir,
            allow: ['**/*.ts'],
            deny: ['**/secret.ts'],
          }).middleware,
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
          createDevAssets({
            root: appDir,
            allow: ['**/*.ts'],
            workspaceRoot: tmpDir,
            workspaceAllow: ['packages/**'],
            workspaceDeny: ['**/blocked.ts'],
          }).middleware,
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
          createDevAssets({
            root: appDir,
            allow: ['**/*.ts'],
            external: ['react'],
          }).middleware,
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
          createDevAssets({
            root: appDir,
            allow: ['**/*.ts'],
            sourcemap: false,
          }).middleware,
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
