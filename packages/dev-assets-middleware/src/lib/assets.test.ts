import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import * as path from 'node:path'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'

import {
  getPackageName,
  isCommonJS,
  extractImportSpecifiers,
  parseInlineSourceMap,
  generateETag,
  matchesETag,
  createDevAssets,
  devAssets,
  createModuleGraph,
  ensureModuleNode,
  getModuleByUrl,
  getModuleByFile,
  invalidateModule,
} from './assets.ts'

describe('getPackageName', () => {
  it('extracts name from unscoped package', () => {
    assert.equal(getPackageName('lodash'), 'lodash')
  })

  it('extracts name from unscoped package with subpath', () => {
    assert.equal(getPackageName('lodash/map'), 'lodash')
    assert.equal(getPackageName('lodash/fp/map'), 'lodash')
  })

  it('extracts name from scoped package', () => {
    assert.equal(getPackageName('@remix-run/component'), '@remix-run/component')
  })

  it('extracts name from scoped package with subpath', () => {
    assert.equal(getPackageName('@remix-run/component/jsx-runtime'), '@remix-run/component')
    assert.equal(getPackageName('@remix-run/component/lib/utils'), '@remix-run/component')
  })

  it('returns null for incomplete scoped package', () => {
    assert.equal(getPackageName('@remix-run'), null)
  })

  it('handles edge cases', () => {
    assert.equal(getPackageName(''), '')
    assert.equal(getPackageName('a'), 'a')
    assert.equal(getPackageName('@a/b'), '@a/b')
  })
})

describe('isCommonJS', () => {
  describe('detects CJS patterns', () => {
    it('detects module.exports', () => {
      assert.equal(isCommonJS('module.exports = {}'), true)
      assert.equal(isCommonJS('module.exports.foo = bar'), true)
    })

    it('detects exports.property', () => {
      assert.equal(isCommonJS('exports.foo = bar'), true)
      assert.equal(isCommonJS('exports.default = fn'), true)
      assert.equal(isCommonJS('exports._private = x'), true)
      assert.equal(isCommonJS('exports.$special = y'), true)
    })

    it('detects require() without ESM syntax', () => {
      assert.equal(isCommonJS('const x = require("foo")'), true)
      assert.equal(isCommonJS("const x = require('foo')"), true)
      assert.equal(isCommonJS('require("foo")'), true)
    })
  })

  describe('identifies ESM', () => {
    it('returns false for import statements', () => {
      assert.equal(isCommonJS('import foo from "bar"'), false)
      assert.equal(isCommonJS('import { foo } from "bar"'), false)
      assert.equal(isCommonJS('import * as foo from "bar"'), false)
    })

    it('returns false for export statements', () => {
      assert.equal(isCommonJS('export default foo'), false)
      assert.equal(isCommonJS('export { foo }'), false)
      assert.equal(isCommonJS('export const foo = 1'), false)
    })

    it('returns false for ESM with require() calls', () => {
      // If there's ESM syntax, require() is allowed (dynamic require in ESM)
      assert.equal(isCommonJS('import foo from "bar"; require("baz")'), false)
      assert.equal(isCommonJS('export const x = require("y")'), false)
    })
  })

  describe('edge cases', () => {
    it('returns false for empty source', () => {
      assert.equal(isCommonJS(''), false)
    })

    it('returns false for plain JavaScript', () => {
      assert.equal(isCommonJS('const x = 1'), false)
      assert.equal(isCommonJS('function foo() {}'), false)
    })

    it('does not false-positive on similar patterns', () => {
      // "module.exports" in a string shouldn't trigger
      assert.equal(isCommonJS('const str = "module.exports"'), true) // This is a known limitation
      // But legitimate code patterns should work
      assert.equal(isCommonJS('const exports = {}'), false) // No exports.property
      assert.equal(isCommonJS('const module = {}'), false) // No module.exports
    })

    it('handles exports without valid property name', () => {
      assert.equal(isCommonJS('exports. = x'), false) // Invalid property
      assert.equal(isCommonJS('exports[0] = x'), false) // Bracket notation not matched
    })
  })
})

