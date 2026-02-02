import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import * as path from 'node:path'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'

import {
  parseInlineSourceMap,
  fixSourceMapPaths,
  hashCode,
  generateETag,
  matchesETag,
  createDevAssets,
  devAssets,
} from './assets.ts'

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

describe('fixSourceMapPaths', () => {
  it('fixes filesystem-relative paths to URL paths for app files', () => {
    // Simulate esbuild output with filesystem-relative path
    let sourceMap = {
      version: 3,
      sources: ['../components/Counter.tsx'],
      mappings: 'AAAA',
      sourcesContent: ['export function Counter() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function Counter() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    // Fix the paths
    let fixed = fixSourceMapPaths(code, '/assets/components/Counter.tsx')

    // Verify the source map was fixed
    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.deepEqual(parsed.sources, ['/assets/components/Counter.tsx'])
    assert.deepEqual(parsed.sourcesContent, ['export function Counter() {}'])
  })

  it('fixes filesystem-relative paths to URL paths for HMR runtime', () => {
    // Simulate esbuild output with filesystem-relative path
    let sourceMap = {
      version: 3,
      sources: ['../../virtual/hmr-runtime.ts'],
      mappings: 'AAAA',
      sourcesContent: ['export function __hmr_register() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function __hmr_register() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    // Fix the paths
    let fixed = fixSourceMapPaths(code, '/__@remix/hmr-runtime.ts')

    // Verify the source map was fixed
    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.deepEqual(parsed.sources, ['/__@remix/hmr-runtime.ts'])
    assert.deepEqual(parsed.sourcesContent, ['export function __hmr_register() {}'])
  })

  it('fixes filesystem-relative paths to URL paths for workspace files', () => {
    // Simulate esbuild output with filesystem-relative path
    let sourceMap = {
      version: 3,
      sources: ['../../packages/component/src/index.ts'],
      mappings: 'AAAA',
      sourcesContent: ['export function createRoot() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function createRoot() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    // Fix the paths
    let fixed = fixSourceMapPaths(code, '/__@workspace/packages/component/src/index.ts')

    // Verify the source map was fixed
    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.deepEqual(parsed.sources, ['/__@workspace/packages/component/src/index.ts'])
    assert.deepEqual(parsed.sourcesContent, ['export function createRoot() {}'])
  })

  it('preserves sourcesContent when fixing paths', () => {
    let sourceMap = {
      version: 3,
      sources: ['../App.tsx'],
      mappings: 'AAAA',
      sourcesContent: ['export function App() { return <div>Hello</div> }'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function App() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    // Fix the paths
    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.ok(parsed.sourcesContent)
    assert.equal(parsed.sourcesContent[0], 'export function App() { return <div>Hello</div> }')
  })

  it('preserves mappings when fixing paths', () => {
    let sourceMap = {
      version: 3,
      sources: ['../App.tsx'],
      mappings: 'AAAA,CAAC,CAAC,CAAC',
      sourcesContent: ['export function App() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function App() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    // Fix the paths
    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.equal(parsed.mappings, 'AAAA,CAAC,CAAC,CAAC')
  })

  it('handles code without source map gracefully', () => {
    let code = 'export function App() {}'
    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')
    assert.equal(fixed, code)
  })

  it('handles malformed source map gracefully', () => {
    let code =
      'export function App() {}\n//# sourceMappingURL=data:application/json;base64,not-valid!!!'
    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')
    // Should return original code when parsing fails
    assert.equal(fixed, code)
  })

  it('replaces multiple sources with single sourceUrl', () => {
    // Edge case: if esbuild somehow generates multiple sources, replace all with the single URL
    let sourceMap = {
      version: 3,
      sources: ['../App.tsx', '../utils.ts'],
      mappings: 'AAAA',
      sourcesContent: ['export function App() {}', 'export const x = 1'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function App() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    // Fix the paths
    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    // Should have single source URL
    assert.deepEqual(parsed.sources, ['/assets/App.tsx'])
    // sourcesContent should be preserved as-is
    assert.deepEqual(parsed.sourcesContent, ['export function App() {}', 'export const x = 1'])
  })
})

describe('hashCode', () => {
  it('generates consistent hash for same code', async () => {
    let code = 'export function test() { return 42; }'

    let hash1 = await hashCode(code)
    let hash2 = await hashCode(code)

    assert.equal(hash1, hash2)
  })

  it('generates different hashes for different code', async () => {
    let code1 = 'export function test() { return 42; }'
    let code2 = 'export function test() { return 43; }'

    let hash1 = await hashCode(code1)
    let hash2 = await hashCode(code2)

    assert.notEqual(hash1, hash2)
  })

  it('generates hash with reasonable length', async () => {
    let code = 'export function test() { return 42; }'

    let hash = await hashCode(code)

    // Should be exactly 16 chars (as specified in implementation)
    assert.equal(hash.length, 16)
  })
})

describe('generateETag', () => {
  it('generates weak ETag from hash', () => {
    let hash = 'abc123def456'

    let etag = generateETag(hash)

    assert.ok(etag.startsWith('W/"'), 'ETag should be weak (W/ prefix)')
    assert.ok(etag.endsWith('"'), 'ETag should end with quote')
    assert.ok(etag.includes(hash), 'ETag should contain the hash')
  })

  it('generates different ETags for different hashes', () => {
    let hash1 = 'abc123def456'
    let hash2 = 'xyz789ghi012'

    let etag1 = generateETag(hash1)
    let etag2 = generateETag(hash2)

    assert.notEqual(etag1, etag2)
  })

  it('generates same ETag for same hash', () => {
    let hash = 'abc123def456'

    let etag1 = generateETag(hash)
    let etag2 = generateETag(hash)

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
        assert.ok(
          code.includes('https://unpkg.com/@remix-run/component'),
          'should preserve CDN URL',
        )

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
