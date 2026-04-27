import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createModuleStore } from './module-store.ts'
import type { ModuleSnapshot } from './module-store.ts'
import type { EmittedModule } from './scripts/emit.ts'
import type { ResolvedModule } from './scripts/resolve.ts'
import type { TransformedModule } from './scripts/transform.ts'

function createTransformedModule(): TransformedModule {
  return {
    fingerprint: null,
    identityPath: '/app/entry.ts',
    importerDir: '/app',
    packageSpecifiers: [],
    rawCode: 'export const value = 1',
    resolvedPath: '/app/entry.ts',
    sourceMap: null,
    stableUrlPathname: '/assets/app/entry.ts',
    trackedFiles: ['/app/entry.ts'],
    unresolvedImports: [],
  }
}

function createEmittedModule(): EmittedModule {
  return {
    code: {
      content: 'export const value = 1',
      etag: 'W/"code"',
    },
    fingerprint: null,
    importUrls: [],
    sourceMap: null,
  }
}

function createResolvedModule(): ResolvedModule {
  return {
    deps: [],
    fingerprint: null,
    identityPath: '/app/entry.ts',
    imports: [],
    trackedFiles: ['/app/entry.ts'],
    rawCode: 'export const value = 1',
    resolvedPath: '/app/entry.ts',
    sourceMap: null,
    stableUrlPathname: '/assets/app/entry.ts',
  }
}

function createModuleSnapshot(): ModuleSnapshot {
  return new Map([
    [
      '/app/entry.ts',
      {
        mtimeNs: 1n,
        size: 22n,
      },
    ],
  ])
}

describe('createModuleStore', () => {
  it('increments a record version on each invalidation', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()
    let record = store.get('/app/entry.ts')
    let transformed = createTransformedModule()

    store.setTransformed('/app/entry.ts', transformed, [transformed])

    assert.equal(record.invalidationVersion, 0)

    store.invalidateForFileEvent('/app/entry.ts', 'change')
    assert.equal(record.invalidationVersion, 1)
    assert.equal(record.transformed, undefined)

    store.setTransformed('/app/entry.ts', transformed, [transformed])
    store.invalidateForFileEvent('/app/entry.ts', 'change')
    assert.equal(record.invalidationVersion, 2)
    assert.equal(record.transformed, undefined)
  })

  it('retains stale emitted modules across change invalidations', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()
    let record = store.get('/app/entry.ts')
    let emitted = createEmittedModule()
    let snapshot = createModuleSnapshot()

    let transformed = createTransformedModule()
    store.setTransformed('/app/entry.ts', transformed, [transformed])
    store.setEmitted('/app/entry.ts', emitted, snapshot)

    store.invalidateForFileEvent('/app/entry.ts', 'change')

    assert.equal(record.emitted, undefined)
    assert.equal(record.staleEmitted, emitted)
    assert.equal(record.staleEmittedSnapshot, snapshot)

    store.invalidateForFileEvent('/app/entry.ts', 'change')

    assert.equal(record.emitted, undefined)
    assert.equal(record.staleEmitted, emitted)
    assert.equal(record.staleEmittedSnapshot, snapshot)
  })

  it('clears stale emitted modules across structural invalidations', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()
    let record = store.get('/app/entry.ts')

    let transformed = createTransformedModule()
    store.setTransformed('/app/entry.ts', transformed, [transformed])
    store.setEmitted('/app/entry.ts', createEmittedModule(), createModuleSnapshot())
    store.invalidateForFileEvent('/app/entry.ts', 'change')
    store.invalidateForFileEvent('/app/entry.ts', 'unlink')

    assert.equal(record.staleEmitted, undefined)
    assert.equal(record.staleEmittedSnapshot, undefined)
  })

  it('does not retain stale emitted modules without a snapshot', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()
    let record = store.get('/app/entry.ts')

    let transformed = createTransformedModule()
    store.setTransformed('/app/entry.ts', transformed, [transformed])
    store.setEmitted('/app/entry.ts', createEmittedModule(), null)
    store.invalidateForFileEvent('/app/entry.ts', 'change')

    assert.equal(record.staleEmitted, undefined)
    assert.equal(record.staleEmittedSnapshot, undefined)
  })

  it('invalidates records for structural candidate file events', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()
    let record = store.get('/app/entry.ts')
    let resolved = createResolvedModule()

    store.setResolved('/app/entry.ts', resolved, [
      resolved,
      {
        trackedFiles: ['/app/foo.ts'],
        trackedDirectories: ['/app/foo/'],
      },
    ])

    store.invalidateForFileEvent('/app/foo.ts', 'add')
    assert.equal(record.invalidationVersion, 1)

    store.setResolved('/app/entry.ts', resolved, [
      resolved,
      {
        trackedFiles: ['/app/foo.ts'],
        trackedDirectories: ['/app/foo/'],
      },
    ])

    store.invalidateForFileEvent('/app/foo/bar.ts', 'unlink')
    assert.equal(record.invalidationVersion, 2)
  })
})
