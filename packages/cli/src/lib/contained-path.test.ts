import * as path from 'node:path'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { resolveContainedPath } from './contained-path.ts'

describe('resolveContainedPath', () => {
  it('resolves paths inside the allowed root', () => {
    let rootDir = path.join(path.sep, 'tmp', 'remix-app')

    assert.equal(
      resolveContainedPath(rootDir, 'app/controllers/home.ts'),
      path.resolve(rootDir, 'app', 'controllers', 'home.ts'),
    )
  })

  it('rejects paths that escape the allowed root', () => {
    let rootDir = path.join(path.sep, 'tmp', 'remix-app')

    assert.throws(() => resolveContainedPath(rootDir, '../escape.ts'), /escapes the allowed root/)
  })
})
