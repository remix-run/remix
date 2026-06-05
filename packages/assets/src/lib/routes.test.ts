import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

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

    assert.deepEqual(routes.resolveUrlPathname('/assets/app/entry.ts'), {
      basePathname: '/assets',
      filePath: 'C:/Users/runner/project/app/entry.ts',
    })
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

    assert.deepEqual(routes.resolveUrlPathname('/assets/app/entry.ts'), {
      basePathname: '/assets',
      filePath: '//server/share/project/app/entry.ts',
    })
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

    assert.deepEqual(routes.resolveUrlPathname('/assets/packages/shared/value.ts'), {
      basePathname: '/assets',
      filePath: '/repo/packages/shared/value.ts',
    })
    assert.equal(
      routes.toUrlPathname('/repo/packages/shared/value.ts'),
      '/assets/packages/shared/value.ts',
    )
  })

  it('supports optional URL-only params in the base path', () => {
    let routes = compileRoutes('/(:version/)assets', [
      {
        fileMap: {
          '/app/*path': 'app/*path',
        },
        rootDir: '/repo/project',
      },
    ])

    assert.deepEqual(routes.resolveUrlPathname('/assets/app/entry.ts'), {
      basePathname: '/assets',
      filePath: '/repo/project/app/entry.ts',
    })
    assert.deepEqual(routes.resolveUrlPathname('/v1.2.3/assets/app/entry.ts'), {
      basePathname: '/v1.2.3/assets',
      filePath: '/repo/project/app/entry.ts',
    })
    assert.equal(routes.toUrlPathname('/repo/project/app/entry.ts'), '/assets/app/entry.ts')
    assert.equal(
      routes.toUrlPathname('/repo/project/app/entry.ts', {
        params: { version: 'v1.2.3' },
      }),
      '/v1.2.3/assets/app/entry.ts',
    )
  })

  it('supports complex optional URL-only params in the base path', () => {
    let routes = compileRoutes('/(:a/)b/(:c/)d', [
      {
        fileMap: {
          '/app/*path': 'app/*path',
        },
        rootDir: '/repo/project',
      },
    ])

    assert.deepEqual(routes.resolveUrlPathname('/a/b/c/d/app/entry.ts'), {
      basePathname: '/a/b/c/d',
      filePath: '/repo/project/app/entry.ts',
    })
    assert.deepEqual(routes.resolveUrlPathname('/b/c/d/app/entry.ts'), {
      basePathname: '/b/c/d',
      filePath: '/repo/project/app/entry.ts',
    })
    assert.equal(
      routes.toUrlPathname('/repo/project/app/dependency.ts', {
        params: { a: 'a', c: 'c' },
      }),
      '/a/b/c/d/app/dependency.ts',
    )
    assert.equal(
      routes.toUrlPathname('/repo/project/app/dependency.ts', {
        params: { c: 'c' },
      }),
      '/b/c/d/app/dependency.ts',
    )
  })

  it('rejects required URL-only params in the base path', () => {
    assert.throws(
      () =>
        compileRoutes('/:version/assets', [
          {
            fileMap: {
              '/app/*path': 'app/*path',
            },
            rootDir: '/repo/project',
          },
        ]),
      /Base path params must be optional/,
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

    assert.deepEqual(routes.resolveUrlPathname('/assets/runtime/helpers/decorate.js'), {
      basePathname: '/assets',
      filePath: 'D:/repo/node_modules/@oxc-project/runtime/helpers/decorate.js',
    })
    assert.equal(
      routes.toUrlPathname(
        String.raw`D:\repo\node_modules\@oxc-project\runtime\helpers\decorate.js`,
      ),
      '/assets/runtime/helpers/decorate.js',
    )
  })
})
