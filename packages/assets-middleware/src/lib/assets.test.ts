import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { assets, type AssetManifest } from './assets.ts'

describe('assets middleware', () => {
  it('returns null for non-existent entry points', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/non-existent.tsx')
    assert.equal(result, null)
  })

  it('returns href for an entry point', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry-ABC123.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry-ABC123.js')
  })

  it('prepends baseUrl when provided (locally-scoped manifest)', () => {
    let manifest: AssetManifest = {
      outputs: {
        'entry-ABC123.js': {
          entryPoint: 'app/entry.tsx',
          imports: [{ path: 'chunk-DEF456.js', kind: 'import-statement' }],
        },
        'chunk-DEF456.js': {},
      },
    }

    let middleware = assets(manifest, { baseUrl: '/build/assets' })
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/assets/entry-ABC123.js')
    assert.deepEqual(result?.chunks, [
      '/build/assets/entry-ABC123.js',
      '/build/assets/chunk-DEF456.js',
    ])
  })

  it('normalizes baseUrl with trailing slash (no double slash in href)', () => {
    let manifest: AssetManifest = {
      outputs: {
        'entry.js': { entryPoint: 'app/entry.tsx' },
      },
    }

    let middleware = assets(manifest, { baseUrl: '/assets/' })
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/assets/entry.js')
  })

  it('normalizes entry paths with leading slashes', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('/app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry.js')
  })

  it('normalizes entry paths with leading ./', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('./app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry.js')
  })

  it('includes the entry in chunks', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.chunks, ['/build/entry.js'])
  })

  it('includes static imports in chunks', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
          imports: [{ path: 'build/chunk-utils.js', kind: 'import-statement' }],
        },
        'build/chunk-utils.js': {},
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.chunks, ['/build/entry.js', '/build/chunk-utils.js'])
  })

  it('includes transitive static imports in chunks', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
          imports: [{ path: 'build/chunk-a.js', kind: 'import-statement' }],
        },
        'build/chunk-a.js': {
          imports: [{ path: 'build/chunk-b.js', kind: 'import-statement' }],
        },
        'build/chunk-b.js': {
          imports: [{ path: 'build/chunk-c.js', kind: 'import-statement' }],
        },
        'build/chunk-c.js': {},
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.chunks, [
      '/build/entry.js',
      '/build/chunk-a.js',
      '/build/chunk-b.js',
      '/build/chunk-c.js',
    ])
  })

  it('excludes dynamic imports from chunks', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
          imports: [
            { path: 'build/chunk-static.js', kind: 'import-statement' },
            { path: 'build/chunk-dynamic.js', kind: 'dynamic-import' },
          ],
        },
        'build/chunk-static.js': {},
        'build/chunk-dynamic.js': {},
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.chunks, ['/build/entry.js', '/build/chunk-static.js'])
  })

  it('handles circular imports without infinite loop', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
          imports: [{ path: 'build/chunk-a.js', kind: 'import-statement' }],
        },
        'build/chunk-a.js': {
          imports: [{ path: 'build/chunk-b.js', kind: 'import-statement' }],
        },
        'build/chunk-b.js': {
          imports: [{ path: 'build/chunk-a.js', kind: 'import-statement' }],
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.chunks, ['/build/entry.js', '/build/chunk-a.js', '/build/chunk-b.js'])
  })

  it('caches chunk resolution', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
          imports: [{ path: 'build/chunk.js', kind: 'import-statement' }],
        },
        'build/chunk.js': {},
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result1 = mockContext.assets.get('app/entry.tsx')
    let result2 = mockContext.assets.get('app/entry.tsx')

    // Same array reference indicates caching
    assert.equal(result1?.chunks, result2?.chunks)
  })

  it('handles multiple entry points', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/main.js': {
          entryPoint: 'app/main.tsx',
          imports: [{ path: 'build/shared.js', kind: 'import-statement' }],
        },
        'build/admin.js': {
          entryPoint: 'app/admin.tsx',
          imports: [{ path: 'build/shared.js', kind: 'import-statement' }],
        },
        'build/shared.js': {},
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let main = mockContext.assets.get('app/main.tsx')
    assert.deepEqual(main?.chunks, ['/build/main.js', '/build/shared.js'])

    let admin = mockContext.assets.get('app/admin.tsx')
    assert.deepEqual(admin?.chunks, ['/build/admin.js', '/build/shared.js'])
  })

  it('handles output paths with ./ prefix', () => {
    let manifest: AssetManifest = {
      outputs: {
        './build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry.js')
  })

  it('handles nested entry point paths', () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/routes/admin/dashboard.js': {
          entryPoint: 'app/routes/admin/dashboard.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/routes/admin/dashboard.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/routes/admin/dashboard.js')
  })

  it('sets assets on context and calls next', async () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }

    let nextCalled = false
    await middleware(mockContext as any, async () => {
      nextCalled = true
      return new Response('ok')
    })

    assert.equal(nextCalled, true)
    assert.notEqual(mockContext.assets, null)
  })

  it('allows route handlers to access assets', async () => {
    let manifest: AssetManifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }

    let capturedEntry: any = null
    await middleware(mockContext as any, async () => {
      capturedEntry = mockContext.assets.get('app/entry.tsx')
      return new Response('ok')
    })

    assert.notEqual(capturedEntry, null)
    assert.equal(capturedEntry.href, '/build/entry.js')
  })
})

describe('realistic esbuild metafile', () => {
  it('works with a realistic esbuild output structure', () => {
    // This simulates a real esbuild metafile structure
    let manifest: AssetManifest = {
      outputs: {
        'build/entry-XYZABC.js': {
          entryPoint: 'app/entry.tsx',
          imports: [
            { path: 'build/chunk-COMPONENT.js', kind: 'import-statement' },
            { path: 'build/chunk-UTILS.js', kind: 'import-statement' },
            { path: 'build/chunk-LAZY.js', kind: 'dynamic-import' },
          ],
        },
        'build/chunk-COMPONENT.js': {
          imports: [{ path: 'build/chunk-SCHEDULER.js', kind: 'import-statement' }],
        },
        'build/chunk-UTILS.js': {
          imports: [{ path: 'build/chunk-COMPONENT.js', kind: 'import-statement' }],
        },
        'build/chunk-SCHEDULER.js': {},
        'build/chunk-LAZY.js': {
          imports: [{ path: 'build/chunk-COMPONENT.js', kind: 'import-statement' }],
        },
      },
    }

    let middleware = assets(manifest)
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.get('app/entry.tsx')

    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry-XYZABC.js')

    // Should include entry + static imports, but NOT the lazy-loaded chunk
    assert.ok(result?.chunks.includes('/build/entry-XYZABC.js'))
    assert.ok(result?.chunks.includes('/build/chunk-COMPONENT.js'))
    assert.ok(result?.chunks.includes('/build/chunk-UTILS.js'))
    assert.ok(result?.chunks.includes('/build/chunk-SCHEDULER.js'))
    assert.ok(!result?.chunks.includes('/build/chunk-LAZY.js'))
  })
})
