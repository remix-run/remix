import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { getPackageDependencies, packageNameToDirectoryName } from './packages.ts'
import { createPublishPlan } from './publish.ts'
import remix from '../../packages/remix/package.json' with { type: 'json' }

describe('native package publication', () => {
  it('keeps the facade and native payloads out of the umbrella dependencies', () => {
    assert.equal(
      Object.keys(remix.dependencies).some((name) => name.startsWith('@remix-run/uwebsockets-js')),
      false,
    )
    assert.equal(remix.dependencies['@remix-run/node-serve'], 'workspace:^')
    assert.equal(remix.exports['./node-serve'], './src/node-serve.ts')
  })

  it('publishes optional native packages before the facade and server', () => {
    let names = [
      '@remix-run/node-serve',
      '@remix-run/uwebsockets-js',
      '@remix-run/uwebsockets-js-darwin-arm64',
    ]
    let plan = createPublishPlan({
      packages: names.map((packageName) => ({ packageName, version: '0.1.0', tag: packageName })),
      prereleaseDirNames: new Set(),
      getDirectoryName: packageNameToDirectoryName,
      getDependencies: getPackageDependencies,
    })
    assert.deepEqual(
      plan.map((entry) => entry.packageName),
      names.toReversed(),
    )
  })
})