describe('extractImportSpecifiers', () => {
  describe('detects static imports', () => {
    it('detects default imports', async () => {
      let imports = await extractImportSpecifiers(`import foo from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })

    it('detects named imports', async () => {
      let imports = await extractImportSpecifiers(`import { foo, bar } from 'baz'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'baz')
    })

    it('detects namespace imports', async () => {
      let imports = await extractImportSpecifiers(`import * as foo from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })

    it('detects side-effect imports', async () => {
      let imports = await extractImportSpecifiers(`import 'side-effect'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'side-effect')
    })

    it('detects multiple imports', async () => {
      let code = `
        import a from 'pkg-a'
        import { b } from 'pkg-b'
        import 'pkg-c'
      `
      let imports = await extractImportSpecifiers(code)
      assert.equal(imports.length, 3)
      assert.deepEqual(
        imports.map((i) => i.specifier),
        ['pkg-a', 'pkg-b', 'pkg-c'],
      )
    })
  })

  describe('detects dynamic imports', () => {
    it('detects dynamic import with string literal', async () => {
      let imports = await extractImportSpecifiers(`const m = import('dynamic')`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'dynamic')
    })

    it('does not include dynamic import with variable', async () => {
      let imports = await extractImportSpecifiers(`const m = import(variable)`)
      assert.equal(imports.length, 0)
    })

    it('does not include dynamic import with expression', async () => {
      let imports = await extractImportSpecifiers(`const m = import('./path/' + name)`)
      assert.equal(imports.length, 0)
    })
  })

  describe('detects re-exports', () => {
    it('detects export from', async () => {
      let imports = await extractImportSpecifiers(`export { foo } from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })

    it('detects export * from', async () => {
      let imports = await extractImportSpecifiers(`export * from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })

    it('detects export * as from', async () => {
      let imports = await extractImportSpecifiers(`export * as ns from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })
  })

  describe('edge cases', () => {
    it('does not detect imports in strings', async () => {
      let imports = await extractImportSpecifiers(`const str = "import foo from 'bar'"`)
      assert.equal(imports.length, 0)
    })

    it('does not detect imports in template literals', async () => {
      let imports = await extractImportSpecifiers('const str = `import foo from "bar"`')
      assert.equal(imports.length, 0)
    })

    it('does not detect imports in comments', async () => {
      let imports = await extractImportSpecifiers(`// import foo from 'bar'`)
      assert.equal(imports.length, 0)
    })

    it('does not detect imports in block comments', async () => {
      let imports = await extractImportSpecifiers(`/* import foo from 'bar' */`)
      assert.equal(imports.length, 0)
    })

    it('provides correct positions', async () => {
      let code = `import foo from 'bar'`
      let imports = await extractImportSpecifiers(code)
      assert.equal(code.slice(imports[0].start, imports[0].end), 'bar')
    })

    it('handles empty source', async () => {
      let imports = await extractImportSpecifiers('')
      assert.equal(imports.length, 0)
    })

    it('handles source with no imports', async () => {
      let imports = await extractImportSpecifiers('const x = 1')
      assert.equal(imports.length, 0)
    })
  })
})

describe('parseInlineSourceMap', () => {
  it('parses valid inline source map', () => {
    let sourceMap = {
      version: 3,
      sources: ['/entry.ts'],
      mappings: 'AAAA',
      sourcesContent: ['const x = 1'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `const x = 1;\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let parsed = parseInlineSourceMap(code)

    assert.ok(parsed)
    assert.deepEqual(parsed.sources, ['/entry.ts'])
    assert.deepEqual(parsed.sourcesContent, ['const x = 1'])
    assert.equal(parsed.mappings, 'AAAA')
  })

  it('returns null for code without source map', () => {
    let parsed = parseInlineSourceMap('const x = 1')
    assert.equal(parsed, null)
  })

  it('returns null for malformed base64', () => {
    let code = '//# sourceMappingURL=data:application/json;base64,not-valid-base64!!!'
    let parsed = parseInlineSourceMap(code)
    assert.equal(parsed, null)
  })

  it('extracts source map with URL paths (not filesystem paths)', () => {
    // This is the key test: source maps should use URL paths like "/entry.ts"
    // not filesystem paths like "/Users/mark/project/app/entry.ts"
    let sourceMap = {
      version: 3,
      sources: ['/components/App.tsx'],
      mappings: 'AAAA',
      sourcesContent: ['export function App() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function App() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let parsed = parseInlineSourceMap(code)

    assert.ok(parsed)
    // Source should be a URL path, not a filesystem path
    assert.equal(parsed.sources[0], '/components/App.tsx')
    assert.ok(!parsed.sources[0].includes('/Users/'), 'Source should not contain filesystem path')
    assert.ok(!parsed.sources[0].includes('C:\\'), 'Source should not contain Windows path')
  })

  it('handles workspace URL paths', () => {
    let sourceMap = {
      version: 3,
      sources: ['/__@workspace/node_modules/@remix-run/component/src/index.ts'],
      mappings: 'AAAA',
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export {};\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let parsed = parseInlineSourceMap(code)

    assert.ok(parsed)
    assert.equal(parsed.sources[0], '/__@workspace/node_modules/@remix-run/component/src/index.ts')
  })
})

describe('generateETag', () => {
  it('generates weak ETag from mtime and size', () => {
    let mtime = new Date('2024-01-15T10:30:00Z')
    let size = 1234

    let etag = generateETag(mtime, size)

    assert.ok(etag.startsWith('W/"'), 'ETag should be weak (W/ prefix)')
    assert.ok(etag.endsWith('"'), 'ETag should end with quote')
  })

  it('generates different ETags for different mtimes', () => {
    let mtime1 = new Date('2024-01-15T10:30:00Z')
    let mtime2 = new Date('2024-01-15T10:30:01Z')
    let size = 1234

    let etag1 = generateETag(mtime1, size)
    let etag2 = generateETag(mtime2, size)

    assert.notEqual(etag1, etag2)
  })

  it('generates different ETags for different sizes', () => {
    let mtime = new Date('2024-01-15T10:30:00Z')

    let etag1 = generateETag(mtime, 1234)
    let etag2 = generateETag(mtime, 5678)

    assert.notEqual(etag1, etag2)
  })

  it('generates same ETag for same mtime and size', () => {
    let mtime = new Date('2024-01-15T10:30:00Z')
    let size = 1234

    let etag1 = generateETag(mtime, size)
    let etag2 = generateETag(mtime, size)

    assert.equal(etag1, etag2)
  })
})

describe('matchesETag', () => {
  it('returns false for null If-None-Match', () => {
    assert.equal(matchesETag(null, 'W/"abc"'), false)
  })

  it('returns true for exact match', () => {
    assert.equal(matchesETag('W/"abc"', 'W/"abc"'), true)
  })

  it('returns true for match without W/ prefix', () => {
    assert.equal(matchesETag('"abc"', 'W/"abc"'), true)
    assert.equal(matchesETag('W/"abc"', '"abc"'), true)
  })

  it('returns false for non-match', () => {
    assert.equal(matchesETag('W/"abc"', 'W/"xyz"'), false)
  })

  it('returns true for wildcard', () => {
    assert.equal(matchesETag('*', 'W/"abc"'), true)
  })

  it('handles multiple ETags in If-None-Match', () => {
    assert.equal(matchesETag('W/"abc", W/"def", W/"xyz"', 'W/"def"'), true)
    assert.equal(matchesETag('W/"abc", W/"def"', 'W/"xyz"'), false)
  })

  it('handles whitespace in multiple ETags', () => {
    assert.equal(matchesETag('W/"abc" , W/"def" , W/"xyz"', 'W/"def"'), true)
  })
})

describe('createDevAssets', () => {
  let tempDir: string

  // Create a temp directory with test files before each test
  function setupTempDir() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-test-'))
    fs.writeFileSync(path.join(tempDir, 'entry.tsx'), 'export default function App() {}')
    fs.mkdirSync(path.join(tempDir, 'components'))
    fs.writeFileSync(path.join(tempDir, 'components', 'Button.tsx'), 'export function Button() {}')
  }

  function cleanupTempDir() {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  describe('get()', () => {
    it('returns href as source path with leading slash', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns chunks as array containing only href', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.deepEqual(entry.chunks, ['/entry.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('handles nested paths', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('components/Button.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/components/Button.tsx')
        assert.deepEqual(entry.chunks, ['/components/Button.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes leading slashes in entry path', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('/entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes multiple leading slashes', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('///entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null if entry file does not exist', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)

        assert.equal(assets.get('nonexistent.tsx'), null)
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null for nested non-existent paths', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)

        assert.equal(assets.get('missing/file.tsx'), null)
      } finally {
        cleanupTempDir()
      }
    })

    it('works with relative root path', () => {
      setupTempDir()
      try {
        // Get relative path from cwd to temp dir
        let relativePath = path.relative(process.cwd(), tempDir)
        let assets = createDevAssets(relativePath)
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('works with absolute root path', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('entry points restriction', () => {
    it('allows all files when entryPoints not specified', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)

        assert.ok(assets.get('entry.tsx'), 'entry.tsx should be accessible')
        assert.ok(assets.get('components/Button.tsx'), 'components/Button.tsx should be accessible')
      } finally {
        cleanupTempDir()
      }
    })

    it('restricts to specified entry points when provided', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir, ['entry.tsx'])

        assert.ok(assets.get('entry.tsx'), 'entry.tsx should be accessible')
        assert.equal(
          assets.get('components/Button.tsx'),
          null,
          'components/Button.tsx should not be accessible',
        )
      } finally {
        cleanupTempDir()
      }
    })

    it('allows multiple entry points', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir, ['entry.tsx', 'components/Button.tsx'])

        assert.ok(assets.get('entry.tsx'), 'entry.tsx should be accessible')
        assert.ok(assets.get('components/Button.tsx'), 'components/Button.tsx should be accessible')
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes leading slashes in entry points', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir, ['entry.tsx'])

        // Both with and without leading slash should work
        assert.ok(assets.get('entry.tsx'), 'without leading slash should work')
        assert.ok(assets.get('/entry.tsx'), 'with leading slash should work')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null for non-entry files even if they exist', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir, ['entry.tsx'])

        // Button.tsx exists on disk but is not in entryPoints
        assert.equal(assets.get('components/Button.tsx'), null)
      } finally {
        cleanupTempDir()
      }
    })
  })
})

describe('allow/deny security', () => {
  let tempDir: string
  let workspaceDir: string

  function setupDirs() {
    // Create app directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-assets-test-'))
    fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'app', 'entry.ts'), 'export {}')
    fs.writeFileSync(path.join(tempDir, 'server.ts'), 'export {}')
    fs.writeFileSync(path.join(tempDir, '.env'), 'SECRET=foo')

    // Create workspace directory
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
        let middleware = devAssets({ root: tempDir, allow: [] })
        let request = new Request('http://localhost/app/entry.ts')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.ts'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('allows requests matching allow patterns', async () => {
      setupDirs()
      try {
        let middleware = devAssets({ root: tempDir, allow: [/^app\//] })
        let request = new Request('http://localhost/app/entry.ts')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.ts'),
          method: 'GET',
          assets: null,
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 200)
        assert.ok(response.headers.get('content-type')?.includes('javascript'))
      } finally {
        cleanupDirs()
      }
    })

    it('blocks requests not matching allow patterns', async () => {
      setupDirs()
      try {
        let middleware = devAssets({ root: tempDir, allow: [/^app\//] })
        let request = new Request('http://localhost/server.ts')
        let context: any = {
          request,
          url: new URL('http://localhost/server.ts'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('blocks requests matching deny patterns', async () => {
      setupDirs()
      // Create a .ts file that we want to deny
      fs.writeFileSync(path.join(tempDir, 'secret.ts'), 'export let SECRET = "foo"')

      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/.*/], // Allow everything
          deny: [/^secret\.ts$/], // But deny secret.ts
        })
        let request = new Request('http://localhost/secret.ts')
        let context: any = {
          request,
          url: new URL('http://localhost/secret.ts'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('deny takes precedence over allow', async () => {
      setupDirs()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/.*/], // Allow everything
          deny: [/^server\.ts$/], // Except server.ts
        })
        let request = new Request('http://localhost/server.ts')
        let context: any = {
          request,
          url: new URL('http://localhost/server.ts'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 403)
      } finally {
        cleanupDirs()
      }
    })
  })

  describe('workspace security', () => {
    it('blocks workspace requests when not configured', async () => {
      setupDirs()
      try {
        let middleware = devAssets({ allow: [/^app\//] })
        let request = new Request('http://localhost/__@workspace/node_modules/pkg/index.js')
        let context: any = {
          request,
          url: new URL('http://localhost/__@workspace/node_modules/pkg/index.js'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('allows workspace requests matching allow patterns', async () => {
      setupDirs()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          workspace: {
            root: workspaceDir,
            allow: [/node_modules/],
          },
        })
        let request = new Request('http://localhost/__@workspace/node_modules/pkg/index.js')
        let context: any = {
          request,
          url: new URL('http://localhost/__@workspace/node_modules/pkg/index.js'),
          method: 'GET',
          assets: null,
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 200)
      } finally {
        cleanupDirs()
      }
    })

    it('blocks workspace requests not matching allow patterns', async () => {
      setupDirs()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          workspace: {
            root: workspaceDir,
            allow: [/node_modules/], // Only allow node_modules
          },
        })
        let request = new Request('http://localhost/__@workspace/packages/lib/index.ts')
        let context: any = {
          request,
          url: new URL('http://localhost/__@workspace/packages/lib/index.ts'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('inherits top-level deny patterns', async () => {
      setupDirs()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          deny: [/\.env/], // Top-level deny
          workspace: {
            root: workspaceDir,
            allow: [/.*/], // Allow everything in workspace
          },
        })
        let request = new Request('http://localhost/__@workspace/.env')
        let context: any = {
          request,
          url: new URL('http://localhost/__@workspace/.env'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 403)
      } finally {
        cleanupDirs()
      }
    })

    it('combines workspace deny with inherited deny', async () => {
      setupDirs()
      fs.writeFileSync(path.join(workspaceDir, 'test.ts'), 'export {}')

      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          deny: [/\.env/], // Global deny
          workspace: {
            root: workspaceDir,
            allow: [/.*/],
            deny: [/test\.ts/], // Additional workspace deny
          },
        })

        // Should block test.ts (workspace-specific deny)
        let request1 = new Request('http://localhost/__@workspace/test.ts')
        let context1: any = {
          request: request1,
          url: new URL('http://localhost/__@workspace/test.ts'),
          method: 'GET',
        }
        let response1 = await middleware(context1, async () => new Response('next'))
        assert.ok(response1)
        assert.equal(response1.status, 403, 'Should block workspace-specific deny pattern')

        // Should also block .env (inherited deny)
        let request2 = new Request('http://localhost/__@workspace/.env')
        let context2: any = {
          request: request2,
          url: new URL('http://localhost/__@workspace/.env'),
          method: 'GET',
        }
        let response2 = await middleware(context2, async () => new Response('next'))
        assert.ok(response2)
        assert.equal(response2.status, 403, 'Should block inherited deny pattern')
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
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  describe('plugin support', () => {
    it('allows custom plugins for non-standard file types', async () => {
      setupTempDir()
      try {
        // Create a .data file (not a standard JS/TS file)
        fs.writeFileSync(path.join(tempDir, 'app', 'config.data'), '{"key": "value"}')

        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            plugins: [
              {
                name: 'data-loader',
                setup(build) {
                  build.onLoad({ filter: /\.data$/ }, async (args) => {
                    let text = await fs.promises.readFile(args.path, 'utf-8')
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

        let request = new Request('http://localhost/app/config.data')
        let context: any = {
          request,
          url: new URL('http://localhost/app/config.data'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 200)
        let text = await response.text()
        // The plugin should have transformed the .data file into JS
        // Check that it's valid JS with an export
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
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            // User tries to configure these, but they should be overridden
            // Cast to any to bypass type check for testing override behavior
            bundle: true,
            write: true,
            format: 'cjs',
          } as any,
        })

        // Request a file that imports another file
        let request = new Request('http://localhost/app/with-import.tsx')
        let context: any = {
          request,
          url: new URL('http://localhost/app/with-import.tsx'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 200)
        let text = await response.text()

        // Should NOT inline the import (unbundled)
        // It should keep the import statement (possibly rewritten)
        assert.ok(
          text.includes('import') || text.includes('from'),
          'Should maintain imports (unbundled)',
        )

        // Should be ESM format
        assert.ok(!text.includes('exports.'), 'Should not use CommonJS exports')
        assert.ok(!text.includes('module.exports'), 'Should not use module.exports')
      } finally {
        cleanupTempDir()
      }
    })

    it('honors sourcemap: false', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            sourcemap: false,
          },
        })

        let request = new Request('http://localhost/app/entry.tsx')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 200)
        let text = await response.text()

        // Should not have sourcemap
        assert.ok(!text.includes('sourceMappingURL'), 'Should not include source map')
      } finally {
        cleanupTempDir()
      }
    })

    it('coerces other sourcemap values to inline', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            sourcemap: 'external' as any,
          },
        })

        let request = new Request('http://localhost/app/entry.tsx')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
        }
        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response)
        assert.equal(response.status, 200)
        let text = await response.text()

        // Should have inline sourcemap (not external)
        assert.ok(
          text.includes('sourceMappingURL=data:application/json;base64,'),
          'Should have inline source map',
        )
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('entryPoints integration', () => {
    it('restricts assets.get() when entryPoints provided', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            entryPoints: ['app/entry.tsx'],
          },
        })

        let request = new Request('http://localhost/')
        let context: any = {
          request,
          url: new URL('http://localhost/'),
          method: 'GET',
          assets: null as any,
        }

        await middleware(context, async () => new Response('next'))

        // assets.get should be available on context
        assert.ok(context.assets, 'assets should be set on context')

        // Should allow entry.tsx
        assert.ok(context.assets.get('app/entry.tsx'), 'entry.tsx should be accessible')

        // Should block other.tsx (not in entryPoints)
        assert.equal(
          context.assets.get('app/other.tsx'),
          null,
          'other.tsx should not be accessible',
        )
      } finally {
        cleanupTempDir()
      }
    })

    it('allows all files when entryPoints not provided', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
        })

        let request = new Request('http://localhost/')
        let context: any = {
          request,
          url: new URL('http://localhost/'),
          method: 'GET',
          assets: null as any,
        }

        await middleware(context, async () => new Response('next'))

        // assets.get should be available on context
        assert.ok(context.assets, 'assets should be set on context')

        // Should allow both files
        assert.ok(context.assets.get('app/entry.tsx'), 'entry.tsx should be accessible')
        assert.ok(context.assets.get('app/other.tsx'), 'other.tsx should be accessible')
      } finally {
        cleanupTempDir()
      }
    })
  })

  describe('external imports', () => {
    it('leaves HTTP/HTTPS URLs unchanged when in external config', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            external: ['https://unpkg.com/@remix-run/component'],
          },
        })

        // Create a file that imports from CDN
        let entryPath = path.join(tempDir, 'app/entry.tsx')
        await fsp.writeFile(
          entryPath,
          `import { createRoot } from 'https://unpkg.com/@remix-run/component'
import { helper } from './utils.ts'

let root = createRoot(document.getElementById('app')!)
console.log(root, helper)
root.render(<div>Hello</div>)`,
        )

        let utilsPath = path.join(tempDir, 'app/utils.ts')
        await fsp.writeFile(utilsPath, 'export function helper() { return "helper" }')

        let request = new Request('http://localhost/app/entry.tsx')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
          assets: null as any,
        }

        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response, 'should return a response')
        assert.equal(response.status, 200)

        let code = await response.text()

        // HTTP URL should be unchanged
        assert.ok(code.includes('https://unpkg.com/@remix-run/component'), 'should preserve CDN URL')

        // Relative import should be rewritten
        assert.ok(code.includes('/app/utils.ts'), 'should rewrite relative import')
      } finally {
        cleanupTempDir()
      }
    })

    it('skips bare specifiers matching external patterns (strings)', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            external: ['@remix-run/component'],
          },
        })

        let entryPath = path.join(tempDir, 'app/entry.tsx')
        await fsp.writeFile(
          entryPath,
          `import { createRoot } from '@remix-run/component'
import { helper } from './utils.ts'

export function createApp() { 
  let root = createRoot(document.body)
  console.log(root, helper)
  root.render(<div>Hello</div>)
  return { root }
}`,
        )

        let utilsPath = path.join(tempDir, 'app/utils.ts')
        await fsp.writeFile(utilsPath, 'export function helper() { return "helper" }')

        let request = new Request('http://localhost/app/entry.tsx')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
          assets: null as any,
        }

        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response, 'should return a response')
        assert.equal(response.status, 200)

        let code = await response.text()

        // External bare specifiers should be unchanged
        assert.ok(
          code.includes("'@remix-run/component'") || code.includes('"@remix-run/component"'),
          'should preserve @remix-run/component import',
        )

        // Relative import should be rewritten
        assert.ok(code.includes('/app/utils.ts'), 'should rewrite relative import')
      } finally {
        cleanupTempDir()
      }
    })

    it('skips bare specifiers matching external patterns (regex)', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            external: [/^@external\//] as any,
          },
        })

        let entryPath = path.join(tempDir, 'app/entry.tsx')
        await fsp.writeFile(
          entryPath,
          `import { foo } from '@external/package'
import { bar } from '@external/another'
import { helper } from './utils.ts'
console.log(foo, bar, helper)
export { foo, bar, helper }`,
        )

        let utilsPath = path.join(tempDir, 'app/utils.ts')
        await fsp.writeFile(utilsPath, 'export function helper() { return "helper" }')

        let request = new Request('http://localhost/app/entry.tsx')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
          assets: null as any,
        }

        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response, 'should return a response')
        assert.equal(response.status, 200)

        let code = await response.text()

        // External bare specifiers should be unchanged
        assert.ok(
          code.includes("'@external/package'") || code.includes('"@external/package"'),
          'should preserve @external/package import',
        )
        assert.ok(
          code.includes("'@external/another'") || code.includes('"@external/another"'),
          'should preserve @external/another import',
        )

        // Relative import should be rewritten
        assert.ok(code.includes('/app/utils.ts'), 'should rewrite relative import')
      } finally {
        cleanupTempDir()
      }
    })

    it('works for both static and dynamic imports', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
          esbuildConfig: {
            external: ['@external/package'],
          },
        })

        let entryPath = path.join(tempDir, 'app/entry.tsx')
        await fsp.writeFile(
          entryPath,
          `import { foo } from '@external/package'
const dynamicExternal = import('@external/package')
import { helper } from './utils.ts'
const dynamicHelper = import('./utils.ts')
console.log(foo, helper)
export { foo, dynamicExternal, helper, dynamicHelper }`,
        )

        let utilsPath = path.join(tempDir, 'app/utils.ts')
        await fsp.writeFile(utilsPath, 'export function helper() { return "helper" }')

        let request = new Request('http://localhost/app/entry.tsx')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
          assets: null as any,
        }

        let response = await middleware(context, async () => new Response('next'))

        assert.ok(response, 'should return a response')
        assert.equal(response.status, 200)

        let code = await response.text()

        // External bare specifiers should be unchanged (both static and dynamic)
        let externalMatches = code.match(/['"]@external\/package['"]/g)
        assert.equal(externalMatches?.length, 2, 'should preserve both @external/package imports')

        // Relative imports should be rewritten (both static and dynamic)
        let utilsMatches = code.match(/\/app\/utils\.ts/g)
        assert.equal(utilsMatches?.length, 2, 'should rewrite both relative imports')
      } finally {
        cleanupTempDir()
      }
    })
  })
})

describe('module graph', () => {
  describe('createModuleGraph', () => {
    it('creates an empty graph', () => {
      let graph = createModuleGraph()
      assert.equal(graph.urlToModule.size, 0)
      assert.equal(graph.fileToModule.size, 0)
    })
  })

  describe('ensureModuleNode', () => {
    it('creates a new module node', () => {
      let graph = createModuleGraph()
      let node = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      assert.equal(node.url, '/app/entry.tsx')
      assert.equal(node.file, '/abs/path/entry.tsx')
      assert.equal(node.importers.size, 0)
      assert.equal(node.importedModules.size, 0)
      assert.equal(node.transformResult, undefined)
      assert.equal(node.lastModified, undefined)
    })

    it('returns existing node by URL', () => {
      let graph = createModuleGraph()
      let node1 = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')
      let node2 = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      assert.equal(node1, node2)
      assert.equal(graph.urlToModule.size, 1)
      assert.equal(graph.fileToModule.size, 1)
    })

    it('returns existing node by file path', () => {
      let graph = createModuleGraph()
      let node1 = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')
      let node2 = ensureModuleNode(graph, '/different/url.tsx', '/abs/path/entry.tsx')

      assert.equal(node1, node2)
      // Should have 2 URL mappings to same node
      assert.equal(graph.urlToModule.size, 2)
      assert.equal(graph.fileToModule.size, 1)
    })

    it('updates file path for placeholder nodes', () => {
      let graph = createModuleGraph()
      // Create placeholder node with empty file
      let node1 = ensureModuleNode(graph, '/app/entry.tsx', '')

      assert.equal(node1.file, '')
      assert.equal(graph.fileToModule.size, 0)

      // Update with real file path
      let node2 = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      assert.equal(node1, node2)
      assert.equal(node2.file, '/abs/path/entry.tsx')
      assert.equal(graph.fileToModule.size, 1)
      assert.equal(graph.fileToModule.get('/abs/path/entry.tsx'), node2)
    })
  })

  describe('getModuleByUrl', () => {
    it('returns node by URL', () => {
      let graph = createModuleGraph()
      let node = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      let found = getModuleByUrl(graph, '/app/entry.tsx')
      assert.equal(found, node)
    })

    it('returns undefined for non-existent URL', () => {
      let graph = createModuleGraph()
      let found = getModuleByUrl(graph, '/app/entry.tsx')
      assert.equal(found, undefined)
    })
  })

  describe('getModuleByFile', () => {
    it('returns node by file path', () => {
      let graph = createModuleGraph()
      let node = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      let found = getModuleByFile(graph, '/abs/path/entry.tsx')
      assert.equal(found, node)
    })

    it('returns undefined for non-existent file path', () => {
      let graph = createModuleGraph()
      let found = getModuleByFile(graph, '/abs/path/entry.tsx')
      assert.equal(found, undefined)
    })
  })

  describe('invalidateModule', () => {
    it('clears transform result and mtime', () => {
      let graph = createModuleGraph()
      let node = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      node.transformResult = { code: 'test code', map: null }
      node.lastModified = 123456

      invalidateModule(node)

      assert.equal(node.transformResult, undefined)
      assert.equal(node.lastModified, undefined)
    })

    it('propagates invalidation to importers', () => {
      let graph = createModuleGraph()
      let entryNode = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')
      let utilsNode = ensureModuleNode(graph, '/app/utils.ts', '/abs/path/utils.ts')

      // Setup relationship: entry imports utils
      entryNode.importedModules.add(utilsNode)
      utilsNode.importers.add(entryNode)

      // Set transform results
      entryNode.transformResult = { code: 'entry code', map: null }
      entryNode.lastModified = 111
      utilsNode.transformResult = { code: 'utils code', map: null }
      utilsNode.lastModified = 222

      // Invalidate utils
      invalidateModule(utilsNode)

      // Both should be invalidated
      assert.equal(utilsNode.transformResult, undefined)
      assert.equal(utilsNode.lastModified, undefined)
      assert.equal(entryNode.transformResult, undefined)
      assert.equal(entryNode.lastModified, undefined)
    })

    it('handles circular dependencies without infinite loop', () => {
      let graph = createModuleGraph()
      let nodeA = ensureModuleNode(graph, '/app/a.ts', '/abs/path/a.ts')
      let nodeB = ensureModuleNode(graph, '/app/b.ts', '/abs/path/b.ts')

      // Create circular dependency: A imports B, B imports A
      nodeA.importedModules.add(nodeB)
      nodeB.importers.add(nodeA)
      nodeB.importedModules.add(nodeA)
      nodeA.importers.add(nodeB)

      // Set transform results
      nodeA.transformResult = { code: 'a code', map: null }
      nodeA.lastModified = 111
      nodeB.transformResult = { code: 'b code', map: null }
      nodeB.lastModified = 222

      // Invalidate A - should not loop infinitely
      invalidateModule(nodeA)

      // Both should be invalidated
      assert.equal(nodeA.transformResult, undefined)
      assert.equal(nodeA.lastModified, undefined)
      assert.equal(nodeB.transformResult, undefined)
      assert.equal(nodeB.lastModified, undefined)
    })

    it('propagates through deep dependency chains', () => {
      let graph = createModuleGraph()
      let entryNode = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')
      let utilsNode = ensureModuleNode(graph, '/app/utils.ts', '/abs/path/utils.ts')
      let helperNode = ensureModuleNode(graph, '/app/helper.ts', '/abs/path/helper.ts')

      // Setup chain: entry -> utils -> helper
      entryNode.importedModules.add(utilsNode)
      utilsNode.importers.add(entryNode)
      utilsNode.importedModules.add(helperNode)
      helperNode.importers.add(utilsNode)

      // Set transform results
      entryNode.transformResult = { code: 'entry code', map: null }
      entryNode.lastModified = 111
      utilsNode.transformResult = { code: 'utils code', map: null }
      utilsNode.lastModified = 222
      helperNode.transformResult = { code: 'helper code', map: null }
      helperNode.lastModified = 333

      // Invalidate helper (leaf node)
      invalidateModule(helperNode)

      // All should be invalidated
      assert.equal(helperNode.transformResult, undefined)
      assert.equal(utilsNode.transformResult, undefined)
      assert.equal(entryNode.transformResult, undefined)
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
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  describe('transform caching', () => {
    it('caches transforms and reuses them on subsequent requests', async () => {
      setupTempDir()
      try {
        let middleware = devAssets({
          root: tempDir,
          allow: [/^app\//],
        })

        // Create a file
        let entryPath = path.join(tempDir, 'app/entry.tsx')
        await fsp.writeFile(
          entryPath,
          `import { helper } from './utils.ts'
export function main() {
  console.log(helper())
}`,
        )
        let utilsPath = path.join(tempDir, 'app/utils.ts')
        await fsp.writeFile(utilsPath, 'export function helper() { return "v1" }')

        let request = new Request('http://localhost/app/entry.tsx')
        let context: any = {
          request,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
          assets: null as any,
        }

        // First request - should transform
        let response1 = await middleware(context, async () => new Response('next'))
        assert.ok(response1, 'response1 should be defined')
        assert.equal(response1.status, 200)
        let code1 = await response1.text()
        assert.ok(code1.includes('main'))

        // Second request - should use cached transform
        let request2 = new Request('http://localhost/app/entry.tsx')
        let context2: any = {
          request: request2,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
          assets: null as any,
        }

        let response2 = await middleware(context2, async () => new Response('next'))
        assert.ok(response2, 'response2 should be defined')
        assert.equal(response2.status, 200)
        let code2 = await response2.text()

        // Should be identical (from cache)
        assert.equal(code1, code2)

        // Modify the file
        await fsp.writeFile(
          entryPath,
          `import { helper } from './utils.ts'
export function main() {
  console.log(helper())
  console.log("v2")
}`,
        )

        // Third request - should re-transform due to mtime change
        let request3 = new Request('http://localhost/app/entry.tsx')
        let context3: any = {
          request: request3,
          url: new URL('http://localhost/app/entry.tsx'),
          method: 'GET',
          assets: null as any,
        }

        let response3 = await middleware(context3, async () => new Response('next'))
        assert.ok(response3, 'response3 should be defined')
        assert.equal(response3.status, 200)
        let code3 = await response3.text()

        // Should be different (new version)
        assert.notEqual(code1, code3)
        assert.ok(code3.includes('v2'))
      } finally {
        cleanupTempDir()
      }
    })
  })
})
