import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createModuleStore } from './module-store.ts'
import type { ModuleSnapshot } from './module-store.ts'
import type { EmittedModule } from './scripts/emit.ts'
import type { ResolvedModule } from './scripts/resolve.ts'
import type { TransformedModule } from './scripts/transform.ts'

function createTransformedModule(): TransformedModule {
  return {
    fingerprint: null,
    hmr: {
      acceptedDeps: [],
      selfAccepting: false,
      usesImportMetaHot: false,
    },
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

function createResolvedModule(
  options: {
    acceptedDeps?: string[]
    deps?: string[]
    identityPath?: string
  } = {},
): ResolvedModule {
  let identityPath = options.identityPath ?? '/app/entry.ts'

  return {
    deps: options.deps ?? [],
    fingerprint: null,
    hmr: {
      acceptedDeps: (options.acceptedDeps ?? []).map((depPath, index) => ({
        depPath,
        end: index,
        start: index,
      })),
      selfAccepting: false,
      usesImportMetaHot: false,
    },
    identityPath,
    imports: [],
    trackedFiles: [identityPath],
    rawCode: 'export const value = 1',
    resolvedPath: identityPath,
    sourceMap: null,
    stableUrlPathname: `/assets${identityPath}`,
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
    assert.equal(record.transformed, transformed)
    assert.equal(store.isTransformedFresh(record), false)

    store.setTransformed('/app/entry.ts', transformed, [transformed])
    assert.equal(store.isTransformedFresh(record), true)
    store.invalidateForFileEvent('/app/entry.ts', 'change')
    assert.equal(record.invalidationVersion, 2)
    assert.equal(record.transformed, transformed)
    assert.equal(store.isTransformedFresh(record), false)
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

    assert.equal(record.emitted, emitted)
    assert.equal(store.isEmittedFresh(record), false)
    assert.equal(record.staleEmitted, emitted)
    assert.equal(record.staleEmittedSnapshot, snapshot)

    store.invalidateForFileEvent('/app/entry.ts', 'change')

    assert.equal(record.emitted, emitted)
    assert.equal(store.isEmittedFresh(record), false)
    assert.equal(record.staleEmitted, emitted)
    assert.equal(record.staleEmittedSnapshot, snapshot)
  })

  it('retains stale emitted modules but clears conditional snapshots across graph invalidations', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()
    let record = store.get('/app/entry.ts')
    let emitted = createEmittedModule()

    let transformed = createTransformedModule()
    store.setTransformed('/app/entry.ts', transformed, [transformed])
    store.setEmitted('/app/entry.ts', emitted, createModuleSnapshot())
    store.invalidateForFileEvent('/app/entry.ts', 'change')
    store.invalidateForFileEvent('/app/entry.ts', 'unlink')

    assert.equal(record.emitted, emitted)
    assert.equal(store.isEmittedFresh(record), false)
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

  it('retains stale resolved modules and links when a candidate file is added', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>({
      getAcceptedDependencies(resolved) {
        return resolved.hmr.acceptedDeps.map((acceptedDep) => acceptedDep.depPath)
      },
      getDependencies(resolved) {
        return resolved.deps
      },
    })
    let resolved = createResolvedModule({
      acceptedDeps: ['/app/value.ts'],
      deps: ['/app/value.ts'],
    })

    store.setResolved('/app/entry.ts', resolved, [
      resolved,
      {
        trackedDirectories: ['/app/foo/'],
        trackedFiles: ['/app/foo.ts'],
      },
    ])
    store.invalidateForFileEvent('/app/foo.ts', 'add')

    let record = store.get('/app/entry.ts')
    assert.equal(record.resolved, resolved)
    assert.equal(store.isResolvedFresh(record), false)
    assert.equal(store.getLastResolved('/app/entry.ts'), resolved)
    assert.deepEqual([...record.links.dependencies], ['/app/value.ts'])
    assert.deepEqual([...record.links.acceptedDependencies], ['/app/value.ts'])
    assert.deepEqual([...store.getImporters('/app/value.ts')], ['/app/entry.ts'])
    assert.deepEqual([...store.getAcceptedImporters('/app/value.ts')], ['/app/entry.ts'])
  })

  it('retains the last resolved module and links across content invalidations', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>({
      getAcceptedDependencies(resolved) {
        return resolved.hmr.acceptedDeps.map((acceptedDep) => acceptedDep.depPath)
      },
      getDependencies(resolved) {
        return resolved.deps
      },
    })
    let resolved = createResolvedModule({
      acceptedDeps: ['/app/accepted.ts'],
      deps: ['/app/value.ts'],
    })

    store.setResolved('/app/entry.ts', resolved, [resolved])
    store.invalidateForFileEvent('/app/entry.ts', 'change')

    let record = store.get('/app/entry.ts')
    assert.equal(record.resolved, resolved)
    assert.equal(store.isResolvedFresh(record), false)
    assert.equal(store.getLastResolved('/app/entry.ts'), resolved)
    assert.deepEqual([...record.links.dependencies], ['/app/value.ts'])
    assert.deepEqual([...record.links.acceptedDependencies], ['/app/accepted.ts'])
    assert.deepEqual([...store.getImporters('/app/value.ts')], ['/app/entry.ts'])
    assert.deepEqual([...store.getAcceptedImporters('/app/accepted.ts')], ['/app/entry.ts'])
  })

  it('emits watched file deltas using file-level ref counts', () => {
    let fileDeltas: Array<{ add: string[]; remove: string[] }> = []
    let directoryDeltas: Array<{ add: string[]; remove: string[] }> = []
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>({
      onWatchDirectoriesChange(delta) {
        directoryDeltas.push(delta)
      },
      onWatchFilesChange(delta) {
        fileDeltas.push(delta)
      },
    })

    store.setResolved('/app/entry.ts', createResolvedModule(), [
      {
        trackedFiles: ['/app/shared.ts', '/app/entry.ts'],
      },
    ])
    store.setResolved('/app/other.ts', createResolvedModule({ identityPath: '/app/other.ts' }), [
      {
        trackedFiles: ['/app/shared.ts', '/app/other.ts'],
      },
    ])
    store.clearResolved('/app/entry.ts', [])

    assert.deepEqual(fileDeltas, [
      { add: ['/app/shared.ts', '/app/entry.ts'], remove: [] },
      { add: ['/app/other.ts'], remove: [] },
      { add: [], remove: ['/app/entry.ts'] },
    ])
    assert.deepEqual(directoryDeltas, [{ add: ['/app'], remove: [] }])
  })

  it('retains HMR update timestamps across content invalidations', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()
    let transformed = createTransformedModule()

    store.setTransformed('/app/entry.ts', transformed, [transformed])
    store.setHmrUpdateTimestamp('/app/entry.ts', 123)
    store.invalidateForFileEvent('/app/entry.ts', 'change')

    assert.equal(store.getHmrUpdateTimestamp('/app/entry.ts'), 123)
  })

  it('retains the last resolved module when the current transform fails', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()
    let resolved = createResolvedModule()
    let transformed = createTransformedModule()

    store.setResolved('/app/entry.ts', resolved, [resolved])
    store.clearTransformed('/app/entry.ts', [transformed])

    assert.equal(store.get('/app/entry.ts').resolved, undefined)
    assert.equal(store.getLastResolved('/app/entry.ts'), resolved)
  })

  it('indexes importers from resolved module dependencies', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>({
      getDependencies(resolved) {
        return resolved.deps
      },
    })
    let resolved = createResolvedModule({
      deps: ['/app/value.ts'],
      identityPath: '/app/entry.ts',
    })

    store.setResolved('/app/entry.ts', resolved, [resolved])

    assert.deepEqual([...store.getImporters('/app/value.ts')], ['/app/entry.ts'])
  })

  it('indexes accepted importers from resolved module dependencies', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>({
      getAcceptedDependencies(resolved) {
        return resolved.hmr.acceptedDeps.map((acceptedDep) => acceptedDep.depPath)
      },
    })
    let resolved = createResolvedModule({
      acceptedDeps: ['/app/value.ts'],
      identityPath: '/app/entry.ts',
    })

    store.setResolved('/app/entry.ts', resolved, [resolved])

    assert.deepEqual([...store.getAcceptedImporters('/app/value.ts')], ['/app/entry.ts'])
  })

  it('replaces links and importer indexes when a module resolves again', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>({
      getAcceptedDependencies(resolved) {
        return resolved.hmr.acceptedDeps.map((acceptedDep) => acceptedDep.depPath)
      },
      getDependencies(resolved) {
        return resolved.deps
      },
    })
    let first = createResolvedModule({
      acceptedDeps: ['/app/one.ts'],
      deps: ['/app/one.ts'],
      identityPath: '/app/entry.ts',
    })
    let second = createResolvedModule({
      acceptedDeps: ['/app/two.ts'],
      deps: ['/app/two.ts'],
      identityPath: '/app/entry.ts',
    })

    store.setResolved('/app/entry.ts', first, [first])
    store.setResolved('/app/entry.ts', second, [second])

    let record = store.get('/app/entry.ts')
    assert.deepEqual([...record.links.dependencies], ['/app/two.ts'])
    assert.deepEqual([...record.links.acceptedDependencies], ['/app/two.ts'])
    assert.deepEqual([...store.getImporters('/app/one.ts')], [])
    assert.deepEqual([...store.getAcceptedImporters('/app/one.ts')], [])
    assert.deepEqual([...store.getImporters('/app/two.ts')], ['/app/entry.ts'])
    assert.deepEqual([...store.getAcceptedImporters('/app/two.ts')], ['/app/entry.ts'])
  })

  it('retains stale resolved modules and links across graph invalidations', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>({
      getAcceptedDependencies(resolved) {
        return resolved.hmr.acceptedDeps.map((acceptedDep) => acceptedDep.depPath)
      },
      getDependencies(resolved) {
        return resolved.deps
      },
    })
    let resolved = createResolvedModule({
      acceptedDeps: ['/app/value.ts'],
      deps: ['/app/value.ts'],
      identityPath: '/app/entry.ts',
    })

    store.setResolved('/app/entry.ts', resolved, [resolved])
    store.invalidateForFileEvent('/app/entry.ts', 'unlink')

    let record = store.get('/app/entry.ts')
    assert.equal(record.resolved, resolved)
    assert.equal(store.isResolvedFresh(record), false)
    assert.equal(store.getLastResolved('/app/entry.ts'), resolved)
    assert.deepEqual([...record.links.dependencies], ['/app/value.ts'])
    assert.deepEqual([...record.links.acceptedDependencies], ['/app/value.ts'])
    assert.deepEqual([...store.getImporters('/app/value.ts')], ['/app/entry.ts'])
    assert.deepEqual([...store.getAcceptedImporters('/app/value.ts')], ['/app/entry.ts'])
  })

  it('clears HMR update timestamps across graph invalidations', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>()

    store.setHmrUpdateTimestamp('/app/entry.ts', 123)
    store.invalidateAll()

    assert.equal(store.getHmrUpdateTimestamp('/app/entry.ts'), undefined)
  })

  it('retains stale resolved modules and links when all records are invalidated', () => {
    let store = createModuleStore<TransformedModule, ResolvedModule, EmittedModule>({
      getAcceptedDependencies(resolved) {
        return resolved.hmr.acceptedDeps.map((acceptedDep) => acceptedDep.depPath)
      },
      getDependencies(resolved) {
        return resolved.deps
      },
    })
    let resolved = createResolvedModule({
      acceptedDeps: ['/app/value.ts'],
      deps: ['/app/value.ts'],
      identityPath: '/app/entry.ts',
    })

    store.setResolved('/app/entry.ts', resolved, [resolved])
    store.invalidateAll()

    let record = store.get('/app/entry.ts')
    assert.equal(record.resolved, resolved)
    assert.equal(store.isResolvedFresh(record), false)
    assert.equal(store.getLastResolved('/app/entry.ts'), resolved)
    assert.deepEqual([...record.links.dependencies], ['/app/value.ts'])
    assert.deepEqual([...record.links.acceptedDependencies], ['/app/value.ts'])
    assert.deepEqual([...store.getImporters('/app/value.ts')], ['/app/entry.ts'])
    assert.deepEqual([...store.getAcceptedImporters('/app/value.ts')], ['/app/entry.ts'])
  })
})
