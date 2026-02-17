import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import type { AssetsManifest } from '@remix-run/assets'
import { assets } from './assets.ts'

function toCurrentManifest(manifest: {
  scripts?: AssetsManifest['scripts']
  files?: AssetsManifest['files']
  outputs?: Record<string, { entryPoint?: string; imports?: Array<{ path: string; kind: string }> }>
}): AssetsManifest {
  return {
    scripts: {
      outputs: manifest.scripts?.outputs ?? manifest.outputs ?? {},
    },
    files: {
      outputs: manifest.files?.outputs ?? {},
    },
  }
}

describe('assets middleware', () => {
  it('resolves file asset variant from manifest.files.outputs', () => {
    let manifest = {
      files: {
        outputs: {
          'app/images/logo.png': {
            variants: {
              card: { path: 'assets/logo-card-abc123.png' },
            },
          },
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/images/logo.png', 'card')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/assets/logo-card-abc123.png')
    assert.deepEqual(result?.preloads, [])
  })

  it('resolves file asset default variant when variant is omitted', () => {
    let manifest = {
      files: {
        outputs: {
          'app/images/logo.png': {
            variants: {
              optimized: { path: 'assets/logo-optimized-abc123.png' },
              thumbnail: { path: 'assets/logo-thumbnail-def456.png' },
            },
            defaultVariant: 'optimized',
          },
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/images/logo.png')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/assets/logo-optimized-abc123.png')
    assert.deepEqual(result?.preloads, [])
  })

  it('returns null when variant is omitted for file that has no default variant', () => {
    let manifest = {
      files: {
        outputs: {
          'app/images/logo.png': {
            variants: {
              card: { path: 'assets/logo-card-abc123.png' },
            },
          },
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/images/logo.png')
    assert.equal(result, null)
  })

  it('returns null for non-existent entry points', () => {
    let manifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/non-existent.tsx')
    assert.equal(result, null)
  })

  it('returns href for an entry point', () => {
    let manifest = {
      outputs: {
        'build/entry-ABC123.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry-ABC123.js')
  })

  it('prepends baseUrl when provided (locally-scoped manifest)', () => {
    let manifest = {
      outputs: {
        'entry-ABC123.js': {
          entryPoint: 'app/entry.tsx',
          imports: [{ path: 'chunk-DEF456.js', kind: 'import-statement' }],
        },
        'chunk-DEF456.js': {},
      },
    }

    let middleware = assets(toCurrentManifest(manifest), { baseUrl: '/build/assets' })
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/assets/entry-ABC123.js')
    assert.deepEqual(result?.preloads, [
      '/build/assets/entry-ABC123.js',
      '/build/assets/chunk-DEF456.js',
    ])
  })

  it('normalizes baseUrl with trailing slash (no double slash in href)', () => {
    let manifest = {
      outputs: {
        'entry.js': { entryPoint: 'app/entry.tsx' },
      },
    }

    let middleware = assets(toCurrentManifest(manifest), { baseUrl: '/assets/' })
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/assets/entry.js')
  })

  it('normalizes entry paths with leading slashes', () => {
    let manifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('/app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry.js')
  })

  it('normalizes entry paths with leading ./', () => {
    let manifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('./app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry.js')
  })

  it('includes the entry in preloads', () => {
    let manifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.preloads, ['/build/entry.js'])
  })

  it('includes static imports in preloads', () => {
    let manifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
          imports: [{ path: 'build/chunk-utils.js', kind: 'import-statement' }],
        },
        'build/chunk-utils.js': {},
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.preloads, ['/build/entry.js', '/build/chunk-utils.js'])
  })

  it('includes transitive static imports in preloads', () => {
    let manifest = {
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

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.preloads, [
      '/build/entry.js',
      '/build/chunk-a.js',
      '/build/chunk-b.js',
      '/build/chunk-c.js',
    ])
  })

  it('excludes dynamic imports from preloads', () => {
    let manifest = {
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

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.preloads, ['/build/entry.js', '/build/chunk-static.js'])
  })

  it('handles circular imports without infinite loop', () => {
    let manifest = {
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

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.deepEqual(result?.preloads, [
      '/build/entry.js',
      '/build/chunk-a.js',
      '/build/chunk-b.js',
    ])
  })

  it('caches preload resolution', () => {
    let manifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
          imports: [{ path: 'build/chunk.js', kind: 'import-statement' }],
        },
        'build/chunk.js': {},
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result1 = mockContext.assets.resolve('app/entry.tsx')
    let result2 = mockContext.assets.resolve('app/entry.tsx')

    // Same array reference indicates caching
    assert.equal(result1?.preloads, result2?.preloads)
  })

  it('handles multiple entry points', () => {
    let manifest = {
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

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let main = mockContext.assets.resolve('app/main.tsx')
    assert.deepEqual(main?.preloads, ['/build/main.js', '/build/shared.js'])

    let admin = mockContext.assets.resolve('app/admin.tsx')
    assert.deepEqual(admin?.preloads, ['/build/admin.js', '/build/shared.js'])
  })

  it('handles output paths with ./ prefix', () => {
    let manifest = {
      outputs: {
        './build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/entry.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/entry.js')
  })

  it('handles nested entry point paths', () => {
    let manifest = {
      outputs: {
        'build/routes/admin/dashboard.js': {
          entryPoint: 'app/routes/admin/dashboard.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }
    middleware(mockContext as any, async () => new Response())

    let result = mockContext.assets.resolve('app/routes/admin/dashboard.tsx')
    assert.notEqual(result, null)
    assert.equal(result?.href, '/build/routes/admin/dashboard.js')
  })

  it('sets assets on context and calls next', async () => {
    let manifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
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
    let manifest = {
      outputs: {
        'build/entry.js': {
          entryPoint: 'app/entry.tsx',
        },
      },
    }

    let middleware = assets(toCurrentManifest(manifest))
    let mockContext = { assets: null as any }

    let capturedEntry: any = null
    await middleware(mockContext as any, async () => {
      capturedEntry = mockContext.assets.resolve('app/entry.tsx')
      return new Response('ok')
    })

    assert.notEqual(capturedEntry, null)
    assert.equal(capturedEntry.href, '/build/entry.js')
  })
})
