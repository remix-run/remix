import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createFingerprintedImportEmitter } from './fingerprinted-imports.ts'
import type { EmittedModule } from './emit.ts'
import type { ResolvedModule } from './resolve.ts'

describe('createFingerprintedImportEmitter', () => {
  it('emits dependency chains without recursive graph traversal', async () => {
    let modules = new Map<string, ResolvedModule>()
    for (let index = 0; index < 12_000; index++) {
      let identityPath = `/module-${index}.ts`
      let depPath = index + 1 < 12_000 ? `/module-${index + 1}.ts` : undefined
      modules.set(identityPath, createResolvedModule(identityPath, depPath ? [depPath] : []))
    }

    let emissions = await createFingerprintedImportEmitter(emitModule)(modules)

    assert.equal(emissions.size, modules.size)
    assert.equal(emissions.get('/module-0.ts')?.fingerprint, 'module-0.ts')
  })

  it('shares in-flight emissions between overlapping script graphs', async () => {
    let shared = createResolvedModule('/shared.ts', [])
    let entryA = createResolvedModule('/entry-a.ts', [shared.identityPath])
    let entryB = createResolvedModule('/entry-b.ts', [shared.identityPath])
    let emitCounts = new Map<string, number>()
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        emitCounts.set(
          resolvedModule.identityPath,
          (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1,
        )
        await Promise.resolve()
        return emitModule(resolvedModule, getRewrittenImportUrl)
      },
    )

    await Promise.all([
      emitFingerprintedImports(
        new Map([
          [entryA.identityPath, entryA],
          [shared.identityPath, shared],
        ]),
      ),
      emitFingerprintedImports(
        new Map([
          [entryB.identityPath, entryB],
          [shared.identityPath, shared],
        ]),
      ),
    ])

    assert.equal(emitCounts.get(shared.identityPath), 1)
    assert.equal(emitCounts.get(entryA.identityPath), 1)
    assert.equal(emitCounts.get(entryB.identityPath), 1)
  })

  it('reuses completed emissions between sequential overlapping script graphs', async () => {
    let shared = createResolvedModule('/shared.ts', [])
    let entryA = createResolvedModule('/entry-a.ts', [shared.identityPath])
    let entryB = createResolvedModule('/entry-b.ts', [shared.identityPath])
    let emitCounts = new Map<string, number>()
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        emitCounts.set(
          resolvedModule.identityPath,
          (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1,
        )
        return emitModule(resolvedModule, getRewrittenImportUrl)
      },
    )

    await emitFingerprintedImports(
      new Map([
        [entryA.identityPath, entryA],
        [shared.identityPath, shared],
      ]),
    )
    await emitFingerprintedImports(
      new Map([
        [entryB.identityPath, entryB],
        [shared.identityPath, shared],
      ]),
    )

    assert.equal(emitCounts.get(shared.identityPath), 1)
    assert.equal(emitCounts.get(entryA.identityPath), 1)
    assert.equal(emitCounts.get(entryB.identityPath), 1)
  })

  it('re-emits cached importers when dependency fingerprints change', async () => {
    let dependencyV1 = createResolvedModule('/dependency.ts', [])
    let dependencyV2 = createResolvedModule('/dependency.ts', [])
    let entry = createResolvedModule('/entry.ts', [dependencyV1.identityPath])
    let emitCounts = new Map<string, number>()
    let fingerprints = new WeakMap([
      [dependencyV1, 'dependency-v1'],
      [dependencyV2, 'dependency-v2'],
      [entry, 'entry'],
    ])
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        emitCounts.set(
          resolvedModule.identityPath,
          (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1,
        )
        for (let depPath of resolvedModule.deps) getRewrittenImportUrl(depPath)
        let fingerprint = fingerprints.get(resolvedModule)
        assert.ok(fingerprint)
        return {
          code: { content: '', etag: fingerprint, fingerprint },
          fingerprint,
          sourceMap: null,
        }
      },
    )

    await emitFingerprintedImports(
      new Map([
        [entry.identityPath, entry],
        [dependencyV1.identityPath, dependencyV1],
      ]),
    )
    await emitFingerprintedImports(
      new Map([
        [entry.identityPath, entry],
        [dependencyV2.identityPath, dependencyV2],
      ]),
    )

    assert.equal(emitCounts.get(dependencyV1.identityPath), 2)
    assert.equal(emitCounts.get(entry.identityPath), 2)
  })

  it('shares in-flight circular import emissions between overlapping script graphs', async () => {
    let cycleA = createResolvedModule('/cycle-a.ts', ['/cycle-b.ts'])
    let cycleB = createResolvedModule('/cycle-b.ts', ['/cycle-a.ts'])
    let entryA = createResolvedModule('/entry-a.ts', [cycleA.identityPath])
    let entryB = createResolvedModule('/entry-b.ts', [cycleB.identityPath])
    let emitCounts = new Map<string, number>()
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        emitCounts.set(
          resolvedModule.identityPath,
          (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1,
        )
        await Promise.resolve()
        return emitModule(resolvedModule, getRewrittenImportUrl)
      },
    )
    let cycleModules = [
      [cycleA.identityPath, cycleA],
      [cycleB.identityPath, cycleB],
    ] as const

    await Promise.all([
      emitFingerprintedImports(new Map([[entryA.identityPath, entryA], ...cycleModules])),
      emitFingerprintedImports(new Map([[entryB.identityPath, entryB], ...cycleModules])),
    ])

    assert.equal(emitCounts.get(cycleA.identityPath), 2)
    assert.equal(emitCounts.get(cycleB.identityPath), 2)
    assert.equal(emitCounts.get(entryA.identityPath), 1)
    assert.equal(emitCounts.get(entryB.identityPath), 1)
  })

  it('reuses circular import emissions between sequential overlapping script graphs', async () => {
    let cycleA = createResolvedModule('/cycle-a.ts', ['/cycle-b.ts'])
    let cycleB = createResolvedModule('/cycle-b.ts', ['/cycle-a.ts'])
    let entryA = createResolvedModule('/entry-a.ts', [cycleA.identityPath])
    let entryB = createResolvedModule('/entry-b.ts', [cycleB.identityPath])
    let emitCounts = new Map<string, number>()
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        emitCounts.set(
          resolvedModule.identityPath,
          (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1,
        )
        return emitModule(resolvedModule, getRewrittenImportUrl)
      },
    )
    let cycleModules = [
      [cycleA.identityPath, cycleA],
      [cycleB.identityPath, cycleB],
    ] as const

    await emitFingerprintedImports(new Map([[entryA.identityPath, entryA], ...cycleModules]))
    await emitFingerprintedImports(new Map([[entryB.identityPath, entryB], ...cycleModules]))

    assert.equal(emitCounts.get(cycleA.identityPath), 2)
    assert.equal(emitCounts.get(cycleB.identityPath), 2)
    assert.equal(emitCounts.get(entryA.identityPath), 1)
    assert.equal(emitCounts.get(entryB.identityPath), 1)
  })

  it('reuses completed dependencies when a later emission fails', async () => {
    let dependency = createResolvedModule('/dependency.ts', [])
    let entry = createResolvedModule('/entry.ts', [dependency.identityPath])
    let modules = new Map([
      [entry.identityPath, entry],
      [dependency.identityPath, dependency],
    ])
    let emitCounts = new Map<string, number>()
    let shouldFail = true
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        emitCounts.set(
          resolvedModule.identityPath,
          (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1,
        )
        if (resolvedModule === entry && shouldFail) throw new Error('Entry emission failed')
        return emitModule(resolvedModule, getRewrittenImportUrl)
      },
    )

    await assert.rejects(emitFingerprintedImports(modules), /Entry emission failed/)
    shouldFail = false

    let emissions = await emitFingerprintedImports(modules)

    assert.equal(emissions.size, 2)
    assert.equal(emitCounts.get(dependency.identityPath), 1)
    assert.equal(emitCounts.get(entry.identityPath), 2)
  })

  it('propagates a shared in-flight failure and retries the emission', async () => {
    let shared = createResolvedModule('/shared.ts', [])
    let entryA = createResolvedModule('/entry-a.ts', [shared.identityPath])
    let entryB = createResolvedModule('/entry-b.ts', [shared.identityPath])
    let emitCounts = new Map<string, number>()
    let shouldFail = true
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        emitCounts.set(
          resolvedModule.identityPath,
          (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1,
        )
        await Promise.resolve()
        if (resolvedModule === shared && shouldFail) throw new Error('Shared emission failed')
        return emitModule(resolvedModule, getRewrittenImportUrl)
      },
    )
    let graphA = new Map([
      [entryA.identityPath, entryA],
      [shared.identityPath, shared],
    ])
    let graphB = new Map([
      [entryB.identityPath, entryB],
      [shared.identityPath, shared],
    ])

    let results = await Promise.allSettled([
      emitFingerprintedImports(graphA),
      emitFingerprintedImports(graphB),
    ])

    assert.equal(results[0]?.status, 'rejected')
    assert.equal(results[1]?.status, 'rejected')
    assert.equal(emitCounts.get(shared.identityPath), 1)
    assert.equal(emitCounts.has(entryA.identityPath), false)
    assert.equal(emitCounts.has(entryB.identityPath), false)

    shouldFail = false
    let emissions = await emitFingerprintedImports(graphA)

    assert.equal(emissions.size, 2)
    assert.equal(emitCounts.get(shared.identityPath), 2)
    assert.equal(emitCounts.get(entryA.identityPath), 1)
  })

  it('retries circular imports after a fingerprint input fails to emit', async () => {
    let cycleA = createResolvedModule('/cycle-a.ts', ['/cycle-b.ts'])
    let cycleB = createResolvedModule('/cycle-b.ts', ['/cycle-a.ts'])
    let modules = new Map([
      [cycleA.identityPath, cycleA],
      [cycleB.identityPath, cycleB],
    ])
    let emitCounts = new Map<string, number>()
    let shouldFail = true
    let releasePendingEmission: (() => void) | undefined
    let pendingEmission = new Promise<void>((resolve) => {
      releasePendingEmission = resolve
    })
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        let emitCount = (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1
        emitCounts.set(resolvedModule.identityPath, emitCount)
        if (resolvedModule === cycleA && shouldFail) await pendingEmission
        if (resolvedModule === cycleB && shouldFail) {
          throw new Error('Fingerprint input emission failed')
        }
        return emitModule(resolvedModule, getRewrittenImportUrl)
      },
    )

    let firstAttempt = emitFingerprintedImports(modules)
    await Promise.resolve()
    let overlappingAttempt = emitFingerprintedImports(modules)
    await Promise.resolve()

    assert.equal(emitCounts.get(cycleA.identityPath), 1)
    assert.equal(emitCounts.get(cycleB.identityPath), 1)

    assert.ok(releasePendingEmission)
    releasePendingEmission()
    await assert.rejects(firstAttempt, /Fingerprint input emission failed/)
    await assert.rejects(overlappingAttempt, /Fingerprint input emission failed/)
    shouldFail = false

    let emissions = await emitFingerprintedImports(modules)

    assert.equal(emissions.size, 2)
    assert.equal(emitCounts.get(cycleA.identityPath), 3)
    assert.equal(emitCounts.get(cycleB.identityPath), 3)
  })

  it('retries circular imports after final emission fails', async () => {
    let cycleA = createResolvedModule('/cycle-a.ts', ['/cycle-b.ts'])
    let cycleB = createResolvedModule('/cycle-b.ts', ['/cycle-a.ts'])
    let modules = new Map([
      [cycleA.identityPath, cycleA],
      [cycleB.identityPath, cycleB],
    ])
    let emitCounts = new Map<string, number>()
    let shouldFail = true
    let emitFingerprintedImports = createFingerprintedImportEmitter(
      async (resolvedModule, getRewrittenImportUrl) => {
        let emitCount = (emitCounts.get(resolvedModule.identityPath) ?? 0) + 1
        emitCounts.set(resolvedModule.identityPath, emitCount)
        if (resolvedModule === cycleB && emitCount === 2 && shouldFail) {
          throw new Error('Final emission failed')
        }
        return emitModule(resolvedModule, getRewrittenImportUrl)
      },
    )

    await assert.rejects(emitFingerprintedImports(modules), /Final emission failed/)
    shouldFail = false

    let emissions = await emitFingerprintedImports(modules)

    assert.equal(emissions.size, 2)
    assert.equal(emitCounts.get(cycleA.identityPath), 4)
    assert.equal(emitCounts.get(cycleB.identityPath), 4)
  })
})

function createResolvedModule(identityPath: string, deps: string[]): ResolvedModule {
  return {
    deps,
    hmr: { acceptedDeps: [], selfAccepting: false, usesImportMetaHot: false },
    identityPath,
    imports: [],
    rawCode: '',
    resolvedPath: identityPath,
    sourceMap: null,
    stableUrlPathname: identityPath,
    staticDeps: deps,
    trackedFiles: [],
  }
}

function emitModule(
  resolvedModule: ResolvedModule,
  getRewrittenImportUrl: (identityPath: string) => string,
): Promise<EmittedModule> {
  for (let depPath of resolvedModule.deps) getRewrittenImportUrl(depPath)
  let fingerprint = resolvedModule.identityPath.slice(1)
  return Promise.resolve({
    code: { content: '', etag: fingerprint, fingerprint },
    fingerprint,
    sourceMap: null,
  })
}
