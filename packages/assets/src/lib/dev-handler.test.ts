import type { PluginBuild } from 'esbuild'
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
    it('blocks requests when no allow patterns configured', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({ root: tempDir, allow: [] })
        let response = await handler.serve('/app/entry.ts', new Headers())

        assert.equal(response, null, 'handler should not serve when no allow patterns')
      } finally {
        cleanupDirs()
      }
    })

    it('allows requests matching allow patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({ root: tempDir, allow: ['app/**'] })
        let response = await handler.serve('/app/entry.ts', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 200)
        assert.ok(response!.headers.get('content-type')?.includes('javascript'))
      } finally {
        cleanupDirs()
      }
    })

    it('blocks requests not matching allow patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({ root: tempDir, allow: ['app/**'] })
        let response = await handler.serve('/server.ts', new Headers())

        assert.equal(response, null, 'handler should not serve path outside allow')
      } finally {
        cleanupDirs()
      }
    })

    it('blocks requests matching deny patterns', async () => {
      setupDirs()
      fs.writeFileSync(path.join(tempDir, 'secret.ts'), 'export let SECRET = "foo"')

      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['**'],
          deny: ['secret.ts'],
        })
        let response = await handler.serve('/secret.ts', new Headers())

        assert.equal(response, null, 'handler should not serve path matching deny')
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
        let response = await handler.serve('/server.ts', new Headers())

        assert.equal(response, null, 'handler should not serve path matching deny')
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
        let response = await handler.serve('/__@workspace/node_modules/pkg/index.js', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('allows workspace requests matching allow patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          workspace: {
            root: workspaceDir,
            allow: ['**/node_modules/**'],
          },
        })
        let response = await handler.serve('/__@workspace/node_modules/pkg/index.js', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 200)
      } finally {
        cleanupDirs()
      }
    })

    it('blocks workspace requests not matching allow patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          workspace: {
            root: workspaceDir,
            allow: ['**/node_modules/**'],
          },
        })
        let response = await handler.serve('/__@workspace/packages/lib/index.ts', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('inherits top-level deny patterns', async () => {
      setupDirs()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          deny: ['**/.env*'],
          workspace: {
            root: workspaceDir,
            allow: ['**'],
          },
        })
        let response = await handler.serve('/__@workspace/.env', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('combines workspace deny with inherited deny', async () => {
      setupDirs()
      fs.writeFileSync(path.join(workspaceDir, 'test.ts'), 'export {}')

      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          deny: ['**/.env*'],
          workspace: {
            root: workspaceDir,
            allow: ['**'],
            deny: ['**/test.ts'],
          },
        })

        let response1 = await handler.serve('/__@workspace/test.ts', new Headers())
        assert.ok(response1)
        assert.equal(response1!.status, 403, 'Should block workspace-specific deny pattern')

        let response2 = await handler.serve('/__@workspace/.env', new Headers())
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

  describe('plugin support', () => {
    it('allows custom plugins for non-standard file types', async () => {
      setupTempDir()
      fs.writeFileSync(path.join(tempDir, 'app', 'config.data'), '{"key": "value"}')

      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          esbuildConfig: {
            plugins: [
              {
                name: 'data-loader',
                setup(build: PluginBuild) {
                  build.onLoad({ filter: /\.data$/ }, async (args) => {
                    let text = await fsp.readFile(args.path, 'utf-8')
                    return {
                      contents: `export default ${text}`,
                      loader: 'js',
                    }
                  })
                },
              },
            ],
          },
        })

        let response = await handler.serve('/app/config.data', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 200)
        let text = await response!.text()
        assert.ok(
          text.includes('export') || text.includes('default'),
          `Expected export in: ${text.slice(0, 200)}`,
        )
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('config override behavior', () => {
    it('maintains unbundled dev model even with user config', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          esbuildConfig: {
            bundle: true,
            write: true,
            format: 'cjs',
          } as Parameters<typeof createDevAssetsHandler>[0]['esbuildConfig'],
        })

        let response = await handler.serve('/app/with-import.tsx', new Headers())

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
          esbuildConfig: { sourcemap: false },
        })

        let response = await handler.serve('/app/entry.tsx', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 200)
        let text = await response!.text()
        assert.ok(!text.includes('sourceMappingURL'), 'Should not include source map')
      } finally {
        cleanupTempDir()
      }
    })

    it('coerces other sourcemap values to inline', async () => {
      setupTempDir()
      try {
        let handler = createDevAssetsHandler({
          root: tempDir,
          allow: ['app/**'],
          esbuildConfig: { sourcemap: 'external' as unknown as boolean },
        })

        let response = await handler.serve('/app/entry.tsx', new Headers())

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
          esbuildConfig: {
            external: ['https://unpkg.com/@remix-run/component'],
          },
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

        let response = await handler.serve('/app/entry.tsx', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 200)
        let code = await response!.text()
        assert.ok(
          code.includes('https://unpkg.com/@remix-run/component'),
          'should preserve CDN URL',
        )
        assert.ok(code.includes('/app/utils.ts'), 'should rewrite relative import')
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
          esbuildConfig: { external: ['@remix-run/component'] },
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

        let response = await handler.serve('/app/entry.tsx', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 200)
        let code = await response!.text()
        assert.ok(
          code.includes("'@remix-run/component'") || code.includes('"@remix-run/component"'),
          'should preserve @remix-run/component import',
        )
        assert.ok(code.includes('/app/utils.ts'), 'should rewrite relative import')
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
          esbuildConfig: { external: ['@external/package', '@external/another'] },
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

        let response = await handler.serve('/app/entry.tsx', new Headers())

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
        assert.ok(code.includes('/app/utils.ts'), 'should rewrite relative import')
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
          esbuildConfig: { external: ['@external/package'] },
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

        let response = await handler.serve('/app/entry.tsx', new Headers())

        assert.ok(response)
        assert.equal(response!.status, 200)
        let code = await response!.text()
        let externalMatches = code.match(/['"]@external\/package['"]/g)
        assert.equal(externalMatches?.length, 2, 'should preserve both @external/package imports')
        let utilsMatches = code.match(/\/app\/utils\.ts/g)
        assert.equal(utilsMatches?.length, 2, 'should rewrite both relative imports')
      } finally {
        cleanupTempDir()
      }
    })
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

        let response1 = await handler.serve('/app/entry.tsx', new Headers())
        assert.ok(response1)
        assert.equal(response1!.status, 200)
        let code1 = await response1!.text()
        assert.ok(code1.includes('main'))

        let response2 = await handler.serve('/app/entry.tsx', new Headers())
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

        let response3 = await handler.serve('/app/entry.tsx', new Headers())
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
