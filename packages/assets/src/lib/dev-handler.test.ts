import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { createDevAssetsHandler } from './dev-handler.ts'

describe('allow/deny security', () => {
  let tempDir: string
  let workspaceDir: string

  function setupDirs() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-test-'))
    fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'app', 'entry.ts'), 'export {}')
    fs.writeFileSync(path.join(tempDir, 'server.ts'), 'export {}')
    fs.writeFileSync(path.join(tempDir, '.env'), 'SECRET=foo')

    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-test-'))
    fs.mkdirSync(path.join(workspaceDir, 'node_modules', 'pkg'), { recursive: true })
    fs.mkdirSync(path.join(workspaceDir, 'packages', 'lib'), { recursive: true })
    fs.writeFileSync(path.join(workspaceDir, 'node_modules', 'pkg', 'index.js'), 'export {}')
    fs.writeFileSync(path.join(workspaceDir, 'packages', 'lib', 'index.ts'), 'export {}')
    fs.writeFileSync(path.join(workspaceDir, '.env'), 'SECRET=bar')
  }

  function cleanupDirs() {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    if (workspaceDir) fs.rmSync(workspaceDir, { recursive: true, force: true })
  }

  describe('app root security', () => {
    it('returns 403 when no allow patterns configured', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({ root: tempDir, allow: [] })
        let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.ts'))

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('returns null for requests without /__@assets/ scope', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({ root: tempDir, allow: ['app/**'] })
        let response = await handler.serve(new Request('http://localhost/app/entry.ts'))

        assert.equal(response, null, 'bare paths should not be served — must use /__@assets/ scope')
      } finally {
        cleanupDirs()
      }
    })

    it('allows requests matching allow patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({ root: tempDir, allow: ['app/**'] })
        let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.ts'))

        assert.ok(response)
        assert.equal(response!.status, 200)
        assert.ok(response!.headers.get('content-type')?.includes('javascript'))
      } finally {
        cleanupDirs()
      }
    })

    it('returns 403 for requests not matching allow patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({ root: tempDir, allow: ['app/**'] })
        let response = await handler.serve(new Request('http://localhost/__@assets/server.ts'))

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('returns 403 for requests matching deny patterns', async () => {
      setupDirs()
      fs.writeFileSync(path.join(tempDir, 'secret.ts'), 'export let SECRET = "foo"')

      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['**'],
          deny: ['secret.ts'],
        })
        let response = await handler.serve(new Request('http://localhost/__@assets/secret.ts'))

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('deny takes precedence over allow', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['**'],
          deny: ['server.ts'],
        })
        let response = await handler.serve(new Request('http://localhost/__@assets/server.ts'))

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })
  })

  describe('workspace security', () => {
    it('blocks workspace requests when not configured', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
        })
        let response = await handler.serve(
          new Request('http://localhost/__@assets/__@workspace/node_modules/pkg/index.js'),
        )

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('allows workspace requests matching workspaceAllow patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          workspaceRoot: workspaceDir,
          workspaceAllow: ['**/node_modules/**'],
        })
        let response = await handler.serve(
          new Request('http://localhost/__@assets/__@workspace/node_modules/pkg/index.js'),
        )

        assert.ok(response)
        assert.equal(response!.status, 200)
      } finally {
        cleanupDirs()
      }
    })

    it('blocks workspace requests not matching workspaceAllow patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          workspaceRoot: workspaceDir,
          workspaceAllow: ['**/node_modules/**'],
        })
        let response = await handler.serve(
          new Request('http://localhost/__@assets/__@workspace/packages/lib/index.ts'),
        )

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('workspaceDeny defaults to top-level deny', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          deny: ['**/.env*'],
          workspaceRoot: workspaceDir,
          workspaceAllow: ['**'],
        })
        let response = await handler.serve(
          new Request('http://localhost/__@assets/__@workspace/.env'),
        )

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('workspaceDeny overrides default and can add workspace-specific rules', async () => {
      setupDirs()
      fs.writeFileSync(path.join(workspaceDir, 'test.ts'), 'export {}')

      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          deny: ['**/.env*'],
          workspaceRoot: workspaceDir,
          workspaceAllow: ['**'],
          workspaceDeny: ['**/.env*', '**/test.ts'],
        })

        let response1 = await handler.serve(
          new Request('http://localhost/__@assets/__@workspace/test.ts'),
        )
        assert.ok(response1)
        assert.equal(response1!.status, 403, 'Should block workspace-specific deny pattern')

        let response2 = await handler.serve(
          new Request('http://localhost/__@assets/__@workspace/.env'),
        )
        assert.ok(response2)
        assert.equal(response2!.status, 403, 'Should block inherited deny pattern')
      } finally {
        cleanupDirs()
      }
    })
  })
})

