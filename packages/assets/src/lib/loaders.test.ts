import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { registerHooks } from 'node:module'
import type { ModuleLoader } from './loaders.ts'

type NodeModuleLoader = NonNullable<Parameters<typeof registerHooks>[0]['load']>

describe('ModuleLoader', () => {
  it('is type-compatible with Node synchronous load hooks in both directions', () => {
    let nodeLoader = ((url, context, nextLoad) => nextLoad(url, context)) satisfies NodeModuleLoader

    let assetLoader: ModuleLoader = nodeLoader
    let nodeCompatibleLoader: NodeModuleLoader = assetLoader

    assert.equal(nodeCompatibleLoader, nodeLoader)
  })
})
