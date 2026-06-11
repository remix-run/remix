import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ResolveResult, ResolverFactory } from 'oxc-resolver'

import { normalizeFilePath } from '../paths.ts'
import { resolveComponentHmrRefreshSpecifier } from './transform.ts'

const packageRoot = path.resolve(import.meta.dirname, '../../..')
const repoPackagesRoot = path.resolve(packageRoot, '..')
const remixPackageJson = JSON.parse(
  fs.readFileSync(path.join(repoPackagesRoot, 'remix/package.json'), 'utf-8'),
) as { exports?: Record<string, unknown> }
const uiPackageJson = JSON.parse(
  fs.readFileSync(path.join(repoPackagesRoot, 'ui/package.json'), 'utf-8'),
) as { exports?: Record<string, unknown> }

function createResolverFactory(resolvedPaths: Record<string, string>): ResolverFactory {
  return {
    async resolveFileAsync(_importerPath: string, specifier: string): Promise<ResolveResult> {
      let resolvedPath = resolvedPaths[specifier]
      return resolvedPath === undefined ? { error: 'not found' } : { path: resolvedPath }
    },
  } as ResolverFactory
}

describe('resolveComponentHmrRefreshSpecifier', () => {
  let importerPath = path.resolve('/app/component.ts')
  let remixRefreshPath = path.resolve('/app/node_modules/remix/src/ui/dev/refresh.ts')
  let uiRefreshPath = path.resolve('/app/node_modules/@remix-run/ui/src/dev/refresh.ts')

  it('matches the real package refresh export contracts', () => {
    assert.ok(
      remixPackageJson.exports?.['./ui/dev/refresh'] !== undefined,
      'Expected remix to export ./ui/dev/refresh',
    )
    assert.ok(
      uiPackageJson.exports?.['./dev/refresh'] !== undefined,
      'Expected @remix-run/ui to export ./dev/refresh',
    )
  })

  it('prefers the umbrella remix refresh module', async () => {
    let refreshSpecifier = await resolveComponentHmrRefreshSpecifier(importerPath, {
      isAllowed: () => true,
      resolverFactory: createResolverFactory({
        'remix/ui/dev/refresh': remixRefreshPath,
        '@remix-run/ui/dev/refresh': uiRefreshPath,
      }),
    })

    assert.equal(refreshSpecifier, 'remix/ui/dev/refresh')
  })

  it('falls back to the scoped UI refresh module', async () => {
    let refreshSpecifier = await resolveComponentHmrRefreshSpecifier(importerPath, {
      isAllowed: () => true,
      resolverFactory: createResolverFactory({
        '@remix-run/ui/dev/refresh': uiRefreshPath,
      }),
    })

    assert.equal(refreshSpecifier, '@remix-run/ui/dev/refresh')
  })

  it('returns null when no UI refresh module resolves', async () => {
    let refreshSpecifier = await resolveComponentHmrRefreshSpecifier(importerPath, {
      isAllowed: () => true,
      resolverFactory: createResolverFactory({}),
    })

    assert.equal(refreshSpecifier, null)
  })

  it('ignores refresh modules outside the allowed file set', async () => {
    let refreshSpecifier = await resolveComponentHmrRefreshSpecifier(importerPath, {
      isAllowed: (filePath) => filePath !== normalizeFilePath(remixRefreshPath),
      resolverFactory: createResolverFactory({
        'remix/ui/dev/refresh': remixRefreshPath,
        '@remix-run/ui/dev/refresh': uiRefreshPath,
      }),
    })

    assert.equal(refreshSpecifier, '@remix-run/ui/dev/refresh')
  })
})
