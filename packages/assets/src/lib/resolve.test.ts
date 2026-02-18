import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import {
  resolvedPathToUrl,
  resolveSpecifiers,
  resolveSpecifiersToPaths,
  type ResolveContext,
} from './resolve.ts'

describe('resolvedPathToUrl', () => {
  it('uses workspace allow patterns (not app) for paths under workspace root', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-test-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      let workspacePkgDir = path.join(tmpDir, 'packages', 'pkg')
      await fsp.mkdir(path.join(appDir), { recursive: true })
      await fsp.mkdir(path.join(workspacePkgDir), { recursive: true })
      await fsp.writeFile(path.join(appDir, 'entry.ts'), '')
      await fsp.writeFile(path.join(workspacePkgDir, 'index.ts'), '')

      let workspaceRoot = tmpDir
      let absolutePath = path.join(workspacePkgDir, 'index.ts')

      let ctx: ResolveContext = {
        root: appDir,
        workspaceRoot,
        allowPatterns: ['app/**'], // App allow - does NOT match packages/pkg/index.ts
        denyPatterns: [],
        workspaceAllowPatterns: ['packages/**'], // Workspace allow - matches
        workspaceDenyPatterns: [],
      }

      let url = resolvedPathToUrl(absolutePath, ctx)

      assert.ok(
        url.startsWith('/__@workspace/'),
        `Expected /__@workspace/ URL, got: ${url}. ` +
          `(Bug: using app allow for workspace paths would emit absolute path)`,
      )
      assert.ok(url.includes('packages/pkg/index.ts'), `Expected path in URL, got: ${url}`)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('resolveSpecifiersToPaths', () => {
  it('resolves tsconfig path aliases', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-test-tsconfig-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      let srcDir = path.join(appDir, 'src')
      let libDir = path.join(appDir, 'lib')
      await fsp.mkdir(srcDir, { recursive: true })
      await fsp.mkdir(libDir, { recursive: true })
      await fsp.writeFile(path.join(srcDir, 'entry.ts'), "import '@app/util'\n")
      await fsp.writeFile(path.join(libDir, 'util.ts'), 'export const util = true\n')
      await fsp.writeFile(
        path.join(appDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@app/*': ['lib/*'],
            },
          },
        }),
      )

      let ctx: ResolveContext = {
        root: appDir,
        workspaceRoot: null,
        allowPatterns: ['**'],
        denyPatterns: [],
        workspaceAllowPatterns: ['**'],
        workspaceDenyPatterns: [],
      }
      let resolutionCache = new Map<string, string>()

      let resolved = await resolveSpecifiersToPaths(
        ['@app/util'],
        srcDir,
        ctx,
        resolutionCache,
        [],
        () => false,
      )

      assert.equal(resolved.length, 1)
      assert.equal(resolved[0]?.absolutePath, fs.realpathSync(path.join(libDir, 'util.ts')))
      assert.equal(resolved[0]?.url, '/lib/util.ts')
      assert.equal(resolutionCache.get(`@app/util\0${srcDir}`), '/lib/util.ts')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('resolves package exports and package imports', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-test-package-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      let srcDir = path.join(appDir, 'src')
      let pkgDir = path.join(appDir, 'node_modules', 'pkg')
      await fsp.mkdir(srcDir, { recursive: true })
      await fsp.mkdir(pkgDir, { recursive: true })
      await fsp.writeFile(
        path.join(srcDir, 'entry.ts'),
        "import 'pkg/feature'\nimport '#internal'\n",
      )
      await fsp.writeFile(path.join(srcDir, 'internal.ts'), 'export const internal = true\n')
      await fsp.writeFile(
        path.join(appDir, 'package.json'),
        JSON.stringify({
          name: 'app',
          type: 'module',
          imports: {
            '#internal': './src/internal.ts',
          },
        }),
      )
      await fsp.writeFile(
        path.join(pkgDir, 'package.json'),
        JSON.stringify({
          name: 'pkg',
          type: 'module',
          exports: {
            './feature': './feature.js',
          },
        }),
      )
      await fsp.writeFile(path.join(pkgDir, 'feature.js'), 'export const feature = true\n')

      let ctx: ResolveContext = {
        root: appDir,
        workspaceRoot: null,
        allowPatterns: ['**'],
        denyPatterns: [],
        workspaceAllowPatterns: ['**'],
        workspaceDenyPatterns: [],
      }
      let resolutionCache = new Map<string, string>()

      let resolved = await resolveSpecifiersToPaths(
        ['pkg/feature', '#internal'],
        srcDir,
        ctx,
        resolutionCache,
        [],
        () => false,
      )
      let byUrl = new Set(resolved.map((r) => r.url))

      assert.equal(resolved.length, 2)
      assert.ok(byUrl.has('/node_modules/pkg/feature.js'))
      assert.ok(byUrl.has('/src/internal.ts'))
      assert.equal(resolutionCache.get(`pkg/feature\0${srcDir}`), '/node_modules/pkg/feature.js')
      assert.equal(resolutionCache.get(`#internal\0${srcDir}`), '/src/internal.ts')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('maps files outside app root to workspace URL paths', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-test-workspace-'))
    try {
      let appDir = path.join(tmpDir, 'apps', 'web')
      let srcDir = path.join(appDir, 'src')
      let workspacePkgDir = path.join(tmpDir, 'packages', 'lib')
      await fsp.mkdir(srcDir, { recursive: true })
      await fsp.mkdir(workspacePkgDir, { recursive: true })
      await fsp.writeFile(path.join(srcDir, 'entry.ts'), "import '@workspace/lib'\n")
      await fsp.writeFile(path.join(workspacePkgDir, 'index.ts'), 'export const lib = true\n')
      await fsp.writeFile(
        path.join(appDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@workspace/lib': ['../../packages/lib/index.ts'],
            },
          },
        }),
      )

      let ctx: ResolveContext = {
        root: appDir,
        workspaceRoot: tmpDir,
        allowPatterns: ['**'],
        denyPatterns: [],
        workspaceAllowPatterns: ['packages/**'],
        workspaceDenyPatterns: [],
      }
      let resolutionCache = new Map<string, string>()

      let resolved = await resolveSpecifiersToPaths(
        ['@workspace/lib'],
        srcDir,
        ctx,
        resolutionCache,
        [],
        () => false,
      )

      assert.equal(resolved.length, 1)
      assert.equal(
        resolved[0]?.absolutePath,
        fs.realpathSync(path.join(workspacePkgDir, 'index.ts')),
      )
      assert.equal(resolved[0]?.url, '/__@workspace/packages/lib/index.ts')
      assert.equal(
        resolutionCache.get(`@workspace/lib\0${srcDir}`),
        '/__@workspace/packages/lib/index.ts',
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('resolves package subpath imports to condition-specific files', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-test-conditions-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      let srcDir = path.join(appDir, 'src')
      let assetsDir = path.join(appDir, '.assets', 'app', 'images')
      await fsp.mkdir(srcDir, { recursive: true })
      await fsp.mkdir(assetsDir, { recursive: true })
      await fsp.writeFile(path.join(assetsDir, 'logo.dev.ts'), "export default '/dev-url'\n")
      await fsp.writeFile(path.join(assetsDir, 'logo.build.ts'), "export default '/build-url'\n")
      await fsp.writeFile(
        path.join(appDir, 'package.json'),
        JSON.stringify({
          name: 'app',
          type: 'module',
          imports: {
            '#assets/*': {
              development: './.assets/*.dev.ts',
              default: './.assets/*.build.ts',
            },
          },
        }),
      )

      let ctx: ResolveContext = {
        root: appDir,
        workspaceRoot: null,
        allowPatterns: ['**'],
        denyPatterns: [],
        workspaceAllowPatterns: ['**'],
        workspaceDenyPatterns: [],
      }

      let devResolved = await resolveSpecifiersToPaths(
        ['#assets/app/images/logo'],
        srcDir,
        ctx,
        new Map(),
        [],
        () => false,
        ['development'],
      )
      assert.equal(devResolved.length, 1)
      assert.ok(
        devResolved[0]?.absolutePath?.endsWith('logo.dev.ts'),
        `Expected .dev.ts with development condition, got: ${devResolved[0]?.absolutePath}`,
      )

      let buildResolved = await resolveSpecifiersToPaths(
        ['#assets/app/images/logo'],
        srcDir,
        ctx,
        new Map(),
        [],
        () => false,
      )
      assert.equal(buildResolved.length, 1)
      assert.ok(
        buildResolved[0]?.absolutePath?.endsWith('logo.build.ts'),
        `Expected .build.ts with default condition, got: ${buildResolved[0]?.absolutePath}`,
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('resolveSpecifiers', () => {
  it('skips configured external specifiers and falls back on unresolved imports', async () => {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-test-external-'))
    try {
      let appDir = path.join(tmpDir, 'app')
      let srcDir = path.join(appDir, 'src')
      await fsp.mkdir(srcDir, { recursive: true })
      await fsp.writeFile(path.join(srcDir, 'entry.ts'), "import 'remix'\nimport './missing.ts'\n")

      let ctx: ResolveContext = {
        root: appDir,
        workspaceRoot: null,
        allowPatterns: ['**'],
        denyPatterns: [],
        workspaceAllowPatterns: ['**'],
        workspaceDenyPatterns: [],
      }
      let resolutionCache = new Map<string, string>()

      await resolveSpecifiers(
        ['remix', './missing.ts'],
        srcDir,
        ctx,
        resolutionCache,
        ['remix'],
        (specifier) => specifier === 'remix',
      )

      assert.equal(resolutionCache.has(`remix\0${srcDir}`), false)
      assert.equal(resolutionCache.get(`./missing.ts\0${srcDir}`), './missing.ts')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
