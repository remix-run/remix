import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { resolveInjectedPackageJsonUrl } from './injected-packages.ts'

describe('resolveInjectedPackageJsonUrl', () => {
  it('uses an explicit resolver when provided', () => {
    let expectedUrl = 'file:///tmp/example/package.json'
    let resolved = resolveInjectedPackageJsonUrl('@oxc-project/runtime', () => expectedUrl)

    assert.equal(resolved, expectedUrl)
  })

  it('falls back to createRequire when import.meta.resolve is unavailable', () => {
    let resolved = resolveInjectedPackageJsonUrl('@oxc-project/runtime', undefined)
    let resolvedPath = fileURLToPath(resolved)

    assert.ok(resolved.startsWith('file:'))
    assert.ok(resolvedPath.endsWith('package.json'))
    assert.ok(fs.existsSync(resolvedPath))
  })
})
