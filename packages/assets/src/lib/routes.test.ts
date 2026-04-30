import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compileRoutes } from './routes.ts'

describe('compileRoutes', () => {
  it('supports windows-style roots without parsing them as route syntax', () => {
    let routes = compileRoutes('/assets', [
      {
        fileMap: {
          '/app/*path': 'app/*path',
        },
        rootDir: String.raw`C:\Users\runner\project`,
      },
    ])

    assert.equal(
      routes.resolveUrlPathname('/assets/app/entry.ts'),
      'C:/Users/runner/project/app/entry.ts',
    )
    assert.equal(
      routes.toUrlPathname(String.raw`C:\Users\runner\project\app\entry.ts`),
      '/assets/app/entry.ts',
    )
  })

  it('supports UNC roots when mapping file paths back to URLs', () => {
    let routes = compileRoutes('/assets', [
      {
        fileMap: {
          '/app/*path': 'app/*path',
        },
        rootDir: String.raw`\\server\share\project`,
      },
    ])

    assert.equal(
      routes.resolveUrlPathname('/assets/app/entry.ts'),
      '//server/share/project/app/entry.ts',
    )
    assert.equal(
      routes.toUrlPathname(String.raw`\\server\share\project\app\entry.ts`),
      '/assets/app/entry.ts',
    )
  })

  it('supports file patterns outside the root directory', () => {
    let routes = compileRoutes('/assets', [
      {
        fileMap: {
          '/packages/*path': '../packages/*path',
        },
        rootDir: '/repo/project',
      },
    ])

    assert.equal(
      routes.resolveUrlPathname('/assets/packages/shared/value.ts'),
      '/repo/packages/shared/value.ts',
    )
    assert.equal(
      routes.toUrlPathname('/repo/packages/shared/value.ts'),
      '/assets/packages/shared/value.ts',
    )
  })

  it('supports route configs with different root directories', () => {
    let routes = compileRoutes('/assets', [
      {
        fileMap: {
          '/app/*path': 'app/*path',
        },
        rootDir: String.raw`C:\repo\project`,
      },
      {
        fileMap: {
          '/runtime/*path': '@oxc-project/runtime/*path',
        },
        rootDir: String.raw`D:\repo\node_modules`,
      },
    ])

    assert.equal(
      routes.resolveUrlPathname('/assets/runtime/helpers/decorate.js'),
      'D:/repo/node_modules/@oxc-project/runtime/helpers/decorate.js',
    )
    assert.equal(
      routes.toUrlPathname(String.raw`D:\repo\node_modules\@oxc-project\runtime\helpers\decorate.js`),
      '/assets/runtime/helpers/decorate.js',
    )
  })
})