describe('esbuild config support', () => {
  let tempDir: string

  function setupTempDir() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbuild-config-test-'))
    fs.mkdirSync(path.join(tempDir, 'app'))
    fs.writeFileSync(
      path.join(tempDir, 'app', 'entry.tsx'),
      `import { message } from './message.txt'\nexport default function App() { return message }`,
    )
    fs.writeFileSync(path.join(tempDir, 'app', 'message.txt'), 'Hello from txt!')
    fs.writeFileSync(path.join(tempDir, 'app', 'other.tsx'), 'export default function Other() {}')
    fs.writeFileSync(
      path.join(tempDir, 'app', 'with-import.tsx'),
      `import { foo } from './foo'\nexport { foo }`,
    )
    fs.writeFileSync(path.join(tempDir, 'app', 'foo.ts'), 'export let foo = 123')
  }

  function cleanupTempDir() {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  }

  describe('default behavior', () => {
    it('serves standard file types without custom config', async () => {
      setupTempDir()
      fs.writeFileSync(path.join(tempDir, 'app', 'simple.ts'), 'export const x = 1')

      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
        })

        let response = await handler.serve(new Request('http://localhost/__@assets/app/simple.ts'))
        assert.ok(response)
        assert.equal(response!.status, 200)
        let text = await response!.text()
        assert.ok(text.includes('x') || text.includes('export'))
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('config override behavior', () => {
    it('serves ESM (import/from, not CommonJS)', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
        })

        let response = await handler.serve(
          new Request('http://localhost/__@assets/app/with-import.tsx'),
        )

        assert.ok(response)
        assert.equal(response!.status, 200)
        let text = await response!.text()

        assert.ok(
          text.includes('import') || text.includes('from'),
          'Should maintain imports (unbundled)',
        )
        assert.ok(!text.includes('exports.'), 'Should not use CommonJS exports')
        assert.ok(!text.includes('module.exports'), 'Should not use module.exports')
      } finally {
        cleanupTempDir()
      }
    })

    it('honors sourcemap: false', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          sourcemap: false,
        })

        let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))

        assert.ok(response)
        assert.equal(response!.status, 200)
        let text = await response!.text()
        assert.ok(!text.includes('sourceMappingURL'), 'Should not include source map')
      } finally {
        cleanupTempDir()
      }
    })

    it('includes inline source map when sourcemap: true (default)', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          sourcemap: true,
        })

        let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))

        assert.ok(response)
        assert.equal(response!.status, 200)
        let text = await response!.text()
        assert.ok(
          text.includes('sourceMappingURL=data:application/json;base64,'),
          'Should have inline source map',
        )
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('external imports', () => {
    it('leaves HTTP/HTTPS URLs unchanged when in external config', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          external: ['https://unpkg.com/@remix-run/component'],
        })

        await fsp.writeFile(
          path.join(tempDir, 'app', 'entry.tsx'),
          `import { createRoot } from 'https://unpkg.com/@remix-run/component'
import { helper } from './utils.ts'

let root = createRoot(document.getElementById('app')!)
console.log(root, helper)
root.render(<div>Hello</div>)`,
        )
        await fsp.writeFile(
          path.join(tempDir, 'app', 'utils.ts'),
          'export function helper() { return "helper" }',
        )

        let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))

        assert.ok(response)
        assert.equal(response!.status, 200)
        let code = await response!.text()
        assert.ok(
          code.includes('https://unpkg.com/@remix-run/component'),
          'should preserve CDN URL',
        )
        assert.ok(code.includes('/__@assets/app/utils.ts'), 'should rewrite relative import')
      } finally {
        cleanupTempDir()
      }
    })

    it('skips bare specifiers matching external patterns (strings)', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          external: ['@remix-run/component'],
        })

        await fsp.writeFile(
          path.join(tempDir, 'app', 'entry.tsx'),
          `import { createRoot } from '@remix-run/component'
import { helper } from './utils.ts'

export function createApp() {
  let root = createRoot(document.body)
  console.log(root, helper)
  root.render(<div>Hello</div>)
  return { root }
}`,
        )
        await fsp.writeFile(
          path.join(tempDir, 'app', 'utils.ts'),
          'export function helper() { return "helper" }',
        )

        let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))

        assert.ok(response)
        assert.equal(response!.status, 200)
        let code = await response!.text()
        assert.ok(
          code.includes("'@remix-run/component'") || code.includes('"@remix-run/component"'),
          'should preserve @remix-run/component import',
        )
        assert.ok(code.includes('/__@assets/app/utils.ts'), 'should rewrite relative import')
      } finally {
        cleanupTempDir()
      }
    })

    it('skips multiple bare specifiers when all listed in external', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          external: ['@external/package', '@external/another'],
        })

        await fsp.writeFile(
          path.join(tempDir, 'app', 'entry.tsx'),
          `import { foo } from '@external/package'
import { bar } from '@external/another'
import { helper } from './utils.ts'
console.log(foo, bar, helper)
export { foo, bar, helper }`,
        )
        await fsp.writeFile(
          path.join(tempDir, 'app', 'utils.ts'),
          'export function helper() { return "helper" }',
        )

        let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))

        assert.ok(response)
        assert.equal(response!.status, 200)
        let code = await response!.text()
        assert.ok(
          code.includes("'@external/package'") || code.includes('"@external/package"'),
          'should preserve @external/package import',
        )
        assert.ok(
          code.includes("'@external/another'") || code.includes('"@external/another"'),
          'should preserve @external/another import',
        )
        assert.ok(code.includes('/__@assets/app/utils.ts'), 'should rewrite relative import')
      } finally {
        cleanupTempDir()
      }
    })

    it('works for both static and dynamic imports', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          external: ['@external/package'],
        })

        await fsp.writeFile(
          path.join(tempDir, 'app', 'entry.tsx'),
          `import { foo } from '@external/package'
const dynamicExternal = import('@external/package')
import { helper } from './utils.ts'
const dynamicHelper = import('./utils.ts')
console.log(foo, helper)
export { foo, dynamicExternal, helper, dynamicHelper }`,
        )
        await fsp.writeFile(
          path.join(tempDir, 'app', 'utils.ts'),
          'export function helper() { return "helper" }',
        )

        let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))

        assert.ok(response)
        assert.equal(response!.status, 200)
        let code = await response!.text()
        let externalMatches = code.match(/['"]@external\/package['"]/g)
        assert.equal(externalMatches?.length, 2, 'should preserve both @external/package imports')
        let utilsMatches = code.match(/\/__@assets\/app\/utils\.ts/g)
        assert.equal(utilsMatches?.length, 2, 'should rewrite both relative imports')
      } finally {
        cleanupTempDir()
      }
    })
  })
})

