import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compileRoutes, normalizeFilePath } from './routes.ts'

describe('compileRoutes', () => {
  it('normalizes standard windows absolute paths consistently', () => {
    assert.equal(normalizeFilePath(String.raw`C:\Users\runner\project`), '/C:/Users/runner/project')
    assert.equal(normalizeFilePath('/C:/Users/runner/project'), '/C:/Users/runner/project')
  })

  it('supports windows-style roots without parsing them as route syntax', () => {
    let routes = compileRoutes({
      root: String.raw`C:\Users\runner\project`,
      routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
    })

    assert.equal(
      routes.resolveUrlPathname('/scripts/app/entry.ts'),
      '/C:/Users/runner/project/app/entry.ts',
    )
    assert.equal(
      routes.toUrlPathname(String.raw`C:\Users\runner\project\app\entry.ts`),
      '/scripts/app/entry.ts',
    )
  })
})
