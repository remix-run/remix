import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { compileRoutes } from './routes.ts'

describe('compileRoutes', () => {
  it('supports mount paths without leading slashes', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { app: 'app' },
        rootDir: '/repo/project',
      },
    ])

    assert.equal(routes.resolveUrlPathname('/assets/app/entry.ts'), '/repo/project/app/entry.ts')
    assert.equal(routes.toUrlPathname('/repo/project/app/entry.ts'), '/assets/app/entry.ts')
  })

  it('supports mount paths with leading slashes', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { '/app': 'app' },
        rootDir: '/repo/project',
      },
    ])

    assert.equal(routes.resolveUrlPathname('/assets/app/entry.ts'), '/repo/project/app/entry.ts')
    assert.equal(routes.toUrlPathname('/repo/project/app/entry.ts'), '/assets/app/entry.ts')
  })

  it('normalizes leading and trailing slashes in mount paths', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { '/app/': 'app' },
        rootDir: '/repo/project',
      },
    ])

    assert.equal(routes.resolveUrlPathname('/assets/app/entry.ts'), '/repo/project/app/entry.ts')
    assert.equal(routes.toUrlPathname('/repo/project/app/entry.ts'), '/assets/app/entry.ts')
  })

  it('canonicalizes mount URL roots as URL pathnames', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { 'café files': 'app' },
        rootDir: '/repo/project',
      },
    ])

    assert.equal(
      routes.resolveUrlPathname('/assets/caf%C3%A9%20files/entry.ts'),
      '/repo/project/app/entry.ts',
    )
    assert.equal(
      routes.toUrlPathname('/repo/project/app/entry.ts'),
      '/assets/caf%C3%A9%20files/entry.ts',
    )
  })

  it('supports windows-style roots', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { app: 'app' },
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
        mounts: { app: 'app' },
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

  it('supports file roots outside the root directory', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { packages: '../packages' },
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

  it('supports mount configs with different root directories', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { app: 'app' },
        rootDir: String.raw`C:\repo\project`,
      },
      {
        mounts: { runtime: '@oxc-project/runtime' },
        rootDir: String.raw`D:\repo\node_modules`,
      },
    ])

    assert.equal(
      routes.resolveUrlPathname('/assets/runtime/helpers/decorate.js'),
      'D:/repo/node_modules/@oxc-project/runtime/helpers/decorate.js',
    )
    assert.equal(
      routes.toUrlPathname(
        String.raw`D:\repo\node_modules\@oxc-project\runtime\helpers\decorate.js`,
      ),
      '/assets/runtime/helpers/decorate.js',
    )
  })

  it('decodes generated file paths while keeping URL pathnames encoded', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { npm: 'node_modules' },
        rootDir: '/repo/project',
      },
    ])

    assert.equal(
      routes.resolveUrlPathname('/assets/npm/%40remix-run/ui/jsx-runtime.ts'),
      '/repo/project/node_modules/@remix-run/ui/jsx-runtime.ts',
    )
    assert.equal(
      routes.toUrlPathname('/repo/project/node_modules/@remix-run/ui/jsx-runtime.ts'),
      '/assets/npm/%40remix-run/ui/jsx-runtime.ts',
    )
  })

  it('does not resolve encoded paths outside a mount', () => {
    let routes = compileRoutes('/assets', [
      {
        mounts: { app: 'app' },
        rootDir: '/repo/project',
      },
    ])

    assert.equal(routes.resolveUrlPathname('/assets/app/%2E%2E/secret.ts'), null)
    assert.equal(routes.resolveUrlPathname('/assets/app/%2Fetc/passwd'), null)
  })

  it('rejects incompatible overlapping URL roots', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { app: 'app', 'app/routes': 'routes' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts keys must not overlap\. Received "app" and "app\/routes"\./,
    )
  })

  it('rejects compatible but redundant overlapping roots', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { app: 'app', 'app/vendor': 'app/vendor' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts values must not overlap\. Received "app" and "app\/vendor"/,
    )
  })

  it('rejects URL roots that overlap after URL canonicalization', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { 'app files': 'app', 'app%20files': 'other' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts keys must not overlap\. Received "app files" and "app%20files"\./,
    )
  })

  it('rejects URL roots that overlap after slash normalization', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { app: 'app', '/app/': 'other' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts keys must not overlap\. Received "app" and "\/app\/"\./,
    )
  })

  it('rejects nested URL roots after slash normalization', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { '/app/': 'app', '/app/routes/': 'routes' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts keys must not overlap\. Received "\/app\/" and "\/app\/routes\/"\./,
    )
  })

  it('rejects URL roots containing query strings', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { 'app?variant': 'app' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts keys must be URL pathnames .* Received "app\?variant"\./,
    )
  })

  it('rejects URL roots containing fragments', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { 'app#fragment': 'app' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts keys must be URL pathnames .* Received "app#fragment"\./,
    )
  })

  it('rejects URL roots containing encoded dot segments', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { 'app/%2e%2e/other': 'app' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts keys must be URL pathnames .* Received "app\/%2e%2e\/other"\./,
    )
  })

  it('rejects overlapping file roots', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { app: 'app', routes: 'app/routes' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts values must not overlap\. Received "app" and "app\/routes"/,
    )
  })

  it('rejects overlapping file roots after slash normalization', () => {
    assert.throws(
      () =>
        compileRoutes('/assets', [
          {
            mounts: { app: 'app/', routes: 'app/routes/' },
            rootDir: '/repo/project',
          },
        ]),
      /mounts values must not overlap\. Received "app\/" and "app\/routes\/"/,
    )
  })
})