describe('#assets/ import resolution', () => {
  it('rewrites #assets/ imports using the placeholder condition, not the default', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-conditions-'))
    try {
      let appDir = path.join(tmpDir)
      let srcDir = path.join(appDir, 'app')
      let assetsDir = path.join(appDir, '.assets', 'app', 'images')
      await fsp.mkdir(srcDir, { recursive: true })
      await fsp.mkdir(assetsDir, { recursive: true })

      await fsp.writeFile(
        path.join(assetsDir, 'logo.placeholder.ts'),
        "export default '/__@assets/dev-url'\n",
      )
      await fsp.writeFile(path.join(assetsDir, 'logo.build.ts'), "export default '/build-url'\n")
      await fsp.writeFile(
        path.join(appDir, 'package.json'),
        JSON.stringify({
          name: 'app',
          type: 'module',
          imports: {
            '#assets/*': {
              placeholder: './.assets/*.placeholder.ts',
              default: './.assets/*.build.ts',
            },
          },
        }),
      )
      await fsp.writeFile(
        path.join(srcDir, 'entry.ts'),
        "import logoUrl from '#assets/app/images/logo'; export { logoUrl }",
      )

      let handler = createDevAssetsHandler({
        root: appDir,
        allow: ['app/**', '.assets/**'],
      })

      let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.ts'))
      assert.ok(response)
      assert.equal(response!.status, 200)
      let code = await response!.text()

      assert.ok(
        code.includes('.placeholder.ts'),
        `Expected import rewritten to .placeholder.ts with placeholder condition, got:\n${code}`,
      )
      assert.ok(
        !code.includes('.build.ts'),
        `Expected no .build.ts import in dev mode, got:\n${code}`,
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('module graph integration', () => {
  let tempDir: string

  function setupTempDir() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-graph-test-'))
    fs.mkdirSync(path.join(tempDir, 'app'))
  }

  function cleanupTempDir() {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  }

  describe('transform caching', () => {
    it('caches transforms and reuses them on subsequent requests', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
        })

        await fsp.writeFile(
          path.join(tempDir, 'app', 'entry.tsx'),
          `import { helper } from './utils.ts'
export function main() {
  console.log(helper())
}`,
        )
        await fsp.writeFile(
          path.join(tempDir, 'app', 'utils.ts'),
          'export function helper() { return "v1" }',
        )

        let response1 = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))
        assert.ok(response1)
        assert.equal(response1!.status, 200)
        let code1 = await response1!.text()
        assert.ok(code1.includes('main'))

        let response2 = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))
        assert.ok(response2)
        assert.equal(response2!.status, 200)
        let code2 = await response2!.text()
        assert.equal(code1, code2)

        await fsp.writeFile(
          path.join(tempDir, 'app', 'entry.tsx'),
          `import { helper } from './utils.ts'
export function main() {
  console.log(helper())
  console.log("v2")
}`,
        )

        let response3 = await handler.serve(new Request('http://localhost/__@assets/app/entry.tsx'))
        assert.ok(response3)
        assert.equal(response3!.status, 200)
        let code3 = await response3!.text()
        assert.notEqual(code1, code3)
        assert.ok(code3.includes('v2'))
      } finally {
        cleanupTempDir()
      }
    })
  })
})

