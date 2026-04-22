import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createModuleStore } from './store.ts'
import type { TransformedModule } from './transform.ts'

describe('createModuleStore', () => {
  it('increments a record version on each invalidation', () => {
    let store = createModuleStore()
    let record = store.get('/app/entry.ts')
    let transformed: TransformedModule = {
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

    store.setTransformed('/app/entry.ts', transformed)

    assert.equal(record.invalidationVersion, 0)

    store.invalidateForFileEvent('/app/entry.ts', 'change')
    assert.equal(record.invalidationVersion, 1)
    assert.equal(record.transformed, undefined)

    store.setTransformed('/app/entry.ts', transformed)
    store.invalidateForFileEvent('/app/entry.ts', 'change')
    assert.equal(record.invalidationVersion, 2)
    assert.equal(record.transformed, undefined)
  })
})
