import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compileRoutes } from './routes.ts'

describe('compileRoutes', () => {
  it('supports windows-style roots without parsing them as route syntax', () => {
    let routes = compileRoutes({
      root: '/C:/Users/runner/project',
      routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
    })

    assert.equal(
      routes.resolveUrlPathname('/scripts/app/entry.ts'),
      '/C:/Users/runner/project/app/entry.ts',
    )
    assert.equal(
      routes.toUrlPathname('/C:/Users/runner/project/app/entry.ts'),
      '/scripts/app/entry.ts',
    )
  })
})