describe('file asset routing', () => {
  it('routes to file handler when path matches a file rule, even without a ?@variant query param (defaultVariant case)', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-asset-routing-'))
    try {
      let appDir = path.join(tmpDir, 'app', 'images')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(path.join(appDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

      let handler = createDevAssetsHandler({
        root: tmpDir,
        allow: ['app/**'],
        source: {
          files: [
            {
              include: 'app/images/**/*.png',
              defaultVariant: 'webp',
              variants: {
                webp: (data) => data,
              },
            },
          ],
        },
      })

      // No ?@variant — handler must consult file rules, not just check for query params
      let response = await handler.serve(
        new Request('http://localhost/__@assets/app/images/logo.png'),
      )

      assert.ok(response)
      // Would be a transform error or 500 if routed to the script handler (not valid JS)
      assert.notEqual(response!.status, 500, 'must not be routed to the script handler')
      assert.ok(
        response!.status === 200 || response!.status === 404,
        `expected 200 or 404 from file handler, got ${response!.status}`,
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('does not treat a JS file as a file asset just because a file rule with variants exists for other paths', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-asset-routing-no-match-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      await fsp.mkdir(appDir, { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), 'export const x = 1')

      let handler = createDevAssetsHandler({
        root: tmpDir,
        allow: ['app/**'],
        source: {
          files: [
            {
              include: 'app/images/**/*.png',
              variants: { webp: (data) => data },
            },
          ],
        },
      })

      // entry.ts does not match the file rule — must be routed to the script handler
      let response = await handler.serve(new Request('http://localhost/__@assets/app/entry.ts'))

      assert.ok(response)
      assert.equal(response!.status, 200)
      assert.ok(response!.headers.get('content-type')?.includes('javascript'))
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('file asset ETag behavior', () => {
  let tempDir: string

  function setupTempDir() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-asset-etag-test-'))
    fs.mkdirSync(path.join(tempDir, 'app', 'images'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'app', 'images', 'logo.txt'), 'logo')
  }

  function cleanupTempDir() {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  }

  it('does not return 304 before first transform hash is known', async () => {
    setupTempDir()
    try {
      let handler = createDevAssetsHandler({
        root: tempDir,
        allow: ['app/**'],
        source: {
          files: [
            {
              include: 'app/images/**/*.txt',
              variants: {
                card: (data) => data,
              },
            },
          ],
        },
      })

      let response = await handler.serve(
        new Request('http://localhost/__@assets/app/images/logo.txt?@card', {
          headers: { 'If-None-Match': 'W/"definitely-not-a-match"' },
        }),
      )

      assert.ok(response)
      assert.equal(response!.status, 200)
      assert.ok(response!.headers.get('ETag'))
    } finally {
      cleanupTempDir()
    }
  })

  it('recomputes transform hash after handler restart before responding 304', async () => {
    setupTempDir()
    let transformRuns = 0
    try {
      let files = [
        {
          include: 'app/images/**/*.txt',
          variants: {
            card: (data: Buffer) => {
              transformRuns++
              return data
            },
          },
        },
      ]

      let handler1 = createDevAssetsHandler({
        root: tempDir,
        allow: ['app/**'],
        source: { files },
      })

      let response1 = await handler1.serve(
        new Request('http://localhost/__@assets/app/images/logo.txt?@card'),
      )
      assert.ok(response1)
      assert.equal(response1!.status, 200)
      let etag = response1!.headers.get('ETag')
      assert.ok(etag)
      assert.equal(transformRuns, 1)

      // New handler instance simulates a server restart with empty in-memory hashes.
      let handler2 = createDevAssetsHandler({
        root: tempDir,
        allow: ['app/**'],
        source: { files },
      })
      let response2 = await handler2.serve(
        new Request('http://localhost/__@assets/app/images/logo.txt?@card', {
          headers: { 'If-None-Match': etag! },
        }),
      )
      assert.ok(response2)
      assert.equal(response2!.status, 304)
      assert.equal(transformRuns, 2)
    } finally {
      cleanupTempDir()
    }
  })
})
