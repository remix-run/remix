import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { compileRoutes } from './routes.ts'

describe('compileRoutes', () => {
  it('supports windows-style roots without parsing them as route syntax', () => {
    let routes = compileRoutes({
      fileMap: {
        '/assets/app/*path': 'app/*path',
      },
      rootDir: String.raw`C:\Users\runner\project`,
    })

    assert.equal(
      routes.resolveUrlPathname('/assets/app/entry.ts'),
      'C:/Users/runner/project/app/entry.ts',
    )
    assert.equal(
      routes.toUrlPathname(String.raw`C:\Users\runner\project\app\entry.ts`),
      '/assets/app/entry.ts',
    )
  })

  it('supports file patterns outside the root directory', () => {
    let routes = compileRoutes({
      fileMap: {
        '/assets/packages/*path': '../packages/*path',
      },
      rootDir: '/repo/project',
    })

    assert.equal(
      routes.resolveUrlPathname('/assets/packages/shared/value.ts'),
      '/repo/packages/shared/value.ts',
    )
    assert.equal(
      routes.toUrlPathname('/repo/packages/shared/value.ts'),
      '/assets/packages/shared/value.ts',
    )
  })
})
