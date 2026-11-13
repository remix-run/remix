import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createBarrelFileImportOptimizer } from './optimize-barrel-file-imports.ts'
import type { ResolvedModule } from './resolve.ts'

describe('createBarrelFileImportOptimizer', () => {
  it('handles deep dependency graphs without overflowing the call stack', () => {
    let graph = new Map<string, ResolvedModule>()
    for (let index = 0; index < 12_000; index++) {
      let identityPath = `/module-${index}.js`
      let deps = index < 11_999 ? [`/module-${index + 1}.js`] : []
      let imports = deps.map((depPath) => ({
        compiledSpecifier: depPath,
        depPath,
        end: 8 + depPath.length,
        specifier: depPath,
        start: 8,
      }))
      graph.set(identityPath, {
        deps,
        hmr: { acceptedDeps: [], selfAccepting: false, usesImportMetaHot: false },
        identityPath,
        importRewrites: [],
        imports,
        packageJsonPath: null,
        rawCode:
          deps.length > 0
            ? `import "${deps[0]}"; export const value = 1`
            : 'export const value = 1',
        resolvedPath: identityPath,
        runtimeImports: imports,
        sourceMap: null,
        staticDeps: deps,
        stableUrlPathname: identityPath,
        trackedFiles: [],
      })
    }

    let optimized = createBarrelFileImportOptimizer()(graph)

    assert.equal(optimized.size, graph.size)
    assert.equal(optimized.get('/module-0.js'), graph.get('/module-0.js'))
  })
})
