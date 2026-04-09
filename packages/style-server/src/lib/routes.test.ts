import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compileRoutes } from './routes.ts'

describe('compileRoutes', () => {
  it('supports windows-style roots without parsing them as route syntax', () => {
    let routes = compileRoutes({
      root: String.raw`C:\Users\runner\project`,
      routes: [{ urlPattern: '/styles/app/*path', filePattern: 'app/*path' }],
    })

    assert.equal(
      routes.resolveUrlPathname('/styles/app/entry.css'),
      'C:/Users/runner/project/app/entry.css',
    )
    assert.equal(
      routes.toUrlPathname(String.raw`C:\Users\runner\project\app\entry.css`),
      '/styles/app/entry.css',
    )
  })

  it('rejects absolute file patterns', () => {
    assert.throws(
      () =>
        compileRoutes({
          root: '/project',
          routes: [{ urlPattern: '/styles/*path', filePattern: '/app/styles/*path' }],
        }),
      /File route patterns must be relative to style-server root/,
    )
  })

  it('rejects unnamed route wildcards because routes must be reversible', () => {
    assert.throws(
      () =>
        compileRoutes({
          root: '/project',
          routes: [{ urlPattern: '/styles/*', filePattern: 'app/styles/*path' }],
        }),
      /route patterns must use named wildcards for reversible mapping/i,
    )
  })

  it('rejects mismatched capture structure', () => {
    assert.throws(
      () =>
        compileRoutes({
          root: '/project',
          routes: [{ urlPattern: '/styles/:scope/*path', filePattern: 'app/styles/*path' }],
        }),
      /Route patterns must have matching capture structure/,
    )
  })
})
